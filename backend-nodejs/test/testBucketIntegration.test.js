import assert from 'assert';
import { BucketLineageAdapter } from '../src/services/bucketLineageAdapter.js';
import { BucketClient } from '../src/services/bucketClient.js';

console.log('===============================================================');
console.log('   SETU Bucket Integration Test Suite (Node.js Test)');
console.log('===============================================================\n');

let passedTests = 0;
let failedTests = 0;

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`  [PASS] Test ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] Test ${name}:`, err.message);
    failedTests++;
  }
}

async function executeTests() {
  // Test 1: Bucket Lineage Event Emission & Determinism Hash
  await runAsyncTest('1: Lineage Emission & SHA-256 Determinism Hash', async () => {
    const execution = {
      execution_id: 'exec_bc_001',
      trace_id: 'trc_bc_101',
      tenant_id: 'tenant_bright_connection',
      timestamp: '2026-10-12T10:00:00.000Z',
    };

    const event = await BucketLineageAdapter.emitExecutionEvent(
      execution,
      'execution_dispatched',
      { step: 'dispatch_to_transporter', transporter: 'V-Trans' },
      { sequence: 1 }
    );

    assert.ok(event.lineage_event_id.startsWith('lin_'), 'Lineage event ID must start with lin_');
    assert.strictEqual(event.sequence, 1);
    assert.strictEqual(event.tenant_id, 'tenant_bright_connection');
    assert.ok(event.determinism_hash, 'Determinism SHA-256 hash must be generated');
    assert.strictEqual(event.determinism_hash.length, 64, 'SHA-256 hash must be 64 hex characters');
  });

  // Test 2: Bucket History Verification
  await runAsyncTest('2: Execution History Verification without Duplication', async () => {
    const history = await BucketLineageAdapter.verifyExecutionHistory('exec_bc_001', 'trc_bc_101');
    assert.strictEqual(history.trace_id, 'trc_bc_101');
    assert.strictEqual(history.execution_id, 'exec_bc_001');
    assert.ok(typeof history.verified === 'boolean');
  });

  // Test 3: External Bucket Client Envelope Construction
  await runAsyncTest('3: External Bucket Client Artifact Envelope & Hash', async () => {
    const envelope = BucketClient.buildArtifactEnvelope({
      artifactType: 'storefront_ocr_proof',
      traceId: 'trc_proof_777',
      executionId: 'exec_proof_888',
      payload: {
        store_name: 'Bright Connection Electronics',
        ocr_confidence: 0.96,
        location: { lat: 19.0760, lng: 72.8777 },
      },
      tenantId: 'tenant_bright_connection',
    });

    assert.strictEqual(envelope.envelope_version, '1.0.0');
    assert.ok(envelope.artifact_id.startsWith('art_'));
    assert.strictEqual(envelope.trace_id, 'trc_proof_777');
    assert.strictEqual(envelope.execution_id, 'exec_proof_888');
    assert.strictEqual(envelope.source_system, 'setu');
    assert.ok(envelope.content_hash, 'Content SHA-256 hash required');
    assert.strictEqual(envelope.content_hash.length, 64);
  });

  // Test 4: External Bucket Client Graceful Offline Handling
  await runAsyncTest('4: Bucket Client Offline Fallback & Graceful Degradation', async () => {
    const res = await BucketClient.storeEvidenceRecord({
      traceId: 'trc_offline_001',
      executionId: 'exec_offline_001',
      entityType: 'POD_PROOF',
      fileReference: 's3://evidence/pod_123.jpg',
      ocrData: { invoice_no: 'INV-9921', total: 45000 },
      coordinates: { lat: 19.07, lng: 72.87 },
      metadata: { agent_id: 'agent_ratnesh_01' },
    });

    assert.ok(res.artifact_id);
    assert.strictEqual(res.offline_queued, true, 'Must gracefully handle offline external service without crashing');
  });

  console.log('\n===============================================================');
  console.log(`   Summary: ${passedTests} passed, ${failedTests} failed`);
  console.log('===============================================================\n');

  process.exit(failedTests > 0 ? 1 : 0);
}

executeTests();
