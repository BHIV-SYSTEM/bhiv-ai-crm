/**
 * brightDemoData.js — Frontend Bright Connection Tally demo data generator
 * Derived strictly from backend-nodejs/src/scripts/demoData.js (Mumbai Dealers Master)
 */

export const PDF_PARSED_BRIGHT_DATA = {
  fileName: 'Receivable-22 Sept 26.pdf',
  fileSize: '100.0 KB',
  company: 'Bright Connections',
  address: '176/1410, Motilal Nagar No 1, Kali Gali, Sainath Mandir, Goregaon West, Mumbai 400104',
  gstin: '27AJKPN4994K1ZD',
  email: 'brightconnections9@gmail.com',
  sourceSystem: 'Biz Analyst (Tally Prime ERP Connector)',
  reportDate: '22 Sept 2026',
  totalReceivables: 1149012,
  totalParties: 12,
  dealers: [
    {
      id: 'store_bright_mumbai_01',
      code: 'BC-MUM-001',
      name: 'Tanvi Mobile Hub',
      company: 'Bright Connections',
      tenantId: 'tenant_bright_connection',
      city: 'Mumbai',
      region: 'Maharashtra',
      area: 'Andheri East',
      address: 'Shop 4, Station Road, Andheri East, Mumbai 400069',
      geofence: { lat: 19.1185, lng: 72.8480, radiusMeters: 50 },
      manager: 'Rajesh Menon (Field Agent - Mumbai Region)',
      owner: 'Deepak Gupta / Sales Manager',
      creditLimit: 500000,
      outstanding: 13204,
      overdue: 10284,
      phone: '9820123456',
      gstin: '27AABCA1234F1Z5',
      pan: 'AABCA1234F',
      group: 'Sundry Debtors',
      invoices: [
        { date: '2024-12-30', ref: '526091', pending: 590, dueOn: '2025-01-29', overdueDays: 603 },
        { date: '2025-05-23', ref: 'SYSSR/0022/25-26', pending: -1356, dueOn: '2025-06-22', overdueDays: 459 },
        { date: '2026-07-11', ref: 'NT/91/26-27', pending: 10284, dueOn: '2026-08-10', overdueDays: 45 },
        { date: '2026-07-28', ref: 'NT/151/26-27', pending: 3686, dueOn: '2026-08-27', overdueDays: 28 },
      ],
      tallySyncStatus: 'LIVE - Tally Prime Gateway Connected',
      tallyLastSync: 'Just now',
    },
    {
      id: 'store_bright_mumbai_02',
      code: 'BC-MUM-002',
      name: 'Zee Mobile Nx',
      company: 'Bright Connections',
      tenantId: 'tenant_bright_connection',
      city: 'Mumbai',
      region: 'Maharashtra',
      area: 'Santacruz East',
      address: 'Station Road, Santacruz East, Mumbai 400055',
      geofence: { lat: 19.0820, lng: 72.8420, radiusMeters: 50 },
      manager: 'Rajesh Menon (Field Agent)',
      owner: 'Deepak Gupta / Sales Manager',
      creditLimit: 500000,
      outstanding: 21299,
      overdue: 10934,
      phone: '9820234567',
      gstin: '27AABCB5678G1Z3',
      pan: 'AABCB5678G',
      group: 'Sundry Debtors',
      invoices: [
        { date: '2026-07-13', ref: 'EVM/195/2627', pending: 6140, dueOn: '2026-07-13', overdueDays: 73 },
        { date: '2026-08-17', ref: 'EVM/288/2627', pending: 4794, dueOn: '2026-08-17', overdueDays: 38 },
        { date: '2026-09-01', ref: 'EVM/338/2627', pending: 10365, dueOn: '2026-10-01', overdueDays: 0 },
      ],
      tallySyncStatus: 'LIVE - Tally Prime Gateway Connected',
      tallyLastSync: '5 minutes ago',
    },
    {
      id: 'store_bright_mumbai_03',
      code: 'BC-MUM-003',
      name: 'The Mobile Hub',
      company: 'Bright Connections',
      tenantId: 'tenant_bright_connection',
      city: 'Mumbai',
      region: 'Maharashtra',
      area: 'Andheri East',
      address: 'Marol Naka Metro Junction, Andheri East, Mumbai 400059',
      geofence: { lat: 19.1130, lng: 72.8870, radiusMeters: 50 },
      manager: 'Deepak Gupta (Sales Manager)',
      owner: 'Deepak Gupta / Sales Manager',
      creditLimit: 500000,
      outstanding: 18827,
      overdue: 10503,
      phone: '9820345678',
      gstin: '27AABCC9012H1Z1',
      pan: 'AABCC9012H',
      group: 'Sundry Debtors',
      invoices: [
        { date: '2026-07-02', ref: 'EVM/168/2627', pending: 6155, dueOn: '2026-08-01', overdueDays: 54 },
        { date: '2026-07-20', ref: 'EVM/212/2627', pending: 903, dueOn: '2026-08-19', overdueDays: 36 },
        { date: '2026-08-06', ref: 'EVM/269/2627', pending: 3445, dueOn: '2026-09-05', overdueDays: 19 },
        { date: '2026-08-28', ref: 'EVM/331/2627', pending: 6074, dueOn: '2026-09-27', overdueDays: 0 },
        { date: '2026-09-10', ref: 'EVM/369/2627', pending: 2250, dueOn: '2026-10-10', overdueDays: 0 },
      ],
      tallySyncStatus: 'LIVE - Tally Prime Gateway Connected',
      tallyLastSync: '3 minutes ago',
    },
    {
      id: 'store_bright_mumbai_04',
      code: 'BC-MUM-004',
      name: 'Shree New Kheteshwar Mobile',
      company: 'Bright Connections',
      tenantId: 'tenant_bright_connection',
      city: 'Mumbai',
      region: 'Maharashtra',
      area: 'Andheri East',
      address: 'SV Road Junction, Andheri East, Mumbai 400069',
      geofence: { lat: 19.1197, lng: 72.8464, radiusMeters: 50 },
      manager: 'Deepak Gupta (Sales Manager)',
      owner: 'Deepak Gupta / Sales Manager',
      creditLimit: 500000,
      outstanding: 6136,
      overdue: 1515,
      phone: '9820456789',
      gstin: '27AABCD3456J1Z8',
      pan: 'AABCD3456J',
      group: 'Sundry Debtors',
      invoices: [
        { date: '2026-07-02', ref: 'EVM/166/2627', pending: 1515, dueOn: '2026-08-01', overdueDays: 54 },
        { date: '2026-09-11', ref: 'EVM/375/2627', pending: 5971, dueOn: '2026-10-11', overdueDays: 0 },
      ],
      tallySyncStatus: 'LIVE - Tally Prime Gateway Connected',
      tallyLastSync: 'Just now',
    },
    {
      id: 'store_bright_mumbai_05',
      code: 'BC-MUM-005',
      name: 'Vinayak Mobile',
      company: 'Bright Connections',
      tenantId: 'tenant_bright_connection',
      city: 'Mumbai',
      region: 'Maharashtra',
      area: 'Khar West',
      address: 'SV Road, Khar West, Mumbai 400052',
      geofence: { lat: 19.0720, lng: 72.8360, radiusMeters: 50 },
      manager: 'Rajesh Menon (Field Agent)',
      owner: 'Deepak Gupta / Sales Manager',
      creditLimit: 500000,
      outstanding: 8151,
      overdue: 8850,
      phone: '9820567890',
      gstin: '27AABCE7890K1Z6',
      pan: 'AABCE7890K',
      group: 'Sundry Debtors',
      invoices: [
        { date: '2026-02-23', ref: 'AB/106/2526', pending: 710, dueOn: '2026-03-25', overdueDays: 183 },
        { date: '2026-06-29', ref: 'EVM/151/2627', pending: 3225, dueOn: '2026-06-29', overdueDays: 87 },
        { date: '2026-07-20', ref: 'EVM/210/2627', pending: 4915, dueOn: '2026-07-20', overdueDays: 66 },
      ],
      tallySyncStatus: 'LIVE - Tally Prime Gateway Connected',
      tallyLastSync: '4 minutes ago',
    },
    {
      id: 'store_bright_mumbai_06',
      code: 'BC-MUM-006',
      name: 'Tech Guide',
      company: 'Bright Connections',
      tenantId: 'tenant_bright_connection',
      city: 'Mumbai',
      region: 'Maharashtra',
      area: 'Andheri East',
      address: 'Mahakali Caves Road, Andheri East, Mumbai 400093',
      geofence: { lat: 19.1250, lng: 72.8650, radiusMeters: 50 },
      manager: 'Rajesh Menon (Field Agent)',
      owner: 'Deepak Gupta / Sales Manager',
      creditLimit: 500000,
      outstanding: 6330,
      overdue: 6330,
      phone: '9820678901',
      gstin: '27AABCF2345L1Z4',
      pan: 'AABCF2345L',
      group: 'Sundry Debtors',
      invoices: [
        { date: '2026-05-16', ref: 'EVM/19/2627', pending: 2090, dueOn: '2026-06-15', overdueDays: 101 },
        { date: '2026-06-25', ref: 'EVM/142/2627', pending: 1340, dueOn: '2026-07-25', overdueDays: 61 },
        { date: '2026-08-19', ref: 'EVM/301/2627', pending: 2900, dueOn: '2026-09-18', overdueDays: 6 },
      ],
      tallySyncStatus: 'LIVE - Tally Prime Gateway Connected',
      tallyLastSync: '2 minutes ago',
    },
    {
      id: 'store_bright_mumbai_07',
      code: 'BC-MUM-007',
      name: 'Shree Ramdev Mobile',
      company: 'Bright Connections',
      tenantId: 'tenant_bright_connection',
      city: 'Mumbai',
      region: 'Maharashtra',
      area: 'Khar West',
      address: 'Linking Road, Khar West, Mumbai 400052',
      geofence: { lat: 19.0700, lng: 72.8350, radiusMeters: 50 },
      manager: 'Rajesh Menon (Field Agent)',
      owner: 'Deepak Gupta / Sales Manager',
      creditLimit: 500000,
      outstanding: 6109,
      overdue: 8173,
      phone: '9820789012',
      gstin: '27AABCG6789M1Z2',
      pan: 'AABCG6789M',
      group: 'Sundry Debtors',
      invoices: [
        { date: '2024-02-27', ref: 'AB/651/2324', pending: 4080, dueOn: '2024-02-27', overdueDays: 940 },
        { date: '2026-07-27', ref: 'AB/113/2627', pending: 4093, dueOn: '2026-07-27', overdueDays: 59 },
      ],
      tallySyncStatus: 'LIVE - Tally Prime Gateway Connected',
      tallyLastSync: '6 minutes ago',
    },
    {
      id: 'store_bright_mumbai_08',
      code: 'BC-MUM-008',
      name: 'Swastik Communication Centre',
      company: 'Bright Connections',
      tenantId: 'tenant_bright_connection',
      city: 'Mumbai',
      region: 'Maharashtra',
      area: 'Sakinaka',
      address: 'Sakinaka Junction, Andheri East, Mumbai 400072',
      geofence: { lat: 19.0980, lng: 72.8880, radiusMeters: 50 },
      manager: 'Rajesh Menon (Field Agent)',
      owner: 'Deepak Gupta / Sales Manager',
      creditLimit: 500000,
      outstanding: 5522,
      overdue: 5522,
      phone: '9820890123',
      gstin: '27AABCH0123N1Z0',
      pan: 'AABCH0123N',
      group: 'Sundry Debtors',
      invoices: [
        { date: '2026-08-24', ref: 'NT/223/26-27', pending: 5521.99, dueOn: '2026-09-23', overdueDays: 1 },
      ],
      tallySyncStatus: 'LIVE - Tally Prime Gateway Connected',
      tallyLastSync: '10 minutes ago',
    },
    {
      id: 'store_bright_mumbai_09',
      code: 'BC-MUM-009',
      name: 'Vikas Mobile Center',
      company: 'Bright Connections',
      tenantId: 'tenant_bright_connection',
      city: 'Mumbai',
      region: 'Maharashtra',
      area: 'Vile Parle East',
      address: 'Nehru Road, Vile Parle East, Mumbai 400057',
      geofence: { lat: 19.0990, lng: 72.8490, radiusMeters: 50 },
      manager: 'Rajesh Menon (Field Agent)',
      owner: 'Deepak Gupta / Sales Manager',
      creditLimit: 500000,
      outstanding: 4889,
      overdue: 4889,
      phone: '9820901234',
      gstin: '27AABCI4567P1Z8',
      pan: 'AABCI4567P',
      group: 'Sundry Debtors',
      invoices: [
        { date: '2026-07-28', ref: 'EVM/231/2627', pending: 4889, dueOn: '2026-08-27', overdueDays: 28 },
      ],
      tallySyncStatus: 'LIVE - Tally Prime Gateway Connected',
      tallyLastSync: '8 minutes ago',
    },
    {
      id: 'store_bright_mumbai_10',
      code: 'BC-MUM-010',
      name: 'Shree Kheteshwar Mobile',
      company: 'Bright Connections',
      tenantId: 'tenant_bright_connection',
      city: 'Mumbai',
      region: 'Maharashtra',
      area: 'Ghatkopar West',
      address: 'Asalfa Metro Station, Ghatkopar West, Mumbai 400084',
      geofence: { lat: 19.0912, lng: 72.8980, radiusMeters: 50 },
      manager: 'Rajesh Menon (Field Agent)',
      owner: 'Deepak Gupta / Sales Manager',
      creditLimit: 500000,
      outstanding: 2581,
      overdue: 5896,
      phone: '9820012345',
      gstin: '27AABCJ8901Q1Z6',
      pan: 'AABCJ8901Q',
      group: 'Sundry Debtors',
      invoices: [
        { date: '2026-03-30', ref: 'AC/1384/2526', pending: 1698, dueOn: '2026-04-29', overdueDays: 148 },
        { date: '2026-04-13', ref: 'AC/24/2627', pending: 4198, dueOn: '2026-05-13', overdueDays: 134 },
      ],
      tallySyncStatus: 'LIVE - Tally Prime Gateway Connected',
      tallyLastSync: '3 minutes ago',
    },
  ]
};

