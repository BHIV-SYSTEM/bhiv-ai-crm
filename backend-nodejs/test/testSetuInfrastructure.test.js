import assert from 'assert';
import { DependencyGraphEngine } from '../src/services/dependencyGraphEngine.js';
import { BucketLineageAdapter } from '../src/services/bucketLineageAdapter.js';
import { TelemetryService } from '../src/services/telemetryService.js';
import { SovereignRoutingAdapter } from '../src/services/sovereignRoutingAdapter.js';
import { NiyantranAdapter } from '../src/services/niyantranAdapter.js';
import { UiVisibilityService } from '../src/services/uiVisibilityService.js';

console.log('===============================================================');
console.log('   SETU Infrastructure Engine Suite (Node.js Test)');
console.log('===============================================================\n');

let passedTests = 0;
let failedTests = 0;

function runTest(name, fn) {
  try {
    fn();
    console.log(`  [PASS] Test ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  [FAIL] Test ${name}:`, err.message);
    failedTests++;
  }
}

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
  // Test 1: Dependency Graph DAG Construction & Blockage Propagation
  runTest('1: DAG Graph Construction & Downstream Blockage Propagation', () => {
    const graph = new DependencyGraphEngine();
    graph.addDependency('node_a', 'node_b');
    graph.addDependency('node_b', 'node_c');

    const downstream = graph.getDownstream('node_a');
    assert.deepStrictEqual(downstream.sort(), ['node_b', 'node_c'].sort());

    const updates = graph.propagateBlockage('node_a', 'upstream_contract_failed');
    assert.strictEqual(updates.length, 3);
    assert.strictEqual(graph.nodes.get('node_c').status, 'blocked');
    assert.strictEqual(graph.nodes.get('node_c').metadata.blocked_by, 'node_a');
  });

  // Test 2: Bucket Lineage Event Emission & Determinism Hash
  await runAsyncTest('2: Bucket Lineage Event Emission & Determinism Hash', async () => {
    const execution = {
      execution_id: 'exec_lineage_001',
      trace_id: 'trc_lineage_999',
      tenant_id: 'tenant_bright',
      timestamp: '2026-08-25T12:00:00.000Z',
    };

    const event = await BucketLineageAdapter.emitExecutionEvent(execution, 'execution_started', { step: 1 }, { sequence: 1 });

    assert.ok(event.lineage_event_id.startsWith('lin_'));
    assert.strictEqual(event.sequence, 1);
    assert.ok(event.determinism_hash, 'Determinism SHA-256 hash required');

    const history = await BucketLineageAdapter.verifyExecutionHistory('exec_lineage_001', 'trc_lineage_999');
    assert.strictEqual(history.trace_id, 'trc_lineage_999');
  });

  // Test 3: Telemetry Service Event Emission & Validation
  await runAsyncTest('3: Telemetry Service Event Emission & Validation', async () => {
    const execution = {
      execution_id: 'exec_tel_002',
      trace_id: 'trc_tel_888',
      tenant_id: 'tenant_bright',
    };

    const telEvent = await TelemetryService.emitExecutionStarted(execution, { component: 'connector' });

    assert.strictEqual(telEvent.event_type, 'execution_started');
    assert.strictEqual(telEvent.execution_id, 'exec_tel_002');
    assert.ok(telEvent.telemetry_id.startsWith('tel_'));

    // Test unsupported type failure assertion
    let caughtError = false;
    try {
      await TelemetryService.emit({
        execution_id: 'exec_1',
        trace_id: 'trc_1',
        tenant_id: 't_1',
        timestamp: '2026-08-25T12:00:00Z',
        event_type: 'invalid_event_type',
      });
    } catch (err) {
      caughtError = true;
      assert.ok(err.message.includes('Unsupported telemetry type'));
    }
    assert.strictEqual(caughtError, true, 'Must reject unsupported telemetry event_type');
  });

  // Test 4: Sovereign Routing Adapter & Gated Bridge Validation
  runTest('4: Sovereign Routing Adapter & Gated Bridge Validation', () => {
    const validExecution = {
      execution_id: 'exec_sov_001',
      trace_id: 'trc_sov_001',
      source_system: 'tally',
      actor: 'agent_alok',
      intent_type: 'sync_stock',
      target_system: 'setu',
      parameters: { sku: 'BC-HAMMER-01' },
      priority: 1,
      timestamp: '2026-08-25T12:00:00Z',
      schema_version: '1.0',
      tenant_id: 'tenant_bright',
      governance: {
        gated_bridge: {
          status: 'approved',
          attestation_id: 'att_9912',
          policy_id: 'pol_sovereign_01',
          policy_version: '1.0',
          checked_at: '2026-08-25T12:00:00Z',
        },
      },
    };

    const gatedResult = SovereignRoutingAdapter.validateGatedBridge(validExecution);
    assert.strictEqual(gatedResult.ok, true);

    const sarathiPayload = SovereignRoutingAdapter.buildSarathiPayload(validExecution);
    assert.strictEqual(sarathiPayload.sarathi_version, '1.0');
    assert.strictEqual(sarathiPayload.execution_id, 'exec_sov_001');
  });

  // Test 5: Niyantran Task State Consumption & UI Candidate Visibility
  await runAsyncTest('5: Niyantran Task State Consumption & UI Candidate Visibility', async () => {
    const taskState = {
      task_id: 'task_niyantran_01',
      trace_id: 'trc_vis_777',
      tenant_id: 'tenant_bright',
      state: 'COMPLETED',
      timestamp: '2026-08-25T12:05:00.000Z',
    };

    const consumeRes = await NiyantranAdapter.consumeTaskState(taskState);
    assert.strictEqual(consumeRes.success, true);

    const candidateState = await UiVisibilityService.getCandidateState('trc_vis_777');
    assert.strictEqual(candidateState.trace_id, 'trc_vis_777');
  });

  console.log('\n===============================================================');
  console.log(`   Summary: ${passedTests} passed, ${failedTests} failed`);
  console.log('===============================================================\n');

  process.exit(failedTests > 0 ? 1 : 0);
}

executeTests();
