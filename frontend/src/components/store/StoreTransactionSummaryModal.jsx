import React, { useState, useMemo } from 'react';
import {
  X,
  FileText,
  Download,
  Printer,
  Calendar,
  CreditCard,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  DollarSign,
  Tag,
  Receipt,
  ShieldCheck,
  ExternalLink,
  Lock,
  ShieldAlert,
  Clock
} from 'lucide-react';
import Button from '../common/ui/Button';
import Badge from '../common/ui/Badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '../common/ui/Table';
import { getStoreTransactionData, formatINR } from '@/utils/storeTransactionHelper';
import toast from 'react-hot-toast';

export const StoreTransactionSummaryModal = ({
  isOpen,
  onClose,
  storeContext,
  role = 'manager', // 'manager' | 'admin' | 'agent'
  isApproved = true,
}) => {
  const [activeTab, setActiveTab] = useState('vouchers'); // 'vouchers' | 'invoices' | 'account'
  const [voucherFilter, setVoucherFilter] = useState('ALL'); // 'ALL' | 'Sale' | 'Receipt'
  const [searchQuery, setSearchQuery] = useState('');

  const data = useMemo(() => {
    return getStoreTransactionData(storeContext);
  }, [storeContext]);

  if (!isOpen || !data) return null;

  // Security guard: For field agents, transactions are strictly hidden until admin storefront approval
  if (role === 'agent' && !isApproved) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-6 shadow-2xl text-center space-y-4">
          <div className="relative mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-950/30">
            <Lock className="w-8 h-8" />
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 animate-ping opacity-75" />
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center text-[9px] font-bold text-black">
              !
            </div>
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-2">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Financial Privacy Guard</span>
            </div>
            <h3 className="text-xl font-heading font-extrabold text-white">
              Transactions Locked
            </h3>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Store transactions, invoices, and accounting ledger for <strong className="text-white font-semibold">{data.store.name}</strong> are restricted.
            </p>
          </div>

          {/* Workflow Status Roadmap */}
          <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-3.5 text-left space-y-2.5">
            <div className="flex items-center justify-between text-xs pb-1.5 border-b border-slate-800/80">
              <span className="text-slate-400 font-medium">Verification Stage</span>
              <span className="font-semibold text-amber-400">Step 2 of 3</span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2.5 text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span className="text-[11px]">Arrival & Geofence Verified</span>
              </div>
              <div className="flex items-center gap-2.5 text-amber-300">
                <Clock className="w-4 h-4 text-amber-400 flex-shrink-0 animate-spin" />
                <span className="text-[11px] font-semibold">Storefront Proof Pending Admin Approval</span>
              </div>
              <div className="flex items-center gap-2.5 text-slate-500">
                <Lock className="w-4 h-4 text-slate-600 flex-shrink-0" />
                <span className="text-[11px]">Invoices & Ledger Locked</span>
              </div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/20 text-[11px] text-amber-300/90 leading-tight">
            Transactions will unlock automatically immediately once an Admin or Manager approves the storefront proof.
          </div>

          <Button onClick={onClose} className="w-full text-xs font-semibold py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700">
            Got It, Back to Task
          </Button>
        </div>
      </div>
    );
  }

  const { store, transactions, invoices, stats } = data;

  // Filter vouchers
  const filteredVouchers = transactions.filter((v) => {
    const matchesFilter = voucherFilter === 'ALL' || v.type === voucherFilter;
    const matchesSearch =
      !searchQuery ||
      v.number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.narration.toLowerCase().includes(searchQuery.toLowerCase()) ||
      v.date.includes(searchQuery);
    return matchesFilter && matchesSearch;
  });

  // Export CSV
  const handleExportCSV = () => {
    try {
      const headers = ['Date', 'Voucher Type', 'Voucher Number', 'Narration', 'Debit (INR)', 'Credit (INR)', 'Balance (INR)'];
      const rows = transactions.map((t) => [
        t.date,
        t.type,
        t.number,
        `"${t.narration.replace(/"/g, '""')}"`,
        t.debit || 0,
        t.credit || 0,
        t.balance || 0,
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `Statement_${store.code}_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('CSV Ledger Statement downloaded successfully.');
    } catch (err) {
      toast.error('Failed to export CSV statement');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-3 sm:p-6 animate-fade-in overflow-y-auto">
      <div className="bg-card border border-border rounded-2xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto">
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-slate-900 via-primary/10 to-card p-4 sm:p-5 border-b border-border flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary flex-shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                  {store.code}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" />
                  {store.tallySyncStatus}
                </span>
              </div>
              <h2 className="text-lg sm:text-xl font-heading font-bold text-foreground truncate mt-0.5">
                {store.name} — Transaction Summary
              </h2>
              <p className="text-xs text-muted-foreground truncate">
                {store.address} • GSTIN: {store.gstin}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              className="hidden sm:flex items-center gap-1.5 text-xs shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </Button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Financial Highlights Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 sm:p-4 bg-muted/20 border-b border-border">
          <div className="p-3 rounded-xl bg-card border border-border">
            <span className="text-[11px] font-medium text-muted-foreground block">Total Outstanding</span>
            <p className="text-base sm:text-lg font-bold font-heading text-red-500 mt-0.5">
              {formatINR(stats.outstandingAmount)}
            </p>
            <span className="text-[10px] text-muted-foreground">Current Ledger Debit Balance</span>
          </div>

          <div className="p-3 rounded-xl bg-card border border-border">
            <span className="text-[11px] font-medium text-muted-foreground block">Overdue Amount</span>
            <p className="text-base sm:text-lg font-bold font-heading text-amber-500 mt-0.5">
              {formatINR(stats.overdueAmount)}
            </p>
            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">Payment Past Due</span>
          </div>

          <div className="p-3 rounded-xl bg-card border border-border">
            <span className="text-[11px] font-medium text-muted-foreground block">Credit Limit</span>
            <p className="text-base sm:text-lg font-bold font-heading text-foreground mt-0.5">
              {formatINR(stats.creditLimit)}
            </p>
            <span className="text-[10px] text-muted-foreground">Approved Commercial Credit</span>
          </div>

          <div className="p-3 rounded-xl bg-card border border-border">
            <span className="text-[11px] font-medium text-muted-foreground block">Available Credit</span>
            <p className="text-base sm:text-lg font-bold font-heading text-emerald-500 mt-0.5">
              {formatINR(stats.availableCredit)}
            </p>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Good Standing</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center justify-between border-b border-border px-4 pt-2 bg-card">
          <div className="flex items-center gap-1 sm:gap-2">
            {[
              { id: 'vouchers', label: 'Vouchers & Ledger Statement', icon: FileText, count: transactions.length },
              { id: 'invoices', label: 'Pending Delivery Invoices', icon: Receipt, count: invoices.length },
              { id: 'account', label: 'Merchant Profile', icon: Building2 },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2.5 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
                    activeTab === tab.id
                      ? 'border-primary text-primary'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-muted font-mono">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {activeTab === 'vouchers' && (
            <div className="hidden sm:flex items-center gap-2 pb-2">
              <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                {['ALL', 'Sale', 'Receipt'].map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setVoucherFilter(filter)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition ${
                      voucherFilter === filter ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {filter === 'ALL' ? 'All Types' : filter}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Body Content (Scrollable) */}
        <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-4">
          {/* TAB 1: VOUCHERS LEDGER */}
          {activeTab === 'vouchers' && (
            <div className="space-y-3">
              {/* Filter controls on mobile */}
              <div className="flex sm:hidden items-center justify-between gap-2 pb-2">
                <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
                  {['ALL', 'Sale', 'Receipt'].map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setVoucherFilter(filter)}
                      className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                        voucherFilter === filter ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'
                      }`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              {/* Transactions Table */}
              <div className="border border-border rounded-xl overflow-hidden shadow-sm">
                <Table className="w-full text-xs">
                  <TableHeader>
                    <TableRow className="bg-muted/60 border-b border-border">
                      <TableHead className="w-24 font-bold uppercase text-[11px]">Date</TableHead>
                      <TableHead className="w-20 font-bold uppercase text-[11px]">Type</TableHead>
                      <TableHead className="w-32 font-bold uppercase text-[11px]">Voucher No.</TableHead>
                      <TableHead className="font-bold uppercase text-[11px]">Narration / Details</TableHead>
                      <TableHead className="w-24 text-right font-bold uppercase text-[11px]">Debit</TableHead>
                      <TableHead className="w-24 text-right font-bold uppercase text-[11px]">Credit</TableHead>
                      <TableHead className="w-28 text-right font-bold uppercase text-[11px]">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredVouchers.map((t, idx) => (
                      <TableRow key={t.number || idx} className="hover:bg-muted/30 transition-colors border-b border-border/60">
                        <TableCell className="font-mono text-muted-foreground whitespace-nowrap">{t.date}</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                              t.type === 'Sale'
                                ? 'bg-blue-500/10 text-blue-500 border border-blue-500/20'
                                : t.type === 'Receipt'
                                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                            }`}
                          >
                            {t.type}
                          </span>
                        </TableCell>
                        <TableCell className="font-mono font-medium text-foreground whitespace-nowrap">{t.number}</TableCell>
                        <TableCell className="text-muted-foreground max-w-xs truncate" title={t.narration}>
                          {t.narration}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-red-500">
                          {t.debit > 0 ? formatINR(t.debit) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-semibold text-emerald-500">
                          {t.credit > 0 ? formatINR(t.credit) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono font-bold text-foreground">
                          {formatINR(t.balance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* TAB 2: INVOICES BREAKDOWN */}
          {activeTab === 'invoices' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {invoices.map((inv, idx) => (
                  <div
                    key={inv.ref || idx}
                    className="p-4 rounded-xl border border-border bg-card shadow-sm space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-muted text-foreground">
                        {inv.ref}
                      </span>
                      {inv.overdueDays > 0 ? (
                        <span className="text-[11px] font-semibold text-red-500 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">
                          {inv.overdueDays} Days Overdue
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                          Current
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase block">Invoice Date</span>
                        <span className="text-xs font-medium text-foreground">{inv.date}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-muted-foreground uppercase block">Due On</span>
                        <span className="text-xs font-medium text-foreground">{inv.dueOn}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-muted-foreground uppercase block">Pending Amount</span>
                        <span className="text-sm font-bold text-red-500 font-mono">{formatINR(inv.pending)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: ACCOUNT & MERCHANT PROFILE */}
          {activeTab === 'account' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <h4 className="font-bold text-foreground flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  Merchant Entity Details
                </h4>
                <div className="space-y-2">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Registered Legal Name</span>
                    <span className="font-semibold text-foreground">{store.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Store Code</span>
                    <span className="font-mono font-medium text-foreground">{store.code}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">GSTIN / Tax ID</span>
                    <span className="font-mono font-medium text-foreground">{store.gstin}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">PAN Number</span>
                    <span className="font-mono font-medium text-foreground">{store.pan}</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border bg-card space-y-3">
                <h4 className="font-bold text-foreground flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-primary" />
                  Commercial & Credit Terms
                </h4>
                <div className="space-y-2">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Credit Limit</span>
                    <span className="font-bold text-foreground font-mono">{formatINR(store.creditLimit)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Current Balance</span>
                    <span className="font-bold text-red-500 font-mono">{formatINR(store.outstanding)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Payment Terms</span>
                    <span className="font-medium text-foreground">30 Days Net from Delivery</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Gateway Status</span>
                    <span className="font-semibold text-emerald-500">{store.tallySyncStatus}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 sm:p-4 bg-muted/30 border-t border-border flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Audited & verified against Tally Prime ERP ledger statement.</span>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleExportCSV} className="text-xs">
              <Download className="w-3.5 h-3.5 mr-1" />
              CSV
            </Button>
            <Button size="sm" onClick={onClose} className="text-xs font-semibold">
              Close Summary
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StoreTransactionSummaryModal;
