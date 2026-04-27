import React, { useState, useEffect } from 'react';
import { Bell, ArrowDownLeft, ArrowUpRight, CheckCheck, Check, Inbox, Coins, X } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow, isToday, isYesterday, format } from 'date-fns';
import BackButton from '@/components/ui/BackButton';

type Filter = 'all' | 'credits' | 'debits' | 'other';

const getKind = (title: string): 'credit' | 'debit' | 'other' => {
  const t = title?.toLowerCase() ?? '';
  if (t.includes('debit') || t.includes('debited')) return 'debit';
  if (t.includes('received') || t.includes('credit')) return 'credit';
  return 'other';
};

const parseAmount = (message: string): string | null => {
  // Match patterns like "50.00 barter credits" or "$50.00"
  const barterMatch = message?.match(/(\d+\.?\d*)\s*barter credits/);
  if (barterMatch) return `${parseFloat(barterMatch[1]).toFixed(2)} cr`;
  const cashMatch = message?.match(/\$(\d+\.?\d*)/);
  if (cashMatch) return `$${parseFloat(cashMatch[1]).toFixed(2)}`;
  return null;
};

const groupByDate = (notifications: any[]) => {
  const groups: Record<string, any[]> = {};
  notifications.forEach(n => {
    const d = new Date(n.created_at);
    const key = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'MMM d, yyyy');
    if (!groups[key]) groups[key] = [];
    groups[key].push(n);
  });
  return groups;
};

