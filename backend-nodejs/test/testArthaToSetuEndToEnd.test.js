import assert from 'assert';
// Load the same .env the server loads, so this test presents the same
// SETU_INTEGRATION_API_KEY credential the running backend expects.
import 'dotenv/config';

/**
 * testArthaToSetuEndToEnd.test.js — End-to-End Integration Test (Artha -> SETU Node.js Backend)
 *
 * Simulates a full Artha compliance signal pipeline dispatch (SIG_GST_MISMATCH & SIG_FILING_GENERATED)
 * dispatched over HTTP to the running Node.js SETU Backend at http://localhost:8000/setu/signals/ingest.
 */

const SETU_BASE_URL = process.env.SETU_BASE_URL || 'http://localhost:8000';

console.log('===============================================================');
console.log('   End-to-End Integration Test: AI-Artha ---> SETU (Node.js)');
console.log('===============================================================\n');

async function testArthaSignalDispatch(signalName, payload) {
  console.log(`📡 [Artha Dispatch] Sending ${signalName} to SETU...`);

  // SETU requires a machine credential: /setu rejects anonymous callers.
  const headers = {
    'Content-Type': 'application/json',
    'x-trace-id': payload.trace_id,
    'x-tenant-id': payload.tenant_id,
  };
  const apiKey = process.env.SETU_INTEGRATION_API_KEY || 'dev-setu-integration-key-2026';
  headers['X-SETU-API-Key'] = apiKey;

  const response = await fetch(`${SETU_BASE_URL}/setu/signals/ingest`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  const resJson = await response.json();
  console.log(`   [SETU Response Status]: ${response.status}`);
  console.log(`   [SETU Response Body]:`, JSON.stringify(resJson, null, 2));

  assert.ok(response.status === 200 || response.status === 202, `Expected HTTP 200 or 202, got ${response.status}`);
  assert.ok(resJson.success, 'Expected success: true');
  assert.ok(resJson.trace_id === payload.trace_id, 'trace_id must match');
  if (resJson.ingestion_id) {
    assert.ok(resJson.ingestion_id.startsWith('ing_'), 'ingestion_id must start with ing_');
  }

  console.log(`  [PASS] ${signalName} successfully processed by SETU!\n`);
}

async function runEndToEndTests() {
  try {
    // 1. Dispatch Artha GST Mismatch Compliance Signal
    const traceId1 = `trc_artha_gst_${Date.now()}`;
    const arthaGstSignal = {
      trace_id: traceId1,
      entity_id: 'INV-ARTHA-2026-0881',
      event_type: 'SIG_GST_MISMATCH',
      signal_type: 'compliance_tax',
      severity: 'HIGH',
      timestamp: new Date().toISOString(),
      tenant_id: 'tenant_artha_finance',
      payload: {
        signal_id: 'SIG_GST_MISMATCH',
        trace_id: traceId1,
        source: {
          system: 'artha',
          module: 'GST_ENGINE',
          entity_type: 'INVOICE',
          entity_id: 'INV-ARTHA-2026-0881',
        },
        severity: 'HIGH',
        context: {
          expected_tax: 180.0,
          actual_tax: 200.0,
          variance: 20.0,
          invoice_number: 'INV-ARTHA-2026-0881',
        },
        recommendation: {
          code: 'REC_GST_ADJUST',
          message: 'GST mismatch detected. Adjust tax credit filing.',
        },
      },
      source_context: {
        source_system: 'artha',
        connected_company_id: 'artha_comp_001',
        connected_company_name: 'AI Artha Compliance',
        store_id: null,
        store_name: null,
        location_identifier: 'IN-DL-NDL',
        store_context_available: false,
        source_entity: 'INVOICE',
        source_record_id: 'INV-ARTHA-2026-0881',
        source_timestamp: new Date().toISOString(),
        received_at: new Date().toISOString(),
        sync_id: `sync_artha_${Date.now()}`,
      },
    };

    await testArthaSignalDispatch('Artha GST Mismatch Signal (SIG_GST_MISMATCH)', arthaGstSignal);

    // 2. Dispatch Artha Compliance Filing Generated Signal
    const traceId2 = `trc_artha_filing_${Date.now()}`;
    const arthaFilingSignal = {
      trace_id: traceId2,
      entity_id: 'FILING-GSTR1-202608',
      event_type: 'SIG_FILING_GENERATED',
      signal_type: 'compliance_filing',
      severity: 'LOW',
      timestamp: new Date().toISOString(),
      tenant_id: 'tenant_artha_finance',
      payload: {
        signal_id: 'SIG_FILING_GENERATED',
        trace_id: traceId2,
        source: {
          system: 'artha',
          module: 'COMPLIANCE_FILING',
          entity_type: 'COMPLIANCE_FILING',
          entity_id: 'FILING-GSTR1-202608',
        },
        severity: 'LOW',
        context: {
          filing_type: 'GSTR1',
          period: '2026-08',
          ready_for_submission: true,
        },
        recommendation: {
          code: 'REC_REVIEW_FILING',
          message: 'Filing packet generated. Review before submission.',
        },
      },
      source_context: {
        source_system: 'artha',
        connected_company_id: 'artha_comp_001',
        connected_company_name: 'AI Artha Compliance',
        store_id: null,
        store_name: null,
        location_identifier: null,
        store_context_available: false,
        source_entity: 'COMPLIANCE_FILING',
        source_record_id: 'FILING-GSTR1-202608',
        source_timestamp: new Date().toISOString(),
        received_at: new Date().toISOString(),
        sync_id: null,
      },
    };

    await testArthaSignalDispatch('Artha Compliance Filing Signal (SIG_FILING_GENERATED)', arthaFilingSignal);

    // 3. Query Candidate Visibility for Trace 1
    console.log(`🔍 [Visibility Check] Querying UI candidate state for ${traceId1}...`);
    const visHeaders = {
      'X-SETU-API-Key': process.env.SETU_INTEGRATION_API_KEY || 'dev-setu-integration-key-2026',
    };
    const visResponse = await fetch(`${SETU_BASE_URL}/setu/visibility/candidate/${traceId1}`, {
      headers: visHeaders,
    });
    const visJson = await visResponse.json();
    console.log(`   [Visibility Response]:`, JSON.stringify(visJson, null, 2));
    assert.strictEqual(visJson.trace_id, traceId1);
    console.log(`  [PASS] UI Candidate Visibility state verified!\n`);

    console.log('===============================================================');
    console.log('🎉 FULL END-TO-END ARTHA ---> SETU INTEGRATION TEST PASSED! 🎉');
    console.log('===============================================================\n');

    
  } catch (err) {
    console.error('❌ End-to-End Test Failed:', err.message);
    process.exit(1);
  }
}

runEndToEndTests();
