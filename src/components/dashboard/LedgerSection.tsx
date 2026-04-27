import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ArrowDownLeft, ArrowUpRight, Loader2, BookOpen,
  DollarSign, Coins, TrendingUp, TrendingDown, Download,
} from 'lucide-react';
import { useLedger, LedgerEntry } from '@/hooks/useLedger';

// ─── Source label map ─────────────────────────────────────────────────────────
const SOURCE_LABELS: Record<string, string> = {
  qr_scan:         'QR Scan',
  checkout:        'Checkout',
  pos:             'POS',
  payment_request: 'Payment Request',
  refund:          'Refund',
  admin:           'Admin Adjustment',
  trade:           'Trade',
};

const SOURCE_COLORS: Record<string, string> = {
  qr_scan:         'bg-violet-50 text-violet-700',
  checkout:        'bg-blue-50 text-blue-700',
  pos:             'bg-indigo-50 text-indigo-700',
  payment_request: 'bg-amber-50 text-amber-700',
  refund:          'bg-rose-50 text-rose-700',
  admin:           'bg-gray-100 text-gray-600',
  trade:           'bg-emerald-50 text-emerald-700',
};

// ─── Payment type badge ───────────────────────────────────────────────────────
const PaymentTypeBadge = ({ entry }: { entry: LedgerEntry }) => {
  const hasCash   = entry.cash_amount > 0;
  const hasBarter = entry.barter_amount > 0;
  if (hasCash && hasBarter) return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700">Mixed</span>;
  if (hasCash)              return <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700">Cash</span>;
  return                           <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">Barter</span>;
};

