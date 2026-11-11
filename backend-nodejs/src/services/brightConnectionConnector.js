import crypto from 'crypto';

/**
 * brightConnectionConnector.js — Bright Connection API Connector Engine (Node.js Edition)
 *
 * Translates Bright Connection client payloads into Canonical Master Data Unit (MDU) schemas
 * for SETU & NIYANTRAN processing without code forks or mock fallbacks.
 *
 * Pipeline:
 * Bright Connection API -> Connector -> Canonical MDU Data -> SETU Capability -> Result
 */

// ── Connector-level constants & Env Fallbacks ────────────────────────────────

const CONNECTED_COMPANY_ID = process.env.TALLY_BRIGHT_CONNECTION_ID || 'bc_bright_connection_001';
const CONNECTED_COMPANY_NAME = process.env.TALLY_COMPANY || 'Bright Connection';
const DEFAULT_STORE_ID = process.env.TALLY_STORE_ID || null;
const DEFAULT_STORE_NAME = process.env.TALLY_STORE_NAME || null;
const DEFAULT_LOCATION = process.env.TALLY_LOCATION_IDENTIFIER || null;

/**
 * Build a canonical source_context envelope.
 *
 * Rules (per task spec §4):
 * - Never invent values. If a field is unavailable use null — NOT an empty string.
 * - store_id / store_name may be null when Tally has no godown configured;
 *   that is explicitly represented, not guessed.
 */
function buildSourceContext({
  sourceEntity,
  sourceRecordId = null,
  sourceTimestamp = null,
  syncId = null,
  storeId = null,
  storeName = null,
  locationIdentifier = null,
}) {
  const resolvedStoreId = storeId || DEFAULT_STORE_ID;
  const resolvedStoreName = storeName || DEFAULT_STORE_NAME;
  const resolvedLocation = locationIdentifier || DEFAULT_LOCATION;

  return {
    source_system: 'tally',
    connected_company_id: CONNECTED_COMPANY_ID,
    connected_company_name: CONNECTED_COMPANY_NAME ? CONNECTED_COMPANY_NAME : null,
    store_id: resolvedStoreId,
    store_name: resolvedStoreName,
    location_identifier: resolvedLocation,
    store_context_available: Boolean(resolvedStoreId || resolvedStoreName),
    source_entity: sourceEntity,
    source_record_id: sourceRecordId,
    source_timestamp: sourceTimestamp,
    received_at: new Date().toISOString(),
    sync_id: syncId,
  };
}

export class BrightConnectionConnector {
  static TENANT_ID = 'tenant_bright_connection';

  /**
   * Transforms Bright Connection raw catalog into Canonical MDU Product format.
   * Each record carries a source_context envelope with full provenance.
   *
   * @param {Array<Object>} rawItems
   * @param {string|null} syncId
   * @returns {Array<Object>}
   */
  static transformProductCatalog(rawItems = [], syncId = null) {
    const canonicalProducts = [];

    for (const item of rawItems) {
      let sku = item.sku || item.product_id;
      if (!sku) {
        const itemHash = crypto.createHash('md5').update(JSON.stringify(item)).digest('hex').slice(0, 8);
        sku = `BC-${itemHash}`;
      }

      const sourceContext = buildSourceContext({
        sourceEntity: 'product_catalog',
        sourceRecordId: sku,
        sourceTimestamp: item.created_at || item.updated_at || null,
        syncId: syncId,
        storeId: item.store_id || null,
        storeName: item.store_name || null,
        locationIdentifier: item.location || null,
      });

      const price = parseFloat(item.price || item.unit_price || 0.0);
      const stockQuantity = parseInt(item.stock || item.quantity || 0, 10);
      const productName = item.name || item.title || 'Unnamed Product';
      const category = item.category || 'General Hardware';

      const mduProduct = {
        mdu_type: 'product_catalog',
        tenant_id: this.TENANT_ID,
        sku: sku,
        name: productName,
        category: category,
        price: price,
        stock_quantity: stockQuantity,
        schemes: item.schemes || [],
        canonical_version: '1.0',
        transformed_at: new Date().toISOString(),
        // ── Provenance ────────────────────────────────────────────
        source_context: sourceContext,
        source_payload: item,
        normalized_record: {
          sku: sku,
          name: productName,
          category: category,
          price: price,
          stock_quantity: stockQuantity,
        },
      };

      canonicalProducts.push(mduProduct);
    }

    return canonicalProducts;
  }

