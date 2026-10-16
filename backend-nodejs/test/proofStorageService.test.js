import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';

const testStorageDir = await fs.mkdtemp(
  path.join(os.tmpdir(), 'setu-proof-storage-test-'),
);

process.env.FIELD_AGENT_PROOF_STORAGE_DIR = testStorageDir;

const {
  storeProofImage,
  deleteProofImage,
  getProofImage,
} = await import('../src/services/fieldAgent/proofStorageService.js');

const validPng = await sharp({
  create: {
    width: 2,
    height: 2,
    channels: 3,
    background: { r: 255, g: 255, b: 255 },
  },
})
  .png()
  .toBuffer();

test('stores an accepted PNG and returns an opaque reference and SHA-256', async () => {
  const result = await storeProofImage(validPng);

  assert.match(result.fileReference, /^proof:[0-9a-f-]{36}$/i);
  assert.equal(result.mimeType, 'image/png');
  assert.equal(result.sizeBytes, validPng.length);
  assert.equal(
    result.sha256,
    crypto.createHash('sha256').update(validPng).digest('hex'),
  );

  const proofId = result.fileReference.slice('proof:'.length);
  const storedPath = path.join(testStorageDir, `${proofId}.png`);
  const storedBytes = await fs.readFile(storedPath);

  assert.deepEqual(storedBytes, validPng);
});

test('rejects content without an accepted image signature', async () => {
  await assert.rejects(
    storeProofImage(Buffer.from('this is not an image')),
    /Only valid JPEG, PNG, and WebP images are accepted/,
  );
});

test('rejects a fake PNG with a valid signature but invalid image content', async () => {
  const fakePng = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from('this is not a real PNG image'),
  ]);

  await assert.rejects(
    storeProofImage(fakePng),
    /not a valid, decodable image/,
  );
});
test('rejects images larger than 5 MB', async () => {
  const oversized = Buffer.alloc(5 * 1024 * 1024 + 1);
  await assert.rejects(
    storeProofImage(oversized),
    (error) => error.status === 413,
  );
});

test('deletes a stored proof using its generated reference', async () => {
  const result = await storeProofImage(validPng);
  const proofId = result.fileReference.slice('proof:'.length);
  const storedPath = path.join(testStorageDir, `${proofId}.png`);

  assert.equal(await deleteProofImage(result.fileReference), true);
  await assert.rejects(fs.access(storedPath), { code: 'ENOENT' });
});

test('rejects invalid references during deletion', async () => {
  await assert.rejects(
    deleteProofImage('../private-file'),
    /Invalid application-managed proof reference/,
  );
});

test('retrieves a stored proof image with correct buffer and mimeType', async () => {
  const stored = await storeProofImage(validPng);
  const retrieved = await getProofImage(stored.fileReference);

  assert.equal(retrieved.mimeType, 'image/png');
  assert.deepEqual(retrieved.buffer, validPng);
});

test('rejects missing or invalid proof reference on retrieval', async () => {
  await assert.rejects(
    getProofImage('not-a-valid-proof-ref'),
    /Invalid application-managed proof reference/,
  );
  await assert.rejects(
    getProofImage('proof:00000000-0000-0000-0000-000000000000'),
    /Stored proof image was not found/,
  );
});

test.after(async () => {
  await fs.rm(testStorageDir, { recursive: true, force: true });
});


