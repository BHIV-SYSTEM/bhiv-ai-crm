import { PDF_PARSED_BRIGHT_DATA, generateDemoVouchersForStore } from './brightDemoData';

/**
 * storeTransactionHelper.js
 * Provides consistent transaction & ledger summary data for stores
 * Accessible across Manager/Admin Review Portal and Field Agent Portal
 */

export function getStoreTransactionData(storeContext) {
  if (!storeContext) return null;

  const storeName = storeContext.name || '';
  const storeId = storeContext.storeId || storeContext.id || storeContext.code || 'STR-MUM-01';

  // Find matching dealer from Bright Connection parsed data if available
  const matchedDealer = PDF_PARSED_BRIGHT_DATA.dealers.find(
    (d) =>
      d.code.toLowerCase() === storeId.toLowerCase() ||
      d.name.toLowerCase().includes(storeName.toLowerCase()) ||
      storeName.toLowerCase().includes(d.name.toLowerCase()) ||
      (d.area && storeContext.area && d.area.toLowerCase().includes(storeContext.area.toLowerCase()))
  ) || PDF_PARSED_BRIGHT_DATA.dealers[0];

  const storeCode = matchedDealer?.code || 'BC-MUM-001';
  const rawVouchers = generateDemoVouchersForStore(storeCode);

  // Calculate chronological running balance
  let running = 0;
  const sortedAsc = [...rawVouchers].sort((a, b) => new Date(a.date) - new Date(b.date));
  const vouchersWithBalance = sortedAsc.map((v) => {
    const isSale = v.type === 'Sale';
    const isReceipt = v.type === 'Receipt';
    const isPayment = v.type === 'Payment';

    const debit = isSale ? v.amount : 0;
    const credit = isReceipt || isPayment ? v.amount : 0;
    running = running + debit - credit;

    return {
      ...v,
      debit,
      credit,
      balance: Math.max(0, running),
    };
  });

  // Re-sort descending (newest first for display)
  const transactions = vouchersWithBalance.reverse();

  const invoices = matchedDealer?.invoices || [
    { date: '2026-07-11', ref: `INV-${storeCode}-091`, pending: 10284, dueOn: '2026-08-10', overdueDays: 45 },
    { date: '2026-07-28', ref: `INV-${storeCode}-151`, pending: 3686, dueOn: '2026-08-27', overdueDays: 28 },
    { date: '2026-08-20', ref: `INV-${storeCode}-202`, pending: 5400, dueOn: '2026-09-19', overdueDays: 12 },
  ];

  const totalOutstanding = matchedDealer?.outstanding || invoices.reduce((sum, inv) => sum + inv.pending, 0);
  const totalOverdue = matchedDealer?.overdue || invoices.filter(i => i.overdueDays > 0).reduce((sum, inv) => sum + inv.pending, 0);

  return {
    store: {
      name: storeName || matchedDealer.name,
      code: storeCode,
      storeId: storeId,
      address: storeContext.address || matchedDealer.address,
      area: storeContext.area || matchedDealer.area || 'Mumbai Region',
      gstin: matchedDealer.gstin || '27AAACS9876E1Z4',
      pan: matchedDealer.pan || 'AABCA1234F',
      phone: matchedDealer.phone || '9820123456',
      creditLimit: matchedDealer.creditLimit || 500000,
      outstanding: totalOutstanding,
      overdue: totalOverdue,
      tallySyncStatus: matchedDealer.tallySyncStatus || 'LIVE - Tally Prime Gateway Connected',
      tallyLastSync: matchedDealer.tallyLastSync || 'Just now',
    },
    transactions,
    invoices,
    stats: {
      totalVouchers: transactions.length,
      totalInvoices: invoices.length,
      outstandingAmount: totalOutstanding,
      overdueAmount: totalOverdue,
      creditLimit: matchedDealer?.creditLimit || 500000,
      availableCredit: Math.max(0, (matchedDealer?.creditLimit || 500000) - totalOutstanding),
    },
  };
}

export function formatINR(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '₹0';
  return '₹' + Number(amount).toLocaleString('en-IN');
}
