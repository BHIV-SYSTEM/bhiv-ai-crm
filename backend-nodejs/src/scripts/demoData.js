/**
 * demoData — generates mock Bright Connection Tally data for demo mode.
 * No Tally required. Produces realistic Mumbai dealer data.
 */

const DEALERS = [
  // --- Mumbai Dealers (Sundry Debtors) ---
  { name: 'Andheri Electronics Hub', group: 'Sundry Debtors', closing: 345000, opening: 220000, gstin: '27AABCA1234F1Z5', pan: 'AABCA1234F', area: 'Andheri West' },
  { name: 'Bandra Trading Co', group: 'Sundry Debtors', closing: 278000, opening: 190000, gstin: '27AABCB5678G1Z3', pan: 'AABCB5678G', area: 'Bandra East' },
  { name: 'Churchgate Stationers', group: 'Sundry Debtors', closing: 412000, opening: 280000, gstin: '27AABCC9012H1Z1', pan: 'AABCC9012H', area: 'Churchgate' },
  { name: 'Dadar Hardware Mart', group: 'Sundry Debtors', closing: 189000, opening: 150000, gstin: '27AABCD3456J1Z8', pan: 'AABCD3456J', area: 'Dadar West' },
  { name: 'Fort Financial Services', group: 'Sundry Debtors', closing: 556000, opening: 400000, gstin: '27AABCE7890K1Z6', pan: 'AABCE7890K', area: 'Fort' },
  { name: 'Juhu Retail Paradise', group: 'Sundry Debtors', closing: 167000, opening: 120000, gstin: '27AABCF2345L1Z4', pan: 'AABCF2345L', area: 'Juhu' },
  { name: 'Kurla Wholesale Depot', group: 'Sundry Debtors', closing: 398000, opening: 290000, gstin: '27AABCG6789M1Z2', pan: 'AABCG6789M', area: 'Kurla West' },
  { name: 'Lower Parel Office Solutions', group: 'Sundry Debtors', closing: 234000, opening: 175000, gstin: '27AABCH0123N1Z0', pan: 'AABCH0123N', area: 'Lower Parel' },
  { name: 'Malad Stationery World', group: 'Sundry Debtors', closing: 145000, opening: 98000, gstin: '27AABCI4567P1Z8', pan: 'AABCI4567P', area: 'Malad West' },
  { name: 'Powai Tech Supplies', group: 'Sundry Debtors', closing: 312000, opening: 245000, gstin: '27AABCJ8901Q1Z6', pan: 'AABCJ8901Q', area: 'Powai' },

  // --- Mumbai Agent (Sundry Creditors) ---
  { name: 'Rajesh Menon - Andheri Agent', group: 'Sundry Creditors', closing: 85000, opening: 60000, gstin: '27AABCK2345R1Z4', pan: 'AABCK2345R', area: 'Andheri East' },

  // --- Company Accounts (unchanged) ---
  { name: 'Bright Connection Capital', group: 'Capital Account', closing: 5000000, opening: 5000000, gstin: '', pan: '' },
  { name: 'Sales Account', group: 'Sales Accounts', closing: 12500000, opening: 0, gstin: '', pan: '' },
  { name: 'Purchase Account', group: 'Purchase Accounts', closing: 8200000, opening: 0, gstin: '', pan: '' },
  { name: 'HDFC Bank Account', group: 'Bank Accounts', closing: 3200000, opening: 2800000, gstin: '', pan: '' },
  { name: 'Cash-in-Hand', group: 'Cash-in-Hand', closing: 450000, opening: 380000, gstin: '', pan: '' },
  { name: 'GST Output CGST', group: 'Duties & Taxes', closing: 450000, opening: 0, gstin: '', pan: '' },
  { name: 'GST Output SGST', group: 'Duties & Taxes', closing: 450000, opening: 0, gstin: '', pan: '' },
  { name: 'GST Output IGST', group: 'Duties & Taxes', closing: 320000, opening: 0, gstin: '', pan: '' },
];

const VOUCHER_TYPES = ['Sales', 'Receipt', 'Payment', 'Journal'];
const NARRATIONS = [
  'Being goods sold to Mumbai dealer',
  'Cash received against invoice',
  'Payment made to local supplier',
  'Journal entry for adjustment',
  'Being GST payment for the month',
  'Salary payment for the month',
  'Office rent payment - Mumbai office',
  'Electricity bill payment - Andheri warehouse',
];

function randomAmount(min, max) {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomDate(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysAgo));
  return d.toISOString().slice(0, 10);
}

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

export function generateDemoParties() {
  return DEALERS.map((d) => ({
    name: d.name,
    group: d.group,
    closingBalance: d.closing,
    openingBalance: d.opening,
    creditLimit: 500000,
    gstin: d.gstin,
    pan: d.pan,
  }));
}

export function generateDemoOutstanding() {
  const now = new Date();
  const bills = [];
  for (const d of DEALERS.filter(d => d.group === 'Sundry Debtors')) {
    const billCount = Math.floor(Math.random() * 3) + 1;
    for (let i = 0; i < billCount; i++) {
      const amount = randomAmount(15000, 150000);
      const billDate = new Date(now);
      billDate.setDate(billDate.getDate() - Math.floor(Math.random() * 60) - 10);
      const dueDate = new Date(billDate);
      dueDate.setDate(dueDate.getDate() + 30);
      const isOverdue = dueDate < now;
      const balance = isOverdue ? amount : randomAmount(0, amount);
      bills.push({
        partyName: d.name,
        billNo: `BC/${billDate.getFullYear()}/${String(Math.floor(Math.random() * 9000) + 1000)}`,
        billDate: formatDate(billDate),
        dueDate: formatDate(dueDate),
        amount,
        balance,
        billType: 'Dr',
      });
    }
  }
  return bills;
}

export function generateDemoVouchers() {
  const now = new Date();
  const vouchers = [];
  let voucherNum = 1000;

  // Generate 30 vouchers over last 30 days (only from Mumbai dealers)
  const mumbaiDealers = DEALERS.filter(d => d.group === 'Sundry Debtors');
  for (let i = 0; i < 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const dealer = mumbaiDealers[Math.floor(Math.random() * mumbaiDealers.length)];
    const type = VOUCHER_TYPES[Math.floor(Math.random() * VOUCHER_TYPES.length)];
    const amount = randomAmount(5000, 200000);

    vouchers.push({
      voucherType: type,
      voucherNumber: `${type.substring(0, 3).toUpperCase()}/${date.getFullYear()}/${String(++voucherNum).padStart(6, '0')}`,
      date: formatDate(date),
      amount,
      narration: NARRATIONS[Math.floor(Math.random() * NARRATIONS.length)],
      partyName: dealer.name,
    });
  }
  return vouchers;
}

export function generateDemoSyncRun(counts, durationMs) {
  return {
    timestamp: new Date().toISOString(),
    duration_ms: durationMs,
    records_extracted: counts.parties + counts.outstanding + counts.vouchers,
    records_pushed: counts.parties + counts.outstanding + counts.vouchers,
    parties: counts.parties,
    outstanding: counts.outstanding,
    vouchers: counts.vouchers,
    status: 'success',
  };
}
