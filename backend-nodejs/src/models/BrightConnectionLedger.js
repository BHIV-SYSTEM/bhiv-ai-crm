import mongoose from 'mongoose';

const brightConnectionLedgerSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'bright_connection_active_receivables',
    },
    report_id: { type: String, required: true },
    tenant_id: { type: String, required: true, default: 'tenant_bright_connection' },
    mdu_type: { type: String, default: 'receivable_ledger' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    validation: { type: mongoose.Schema.Types.Mixed, default: {} },
    total_customers: { type: Number, required: true, default: 0 },
    total_amount: { type: Number, required: true, default: 0 },
    customers: { type: [mongoose.Schema.Types.Mixed], default: [] },
    source_context: { type: mongoose.Schema.Types.Mixed, default: {} },
    transformed_at: { type: String },
  },
  { timestamps: true }
);

const BrightConnectionLedger =
  mongoose.models.BrightConnectionLedger ||
  mongoose.model('BrightConnectionLedger', brightConnectionLedgerSchema);

export default BrightConnectionLedger;

