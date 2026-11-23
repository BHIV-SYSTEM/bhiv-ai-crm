import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import FieldAgentProofFile from '../../models/FieldAgentProofFile.js';

let sharpInstance = undefined;

async function getSharp() {
  if (sharpInstance !== undefined) return sharpInstance;
  try {
    const mod = await import('sharp');
    sharpInstance = mod.default || mod;
  } catch {
    sharpInstance = null;
  }
  return sharpInstance;
}

const SERVICE_DIR = path.dirname(fileURLToPath(import.meta.url));

const STORAGE_DIR = path.resolve(
  process.env.FIELD_AGENT_PROOF_STORAGE_DIR ||
    path.join(SERVICE_DIR, '../../../private-storage/field-agent-proofs'),
);

const MAX_FILE_SIZE = 5 * 1024 * 1024;

const IMAGE_SIGNATURES = [
  {
    mimeType: 'image/jpeg',
    extension: '.jpg',
    matches: (buffer) =>
      buffer.length >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff,
  },
  {
    mimeType: 'image/png',
    extension: '.png',
    matches: (buffer) =>
      buffer.length >= 8 &&
      buffer.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
  },
  {
    mimeType: 'image/webp',
    extension: '.webp',
    matches: (buffer) =>
      buffer.length >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP',
  },
];

function storageError(message, status = 400) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function identifyImage(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw storageError('An image file is required.');
  }

  if (buffer.length > MAX_FILE_SIZE) {
    throw storageError('Image must not exceed 5 MB.', 413);
  }

  const image = IMAGE_SIGNATURES.find((item) => item.matches(buffer));

  if (!image) {
    throw storageError('Only valid JPEG, PNG, and WebP images are accepted.');
  }

  const sharp = await getSharp();

  if (sharp) {
    let metadata;

    try {
      metadata = await sharp(buffer, {
        failOn: 'error',
        limitInputPixels: 40000000,
      }).metadata();

      if (
        !metadata.width ||
        !metadata.height ||
        metadata.width > 10000 ||
        metadata.height > 10000 ||
        !['jpeg', 'png', 'webp'].includes(metadata.format)
      ) {
        throw new Error('Unsupported or invalid image dimensions or format.');
      }
    } catch {
      throw storageError('The uploaded file is not a valid, decodable image.');
    }

    if (
      metadata.format !==
      ({ 'image/jpeg': 'jpeg', 'image/png': 'png', 'image/webp': 'webp' }[
        image.mimeType
      ])
    ) {
      throw storageError('Image content does not match its file signature.');
    }
  } else {
    // Pure buffer fallback when sharp native binary is not installed on runtime OS
    if (image.mimeType === 'image/png') {
      if (buffer.length < 24 || !buffer.subarray(12, 16).equals(Buffer.from('IHDR'))) {
        throw storageError('The uploaded file is not a valid, decodable image.');
      }
    }
  }

  return image;
}

export async function storeProofImage(buffer) {
  const image = await identifyImage(buffer);
  const proofReferenceId = crypto.randomUUID();
  const fileReference = `proof:${proofReferenceId}`;
  const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
  const filename = `${proofReferenceId}${image.extension}`;
  const filePath = path.join(STORAGE_DIR, filename);

  let savedToMongo = false;
  if (mongoose.connection.readyState === 1) {
    await FieldAgentProofFile.create({
      fileReference,
      mimeType: image.mimeType,
      sizeBytes: buffer.length,
      sha256,
      data: buffer,
    });
    savedToMongo = true;
  }

  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true, mode: 0o700 });
    await fs.writeFile(filePath, buffer, {
      flag: 'wx',
      mode: 0o600,
    });
  } catch (error) {
    if (!savedToMongo) {
      throw storageError(
        error.code === 'EEXIST'
          ? 'Could not allocate a unique proof file.'
          : 'Could not store the proof image.',
        500,
      );
    }
  }

  return {
    fileReference,
    mimeType: image.mimeType,
    sizeBytes: buffer.length,
    sha256,
  };
}

export async function deleteProofImage(fileReference) {
  if (
    typeof fileReference !== 'string' ||
    !/^proof:[0-9a-f-]{36}$/i.test(fileReference)
  ) {
    throw storageError('Invalid application-managed proof reference.');
  }

  let deleted = false;
  if (mongoose.connection.readyState === 1) {
    const res = await FieldAgentProofFile.deleteOne({ fileReference });
    if (res.deletedCount > 0) deleted = true;
  }

  const proofReferenceId = fileReference.slice('proof:'.length);
  const candidates = ['.jpg', '.png', '.webp'];

  for (const extension of candidates) {
    const filePath = path.join(STORAGE_DIR, `${proofReferenceId}${extension}`);

    try {
      await fs.unlink(filePath);
      deleted = true;
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw storageError('Could not remove the stored proof image.', 500);
      }
    }
  }

  return deleted;
}

export async function getProofImage(fileReference) {
  if (
    typeof fileReference !== 'string' ||
    !/^proof:[0-9a-f-]{36}$/i.test(fileReference)
  ) {
    throw storageError('Invalid application-managed proof reference.', 400);
  }

  // Prefer MongoDB when connected so proof images work identically across local & deployed servers
  if (mongoose.connection.readyState === 1) {
    const doc = await FieldAgentProofFile.findOne({ fileReference }).lean();
    if (doc?.data) {
      const buffer = Buffer.isBuffer(doc.data)
        ? doc.data
        : Buffer.from(doc.data.buffer || doc.data);
      return { buffer, mimeType: doc.mimeType || 'image/jpeg' };
    }
  }

  const proofReferenceId = fileReference.slice('proof:'.length);
  const candidates = [
    { ext: '.jpg', mimeType: 'image/jpeg' },
    { ext: '.png', mimeType: 'image/png' },
    { ext: '.webp', mimeType: 'image/webp' },
  ];

  for (const { ext, mimeType } of candidates) {
    const filePath = path.join(STORAGE_DIR, `${proofReferenceId}${ext}`);
    try {
      const buffer = await fs.readFile(filePath);
      return { buffer, mimeType };
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw storageError('Could not read stored proof image.', 500);
      }
    }
  }

  throw storageError('Stored proof image was not found.', 404);
}

export default {
  storeProofImage,
  deleteProofImage,
  getProofImage,
};