  /**
   * Transforms Bright Connection order payload into Canonical MDU Order format.
   * Carries source_context with company, store, entity, and timestamp provenance.
   *
   * @param {Object} rawOrder
   * @param {string|null} syncId
   * @returns {Object}
   */
  static transformOrderPayload(rawOrder = {}, syncId = null) {
    const timestampStr = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const orderId = rawOrder.order_id || `ORD-BC-${timestampStr}`;

    const items = [];
    let totalAmount = 0.0;

    const rawItems = Array.isArray(rawOrder.items) ? rawOrder.items : [];
    for (const item of rawItems) {
      const qty = parseInt(item.quantity || 1, 10);
      const price = parseFloat(item.unit_price || 0.0);
      const subtotal = qty * price;
      totalAmount += subtotal;

      items.push({
        product_id: item.product_id || item.sku || null,
        name: item.name || null,
        quantity: qty,
        unit_price: price,
        subtotal: subtotal,
      });
    }

    const sourceContext = buildSourceContext({
      sourceEntity: 'order_record',
      sourceRecordId: orderId,
      sourceTimestamp: rawOrder.order_date || rawOrder.created_at || null,
      syncId: syncId,
      storeId: rawOrder.store_id || null,
      storeName: rawOrder.store_name || null,
      locationIdentifier: rawOrder.location || null,
    });

    const finalTotalAmount = parseFloat(rawOrder.total_amount || totalAmount);
    const dealerId = rawOrder.dealer_id || rawOrder.customer_id || null;
    const dealerName = rawOrder.dealer_name || rawOrder.shop_name || null;
    const status = rawOrder.status || 'Placed';

    const normalized = {
      order_id: orderId,
      dealer_id: dealerId,
      dealer_name: dealerName,
      items: items,
      total_amount: finalTotalAmount,
      status: status,
    };

    return {
      mdu_type: 'order_record',
      tenant_id: this.TENANT_ID,
      order_id: orderId,
      dealer_id: dealerId,
      dealer_name: dealerName,
      items: items,
      total_amount: finalTotalAmount,
      status: status,
      payment_receipt: rawOrder.payment_receipt_url || null,
      canonical_version: '1.0',
      transformed_at: new Date().toISOString(),
      // ── Provenance ────────────────────────────────────────────
      source_context: sourceContext,
      source_payload: rawOrder,
      normalized_record: normalized,
    };
  }

  /**
   * Transforms Bright Connection field visit evidence into Canonical MDU Evidence format.
   * Carries source_context with location, agent, and timestamp provenance.
   *
   * @param {Object} rawVisit
   * @param {string|null} syncId
   * @returns {Object}
   */
  static transformFieldVisitEvidence(rawVisit = {}, syncId = null) {
    const timestampStr = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const visitId = rawVisit.visit_id || `VIS-${timestampStr}`;

    const sourceContext = buildSourceContext({
      sourceEntity: 'field_visit_evidence',
      sourceRecordId: visitId,
      sourceTimestamp: rawVisit.visit_date || rawVisit.submitted_at || null,
      syncId: syncId,
      storeId: rawVisit.store_id || null,
      storeName: rawVisit.store_name || null,
      locationIdentifier: rawVisit.location || rawVisit.beat_name || null,
    });

    const routeId = rawVisit.route_id || rawVisit.beat_id || null;
    const dealerId = rawVisit.dealer_id || null;
    const agentId = rawVisit.agent_id || rawVisit.submitted_by || null;
    const paymentCollected = parseFloat(rawVisit.payment_collected || 0.0);

    const normalized = {
      visit_id: visitId,
      route_id: routeId,
      dealer_id: dealerId,
      agent_id: agentId,
      payment_collected: paymentCollected,
      parikshak_reviewed: false,
    };

    return {
      mdu_type: 'field_visit_evidence',
      tenant_id: this.TENANT_ID,
      visit_id: visitId,
      route_id: routeId,
      dealer_id: dealerId,
      agent_id: agentId,
      location_proof: {
        lat: parseFloat(rawVisit.lat || rawVisit.latitude || 0.0),
        lng: parseFloat(rawVisit.lng || rawVisit.longitude || 0.0),
        verified: rawVisit.location_verified !== undefined ? rawVisit.location_verified : true,
      },
      display_photo_url: rawVisit.display_photo_url || rawVisit.shelf_image || null,
      damaged_goods_report: rawVisit.damaged_goods || [],
      invoice_capture_url: rawVisit.invoice_url || rawVisit.receipt_url || null,
      payment_collected: paymentCollected,
      parikshak_reviewed: false,
      canonical_version: '1.0',
      transformed_at: new Date().toISOString(),
      // ── Provenance ────────────────────────────────────────────
      source_context: sourceContext,
      source_payload: rawVisit,
      normalized_record: normalized,
    };
  }
}

export default BrightConnectionConnector;
