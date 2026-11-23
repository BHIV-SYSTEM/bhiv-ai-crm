import mongoose from 'mongoose';

const fieldAgentProofFileSchema = new mongoose.Schema(
  {
    fileReference: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      enum: ['image/jpeg', 'image/png', 'image/webp'],
    },
    sizeBytes: {
      type: Number,
      required: true,
    },
    sha256: {
      type: String,
      required: true,
    },
    data: {
      type: Buffer,
      required: true,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

const FieldAgentProofFile =
  mongoose.models.FieldAgentProofFile ||
  mongoose.model('FieldAgentProofFile', fieldAgentProofFileSchema);

export default FieldAgentProofFile;

