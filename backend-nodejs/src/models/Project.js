import mongoose from 'mongoose';

// Project Schema
const projectSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: { type: String, default: '' },
  status: { type: String, default: 'ACTIVE' },
  created_at: { type: String, default: () => new Date().toISOString() }
}, { timestamps: true });

// Milestone Schema
const milestoneSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  project_id: { type: String, required: true, index: true },
  description: { type: String, default: '' },
  status: { type: String, default: 'IN_PROGRESS' }
}, { timestamps: true });

// Task Schema
const taskSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  project_id: { type: String, required: true, index: true },
  milestone_id: { type: String, default: null },
  description: { type: String, default: '' },
  dependencies: { type: [String], default: [] },
  state: { type: String, default: 'PENDING' },
  created_at: { type: String, default: () => new Date().toISOString() },
  updated_at: { type: String, default: () => new Date().toISOString() }
}, { timestamps: true });

// Assignment Schema
const assignmentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  task_id: { type: String, required: true, index: true },
  resource_id: { type: String, required: true },
  assigned_at: { type: String, default: () => new Date().toISOString() }
}, { timestamps: true });

export const Project = mongoose.models.Project || mongoose.model('Project', projectSchema);
export const Milestone = mongoose.models.Milestone || mongoose.model('Milestone', milestoneSchema);
export const Task = mongoose.models.Task || mongoose.model('Task', taskSchema);
export const Assignment = mongoose.models.Assignment || mongoose.model('Assignment', assignmentSchema);