const NotificationsPage = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, loading } = useNotifications();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleNotificationClick = (n: any) => {
    if (!n.read) markAsRead(n.id);
    if (n.message?.startsWith('trade_request:') || n.title?.toLowerCase().includes('trade request')) {
      navigate('/account-dashboard?tab=trade-requests');
    }
  };
  const [filter, setFilter] = useState<Filter>('all');
  const [responding, setResponding] = useState<string | null>(null);
  const [tradeRequests, setTradeRequests] = useState<Record<string, any>>({});

  // Load trade request details for trade_request notifications
  useEffect(() => {
    const ids = notifications
      .filter(n => n.message?.startsWith('trade_request:'))
      .map(n => n.message.replace('trade_request:', ''));
    if (ids.length === 0) return;
    supabase.from('trade_requests').select('*').in('id', ids).then(({ data, error }) => {
      if (data) {
        const map: Record<string, any> = {};
        data.forEach(r => { map[r.id] = r; });
        setTradeRequests(map);
      }
    });
  }, [notifications]);

  const handleTradeResponse = async (notifId: string, tradeId: string, accepted: boolean) => {
    setResponding(notifId);

    // Update trade_requests table — trigger handles notifying the sender
    await supabase.from('trade_requests').update({
      status: accepted ? 'accepted' : 'rejected',
    }).eq('id', tradeId);

    // Mark notification as read
    await markAsRead(notifId);

    // Refresh trade requests
    setTradeRequests(prev => ({
      ...prev,
      [tradeId]: { ...prev[tradeId], status: accepted ? 'accepted' : 'rejected' },
    }));

    setResponding(null);
  };

  const filtered = notifications.filter(n => {
    if (filter === 'all') return true;
    const kind = getKind(n.title);
    if (filter === 'credits') return kind === 'credit';
    if (filter === 'debits') return kind === 'debit';
    return kind === 'other';
  });

  const grouped = groupByDate(filtered);

  const FILTERS: { id: Filter; label: string }[] = [
    { id: 'all',     label: `All (${notifications.length})` },
    { id: 'credits', label: 'Credits (CR)' },
    { id: 'debits',  label: 'Debits (DR)' },
    { id: 'other',   label: 'Other' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-6">

        {/* Back */}
        <div className="mb-4">
          <BackButton />
        </div>

        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Bell className="h-6 w-6 text-indigo-500" />
              Notifications
            </h1>
            {unreadCount > 0 && (
              <p className="text-sm text-gray-500 mt-0.5">{unreadCount} unread</p>
            )}
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-xl transition-all"
            >
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </button>
          )}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto scrollbar-hide pb-1">
          {FILTERS.map(f => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-semibold border transition-all ${
                filter === f.id
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 flex gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-full bg-gray-100 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-100 rounded w-2/3" />
                  <div className="h-3 bg-gray-50 rounded w-full" />
                  <div className="h-3 bg-gray-50 rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Inbox className="h-12 w-12 mb-3 opacity-30" />
            <p className="font-medium text-gray-500">No notifications</p>
            <p className="text-sm mt-1">
              {filter === 'all' ? "You're all caught up!" : `No ${filter} notifications yet`}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([dateLabel, items]) => (
              <div key={dateLabel}>
                {/* Date group label */}
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2 px-1">
                  {dateLabel}
                </p>

                <div className="space-y-2">
                  {items.map(n => {
                    const kind = getKind(n.title);
                    const isTradeRequest = n.title === 'New Trade Request' && n.message?.startsWith('trade_request:');

                    // ── Trade Request Card ──────────────────────────────────
                    if (isTradeRequest) {
                      const tradeId = n.message?.replace('trade_request:', '');
                      const trade = tradeRequests[tradeId];
                      const tradeStatus = trade?.status;

                      return (
                        <div
                          key={n.id}
                          onClick={() => handleNotificationClick(n)}
                          className={`bg-white rounded-2xl p-4 border transition-all cursor-pointer hover:shadow-sm ${
                            n.read ? 'border-gray-100' : 'border-violet-200 shadow-sm'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <div className="shrink-0 w-10 h-10 rounded-full bg-violet-100 flex items-center justify-center">
                              <Coins className="h-5 w-5 text-violet-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">Trade Request</span>
                                  <p className="text-sm font-semibold text-gray-900 mt-1">
                                    {trade ? trade.service_name : '...'}
                                  </p>
                                </div>
                                {!n.read && <div className="shrink-0 w-2 h-2 rounded-full bg-violet-500 mt-1" />}
                              </div>
                              {trade && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {trade.barter_percentage}% Credits + {100 - trade.barter_percentage}% Cash
                                </p>
                              )}
                              <p className="text-xs text-gray-400 mt-1">
                                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                              </p>

                              {trade && !tradeStatus || tradeStatus === 'pending' ? (
                                <div className="flex gap-2 mt-3">
                                  <button
                                    onClick={() => handleTradeResponse(n.id, tradeId, true)}
                                    disabled={responding === n.id}
                                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors disabled:opacity-60"
                                  >
                                    <Check className="h-3.5 w-3.5" /> Accept
                                  </button>
                                  <button
                                    onClick={() => handleTradeResponse(n.id, tradeId, false)}
                                    disabled={responding === n.id}
                                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors disabled:opacity-60"
                                  >
                                    <X className="h-3.5 w-3.5" /> Decline
                                  </button>
                                </div>
                              ) : tradeStatus === 'accepted' ? (
                                <div className="mt-3 flex items-center gap-1.5 py-2 px-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold">
                                  <Check className="h-3.5 w-3.5" /> Accepted
                                </div>
                              ) : tradeStatus === 'rejected' ? (
                                <div className="mt-3 flex items-center gap-1.5 py-2 px-3 rounded-xl bg-gray-50 text-gray-500 text-xs font-bold">
                                  <X className="h-3.5 w-3.5" /> Declined
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // ── Regular Notification ────────────────────────────────
                    const amount = parseAmount(n.message);
                    return (
                      <div
                        key={n.id}
                        onClick={() => handleNotificationClick(n)}
                        className={`flex items-start gap-3 bg-white rounded-2xl p-4 border transition-all cursor-pointer hover:shadow-sm ${
                          n.read ? 'border-gray-100 opacity-80' : 'border-indigo-100 shadow-sm'
                        }`}
                      >
                        {/* Icon */}
                        <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                          kind === 'debit'  ? 'bg-red-100'     :
                          kind === 'credit' ? 'bg-emerald-100' : 'bg-indigo-100'
                        }`}>
                          {kind === 'debit'  ? <ArrowUpRight   className="h-5 w-5 text-red-500"     /> :
                           kind === 'credit' ? <ArrowDownLeft  className="h-5 w-5 text-emerald-500" /> :
                                              <Bell            className="h-5 w-5 text-indigo-500"  />}
                        </div>

                        {/* Body */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              {kind === 'credit' && (
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">CR</span>
                              )}
                              {kind === 'debit' && (
                                <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-red-100 text-red-600">DR</span>
                              )}
                              <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                            </div>
                            {!n.read && (
                              <button
                                onClick={e => { e.stopPropagation(); markAsRead(n.id); }}
                                className="shrink-0 p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                                title="Mark as read"
                              >
                                <Check className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                          <p className="text-xs text-gray-400 mt-1">
                            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                          </p>
                        </div>

                        {/* Amount badge + unread dot */}
                        <div className="shrink-0 flex flex-col items-end gap-1">
                          {amount && (kind === 'credit' || kind === 'debit') && (
                            <span className={`text-sm font-bold ${kind === 'credit' ? 'text-emerald-600' : 'text-red-500'}`}>
                              {kind === 'credit' ? '+' : '-'}{amount}
                            </span>
                          )}
                          {!n.read && <div className="w-2 h-2 rounded-full bg-indigo-500" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