// ─── Export CSV helper ────────────────────────────────────────────────────────
const exportCSV = (entries: LedgerEntry[]) => {
  const headers = ['Date', 'Type', 'Source', 'Description', 'Cash', 'Barter', 'Cash Balance', 'Barter Balance'];
  const rows = entries.map(e => [
    new Date(e.created_at).toLocaleDateString(),
    e.entry_type.toUpperCase(),
    SOURCE_LABELS[e.source] ?? e.source,
    `"${(e.description ?? '').replace(/"/g, '""')}"`,
    e.entry_type === 'credit' ? `+$${e.cash_amount.toFixed(2)}` : e.cash_amount > 0 ? `-$${e.cash_amount.toFixed(2)}` : '$0.00',
    e.entry_type === 'credit' ? `+${e.barter_amount}pts` : e.barter_amount > 0 ? `-${e.barter_amount}pts` : '0pts',
    `$${e.cash_balance_after.toFixed(2)}`,
    `${e.barter_balance_after}pts`,
  ]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `ledger_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Main Component ───────────────────────────────────────────────────────────
type FilterType  = 'all' | 'cash' | 'barter' | 'mixed';
type EntryFilter = 'all' | 'credit' | 'debit';
type SourceFilter = 'all' | 'qr_scan' | 'checkout' | 'pos' | 'payment_request' | 'refund' | 'admin' | 'trade';

const SOURCE_FILTER_OPTIONS: { value: SourceFilter; label: string }[] = [
  { value: 'all',             label: 'All Sources' },
  { value: 'pos',             label: 'POS' },
  { value: 'payment_request', label: 'Payment Request' },
  { value: 'qr_scan',        label: 'QR Scan' },
  { value: 'checkout',        label: 'Checkout' },
  { value: 'trade',           label: 'Trade' },
  { value: 'refund',          label: 'Refund' },
  { value: 'admin',           label: 'Admin' },
];

const LedgerSection = () => {
  const { entries, summary, loading, error } = useLedger();
  const [typeFilter,   setTypeFilter]   = useState<FilterType>('all');
  const [entryFilter,  setEntryFilter]  = useState<EntryFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');

  // Derive which sources actually exist in the data (hide buttons for unused sources)
  const activeSources = useMemo(
    () => new Set(entries.map(e => e.source)),
    [entries]
  );

  const filtered = useMemo(() => {
    return entries.filter(e => {
      // Payment type filter
      if (typeFilter === 'cash'   && !(e.cash_amount > 0 && e.barter_amount === 0)) return false;
      if (typeFilter === 'barter' && !(e.barter_amount > 0 && e.cash_amount === 0)) return false;
      if (typeFilter === 'mixed'  && !(e.cash_amount > 0 && e.barter_amount > 0))  return false;

      // Source filter
      if (sourceFilter !== 'all' && e.source !== sourceFilter) return false;

      // Credit/Debit filter
      if (entryFilter !== 'all' && e.entry_type !== entryFilter) return false;

      // Date range filter
      if (dateFrom) {
        const from = new Date(dateFrom);
        if (new Date(e.created_at) < from) return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (new Date(e.created_at) > to) return false;
      }

      return true;
    });
  }, [entries, typeFilter, sourceFilter, entryFilter, dateFrom, dateTo]);

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-red-500 font-medium">Could not load ledger</p>
        <p className="text-sm text-gray-400 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Ledger</h2>
          <p className="text-sm text-gray-500 mt-0.5">Complete record of all cash and barter movements</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportCSV(filtered)}
          disabled={filtered.length === 0}
          className="rounded-xl border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600 shrink-0"
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export CSV
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm bg-gradient-to-br from-emerald-500 to-teal-600 md:col-span-1">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="h-4 w-4 text-white/70" />
              <p className="text-white/70 text-xs font-medium">Cash Balance</p>
            </div>
            <p className="text-2xl font-black text-white">${summary.currentCashBalance.toFixed(2)}</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-gradient-to-br from-indigo-500 to-violet-600 md:col-span-1">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-1">
              <Coins className="h-4 w-4 text-white/70" />
              <p className="text-white/70 text-xs font-medium">Barter Balance</p>
            </div>
            <p className="text-2xl font-black text-white">{summary.currentBarterBalance.toLocaleString()} pts</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 shrink-0">
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">${summary.totalCashReceived.toFixed(2)}</p>
              <p className="text-xs text-gray-400">Cash In</p>
              <p className="text-xs text-teal-600 font-medium mt-0.5">{summary.totalBarterReceived.toLocaleString()} pts in</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-50 shrink-0">
              <TrendingDown className="h-4 w-4 text-rose-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">${summary.totalCashSent.toFixed(2)}</p>
              <p className="text-xs text-gray-400">Cash Out</p>
              <p className="text-xs text-rose-600 font-medium mt-0.5">{summary.totalBarterSent.toLocaleString()} pts out</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Payment type */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {(['all', 'cash', 'barter', 'mixed'] as FilterType[]).map(f => (
                <button
                  key={f}
                  onClick={() => setTypeFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                    typeFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Credit / Debit */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {(['all', 'credit', 'debit'] as EntryFilter[]).map(f => (
                <button
                  key={f}
                  onClick={() => setEntryFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                    entryFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Source filter — only shows buttons for sources that exist in the data */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {SOURCE_FILTER_OPTIONS.filter(
                opt => opt.value === 'all' || activeSources.has(opt.value)
              ).map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setSourceFilter(opt.value)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                    sourceFilter === opt.value
                      ? opt.value === 'all'
                        ? 'bg-gray-900 text-white border-gray-900'
                        : `${SOURCE_COLORS[opt.value] ?? 'bg-gray-100 text-gray-700'} border-transparent shadow-sm`
                      : 'bg-white text-gray-500 border-gray-200 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Date range */}
            <div className="flex items-center gap-2 ml-auto">
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <span className="text-xs text-gray-400">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo(''); }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ledger Table */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="px-5 pt-5 pb-0">
          <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-indigo-500" />
            Entries
            {!loading && (
              <span className="text-xs font-normal text-gray-400 ml-1">
                {filtered.length} of {entries.length}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 px-5 pb-5">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading ledger...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <BookOpen className="h-10 w-10 mx-auto mb-3 text-gray-200" />
              <p className="text-gray-500 font-medium">No entries found</p>
              <p className="text-sm text-gray-400 mt-1">
                {entries.length === 0
                  ? 'Your ledger will appear here once you make transactions'
                  : 'Try adjusting your filters'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4">Date</th>
                      <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4">Description</th>
                      <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4">Source</th>
                      <th className="text-left text-xs font-semibold text-gray-400 pb-3 pr-4">Type</th>
                      <th className="text-right text-xs font-semibold text-gray-400 pb-3 pr-4">Cash</th>
                      <th className="text-right text-xs font-semibold text-gray-400 pb-3 pr-4">Barter</th>
                      <th className="text-right text-xs font-semibold text-gray-400 pb-3 pr-4">Cash Bal.</th>
                      <th className="text-right text-xs font-semibold text-gray-400 pb-3">Barter Bal.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {filtered.map(entry => {
                      const isCredit = entry.entry_type === 'credit';
                      return (
                        <tr key={entry.id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="py-3 pr-4 text-xs text-gray-400 whitespace-nowrap">
                            {new Date(entry.created_at).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })}
                          </td>
                          <td className="py-3 pr-4 max-w-[200px]">
                            <p className="text-xs font-medium text-gray-700 truncate">
                              {entry.description ?? '—'}
                            </p>
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SOURCE_COLORS[entry.source] ?? 'bg-gray-100 text-gray-600'}`}>
                              {SOURCE_LABELS[entry.source] ?? entry.source}
                            </span>
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-1.5">
                              <div className={`p-1 rounded-lg ${isCredit ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                                {isCredit
                                  ? <ArrowDownLeft className="h-3 w-3 text-emerald-500" />
                                  : <ArrowUpRight  className="h-3 w-3 text-rose-500" />
                                }
                              </div>
                              <PaymentTypeBadge entry={entry} />
                            </div>
                          </td>
                          <td className={`py-3 pr-4 text-right text-xs font-semibold ${entry.cash_amount > 0 ? (isCredit ? 'text-emerald-600' : 'text-rose-500') : 'text-gray-300'}`}>
                            {entry.cash_amount > 0
                              ? `${isCredit ? '+' : '-'}$${entry.cash_amount.toFixed(2)}`
                              : '—'}
                          </td>
                          <td className={`py-3 pr-4 text-right text-xs font-semibold ${entry.barter_amount > 0 ? (isCredit ? 'text-teal-600' : 'text-rose-400') : 'text-gray-300'}`}>
                            {entry.barter_amount > 0
                              ? `${isCredit ? '+' : '-'}${entry.barter_amount.toLocaleString()} pts`
                              : '—'}
                          </td>
                          <td className="py-3 pr-4 text-right text-xs font-medium text-gray-600">
                            ${entry.cash_balance_after.toFixed(2)}
                          </td>
                          <td className="py-3 text-right text-xs font-medium text-gray-600">
                            {entry.barter_balance_after.toLocaleString()} pts
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {filtered.map(entry => {
                  const isCredit = entry.entry_type === 'credit';
                  return (
                    <div key={entry.id} className="flex items-start justify-between px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${isCredit ? 'bg-emerald-50' : 'bg-rose-50'}`}>
                          {isCredit
                            ? <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
                            : <ArrowUpRight  className="h-4 w-4 text-rose-500" />
                          }
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate max-w-[180px]">
                            {entry.description ?? '—'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${SOURCE_COLORS[entry.source] ?? 'bg-gray-100 text-gray-600'}`}>
                              {SOURCE_LABELS[entry.source] ?? entry.source}
                            </span>
                            <PaymentTypeBadge entry={entry} />
                          </div>
                          <p className="text-xs text-gray-400 mt-1">
                            {new Date(entry.created_at).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        {entry.cash_amount > 0 && (
                          <p className={`text-sm font-bold ${isCredit ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {isCredit ? '+' : '-'}${entry.cash_amount.toFixed(2)}
                          </p>
                        )}
                        {entry.barter_amount > 0 && (
                          <p className={`text-xs font-semibold ${isCredit ? 'text-teal-600' : 'text-rose-400'}`}>
                            {isCredit ? '+' : '-'}{entry.barter_amount.toLocaleString()} pts
                          </p>
                        )}
                        <p className="text-[10px] text-gray-400 mt-1">
                          Bal: ${entry.cash_balance_after.toFixed(2)} · {entry.barter_balance_after.toLocaleString()} pts
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default LedgerSection;
