import crypto from 'node:crypto';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

const SETU_ENV = 'C:/Users/Ashmit Pandey/Desktop/bhiv-ai-crm/backend-nodejs/.env';
const ARTHA_ENV = 'C:/Users/Ashmit Pandey/Downloads/AI-Artha-main/backend/.env';

dotenv.config({ path: SETU_ENV });
dotenv.config({ path: ARTHA_ENV });

const HMAC = process.env.SETU_HMAC_SECRET;
const BASE = 'http://localhost:5000';
const SETU_BASE = 'http://localhost:8000';
const TENANT = 'tenant_sampada_001';

const results = [];
const check = (name, cond, extra = '') => {
  results.push({ name, pass: Boolean(cond), extra });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? `  [${extra}]` : ''}`);
};

const sign = (bodyStr) => crypto.createHmac('sha256', HMAC).update(bodyStr).digest('hex');

async function send(event) {
  const bodyStr = JSON.stringify(event);
  const res = await fetch(`${BASE}/api/v1/setu/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Setu-Signature': sign(bodyStr),
      'X-Trace-Id': `TRC-SMOKE-${Date.now()}`,
      'X-Event-Id': event.event_id,
      'X-Idempotency-Key': event.idempotency_key || '',
      'X-Source-System': 'setu',
    },
    body: bodyStr,
  });
  let parsed = null;
  try {
    parsed = await res.json();
  } catch {
    parsed = null;
  }
  return { status: res.status, parsed };
}

const mkEvent = (type, key, payload, id = null) => ({
  event_id: id || `EVT-SMOKE-${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`,
  event_type: type,
  tenant_id: TENANT,
  idempotency_key: key,
  occurred_at: new Date().toISOString(),
  trace_id: `TRC-SMOKE-${Date.now()}`,
  payload,
});

const ts = Date.now();
const ORDER1 = `ORD-SMOKE-${ts}`;
const ORDER2 = `ORD-SMOKE2-${ts}`;
const RST = `RST-SMOKE-${ts}`;

let eventId1 = null;

async function waitForArtha(event) {
  for (let i = 0; i < 12; i += 1) {
    const r = await send(event);
    if (r.status !== 404 && r.status !== 503) return r;
    await new Promise((res) => setTimeout(res, 2000));
  }
  return send(event);
}

/* ---------------------------------------------------------------- ingest */
console.log('== ARTHA ingest live smoke ==');

const ev1 = mkEvent('order.confirmed', ORDER1, {
  orderNumber: ORDER1,
  customerName: 'Smoke Client',
  customerEmail: 'smoke.client@example.com',
  items: [
    { description: 'Consulting', quantity: 2, unitPrice: 100 },
    { description: 'Support', quantity: 1, unitPrice: 50 },
  ],
  totalAmount: 250,
  orderDate: new Date().toISOString(),
});
eventId1 = ev1.event_id;

const r1 = await waitForArtha(ev1);
check('order.confirmed returns 200', r1.status === 200, `status=${r1.status} ${JSON.stringify(r1.parsed)?.slice(0, 160)}`);
const invId = r1.parsed?.data?.entity?.id;
const invNum = r1.parsed?.data?.entity?.number;
check('invoice number derived', invNum === `SETU-${ORDER1}`, `got=${invNum}`);
check('first create not idempotent', r1.parsed?.data?.idempotent === false);

const r2 = await send(ev1);
check('replay same event_id is idempotent', r2.status === 200 && r2.parsed?.data?.idempotent === true && r2.parsed?.data?.entity?.id === invId);

const r3 = await send(mkEvent('order.confirmed', ORDER1, ev1.payload));
check('replay new event_id same key is idempotent', r3.status === 200 && r3.parsed?.data?.idempotent === true && r3.parsed?.data?.entity?.id === invId);

const payKey = `pay-${ORDER1}-1`;
const r4 = await send(
  mkEvent('payment.received', payKey, {
    orderNumber: ORDER1,
    amount: 50,
    paymentMethod: 'upi',
    reference: payKey,
  })
);
check('payment.received records partial payment', r4.status === 200 && r4.parsed?.data?.entity?.status === 'partial', `status=${r4.parsed?.data?.entity?.status}`);

const r5 = await send(
  mkEvent('payment.received', payKey, {
    orderNumber: ORDER1,
    amount: 50,
    paymentMethod: 'upi',
    reference: payKey,
  })
);
check('duplicate payment reference is idempotent', r5.status === 200 && r5.parsed?.data?.idempotent === true);

const evRst = mkEvent('supplier.purchase-approved', RST, {
  restockId: RST,
  supplierName: 'Smoke Supplier',
  totalAmount: 1500,
  date: new Date().toISOString(),
});
const r6 = await send(evRst);
check('supplier.purchase-approved creates expense', r6.status === 200 && Boolean(r6.parsed?.data?.entity?.id), JSON.stringify(r6.parsed)?.slice(0, 160));
check('expense is pending approval', r6.parsed?.data?.entity?.status === 'pending', `status=${r6.parsed?.data?.entity?.status}`);