export const DEMO_DEALERS = PDF_PARSED_BRIGHT_DATA.dealers;

const VOUCHER_TYPES = ['Sale', 'Receipt', 'Sale', 'Payment'];
const NARRATIONS = [
  'Consumer Electronics & Wiring Kits - Mumbai Depot',
  'Smart Switches & Modular Boxes',
  'HDFC Bank Mumbai RTGS Payment',
  'Heavy Duty Distribution Boards',
  'GST Tax Invoice Payment',
  'Bulk Hardware Order Settlement',
  'Modular Switches & Cable Roll',
  'Direct Bank RTGS Account Transfer - Bandra Branch',
];

function randomAmount(min, max) {
  return Math.round((Math.random() * (max - min) + min) / 1000) * 1000;
}

function formatDate(d) {
  return d.toISOString().slice(0, 10);
}

export function generateDemoVouchersForStore(storeCode) {
  const now = new Date();
  const vouchers = [];
  
  // Seed transactions matching Mumbai Ledger
  const baseTransactions = [
    { date: '2026-09-06', type: 'Sale', number: `INV-${storeCode}-089`, narration: 'Consumer Electronics & Wiring Kits - Mumbai Depot', amount: 85000, status: 'Cleared' },
    { date: '2026-08-28', type: 'Sale', number: `ORD-${storeCode}-074`, narration: 'Smart Switches & Modular Boxes', amount: 160000, status: 'In Payment Window' },
    { date: '2026-08-15', type: 'Receipt', number: `REC-${storeCode}-041`, narration: 'HDFC Bank Mumbai RTGS Payment', amount: 75000, status: 'Completed' },
    { date: '2026-08-01', type: 'Sale', number: `INV-${storeCode}-061`, narration: 'Heavy Duty Distribution Boards', amount: 75000, status: 'Cleared' },
  ];

  vouchers.push(...baseTransactions);

  // Generate 6 additional dynamic vouchers from script generator
  let voucherNum = 100;
  for (let i = 5; i <= 10; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - (i * 4));
    const type = VOUCHER_TYPES[i % VOUCHER_TYPES.length];
    const amount = randomAmount(25000, 140000);
    const prefix = type === 'Sale' ? 'INV' : type === 'Receipt' ? 'REC' : 'PAY';

    vouchers.push({
      date: formatDate(d),
      type,
      number: `${prefix}-${storeCode}-${String(++voucherNum).padStart(3, '0')}`,
      narration: NARRATIONS[i % NARRATIONS.length],
      amount,
      status: type === 'Receipt' ? 'Completed' : 'Cleared',
    });
  }

  // Sort by date descending
  return vouchers.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export function generateDemoParties() {
  return DEMO_DEALERS;
}

