/**
 * dependencyGraphEngine.js — SETU Dependency Graph Engine (Node.js Edition)
 *
 * Directed Acyclic Graph (DAG) manager for signal prerequisite resolution,
 * downstream blockage propagation, and node status management.
 */

export class DependencyGraphEngine {
  constructor() {
    this.nodes = new Map();
    this.dependencies = new Map(); // prerequisite_id -> Set of dependent_ids
    this.reverseDependencies = new Map(); // dependent_id -> Set of prerequisite_ids
  }

  /**
   * Add or update a node in the graph
   * @param {Object} node - Node object containing at least `id`
   * @returns {Object} Normalized node object
   */
  addNode(node) {
    if (!node || !node.id) {
      throw new Error('Node id is required');
    }

    const existing = this.nodes.get(node.id) || {};
    const normalized = {
      id: node.id,
      status: node.status || existing.status || 'pending',
      impact_weight: node.impact_weight !== undefined ? node.impact_weight : (existing.impact_weight !== undefined ? existing.impact_weight : 1),
      tenant_id: node.tenant_id || existing.tenant_id || null,
      metadata: node.metadata || existing.metadata || {},
    };

    this.nodes.set(node.id, normalized);
    if (!this.dependencies.has(node.id)) {
      this.dependencies.set(node.id, new Set());
    }
    if (!this.reverseDependencies.has(node.id)) {
      this.reverseDependencies.set(node.id, new Set());
    }

    return normalized;
  }

  /**
   * Add a dependency edge between prerequisite and dependent nodes
   * @param {string} prerequisiteId
   * @param {string} dependentId
   */
  addDependency(prerequisiteId, dependentId) {
    this.addNode({ id: prerequisiteId });
    this.addNode({ id: dependentId });

    this.dependencies.get(prerequisiteId).add(dependentId);
    this.reverseDependencies.get(dependentId).add(prerequisiteId);
  }

  /**
   * Traverse downstream nodes from a starting node ID
   * @param {string} startId
   * @returns {Array<string>} List of downstream node IDs
   */
  getDownstream(startId) {
    const visited = new Set();
    const queue = [startId];

    while (queue.length > 0) {
      const current = queue.shift();
      const dependents = this.dependencies.get(current) || new Set();

      for (const nextId of dependents) {
        if (!visited.has(nextId)) {
          visited.add(nextId);
          queue.push(nextId);
        }
      }
    }

    return Array.from(visited);
  }

  /**
   * Traverse upstream prerequisite nodes from a starting node ID
   * @param {string} startId
   * @returns {Array<string>} List of upstream node IDs
   */
  getUpstream(startId) {
    const visited = new Set();
    const queue = [startId];

    while (queue.length > 0) {
      const current = queue.shift();
      const prerequisites = this.reverseDependencies.get(current) || new Set();

      for (const prevId of prerequisites) {
        if (!visited.has(prevId)) {
          visited.add(prevId);
          queue.push(prevId);
        }
      }
    }

    return Array.from(visited);
  }

  /**
   * Propagate blockage downstream when a prerequisite node fails or blocks
   * @param {string} startId
   * @param {string} reason
   * @returns {Array<Object>} Updated node objects
   */
  propagateBlockage(startId, reason = 'blocked') {
    const impactedIds = [startId, ...this.getDownstream(startId)];
    const updates = [];

    for (const nodeId of impactedIds) {
      const node = this.nodes.get(nodeId);
      if (!node) continue;

      node.status = 'blocked';
      node.metadata = node.metadata || {};
      node.metadata.blocked_reason = reason;
      node.metadata.blocked_by = startId;
      updates.push(node);
    }

    return updates;
  }
}

export default DependencyGraphEngine;