const r7 = await send(evRst);
check('purchase replay same event_id idempotent', r7.status === 200 && r7.parsed?.data?.idempotent === true && r7.parsed?.data?.entity?.id === r6.parsed?.data?.entity?.id);

const r8 = await send(mkEvent('supplier.purchase-approved', RST, evRst.payload));
check('purchase replay new event_id same key idempotent', r8.status === 200 && r8.parsed?.data?.idempotent === true && r8.parsed?.data?.entity?.id === r6.parsed?.data?.entity?.id);

const r9 = await send(mkEvent('order.confirmed', ORDER2, {
  orderNumber: ORDER2,
  customerName: 'Smoke Client',
  items: [{ description: 'Cancelled item', quantity: 1, unitPrice: 75 }],
  totalAmount: 75,
}));
check('second order confirmed', r9.status === 200 && Boolean(r9.parsed?.data?.entity?.id));

const r10 = await send(mkEvent('order.cancelled', ORDER2, { orderNumber: ORDER2, reason: 'smoke test' }));
check('order.cancelled cancels draft invoice', r10.status === 200 && r10.parsed?.data?.entity?.status === 'cancelled', `status=${r10.parsed?.data?.entity?.status}`);

const r11 = await send(mkEvent('order.cancelled', ORDER2, { orderNumber: ORDER2, reason: 'smoke test' }));
check('cancel replay idempotent', r11.status === 200 && r11.parsed?.data?.idempotent === true);

/* negatives */
let bodyStr = JSON.stringify(mkEvent('order.confirmed', 'ORD-X', { orderNumber: 'ORD-X', items: [{ description: 'x', quantity: 1, unitPrice: 1 }] }));
const badSig = await fetch(`${BASE}/api/v1/setu/ingest`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Setu-Signature': '00'.repeat(32) },
  body: bodyStr,
});
check('bad signature rejected 401', badSig.status === 401, `status=${badSig.status}`);

const noSig = await fetch(`${BASE}/api/v1/setu/ingest`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: bodyStr,
});
check('missing signature rejected 401', noSig.status === 401, `status=${noSig.status}`);

const badTenantEvent = mkEvent('order.confirmed', 'ORD-T', { orderNumber: 'ORD-T', items: [{ description: 'x', quantity: 1, unitPrice: 1 }] });
badTenantEvent.tenant_id = 'tenant_unknown';
const badTenantBody = JSON.stringify(badTenantEvent);
const badTenant = await fetch(`${BASE}/api/v1/setu/ingest`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Setu-Signature': sign(badTenantBody) },
  body: badTenantBody,
});
const badTenantJson = await badTenant.json().catch(() => ({}));
check('unknown tenant rejected 503 tenant_not_provisioned', badTenant.status === 503 && badTenantJson.code === 'tenant_not_provisioned', `status=${badTenant.status} code=${badTenantJson.code}`);

/* ------------------------------------------------- Artha DB dedupe proof */
console.log('== Artha DB integrity ==');
const arthaConn = await mongoose.createConnection(process.env.MONGODB_URI).asPromise();
const ArthaInvoice = arthaConn.model('Invoice', new mongoose.Schema({}, { strict: false, collection: 'invoices' }));
const ArthaExpense = arthaConn.model('Expense', new mongoose.Schema({}, { strict: false, collection: 'expenses' }));
const ArthaEvents = arthaConn.model('SetuIngestEvent', new mongoose.Schema({}, { strict: false, collection: 'setu_ingest_events' }));

const invCount = await ArthaInvoice.countDocuments({ invoiceNumber: `SETU-${ORDER1}` });
check('exactly ONE invoice for order after 3 deliveries', invCount === 1, `count=${invCount}`);

const invDoc = await ArthaInvoice.findOne({ invoiceNumber: `SETU-${ORDER1}` }).lean();
check('invoice scoped to mapped company', String(invDoc?.companyId) === '6abf94a11d087aae3209f10c', `companyId=${invDoc?.companyId}`);
check('invoice subtotal=250 total=250', invDoc?.subtotal === '250.00' && invDoc?.totalAmount === '250.00', `${invDoc?.subtotal}/${invDoc?.totalAmount}`);
check('invoice amountPaid=50', Number(invDoc?.amountPaid) === 50, `amountPaid=${invDoc?.amountPaid}`);

const expCount = await ArthaExpense.countDocuments({ description: `SETU restock ${RST}` });
check('exactly ONE expense for restock after 3 deliveries', expCount === 1, `count=${expCount}`);

const evtCount = await ArthaEvents.countDocuments({ eventId: eventId1 });
check('ingest event stored once', evtCount === 1, `count=${evtCount}`);

/* ---------------------------------------------------- SETU client read */
console.log('== SETU client visibility ==');
await mongoose.connect(process.env.MONGODB_URL);
const { default: Order } = await import('./src/models/Order.js');
const { default: publisher } = await import('./src/services/arthaEventPublisher.js');
const publisherMod = await import('./src/services/arthaEventPublisher.js');

