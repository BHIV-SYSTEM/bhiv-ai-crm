import assert from 'assert';
import { BrightConnectionConnector } from '../src/services/brightConnectionConnector.js';
import { FailureHandlerService } from '../src/services/failureHandlerService.js';

console.log('===============================================================');
console.log('   SETU Provenance & Bright Connection Connector (Node.js Test)');
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
  // Test 1: Product Catalog Transformation
  runTest('1: Product Catalog Transformation & Provenance Envelope', () => {
    const rawCatalog = [
      {
        sku: 'BC-HAMMER-01',
        name: 'Claw Hammer 16oz',
        category: 'Tools',
        price: 24.99,
        stock: 150,
        store_id: 'GODOWN-MUMBAI-01',
        store_name: 'Mumbai Central Depot',
        location: 'IN-MH-BOM',
      },
    ];

    const result = BrightConnectionConnector.transformProductCatalog(rawCatalog, 'sync_batch_99');

    assert.strictEqual(result.length, 1);
    const prod = result[0];

    assert.strictEqual(prod.mdu_type, 'product_catalog');
    assert.strictEqual(prod.tenant_id, 'tenant_bright_connection');
    assert.strictEqual(prod.sku, 'BC-HAMMER-01');
    assert.strictEqual(prod.price, 24.99);

    const ctx = prod.source_context;
    assert.ok(ctx, 'source_context must exist');
    assert.strictEqual(ctx.source_system, 'tally');
    assert.strictEqual(ctx.source_entity, 'product_catalog');
    assert.strictEqual(ctx.source_record_id, 'BC-HAMMER-01');
    assert.strictEqual(ctx.sync_id, 'sync_batch_99');
    assert.strictEqual(ctx.store_id, 'GODOWN-MUMBAI-01');
    assert.strictEqual(ctx.store_name, 'Mumbai Central Depot');
    assert.strictEqual(ctx.store_context_available, true);
    assert.ok(ctx.received_at, 'received_at timestamp required');

    assert.deepStrictEqual(prod.normalized_record, {
      sku: 'BC-HAMMER-01',
      name: 'Claw Hammer 16oz',
      category: 'Tools',
      price: 24.99,
      stock_quantity: 150,
    });
  });

  // Test 2: Order Payload Transformation
  runTest('2: Order Payload Transformation & Provenance Envelope', () => {
    const rawOrder = {
      order_id: 'ORD-2026-8841',
      customer_id: 'DEALER-440',
      shop_name: 'Sharma Hardware',
      total_amount: 1500.0,
      store_id: 'GODOWN-DELHI-02',
      items: [
        { product_id: 'BC-HAMMER-01', name: 'Claw Hammer', quantity: 20, unit_price: 25.0 },
      ],
    };

    const order = BrightConnectionConnector.transformOrderPayload(rawOrder, 'sync_batch_100');

    assert.strictEqual(order.mdu_type, 'order_record');
    assert.strictEqual(order.order_id, 'ORD-2026-8841');
    assert.strictEqual(order.dealer_id, 'DEALER-440');
    assert.strictEqual(order.dealer_name, 'Sharma Hardware');

    const ctx = order.source_context;
    assert.strictEqual(ctx.source_entity, 'order_record');
    assert.strictEqual(ctx.source_record_id, 'ORD-2026-8841');
    assert.strictEqual(ctx.store_id, 'GODOWN-DELHI-02');
    assert.strictEqual(ctx.store_context_available, true);
  });

  // Test 3: Field Visit Evidence Transformation
  runTest('3: Field Visit Evidence Transformation & Provenance Envelope', () => {
    const rawVisit = {
      visit_id: 'VIS-9912',
      beat_id: 'BEAT-WEST-04',
      dealer_id: 'D-551',
      submitted_by: 'AGENT-ALOK',
      lat: 19.076,
      lng: 72.8777,
      payment_collected: 5000.0,
    };

    const visit = BrightConnectionConnector.transformFieldVisitEvidence(rawVisit);

    assert.strictEqual(visit.mdu_type, 'field_visit_evidence');
    assert.strictEqual(visit.visit_id, 'VIS-9912');
    assert.strictEqual(visit.agent_id, 'AGENT-ALOK');
    assert.strictEqual(visit.location_proof.lat, 19.076);
    assert.strictEqual(visit.location_proof.lng, 72.8777);

    const ctx = visit.source_context;
    assert.strictEqual(ctx.source_entity, 'field_visit_evidence');
    assert.strictEqual(ctx.source_record_id, 'VIS-9912');
    assert.strictEqual(ctx.store_id, null);
    assert.strictEqual(ctx.store_context_available, false);
  });

  // Test 4: Failure Handler - Quarantine Policy (HTTP 202)
  await runAsyncTest('4: Failure Handler - Quarantine Policy (HTTP 202)', async () => {
    const result = await FailureHandlerService.handleMissingSourceContext(
      'trc_test_001',
      'tenant_bright_connection',
      ['connected_company_id', 'source_entity'],
      'quarantine'
    );

    assert.strictEqual(result.status_code, 202);
    assert.strictEqual(result.quarantined, true);
    assert.strictEqual(result.source_context_available, false);
    assert.deepStrictEqual(result.details.missing_context_fields, ['connected_company_id', 'source_entity']);
  });

  // Test 5: Failure Handler - Incomplete Policy (HTTP 202)
  await runAsyncTest('5: Failure Handler - Incomplete Policy (HTTP 202)', async () => {
    const result = await FailureHandlerService.handleMissingSourceContext(
      'trc_test_002',
      'tenant_bright_connection',
      ['received_at'],
      'incomplete'
    );

    assert.strictEqual(result.status_code, 202);
    assert.strictEqual(result.incomplete, true);
    assert.strictEqual(result.source_context_available, false);
  });

  // Test 6: Failure Handler - Reject Policy (HTTP 400)
  await runAsyncTest('6: Failure Handler - Hard Reject Policy (HTTP 400)', async () => {
    const result = await FailureHandlerService.handleMissingSourceContext(
      'trc_test_003',
      'tenant_bright_connection',
      ['source_system', 'connected_company_id'],
      'reject'
    );

    assert.strictEqual(result.status_code, 400);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'missing_source_context_rejected');
  });

  // Test 7: Failure Handler - Invalid Trace ID (HTTP 400)
  await runAsyncTest('7: Failure Handler - Invalid Trace ID (HTTP 400)', async () => {
    const result = await FailureHandlerService.handleInvalidTraceId('short', 'tenant_bright_connection');

    assert.strictEqual(result.status_code, 400);
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.error, 'invalid_trace_id');
  });

  console.log('\n===============================================================');
  console.log(`   Summary: ${passedTests} passed, ${failedTests} failed`);
  console.log('===============================================================\n');

  process.exit(failedTests > 0 ? 1 : 0);
}

executeTests();

