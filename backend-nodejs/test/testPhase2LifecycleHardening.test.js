import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { ReplayRegistry } from '../src/services/replayRegistry.js';
import { FailureHandlerService } from '../src/services/failureHandlerService.js';

const STATE_DIR = path.join(process.cwd(), '.phase2-state');
const STATE_FILE = path.join(STATE_DIR, 'replay_registry.json');

function resetState() {
    fs.mkdirSync(STATE_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify({ registry: [], replay_history: [] }, null, 2));
}

test('replay registry preserves idempotency and integrity hash', async () => {
    resetState();
    const baseRecord = {
        tenant_id: 'tenant_bright_connection_001',
        trace_id: 'trc_phase2_replay_001',
        entity_id: 'entity_phase2_001',
        source_connector: 'bright_connection',
        schema_version: '1.0',
        idempotency_key: 'idem_phase2_001',
        payload: { product_id: 'BC-HAMMER-01', qty: 2 },
    };

    const first = await ReplayRegistry.registerCanonicalRecord(baseRecord);
    const second = await ReplayRegistry.registerCanonicalRecord(baseRecord);

    assert.equal(first.duplicate, false);
    assert.equal(second.duplicate, true);
    assert.equal(first.integrity_hash, second.integrity_hash);
    assert.equal((await ReplayRegistry.getRegistry()).registry.length, 1);
});

test('replay registry persists to disk across simulated restart', async () => {
    resetState();
    const record = {
        tenant_id: 'tenant_bright_connection_002',
        trace_id: 'trc_phase2_persist_001',
        entity_id: 'entity_phase2_002',
        source_connector: 'bright_connection',
        schema_version: '1.0',
        idempotency_key: 'idem_phase2_persist_001',
        payload: { product_id: 'BC-HAMMER-02', qty: 1 },
    };

    const first = await ReplayRegistry.registerCanonicalRecord(record);
    assert.ok(first.persisted_to_disk);

    const reloaded = await ReplayRegistry.loadRegistry();
    assert.equal(reloaded.registry.length, 1);
    assert.equal(reloaded.registry[0].trace_id, record.trace_id);
});

test('failure handler captures a real rejection path and tenant isolation guard', async () => {
    const failure = await FailureHandlerService.handleMissingSourceContext(
        'trc_phase2_failure_001',
        'tenant_bright_connection_001',
        ['connected_company_id', 'source_entity'],
        'reject'
    );

    assert.equal(failure.status_code, 400);
    assert.equal(failure.error, 'missing_source_context_rejected');
    assert.equal(failure.success, false);

    const tenantGuard = await FailureHandlerService.handleUnauthorizedTenant(
        'tenant_bright_connection_999',
        'trc_phase2_failure_001',
        'Cross-tenant access rejected'
    );

    assert.equal(tenantGuard.status_code, 403);
    assert.equal(tenantGuard.error, 'unauthorized_tenant');
});

test('replay execution reports original ingestion and deterministic replay hash', async () => {
    resetState();
    const original = {
        tenant_id: 'tenant_bright_connection_001',
        trace_id: 'trc_phase2_replay_exec_001',
        entity_id: 'entity_phase2_exec_001',
        source_connector: 'bright_connection',
        schema_version: '1.0',
        idempotency_key: 'idem_phase2_exec_001',
        payload: { product_id: 'BC-HAMMER-03', qty: 3 },
    };

    const emitted = await ReplayRegistry.registerCanonicalRecord(original);
    const replay = await ReplayRegistry.registerReplayExecution(emitted.trace_id, 'replay_exec_001');

    assert.equal(replay.original_ingestion_present, true);
    assert.equal(replay.replay_registered, true);
    assert.equal(replay.integrity_hash, emitted.integrity_hash);
    assert.equal(replay.duplicate_guard, false);
});