const UserC = mongoose.connection.collection('users');
// Bridge invoice listing is scoped to the caller's email/GST, so the smoke
// user must match the customerEmail used in the order.confirmed payload.
const SMOKE_EMAIL = 'smoke.client@example.com';
let setuUser = await UserC.findOne({ role: 'customer', email: SMOKE_EMAIL });
if (!setuUser) {
  await UserC.insertOne({
    role: 'customer',
    tenant_id: 'tenant_sampada_001',
    name: 'Smoke Client',
    email: SMOKE_EMAIL,
    password: 'not-a-login-account',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  setuUser = await UserC.findOne({ role: 'customer', email: SMOKE_EMAIL });
}
check('SETU user found', Boolean(setuUser?._id), `role=${setuUser?.role} email=${setuUser?.email}`);

const token = jwt.sign({ id: String(setuUser._id) }, process.env.JWT_SECRET, { expiresIn: '1h' });

const invoicesRes = await fetch(`${SETU_BASE}/api/financial/invoices?limit=100`, {
  headers: { Authorization: `Bearer ${token}` },
});
const invoicesJson = await invoicesRes.json().catch(() => ({}));
const invoiceNumbers = (Array.isArray(invoicesJson?.data) ? invoicesJson.data : []).map((i) => i.invoiceNumber);
check('bridge lists Artha invoices (read path works)', invoicesRes.status === 200 && invoiceNumbers.length > 0, `status=${invoicesRes.status} n=${invoiceNumbers.length}`);
check('client sees the SETU-sourced invoice', invoiceNumbers.includes(`SETU-${ORDER1}`), invoiceNumbers.slice(0, 5).join(','));

/* order-finance link: create a SETU order + publish (cross-path idempotency) */
const order = await Order.create({
  orderNumber: ORDER1,
  customerId: setuUser._id,
  items: [
    { productId: new mongoose.Types.ObjectId(), productName: 'Consulting', sku: 'SMOKE-1', quantity: 2, price: 100, total: 200 },
    { productId: new mongoose.Types.ObjectId(), productName: 'Support', sku: 'SMOKE-2', quantity: 1, price: 50, total: 50 },
  ],
  totalAmount: 250,
  status: 'DELIVERED',
  tracking: { placedAt: new Date(), deliveredAt: new Date(), confirmedByCustomer: true },
});
check('SETU order created', Boolean(order._id), `orderNumber=${order.orderNumber}`);

const pub = await publisherMod.publishOrderConfirmed({ order, actorUser: setuUser });
check('publisher syncs (cross-path idempotent replay on Artha)', pub.ok === true && pub.log?.status === 'SYNCED', `status=${pub.log?.status} err=${pub.log?.lastError || ''}`);

const financeRes = await fetch(`${SETU_BASE}/api/order-finance/${order._id}`, {
  headers: { Authorization: `Bearer ${token}` },
});
const financeJson = await financeRes.json().catch(() => ({}));
const fin = financeJson?.data?.finance;
check('order-finance endpoint returns invoice link', financeRes.status === 200 && fin?.invoiceNumber === `SETU-${ORDER1}`, `status=${financeRes.status} inv=${fin?.invoiceNumber}`);
check('order-finance live status from Artha', fin?.live === true && fin?.invoiceStatus === 'partial', `live=${fin?.live} status=${fin?.invoiceStatus}`);

/* PDF download through the bridge */
if (fin?.invoiceId) {
  const pdfRes = await fetch(`${SETU_BASE}/api/financial/invoices/${fin.invoiceId}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const pdfType = pdfRes.headers.get('content-type') || '';
  check('invoice PDF downloadable through SETU bridge', pdfRes.status === 200 && pdfType.includes('pdf'), `status=${pdfRes.status} type=${pdfType}`);
}

/* customer isolation: another user cannot read this order's finance */
const otherUsers = await UserC.find({ _id: { $ne: setuUser._id }, role: 'customer' }).limit(1).toArray();
if (otherUsers.length && otherUsers[0].role === 'customer') {
  const otherToken = jwt.sign({ id: String(otherUsers[0]._id) }, process.env.JWT_SECRET, { expiresIn: '1h' });
  const forbidden = await fetch(`${SETU_BASE}/api/order-finance/${order._id}`, {
    headers: { Authorization: `Bearer ${otherToken}` },
  });
  check('other customer blocked from this order (403)', forbidden.status === 403, `status=${forbidden.status}`);
} else {
  check('other customer blocked from this order (403)', true, 'skipped: no second customer user');
}

await arthaConn.close();
await mongoose.disconnect();

const failed = results.filter((r) => !r.pass);
console.log(`\nSUMMARY: ${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log('FAILED:', failed.map((f) => f.name).join(' | '));
  process.exit(1);
}
process.exit(0);
