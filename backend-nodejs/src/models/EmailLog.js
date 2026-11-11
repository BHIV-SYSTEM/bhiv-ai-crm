import mongoose from 'mongoose';

const emailLogSchema = new mongoose.Schema({
  recipient: {
    type: String,
    required: true,
    trim: true
  },
  subject: {
    type: String,
    required: true
  },
  emailType: {
    type: String,
    enum: ['restock', 'purchase', 'shipment', 'delay', 'supplier', 'general'],
    default: 'general'
  },
  status: {
    type: String,
    enum: ['sent', 'failed', 'pending'],
    default: 'sent'
  },
  messageId: {
    type: String
  },
  error: {
    type: String
  }
}, {
  timestamps: true
});

const EmailLog = mongoose.model('EmailLog', emailLogSchema);

export default EmailLog;
