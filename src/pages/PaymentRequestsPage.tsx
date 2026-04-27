import React, { useState, useEffect } from 'react';
import BackButton from '@/components/ui/BackButton';
import { usePaymentRequests, PaymentRequest } from '@/hooks/usePaymentRequests';
import PaymentRequestDetailDialog from '@/components/payment-requests/PaymentRequestDetailDialog';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import {
  FileText, Search, DollarSign, Coins,
  ArrowDownLeft, ArrowUpRight, Loader2, ChevronLeft, ChevronRight,
} from 'lucide-react';

const STATUS_FILTERS = ['all', 'pending', 'accepted', 'paid', 'rejected', 'cancelled', 'expired'] as const;
const PAGE_SIZE = 10;

const PaymentRequestsPage = () => {
  const { sentRequests, receivedRequests, pendingReceivedCount, loading } = usePaymentRequests();
  const [activeTab, setActiveTab] = useState<'all' | 'received' | 'sent'>('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [activeTab, statusFilter, search]);

  const pendingSent = sentRequests.filter(r => r.status === 'pending' && !r.is_expired).length;
  const totalReceived = receivedRequests.filter(r => r.status === 'paid').reduce((s, r) => s + r.total_amount, 0);
  const totalSent = sentRequests.filter(r => r.status === 'paid').reduce((s, r) => s + r.total_amount, 0);

  const applyFilters = (requests: PaymentRequest[]) => {
    let result = requests;
    if (statusFilter !== 'all') {
      result = result.filter(r =>
        statusFilter === 'expired'
          ? r.is_expired || r.status === 'expired'
          : r.status === statusFilter && !r.is_expired
      );
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        (r.seller_business_name || r.seller_full_name || r.buyer_business_name || r.buyer_full_name || '')
          .toLowerCase().includes(q) ||
        r.service_description.toLowerCase().includes(q)
      );
    }
    return result;
  };

  const getStatusBadge = (status: string, isExpired: boolean | null) => {
    if (isExpired && status === 'pending') return { label: 'Expired', cls: 'bg-gray-100 text-gray-600 border-gray-200' };
    const map: Record<string, { label: string; cls: string }> = {
      pending:   { label: 'Pending',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
      accepted:  { label: 'Accepted',  cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      paid:      { label: 'Paid',      cls: 'bg-blue-50 text-blue-700 border-blue-200' },
      rejected:  { label: 'Rejected',  cls: 'bg-red-50 text-red-700 border-red-200' },
      cancelled: { label: 'Cancelled', cls: 'bg-red-50 text-red-700 border-red-200' },
      expired:   { label: 'Expired',   cls: 'bg-gray-100 text-gray-600 border-gray-200' },
    };
    return map[status] || map.pending;
  };

  const allRequests = [...receivedRequests, ...sentRequests]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const currentRequests = activeTab === 'all' ? allRequests : activeTab === 'received' ? receivedRequests : sentRequests;
  const filtered = applyFilters(currentRequests);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Page Header */}
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950">
        <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-60" />
        <div className="max-w-5xl mx-auto px-4 md:px-6 py-6">
          <div className="mb-4"><BackButton /></div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white">Payment Requests</h1>
              <p className="text-white/50 text-sm mt-0.5">Manage your barter payment requests</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Pending Received', value: pendingReceivedCount, accent: 'text-amber-400' },
              { label: 'Pending Sent',     value: pendingSent,          accent: 'text-blue-400' },
              { label: 'Total Received',   value: `$${totalReceived.toFixed(2)}`, accent: 'text-emerald-400' },
              { label: 'Total Sent',       value: `$${totalSent.toFixed(2)}`,     accent: 'text-violet-400' },
            ].map(({ label, value, accent }) => (
              <div key={label} className="bg-white/10 rounded-xl px-4 py-3 backdrop-blur-sm border border-white/10">
                <p className="text-white/50 text-xs">{label}</p>
                <p className={`text-xl font-bold mt-0.5 ${accent}`}>{value}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 space-y-4">

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
              activeTab === 'all'
                ? 'bg-slate-700 text-white shadow-md shadow-slate-200'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-slate-300'
            }`}
          >
            All
            <span className={`text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center ${
              activeTab === 'all' ? 'bg-white text-slate-700' : 'bg-gray-200 text-gray-600'
            }`}>{allRequests.length}</span>
          </button>
          <button
            onClick={() => setActiveTab('received')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
              activeTab === 'received'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300'
            }`}
          >
            <ArrowDownLeft className="w-4 h-4" />
            Received
            {pendingReceivedCount > 0 && (
              <span className={`text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center ${
                activeTab === 'received' ? 'bg-white text-indigo-600' : 'bg-red-500 text-white'
              }`}>{pendingReceivedCount}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('sent')}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all ${
              activeTab === 'sent'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-200'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-emerald-300'
            }`}
          >
            <ArrowUpRight className="w-4 h-4" />
            Sent
            {pendingSent > 0 && (
              <span className={`text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center ${
                activeTab === 'sent' ? 'bg-white text-emerald-600' : 'bg-amber-500 text-white'
              }`}>{pendingSent}</span>
            )}
          </button>
        </div>

        {/* Search + Status Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or description..."
              className="pl-9 bg-white border-gray-200"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {STATUS_FILTERS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${
                  statusFilter === s
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white text-gray-500 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="h-12 w-12 mx-auto mb-3 text-gray-200" />
            <p className="text-gray-500 font-medium">No requests found</p>
            <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="space-y-3">
            {paginated.map(request => {
              const isReceived = activeTab === 'received' || (activeTab === 'all' && receivedRequests.some(r => r.id === request.id));
              const otherName = isReceived
                ? request.seller_business_name || request.seller_full_name || 'Unknown'
                : request.buyer_business_name || request.buyer_full_name || 'Unknown';
              const initials = otherName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
              const badge = getStatusBadge(request.status, request.is_expired);
              const hasBarter = request.metadata?.barter_percentage != null && request.metadata.barter_percentage > 0;

              return (
                <div
                  key={request.id}
                  onClick={() => { setSelectedRequest(request); setDialogOpen(true); }}
                  className="bg-white rounded-2xl border border-gray-100 p-4 md:p-5 cursor-pointer hover:border-indigo-200 hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-600 font-bold text-sm flex items-center justify-center shrink-0">
                      {initials}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <span className="font-semibold text-gray-900 text-sm">{otherName}</span>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${badge.cls}`}>
                          {badge.label}
                        </span>
                        {activeTab === 'all' && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${isReceived ? 'bg-indigo-50 text-indigo-500' : 'bg-emerald-50 text-emerald-600'}`}>
                            {isReceived ? '↓ Received' : '↑ Sent'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">{request.service_description}</p>
                      <p className="text-[11px] text-gray-400 mt-1">
                        {format(new Date(request.created_at), 'MMM d, yyyy · h:mm a')}
                      </p>
                    </div>

                    {/* Amount */}
                    <div className="text-right shrink-0">
                      {hasBarter ? (
                        <>
                          <div className="font-bold text-sm text-indigo-600 flex items-center justify-end gap-1">
                            <Coins className="h-3.5 w-3.5" />
                            {request.metadata!.barter_amount?.toFixed(0)} cr
                          </div>
                          <div className="text-xs font-semibold text-emerald-600 mt-0.5">
                            ${request.metadata!.cash_amount?.toFixed(2)} cash
                          </div>
                        </>
                      ) : (
                        <div className="font-bold text-sm text-gray-800 flex items-center justify-end gap-0.5">
                          <DollarSign className="h-3.5 w-3.5" />
                          {request.total_amount.toFixed(2)}
                        </div>
                      )}
                      {request.status === 'pending' && !request.is_expired && (
                        <p className="text-[10px] text-amber-500 font-medium mt-1">Awaiting response</p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && filtered.length > PAGE_SIZE && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg text-sm font-semibold transition-all ${
                    p === page
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {selectedRequest && (
        <PaymentRequestDetailDialog
          request={selectedRequest}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
        />
      )}
    </div>
  );
};

export default PaymentRequestsPage;
