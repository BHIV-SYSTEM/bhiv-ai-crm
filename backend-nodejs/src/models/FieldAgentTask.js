import mongoose from 'mongoose';

const coordinateSchema = new mongoose.Schema(
  {
    lat: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    lng: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
  },
  { _id: false }
);

const arrivalEvidenceSchema = new mongoose.Schema(
  {
    agentLocation: {
      type: coordinateSchema,
      required: true,
    },
    accuracyMeters: {
      type: Number,
      required: true,
      min: 0,
    },
    distanceMeters: {
      type: Number,
      required: true,
      min: 0,
    },
    radiusMeters: {
      type: Number,
      required: true,
      default: 50,
    },
    outcome: {
      type: String,
      enum: ['ARRIVAL_CONFIRMED'],
      required: true,
    },
    evaluatedAt: {
      type: Date,
      required: true,
    },
  },
  { _id: false }
);

const proofSchema = new mongoose.Schema(
  {
    proofId: {
      type: String,
      required: true,
    },
    fileReference: {
      type: String,
      required: true,
    },
    submittedAt: {
      type: Date,
      required: true,
    },
    reviewState: {
      type: String,
      enum: ['REVIEW_REQUIRED', 'VERIFIED', 'REJECTED'],
      default: 'REVIEW_REQUIRED',
    },
    ocrStatus: {
      type: String,
      enum: ['PENDING', 'COMPLETED', 'FAILED', 'NOT_CONFIGURED'],
      default: 'PENDING',
    },
    extractedFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: null,
    },
  },
  { _id: false }
);

const auditEventSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    eventType: {
      type: String,
      required: true,
    },
    previousState: {
      type: String,
      default: null,
    },
    currentState: {
      type: String,
      required: true,
    },
    occurredAt: {
      type: Date,
      required: true,
    },
    correlationId: {
      type: String,
      default: null,
    },
    details: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: false }
);

const FIELD_TASK_STATES = [
  'ASSIGNED',
  'ACCEPTED',
  'EN_ROUTE',
  'ARRIVED',
  'PROOF_SUBMITTED',
  'REVIEW_REQUIRED',
  'VERIFIED',
  'REJECTED',
  'COMPLETED',
];

const fieldAgentTaskSchema = new mongoose.Schema(
  {
    taskId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },

    tenantId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },

    assignedAgentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    store: {
      storeId: {
        type: String,
        required: true,
        trim: true,
      },
      name: {
        type: String,
        required: true,
        trim: true,
      },
      location: {
        type: coordinateSchema,
        required: true,
      },
    },

    state: {
      type: String,
      enum: FIELD_TASK_STATES,
      default: 'ASSIGNED',
      required: true,
      index: true,
    },

    arrivalEvidence: {
      type: arrivalEvidenceSchema,
      default: null,
    },

    proof: {
      type: proofSchema,
      default: null,
    },

    auditEvents: {
      type: [auditEventSchema],
      default: [],
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
    versionKey: '__v',
  }
);

fieldAgentTaskSchema.index({
  tenantId: 1,
  assignedAgentId: 1,
  state: 1,
});

const FieldAgentTask =
  mongoose.models.FieldAgentTask ||
  mongoose.model('FieldAgentTask', fieldAgentTaskSchema);

export { FIELD_TASK_STATES };
export default FieldAgentTask;