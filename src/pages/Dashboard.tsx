import React, { useState, useEffect } from 'react';
import BackButton from '@/components/ui/BackButton';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Plus, Edit, Trash2, Pause, Play, MessageSquare, Coins, User,
  Star, Eye, Heart, Gift, QrCode, Package, CreditCard,
  LayoutDashboard, Scan, ClipboardList, Briefcase, Loader2,
  ChevronRight, ChevronDown, PanelLeft, X, RefreshCw, Store, Zap, Filter,
  Wallet, ArrowDownLeft, ArrowUpRight, TrendingUp, Compass, Search, Ban, BookOpen, Clock, Bell, ArrowLeftRight,
} from "lucide-react";
import BusinessCard from '@/components/BusinessCard';
const DISCOVER_CATEGORIES = [
  { label: 'All Categories', value: '' },
  { label: 'Restaurant',     value: 'restaurant' },
  { label: 'Grocery',        value: 'grocery' },
  { label: 'Retail',         value: 'retail' },
  { label: 'Services',       value: 'service' },
  { label: 'Health',         value: 'health' },
  { label: 'Beauty',         value: 'beauty' },
  { label: 'Fitness',        value: 'fitness' },
  { label: 'Auto',           value: 'mechanic' },
  { label: 'Legal',          value: 'lawyer' },
  { label: 'Education',      value: 'tutor' },
  { label: 'Photography',    value: 'photographer' },
];
import AccountSettingsSection from '@/components/dashboard/AccountSettingsSection';
import MyBusinessSection from '@/components/dashboard/MyBusinessSection';
import TaxSettingsSection from '@/components/dashboard/TaxSettingsSection';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import OrderTracking from '@/components/orders/OrderTracking';
import ReviewSystem from '@/components/reviews/ReviewSystem';
import NewListingModal from '@/components/listings/NewListingModal';
import ReferralSystem from '@/components/referrals/ReferralSystem';
import LedgerSection from '@/components/dashboard/LedgerSection';
import CustomerBarcode from '@/components/barter/CustomerBarcode';
import SetupPIN from '@/components/barter/SetupPIN';
import { POSSetupReminder } from '@/components/merchant/POSSetupReminder';
import InboxSection from '@/components/messaging/InboxSection';
import MerchantSupportTab from '@/components/merchant/MerchantSupportTab';
import TradeRequestsPage from './TradeRequestsPage';
import MerchantDashboard from '@/components/merchant/MerchantDashboard';
import CreatePaymentRequest from '@/components/payment-requests/CreatePaymentRequest';
import { usePaymentRequests } from '@/hooks/usePaymentRequests';
import PaymentRequestDetailDialog from '@/components/payment-requests/PaymentRequestDetailDialog';
import { useAuth } from '@/hooks/useAuth';
import { useProducts } from '@/hooks/useProducts';
import { supabase } from '@/integrations/supabase/client';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { usePushTriggers } from '@/hooks/usePushTriggers';
import { useFavorites } from '@/hooks/useFavorites';
import { useToast } from '@/hooks/use-toast';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';

// ─── Nav ─────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'overview',         icon: LayoutDashboard, label: 'Overview',         subs: [] },
  { id: 'listings',         icon: Eye,             label: 'My Listings',      subs: [] },
  { id: 'discover',         icon: Compass,         label: 'Discover',         subs: [] },
  { id: 'favorites',        icon: Heart,           label: 'Favorites',        subs: [] },
  { id: 'inbox',            icon: MessageSquare,   label: 'Inbox',            subs: [] },
  { id: 'wallet',           icon: Wallet,          label: 'Wallet',           subs: [] },
  { id: 'payment-requests',    icon: CreditCard,      label: 'Payment Requests',     subs: ['Analytics', 'Daily Summary', 'Integrations', 'Transactions'] },
  { id: 'trade-send-request', icon: ArrowLeftRight,  label: 'Trade: Send / Request', subs: ['Send Barter', 'Request Barter', 'Trade Requests', 'Barter Notifications'] },
  { id: 'orders',           icon: Package,         label: 'Orders',           subs: [] },
  { id: 'reviews',          icon: Star,            label: 'Reviews',          subs: [] },
  { id: 'referrals',        icon: Gift,            label: 'Referrals',        subs: [] },
  { id: 'ledger',           icon: BookOpen,        label: 'Ledger',           subs: [] },
  { id: 'support',          icon: MessageSquare,   label: 'Support',          subs: [] },
  { id: 'profile',          icon: User,            label: 'Profile Settings', subs: ['Account', 'My Business', 'Barter QR', 'Tax', 'Integrations'] },
];

// ─── Helper Components ────────────────────────────────────────────────────────
const StatCard = ({
  icon: Icon, label, value, sub, color = 'emerald',
}: {
  icon: any; label: string; value: string | number | React.ReactNode; sub?: string; color?: string;
}) => {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-500 bg-emerald-50',
    blue:    'text-blue-500 bg-blue-50',
    purple:  'text-purple-500 bg-purple-50',
    amber:   'text-amber-500 bg-amber-50',
    indigo:  'text-indigo-500 bg-indigo-50',
  };
  const cls = colors[color] || colors.emerald;
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className={`p-2.5 rounded-xl ${cls} w-fit`}>
          <Icon className={`h-5 w-5 ${cls.split(' ')[0]}`} />
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
};

const SectionTitle = ({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) => (
  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
    <div>
      <h2 className="text-xl font-bold text-gray-900">{title}</h2>
      {sub && <p className="text-sm text-gray-500 mt-0.5">{sub}</p>}
    </div>
    {action && <div className="shrink-0">{action}</div>}
  </div>
);

const Pill = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    active:   'bg-emerald-100 text-emerald-700',
    paused:   'bg-amber-100 text-amber-700',
    pending:  'bg-amber-100 text-amber-700',
    inactive: 'bg-gray-100 text-gray-500',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

// ─── Profile Section ──────────────────────────────────────────────────────────
const ProfileSection = ({ user, userProfile, activeSub, onProfileSaved, posIntegrations, navigate }: {
  user: any; userProfile: any; activeSub: string; onProfileSaved: (updated: any) => void;
  posIntegrations: any[]; navigate: (path: string) => void;
}) => (
  <div className="space-y-6">
    {/* Header */}
    <div className="flex items-center gap-4">
      <div className="h-14 w-14 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
        <span className="text-emerald-500 text-xl font-bold">
          {(user?.email?.[0] ?? '?').toUpperCase()}
        </span>
      </div>
      <div>
        <h2 className="text-xl font-bold text-gray-900">{userProfile?.full_name || 'No name set'}</h2>
        <p className="text-sm text-gray-500">{userProfile?.email || user?.email}</p>
      </div>
    </div>

    {/* Account */}
    {activeSub === 'Account' && (
      <AccountSettingsSection user={user} profile={userProfile} onSaved={onProfileSaved} />
    )}

    {/* My Business */}
    {activeSub === 'My Business' && <MyBusinessSection user={user} />}

    {/* Barter QR */}
    {activeSub === 'Barter QR' && (
      <div className="flex flex-col sm:flex-row gap-6 items-start">
        <div className="flex-shrink-0 w-full sm:w-auto">
          <CustomerBarcode />
        </div>
        <div className="flex-1 min-w-0 w-full">
          <SetupPIN />
        </div>
      </div>
    )}

    {/* Tax */}
    {activeSub === 'Tax' && <TaxSettingsSection />}

    {/* Integrations */}
    {activeSub === 'Integrations' && (
      <div className="space-y-5">
        {/* Connected */}
        {posIntegrations.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-0 px-6 pt-5">
              <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" /> Connected POS Systems
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {posIntegrations.map((integration: any) => (
                  <div
                    key={integration.id}
                    className="flex items-center justify-between p-4 border border-emerald-200 bg-emerald-50/50 rounded-xl cursor-pointer hover:bg-emerald-50 transition-colors"
                    onClick={() => {
                      if (integration.provider.toLowerCase() === 'shopify') navigate('/shopify-pos-checkout');
                      else navigate('/merchant/dashboard');
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-emerald-100 rounded-lg">
                        <Scan className="h-5 w-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 capitalize">{integration.provider} POS</p>
                        <p className="text-xs text-gray-500">{integration.store_id}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-xs text-emerald-700 font-medium">Active</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Available integrations */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-0 px-6 pt-5">
            <CardTitle className="text-base font-semibold text-gray-900">Available Integrations</CardTitle>
            <p className="text-xs text-gray-400 mt-1">Connect your POS system to sync products and enable automated transactions</p>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { name: 'Shopify',  desc: 'Sync products & orders',       color: 'bg-green-50 text-green-700 border-green-200',  action: () => navigate('/merchant/dashboard') },
                { name: 'Square',   desc: 'In-person & online payments',  color: 'bg-blue-50 text-blue-700 border-blue-200',    action: () => navigate('/merchant/dashboard') },
                { name: 'Clover',   desc: 'Point-of-sale integration',    color: 'bg-orange-50 text-orange-700 border-orange-200', action: () => navigate('/merchant/dashboard') },
                { name: 'Toast',    desc: 'Restaurant POS system',        color: 'bg-red-50 text-red-700 border-red-200',       action: () => navigate('/merchant/dashboard') },
              ].map(({ name, desc, color, action }) => {
                const connected = posIntegrations.some(p => p.provider.toLowerCase() === name.toLowerCase());
                return (
                  <div
                    key={name}
                    onClick={connected ? undefined : action}
                    className={`flex items-center justify-between p-4 border rounded-xl transition-all ${connected ? 'cursor-default opacity-70 border-emerald-100 bg-emerald-50/30' : 'cursor-pointer hover:shadow-sm border-gray-100 hover:border-gray-200'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-xl border flex items-center justify-center text-xs font-black ${color}`}>
                        {name[0]}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{name}</p>
                        <p className="text-xs text-gray-400">{connected ? 'Already connected' : desc}</p>
                      </div>
                    </div>
                    {connected ? (
                      <span className="text-xs font-semibold text-emerald-600 bg-emerald-100 px-2.5 py-1 rounded-full">Connected</span>
                    ) : (
                      <span className="text-xs font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full">Connect</span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    )}
  </div>
);

// ─── Wallet Section ───────────────────────────────────────────────────────────
const WalletSection = ({ userId, barterPoints, barterPointsLoading }: {
  userId?: string; barterPoints: number | null; barterPointsLoading: boolean;
}) => {
  const [txns, setTxns] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState<'all' | 'received' | 'sent'>('all');

  const fetchTxns = React.useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase.from('transactions')
      .select('id, service_description, points_amount, created_at, from_user_id, to_user_id, status')
      .or(`from_user_id.eq.${userId},to_user_id.eq.${userId}`)
      .order('created_at', { ascending: false });
    if (!data || data.length === 0) { setLoading(false); return; }
    const ids = [...new Set(data.map((t: any) => t.from_user_id === userId ? t.to_user_id : t.from_user_id))];
    const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, business_name').in('user_id', ids);
    const nameMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.user_id, p.business_name || p.full_name || 'Unknown']));
    setTxns(data.map((t: any) => ({
      ...t,
      otherName: nameMap[t.from_user_id === userId ? t.to_user_id : t.from_user_id] ?? 'Unknown',
      isSent: t.from_user_id === userId,
    })));
    setLoading(false);
  }, [userId]);

  React.useEffect(() => {
    fetchTxns();
  }, [fetchTxns]);

  // Realtime: refresh wallet history on any transaction change
  React.useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`wallet_txns_${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, () => {
        fetchTxns();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchTxns]);

  const filtered = filter === 'all' ? txns : txns.filter(t => filter === 'sent' ? t.isSent : !t.isSent);

  const totalReceived = txns.filter(t => !t.isSent && t.status === 'completed').reduce((s, t) => s + (t.points_amount ?? 0), 0);
  const totalSent = txns.filter(t => t.isSent && t.status === 'completed').reduce((s, t) => s + (t.points_amount ?? 0), 0);

  return (
    <div className="space-y-6">
      <SectionTitle title="Wallet" sub="Your barter balance and transaction history" />

      {/* Balance + stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm sm:col-span-1 bg-gradient-to-br from-emerald-500 to-teal-600">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-4 w-4 text-white/70" />
              <p className="text-white/70 text-sm">Barter Balance</p>
            </div>
            {barterPointsLoading
              ? <Loader2 className="h-6 w-6 animate-spin text-white mt-2" />
              : <p className="text-4xl font-black text-white mt-1">${barterPoints?.toLocaleString() ?? 0}</p>
            }
            <p className="text-white/60 text-xs mt-2">Available credits</p>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-emerald-50">
              <ArrowDownLeft className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">${totalReceived.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Total Received</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardContent className="p-5 flex items-center gap-4">
            <div className="p-2.5 rounded-xl bg-rose-50">
              <ArrowUpRight className="h-5 w-5 text-rose-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">${totalSent.toLocaleString()}</p>
              <p className="text-sm text-gray-500">Total Sent</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Transaction history */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="px-5 pt-5 pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-gray-900">Transaction History</CardTitle>
            <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
              {(['all', 'received', 'sent'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${filter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 px-5 pb-5">
          {loading ? (
            <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <TrendingUp className="h-10 w-10 mx-auto mb-3 text-gray-200" />
              <p className="text-gray-500 font-medium">No transactions yet</p>
              <p className="text-sm text-gray-400 mt-1">Your barter history will appear here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map(t => (
                <div key={t.id} className="flex items-center justify-between px-3 py-3 rounded-xl hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl ${t.isSent ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                      {t.isSent
                        ? <ArrowUpRight className="h-4 w-4 text-rose-500" />
                        : <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
                      }
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {t.isSent ? `Sent to ${t.otherName}` : `Received from ${t.otherName}`}
                      </p>
                      {t.service_description && (
                        <p className="text-xs text-gray-400 truncate max-w-xs">{t.service_description}</p>
                      )}
                      <p className="text-xs text-gray-400">
                        {new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${t.isSent ? 'text-rose-500' : 'text-emerald-500'}`}>
                      {t.isSent ? '-' : '+'}{t.points_amount ?? 0} pts
                    </p>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      t.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                    }`}>
                      {t.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

// ─── Discover Section ─────────────────────────────────────────────────────────
const PAGE_SIZE = 9;

const DiscoverSection = ({ currentUserId, onToggleFavorite, isFavorite }: { currentUserId?: string; onToggleFavorite?: (id: string) => void; isFavorite?: (id: string) => boolean }) => {
  const [businesses, setBusinesses] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(true);
  const [page, setPage] = React.useState(0);
  const [search, setSearch] = React.useState('');
  const [searchInput, setSearchInput] = React.useState('');
  const [category, setCategory] = React.useState('');

  const fetchPage = React.useCallback(async (pageIndex: number, replace: boolean) => {
    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    let query = supabase
      .from('businesses')
      .select('id, business_name, category, description, services_offered, barter_percentage, location, contact_method, status, user_id')
      .eq('status', 'active')
      .order('barter_percentage', { ascending: false })
      .range(from, to);
    if (currentUserId) query = query.neq('user_id', currentUserId);
    if (search) query = query.or(`business_name.ilike.%${search}%,category.ilike.%${search}%,description.ilike.%${search}%,location.ilike.%${search}%`);
    if (category) query = query.ilike('category', `%${category}%`);
    const { data } = await query;
    const results = (data || []).map(b => ({
      id: b.id,
      businessName: b.business_name,
      category: b.category,
      servicesOffered: b.services_offered || [],
      wantingInReturn: [],
      estimatedValue: 0,
      location: b.location || '',
      contactMethod: b.contact_method || '',
      rating: 4.5,
      reviews: 0,
      verified: false,
      points: 0,
      image: '/placeholder.svg',
      description: b.description || '',
      barterPercentage: Number(b.barter_percentage) || 20,
    }));
    if (replace) {
      setBusinesses(results);
    } else {
      setBusinesses(prev => {
        const ids = new Set(prev.map(b => b.id));
        return [...prev, ...results.filter((b: any) => !ids.has(b.id))];
      });
    }
    setHasMore(results.length === PAGE_SIZE);
  }, [search, category, currentUserId]);

  React.useEffect(() => {
    setLoading(true);
    setPage(0);
    setBusinesses([]);
    fetchPage(0, true).finally(() => setLoading(false));
  }, [fetchPage]);

  const loadMore = async () => {
    const next = page + 1;
    setPage(next);
    setLoadingMore(true);
    await fetchPage(next, false);
    setLoadingMore(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  return (
    <div className="space-y-5">
      <SectionTitle title="Discover" sub="Find businesses and services to trade with" />

      {/* Search + Category */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearch} className="relative flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search businesses or services..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
            />
          </div>
          <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-4">
            Search
          </Button>
        </form>

        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 sm:w-48"
        >
          {DISCOVER_CATEGORIES.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading...
        </div>
      ) : businesses.length === 0 ? (
        <div className="text-center py-16">
          <Compass className="h-10 w-10 mx-auto mb-3 text-gray-200" />
          <p className="text-gray-500 font-medium">No businesses found</p>
          <p className="text-sm text-gray-400 mt-1">Try a different search or category</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {businesses.map(b => (
              <BusinessCard key={b.id} business={b} onToggleFavorite={onToggleFavorite} isFavorite={isFavorite} />
            ))}
          </div>
          {hasMore && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={loadingMore}
                className="rounded-xl border-gray-200 text-gray-600 hover:border-indigo-300 hover:text-indigo-600"
              >
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Load More
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Static mock data ─────────────────────────────────────────────────────────
const myListings = [
  { id: 1, businessName: 'Digital Marketing Solutions', category: 'Marketing', status: 'active',  views: 45, inquiries: 7, createdAt: 'Nov 15, 2024' },
  { id: 2, businessName: 'SEO Consultation',            category: 'Marketing', status: 'paused',  views: 23, inquiries: 3, createdAt: 'Nov 10, 2024' },
];

// ─── Main Component ───────────────────────────────────────────────────────────
const VALID_TABS = ['overview', 'listings', 'discover', 'favorites', 'inbox', 'wallet', 'payment-requests', 'trade-send-request', 'orders', 'reviews', 'referrals', 'ledger', 'support', 'profile'];
const VALID_SUBS = ['Account', 'My Business', 'Barter QR', 'Tax', 'Integrations'];
const VALID_PAYMENT_SUBS = ['Analytics', 'Daily Summary', 'Integrations', 'Transactions'];
const VALID_TRADE_SUBS = ['Send Barter', 'Request Barter', 'Trade Requests', 'Barter Notifications'];

const Dashboard = () => {
  const { notificationsEnabled, enableNotifications } = usePushNotifications();
  usePushTriggers();
  const { favorites, loading: favLoading, toggleFavorite, isFavorite } = useFavorites();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showPOSReminder, setShowPOSReminder] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [posIntegrations, setPosIntegrations] = useState<any[]>([]);
  const [barterPoints, setBarterPoints] = useState<number | null>(null);
  const [barterPointsLoading, setBarterPointsLoading] = useState(true);
  const [creditLine, setCreditLine] = useState<number>(500);
  const [creditLineLoading, setCreditLineLoading] = useState(true);
  const [userBusinesses, setUserBusinesses] = useState<any[]>([]);
  const [userServices, setUserServices] = useState<any[]>([]);
  const [listingFilter, setListingFilter] = useState<'all' | 'active' | 'pending' | 'inactive'>('all');
  const [listingTab, setListingTab] = useState<'products' | 'services'>(
    (!userProfile?.business_type || userProfile?.business_type === 'service') ? 'services' : 'products'
  );
  const [productPage, setProductPage] = useState(0);
  const PRODUCT_PAGE_SIZE = 20;
  const [showNewListing, setShowNewListing] = useState(false);
  const [completedTrades, setCompletedTrades] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [recentActivity, setRecentActivity] = useState<{ id: string; description: string; points: string | null; timestamp: string }[]>([]);

  const refreshBusinesses = async () => {
    if (!user) return;
    const { data, error } = await supabase.from('businesses')
      .select('id, business_name, category, status, created_at, description, images, estimated_value')
      .eq('user_id', user.id);
    if (error) console.error('Failed to load businesses:', error);
    setUserBusinesses(data || []);
  };

  const refreshServices = async () => {
    if (!user) return;
    const { data, error } = await supabase.from('services')
      .select('id, name, description, status, created_at')
      .eq('merchant_id', user.id)
      .order('created_at', { ascending: false });
    if (error) console.error('Failed to load services:', error);
    setUserServices(data || []);
  };

  const { user } = useAuth();
  const { products: posProducts, refetch: refetchProducts } = useProducts();
  const { toast } = useToast();
  const { notifications, markAsRead } = useNotifications();
  const { receivedRequests, sentRequests, acceptSendRequest, rejectPaymentRequest } = usePaymentRequests();
  const [barterDialogRequest, setBarterDialogRequest] = React.useState<any>(null);
  const [barterDialogOpen, setBarterDialogOpen] = React.useState(false);
  const [processingId, setProcessingId] = React.useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Foreground push notification click → navigate to inbox without full reload
  useEffect(() => {
    const handler = () => setSearchParams({ tab: 'inbox' });
    window.addEventListener('fcm:navigate-inbox', handler);
    return () => window.removeEventListener('fcm:navigate-inbox', handler);
  }, [setSearchParams]);

  // Keep last visited dashboard URL in sessionStorage so admin Back button can return here
  useEffect(() => {
    sessionStorage.setItem('lastDashboardUrl', window.location.pathname + window.location.search);
  }, [searchParams]);


  const activeSection = VALID_TABS.includes(searchParams.get('tab') ?? '') ? searchParams.get('tab')! : 'overview';
  const profileSub = VALID_SUBS.includes(searchParams.get('sub') ?? '') ? searchParams.get('sub')! : 'Account';
  const paymentSub = VALID_PAYMENT_SUBS.includes(searchParams.get('psub') ?? '') ? searchParams.get('psub')! : 'Analytics';
  const tradeSub = VALID_TRADE_SUBS.includes(searchParams.get('tsub') ?? '') ? searchParams.get('tsub')! : '';

  const setActiveSection = (section: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', section);
      if (section !== 'profile') next.delete('sub');
      if (section !== 'trade-send-request') next.delete('tsub');
      return next;
    });
  };

  const setProfileSub = (sub: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'profile');
      next.set('sub', sub);
      return next;
    });
  };

  const setPaymentSub = (sub: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'payment-requests');
      next.set('psub', sub);
      return next;
    });
  };

  const setTradeSub = (sub: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.set('tab', 'trade-send-request');
      next.set('tsub', sub);
      return next;
    });
  };

  useEffect(() => {
    if (!user) return;

    supabase.from('profiles')
      .select('pos_setup_preference, id, full_name, email, barter_percentage, created_at, phone, business_name, business_type, location, website')
      .eq('user_id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('Failed to load profile:', error);
          toast({ title: 'Error', description: 'Could not load your profile.', variant: 'destructive' });
          return;
        }
        if (data) {
          setUserProfile(data);
          setShowPOSReminder(data.pos_setup_preference === 'pending' || data.pos_setup_preference === 'later');
          // Set default listing tab based on business type
          if (data.business_type === 'service' || (!data.business_type)) {
            setListingTab('services');
          } else {
            setListingTab('products');
          }
        }
      });

    refreshBusinesses();
    refreshServices();

    supabase.from('pos_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .then(({ data, error }) => {
        if (error) console.error('Failed to load POS integrations:', error);
        setPosIntegrations(data || []);
      });

    supabase.from('user_credits')
      .select('available_credits')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) console.error('Failed to load barter credits:', error);
        setBarterPoints(data?.available_credits ?? 0);
        setBarterPointsLoading(false);
      });

    supabase.from('merchant_credit_profiles')
      .select('credit_line')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setCreditLine(data?.credit_line ?? 500);
        setCreditLineLoading(false);
      });

    // Completed trades count (transactions + payment_requests + pos scans)
    Promise.all([
      supabase.from('transactions').select('id', { count: 'exact', head: true })
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .eq('status', 'completed')
        .neq('transaction_type', 'payment_request'),
      supabase.from('payment_requests').select('id', { count: 'exact', head: true })
        .or(`seller_id.eq.${user.id},buyer_id.eq.${user.id}`)
        .eq('status', 'paid'),
      supabase.from('pos_barcode_scans').select('id', { count: 'exact', head: true })
        .or(`customer_id.eq.${user.id},merchant_id.eq.${user.id}`)
        .eq('status', 'completed'),
    ]).then(([t, p, s]) => {
      setCompletedTrades((t.count ?? 0) + (p.count ?? 0) + (s.count ?? 0));
    });

    // Pending payment requests count
    supabase.from('payment_requests').select('id', { count: 'exact', head: true })
      .eq('buyer_id', user.id)
      .eq('status', 'pending')
      .then(({ count }) => setPendingRequestsCount(count ?? 0));

    // Recent activity from transactions
    supabase.from('transactions')
      .select('id, service_description, points_amount, created_at, from_user_id, to_user_id, status')
      .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(async ({ data: txns }) => {
        if (!txns || txns.length === 0) return;
        const otherIds = [...new Set(txns.map(t => t.from_user_id === user.id ? t.to_user_id : t.from_user_id))];
        const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, business_name').in('user_id', otherIds);
        const nameMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p.business_name || p.full_name || 'Unknown']));
        setRecentActivity(txns.map(t => {
          const otherId = t.from_user_id === user.id ? t.to_user_id : t.from_user_id;
          const otherName = nameMap[otherId] ?? 'Unknown';
          const isSent = t.from_user_id === user.id;
          const date = new Date(t.created_at);
          const diffMs = Date.now() - date.getTime();
          const diffDays = Math.floor(diffMs / 86400000);
          const timeAgo = diffDays === 0 ? 'Today' : diffDays === 1 ? 'Yesterday' : `${diffDays} days ago`;
          return {
            id: t.id,
            description: t.status === 'completed'
              ? `Completed trade with ${otherName}`
              : isSent
              ? `Sent credit request to ${otherName}`
              : `Received credit request from ${otherName}`,
            points: t.points_amount ? (isSent ? `-${t.points_amount}` : `+${t.points_amount}`) + ' pts' : null,
            timestamp: timeAgo,
          };
        }));
      });
  }, [user]);

  // Realtime: update balance instantly when user_credits changes
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`wallet_credits_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_credits', filter: `user_id=eq.${user.id}` },
        (payload: any) => {
          if (payload.new?.available_credits !== undefined) {
            setBarterPoints(payload.new.available_credits);
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Realtime: refresh wallet transaction history when transactions change
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`wallet_transactions_${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'transactions' },
        async (payload: any) => {
          const tx = payload.new;
          if (tx?.from_user_id === user.id || tx?.to_user_id === user.id) {
            supabase.from('user_credits')
              .select('available_credits')
              .eq('user_id', user.id)
              .maybeSingle()
              .then(({ data }) => {
                if (data?.available_credits !== undefined) setBarterPoints(data.available_credits);
              });
          }
          const { data: txns } = await supabase
            .from('transactions')
            .select('id, service_description, points_amount, created_at, from_user_id, to_user_id, status')
            .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
            .order('created_at', { ascending: false })
            .limit(5);
          if (!txns || txns.length === 0) return;
          const otherIds = [...new Set(txns.map((t: any) => t.from_user_id === user.id ? t.to_user_id : t.from_user_id))];
          const { data: profiles } = await supabase.from('profiles').select('user_id, full_name, business_name').in('user_id', otherIds);
          const nameMap = Object.fromEntries((profiles ?? []).map((p: any) => [p.user_id, p.business_name || p.full_name || 'Unknown']));
          setRecentActivity(txns.map((t: any) => {
            const otherId = t.from_user_id === user.id ? t.to_user_id : t.from_user_id;
            const isSent = t.from_user_id === user.id;
            const diffDays = Math.floor((Date.now() - new Date(t.created_at).getTime()) / 86400000);
            return {
              id: t.id,
              description: t.status === 'completed'
                ? `Completed trade with ${nameMap[otherId] ?? 'Unknown'}`
                : isSent
                ? `Sent credit request to ${nameMap[otherId] ?? 'Unknown'}`
                : `Received credit request from ${nameMap[otherId] ?? 'Unknown'}`,
              points: t.points_amount ? (isSent ? `-${t.points_amount}` : `+${t.points_amount}`) + ' pts' : null,
              timestamp: diffDays === 0 ? 'Today' : diffDays === 1 ? 'Yesterday' : `${diffDays} days ago`,
            };
          }));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleDismissReminder = async () => {
    if (!user) return;
    const { error } = await supabase.from('profiles').update({ pos_setup_preference: 'not_needed' }).eq('user_id', user.id);
    if (error) { toast({ title: 'Failed to dismiss reminder', description: error.message, variant: 'destructive' }); return; }
    setShowPOSReminder(false);
    toast({ title: 'Reminder dismissed', description: 'You can still connect your POS anytime from POS Integration.' });
  };

  // Auto-expand sidebar when activeSection CHANGES (e.g. header nav link clicked)
  // but NOT on initial page load (prevRef starts null)
  const prevSectionRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (prevSectionRef.current !== null && prevSectionRef.current !== activeSection) {
      const item = NAV_ITEMS.find(n => n.id === activeSection);
      if (item && (item.subs as string[]).length > 0) {
        setExpandedSections(prev => {
          if (prev.has(activeSection)) return prev;
          const next = new Set(prev);
          next.add(activeSection);
          return next;
        });
      }
    }
    prevSectionRef.current = activeSection;
  }, [activeSection]);

  const isSuspended = userBusinesses.some((b: any) => b.status === 'suspended');

  if (isSuspended) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
            <Ban className="h-10 w-10 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Account Suspended</h1>
          <p className="text-gray-500 mb-6">
            Your account has been suspended by our team. You are not able to make trades or access your dashboard at this time.
          </p>
          <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-left space-y-2 mb-6">
            <p className="text-sm font-semibold text-red-800">What to do next:</p>
            <p className="text-sm text-red-700">Please contact our support team to resolve this issue and restore access to your account.</p>
            <a
              href="mailto:support@valuehubexchange.com"
              className="inline-flex items-center gap-2 mt-2 text-sm font-semibold text-red-700 underline underline-offset-2 hover:text-red-900"
            >
              support@valuehubexchange.com
            </a>
          </div>
          <p className="text-xs text-gray-400">If you believe this is a mistake, please email us with your account details and we'll review your case promptly.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex bg-gray-50 min-h-screen">

      {/* ── Mobile overlay backdrop ─────────────────────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ────────────────────────────────────────────────────────────── */}
      <aside className={`w-56 bg-[#0f1117] flex flex-col shrink-0 fixed md:sticky top-0 h-screen z-40 transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="h-14 flex items-center px-5 border-b border-white/10 shrink-0">
          <LayoutDashboard className="h-5 w-5 text-emerald-400 mr-2.5" />
          <span className="text-white font-bold">Dashboard</span>
          <button
            className="ml-auto md:hidden text-gray-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ id, icon: Icon, label, subs, redirect }: any) => {
            const active = activeSection === id;
            const hasSubs = subs.length > 0;
            return (
              <div key={id}>
                <button
                  onClick={() => {
                    if (redirect) { navigate(redirect); return; }
                    if (id === 'trade-send-request') { setTradeSub('Send Barter'); }
                    else setActiveSection(id);
                    if (!hasSubs) setSidebarOpen(false);
                    // Always expand when clicking a tab with sub-items
                    if (hasSubs) {
                      setExpandedSections(prev => {
                        const next = new Set(prev);
                        next.add(id);
                        return next;
                      });
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                    active
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-emerald-400' : ''}`} />
                  <span className="flex-1">{label}</span>
                  {id === 'inbox' && pendingRequestsCount > 0 && (
                    <span className="h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                      {pendingRequestsCount}
                    </span>
                  )}
                  {hasSubs && (
                    <span
                      role="button"
                      onClick={e => {
                        e.stopPropagation();
                        setExpandedSections(prev => {
                          const next = new Set(prev);
                          next.has(id) ? next.delete(id) : next.add(id);
                          return next;
                        });
                      }}
                      className="p-0.5 rounded"
                    >
                      <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${expandedSections.has(id) ? 'rotate-180 text-emerald-400' : 'text-gray-600'}`} />
                    </span>
                  )}
                </button>

                {/* Sub-items */}
                {hasSubs && expandedSections.has(id) && (
                  <div className="mt-0.5 ml-3 pl-3 border-l border-white/10 space-y-0.5">
                    {subs.map(sub => {
                      const activeSub = id === 'profile' ? profileSub : id === 'trade-send-request' ? tradeSub : paymentSub;
                      const isActive = activeSub === sub && activeSection === id;
                      return (
                        <button
                          key={sub}
                          onClick={() => {
                            if (id === 'profile') setProfileSub(sub);
                            else if (id === 'trade-send-request') setTradeSub(sub);
                            else setPaymentSub(sub);
                            setSidebarOpen(false);
                          }}
                          className={`w-full text-left text-xs px-2.5 py-2 rounded-lg transition-all ${
                            isActive
                              ? 'bg-emerald-500/10 text-emerald-400 font-medium'
                              : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'
                          }`}
                        >
                          {sub}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User info */}
        <div className="px-4 py-4 border-t border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0">
              <span className="text-emerald-400 text-xs font-bold">
                {(user?.email?.[0] ?? '?').toUpperCase()}
              </span>
            </div>
            <p className="text-xs text-gray-300 truncate min-w-0">{user?.email ?? '—'}</p>
          </div>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <main className="flex-1 p-4 md:p-6 md:ml-0 min-w-0">

        <div className="hidden md:block mb-4"><BackButton /></div>

        {/* Mobile top bar */}
        <div className="flex items-center gap-3 mb-4 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2.5 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-all shadow-sm"
          >
            <PanelLeft className="h-5 w-5" />
          </button>
          <span className="text-base font-semibold text-gray-800 capitalize">{activeSection.replace('-', ' ')}</span>
        </div>

        {showPOSReminder && (
          <div className="mb-6">
            <POSSetupReminder onConnect={() => navigate('/merchant/dashboard')} onDismiss={handleDismissReminder} />
          </div>
        )}

        {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
        {activeSection === 'overview' && (
          <div className="space-y-6">
            {/* Under review notice */}
            {userBusinesses.some((b: any) => b.status === 'pending') && (
              <div className="flex items-start gap-3 px-4 py-3 rounded-xl bg-blue-50 border border-blue-100">
                <Clock className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-blue-800">Your account is under review</p>
                  <p className="text-xs text-blue-500 mt-0.5">We're verifying your details. Full access will be unlocked once approved — usually within 24 hours.</p>
                </div>
              </div>
            )}

            {/* Notification opt-in banner */}
            {!notificationsEnabled && 'Notification' in window && (
              <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100">
                <div className="flex items-center gap-3">
                  <Bell className="h-4 w-4 text-amber-500 shrink-0" />
                  <p className="text-sm text-amber-800">Enable push notifications to get alerts for messages and trade requests.</p>
                </div>
                <Button size="sm" variant="outline" className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100" onClick={enableNotifications}>
                  Enable
                </Button>
              </div>
            )}

            <SectionTitle
              title="Overview"
              sub="Welcome back! Here's what's happening with your trades."
              action={
                <Button onClick={() => setShowNewListing(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Plus className="h-4 w-4 mr-2" />{userProfile?.business_type === 'both' ? 'Add Product/Service' : userProfile?.business_type === 'product' ? 'Add Product' : 'Add Service'}
                </Button>
              }
            />

            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                icon={Coins}
                label="Barter Points"
                value={barterPointsLoading ? <Loader2 className="h-5 w-5 animate-spin text-emerald-500" /> : `$${barterPoints?.toLocaleString() ?? 0}`}
                color="emerald"
              />
              <StatCard icon={Eye}          label="Active Listings"   value={userServices.filter(l => l.status === 'active').length} color="blue"   />
              <StatCard icon={Star}         label="Completed Trades"  value={completedTrades}                                       color="purple" />
              <StatCard icon={MessageSquare}label="Pending Requests"  value={pendingRequestsCount}                                  color="amber"  />
            </div>

            {/* Credit Limit Usage */}
            {!creditLineLoading && (
              <Card className="border-0 shadow-sm">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="text-sm font-semibold text-gray-900">Credit Limit</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {(barterPoints ?? 0) >= 0
                          ? `You have ${(barterPoints ?? 0).toLocaleString()} pts available · Limit: ${creditLine.toLocaleString()} pts`
                          : `You've used ${Math.abs(barterPoints ?? 0).toLocaleString()} of your ${creditLine.toLocaleString()} pt credit limit`
                        }
                      </p>
                    </div>
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                      (barterPoints ?? 0) >= 0
                        ? 'bg-emerald-50 text-emerald-600'
                        : Math.abs(barterPoints ?? 0) / creditLine >= 0.8
                        ? 'bg-red-50 text-red-600'
                        : 'bg-amber-50 text-amber-600'
                    }`}>
                      {(barterPoints ?? 0) >= 0 ? '0%' : `${Math.min(100, Math.round((Math.abs(barterPoints ?? 0) / creditLine) * 100))}%`} used
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        (barterPoints ?? 0) >= 0
                          ? 'bg-emerald-400'
                          : Math.abs(barterPoints ?? 0) / creditLine >= 0.8
                          ? 'bg-red-400'
                          : 'bg-amber-400'
                      }`}
                      style={{ width: `${(barterPoints ?? 0) >= 0 ? 0 : Math.min(100, Math.round((Math.abs(barterPoints ?? 0) / creditLine) * 100))}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[10px] text-gray-400">0</span>
                    <span className="text-[10px] text-gray-400">–{creditLine.toLocaleString()} pts limit</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Activity */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-0 px-6 pt-5">
                <CardTitle className="text-base font-semibold text-gray-900">Recent Activity</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-1">
                  {recentActivity.map(activity => (
                    <div key={activity.id} className="flex items-center justify-between px-2 py-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{activity.timestamp}</p>
                      </div>
                      {activity.points && (
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                          {activity.points}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <div>
              <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick Actions</p>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                {[
                  { icon: Scan,         label: 'Scan',             color: 'text-violet-600 bg-violet-50',  action: () => setProfileSub('Barter QR') },
                  { icon: CreditCard,   label: 'Payment Request',  color: 'text-indigo-600 bg-indigo-50',  action: () => navigate('/merchant/dashboard?tab=requests') },
                  { icon: Briefcase,    label: 'Integration',      color: 'text-blue-600 bg-blue-50',      action: () => setProfileSub('Integrations') },
                  { icon: Package,      label: 'Track Orders',     color: 'text-purple-600 bg-purple-50',  action: () => setActiveSection('orders') },
                  { icon: Gift,         label: 'Earn Referrals',   color: 'text-amber-600 bg-amber-50',    action: () => setActiveSection('referrals') },
                ].map(({ icon: Icon, label, color, action }) => (
                  <Card key={label} className="border-0 shadow-sm cursor-pointer hover:shadow-md transition-shadow" onClick={action}>
                    <CardContent className="flex flex-col items-center justify-center p-5">
                      <div className={`p-3 rounded-xl ${color.split(' ')[1]} mb-2`}>
                        <Icon className={`h-5 w-5 ${color.split(' ')[0]}`} />
                      </div>
                      <p className="text-sm font-medium text-gray-700">{label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── MY LISTINGS ──────────────────────────────────────────────────── */}
        {activeSection === 'listings' && (
          <div className="space-y-5">

            {/* Store Header */}
            <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center shrink-0">
                  <Store className="w-7 h-7 text-indigo-300" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-lg leading-tight">
                    {userProfile?.business_name || userProfile?.full_name || 'My Store'}
                  </h2>
                  <p className="text-white/50 text-xs mt-0.5">
                    {userServices.length} service{userServices.length !== 1 ? 's' : ''} · {userServices.filter((s: any) => s.status === 'active').length} active
                    {userProfile?.barter_percentage > 0 && (
                      <span className="ml-2 bg-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                        {userProfile.barter_percentage}% Barter
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={() => navigate('/merchant/products')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-all"
                >
                  <Package className="w-3.5 h-3.5" /> Products
                </button>
                <Button onClick={() => setShowNewListing(true)} className="bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white border-0 text-xs h-9">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />{userProfile?.business_type === 'both' ? 'Add Product/Service' : userProfile?.business_type === 'product' ? 'Add Product' : 'Add Service'}
                </Button>
              </div>
            </div>

            {/* POS Sync Banner */}
            {posIntegrations.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg shrink-0">
                    <Zap className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-800">POS Connected</p>
                    <p className="text-xs text-emerald-600">
                      {posIntegrations.map((p: any) => p.provider).join(', ')} · Sync to import all your products
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/merchant/products')}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-all shrink-0"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> Sync Products
                </button>
              </div>
            )}


            {/* Listings */}
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-0 px-5 pt-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  {/* Product / Service tabs — always show for 'both', conditionally for single type */}
                  <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
                    {(userProfile?.business_type === 'product' || userProfile?.business_type === 'both') && (
                      <button
                        onClick={() => { setListingTab('products'); setProductPage(0); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${listingTab === 'products' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        <Package className="h-3.5 w-3.5" />
                        Products {posProducts.length > 0 && <span className="ml-0.5 text-[10px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-bold">{posProducts.length}</span>}
                      </button>
                    )}
                    {(userProfile?.business_type === 'service' || userProfile?.business_type === 'both' || !userProfile?.business_type) && (
                      <button
                        onClick={() => setListingTab('services')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${listingTab === 'services' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        <Store className="h-3.5 w-3.5" />
                        Services {userServices.length > 0 && <span className="ml-0.5 text-[10px] bg-violet-100 text-violet-600 px-1.5 py-0.5 rounded-full font-bold">{userServices.length}</span>}
                      </button>
                    )}
                  </div>

                  {/* Service status filter — only on services tab */}
                  {listingTab === 'services' && (
                    <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 w-fit">
                      {(['all', 'active', 'pending', 'inactive'] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => setListingFilter(f)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${listingFilter === f ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                          {f === 'all' ? `All (${userServices.length})` : f}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="pt-4 px-5 pb-5">

                {/* ── PRODUCTS TAB ── */}
                {listingTab === 'products' && (
                  !posProducts || posProducts.length === 0 ? (
                    <div className="text-center py-14">
                      <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                        <Package className="h-8 w-8 text-emerald-300" />
                      </div>
                      <p className="text-gray-700 font-semibold mb-1">No products yet</p>
                      <p className="text-sm text-gray-400 mb-5">Add a product manually or sync from your POS</p>
                      <div className="flex items-center gap-3 justify-center">
                        <Button onClick={() => setShowNewListing(true)} className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-0">
                          <Plus className="h-4 w-4 mr-1.5" /> Add Product
                        </Button>
                        <button onClick={() => navigate('/merchant/dashboard')}
                          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-all">
                          <RefreshCw className="h-4 w-4" /> Sync POS
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                        {posProducts.slice(productPage * PRODUCT_PAGE_SIZE, (productPage + 1) * PRODUCT_PAGE_SIZE).map((product: any) => (
                          <div key={product.id} className="group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-gray-100">
                            {/* Image */}
                            <div className="relative w-full h-44 bg-gray-50 overflow-hidden">
                              <img
                                src={product.image_url || `https://placehold.co/300x176/f3f4f6/9ca3af?text=${encodeURIComponent(product.name || 'Product')}`}
                                alt={product.name}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                              {/* Dark gradient at bottom of image */}
                              <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/30 to-transparent" />
                              {/* Heart */}
                              <button className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-white/90 hover:bg-white text-gray-400 hover:text-red-500 transition-all shadow-sm">
                                <Heart className="h-3.5 w-3.5" />
                              </button>
                              {/* Barter badge */}
                              {product.barter_enabled && (
                                <span className="absolute top-2.5 left-2.5 bg-indigo-600 text-white text-[9px] font-bold px-2 py-0.5 rounded-full tracking-wide">
                                  BARTER
                                </span>
                              )}
                              {/* Out of stock overlay */}
                              {product.stock_quantity === 0 && (
                                <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center">
                                  <span className="text-[11px] font-bold text-gray-600 bg-white px-3 py-1 rounded-full shadow border border-gray-200">Out of Stock</span>
                                </div>
                              )}
                              {/* Manage button — slides up on hover */}
                              <div className="absolute bottom-2 left-0 right-0 flex justify-center translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-200">
                                <button
                                  onClick={() => navigate('/merchant/dashboard')}
                                  className="flex items-center gap-1.5 px-4 py-1.5 bg-white rounded-full text-xs font-semibold text-gray-800 shadow-lg hover:bg-gray-50 transition-all border border-gray-100"
                                >
                                  <Edit className="h-3 w-3" /> Manage
                                </button>
                              </div>
                            </div>

                            {/* Info */}
                            <div className="p-3 space-y-1">
                              <p className="text-[10px] text-gray-400 uppercase tracking-widest font-medium">{product.category || 'Uncategorized'}</p>
                              <p className="text-sm font-semibold text-gray-900 line-clamp-2 leading-snug">{product.name}</p>
                              <div className="flex items-center justify-between pt-1">
                                <span className="text-base font-bold text-gray-900">
                                  {product.price != null ? `$${Number(product.price).toFixed(2)}` : '—'}
                                </span>
                                {product.stock_quantity != null && (
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${product.stock_quantity > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-500'}`}>
                                    {product.stock_quantity > 0 ? `${product.stock_quantity} in stock` : 'Out of stock'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Pagination */}
                      {posProducts.length > PRODUCT_PAGE_SIZE && (() => {
                        const totalPages = Math.ceil(posProducts.length / PRODUCT_PAGE_SIZE);
                        const page = productPage + 1;
                        return (
                          <div className="flex items-center justify-between mt-6 pt-4 border-t">
                            <p className="text-xs text-gray-500">
                              Showing {productPage * PRODUCT_PAGE_SIZE + 1}–{Math.min(page * PRODUCT_PAGE_SIZE, posProducts.length)} of {posProducts.length}
                            </p>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setProductPage(p => Math.max(0, p - 1))}
                                disabled={productPage === 0}
                                className="px-2.5 py-1 text-xs rounded border bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                              >Prev</button>
                              {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                                <button
                                  key={n}
                                  onClick={() => setProductPage(n - 1)}
                                  className={`px-2.5 py-1 text-xs rounded border ${n === page ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white hover:bg-gray-100'}`}
                                >{n}</button>
                              ))}
                              <button
                                onClick={() => setProductPage(p => Math.min(totalPages - 1, p + 1))}
                                disabled={page === totalPages}
                                className="px-2.5 py-1 text-xs rounded border bg-white hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
                              >Next</button>
                            </div>
                          </div>
                        );
                      })()}
                    </>
                  )
                )}

                {/* ── SERVICES TAB ── */}
                {listingTab === 'services' && (
                  userServices.length === 0 ? (
                    <div className="text-center py-14">
                      <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
                        <Store className="h-8 w-8 text-indigo-300" />
                      </div>
                      <p className="text-gray-700 font-semibold mb-1">No service listings yet</p>
                      <p className="text-sm text-gray-400 mb-5">Add your first listing to appear in the marketplace</p>
                      <Button onClick={() => setShowNewListing(true)} className="bg-gradient-to-r from-indigo-500 to-violet-600 text-white border-0">
                        <Plus className="h-4 w-4 mr-1.5" />{userProfile?.business_type === 'both' ? 'Add Product/Service' : userProfile?.business_type === 'product' ? 'Add Product' : 'Add Service'}
                      </Button>
                    </div>
                  ) : (listingFilter !== 'all' && userServices.filter((s: any) => s.status === listingFilter).length === 0) ? (
                    <div className="text-center py-10 text-gray-400">
                      <Filter className="h-6 w-6 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No {listingFilter} listings</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {(listingFilter === 'all' ? userServices : userServices.filter((s: any) => s.status === listingFilter)).map((listing: any) => (
                        <div key={listing.id} className="group border border-gray-100 rounded-xl p-4 hover:border-indigo-200 hover:shadow-sm transition-all">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 text-sm truncate">{listing.name}</p>
                            </div>
                            <Pill status={listing.status} />
                          </div>
                          {listing.description && (
                            <p className="text-sm text-gray-700 line-clamp-2 mb-3">{listing.description}</p>
                          )}
                          <div className="flex items-center justify-between">
                            <p className="text-xs text-gray-500">Added {new Date(listing.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="p-1.5 rounded-lg hover:bg-indigo-50 text-gray-400 hover:text-indigo-600 transition-colors">
                                <Edit className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}

              </CardContent>
            </Card>

            {/* No POS connected — prompt */}
            {posIntegrations.length === 0 && (
              <div className="border border-dashed border-gray-200 rounded-xl p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gray-50 rounded-xl shrink-0">
                    <RefreshCw className="h-5 w-5 text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Sync from your POS system</p>
                    <p className="text-xs text-gray-400">Connect Shopify or another POS to auto-import your products</p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('/merchant/dashboard')}
                  className="px-4 py-2 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition-all shrink-0"
                >
                  Connect POS
                </button>
              </div>
            )}

          </div>
        )}

        {/* ── NEW LISTING MODAL ─────────────────────────────────────────────── */}
        {showNewListing && (
          <NewListingModal
            onClose={() => setShowNewListing(false)}
            onCreated={() => { refreshBusinesses(); refreshServices(); refetchProducts(); }}
            defaultBusinessType={userProfile?.business_type ?? null}
            defaultTab={listingTab === 'products' ? 'product' : 'service'}
          />
        )}

        {/* ── DISCOVER ─────────────────────────────────────────────────────── */}
        {activeSection === 'discover' && (
          <DiscoverSection currentUserId={user?.id} onToggleFavorite={toggleFavorite} isFavorite={isFavorite} />
        )}

        {/* ── FAVORITES ────────────────────────────────────────────────────── */}
        {activeSection === 'favorites' && (
          <div className="space-y-5">
            <SectionTitle title="Favorites" sub="Businesses you've saved" />
            {favLoading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading...
              </div>
            ) : favorites.length === 0 ? (
              <div className="text-center py-16">
                <Heart className="h-10 w-10 mx-auto mb-3 text-gray-200" />
                <p className="text-gray-500 font-medium">No favorites yet</p>
                <p className="text-sm text-gray-400 mt-1">Tap the ❤️ on any business in Discover to save it here</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {favorites.map(b => (
                  <BusinessCard key={b.id} business={b} onToggleFavorite={toggleFavorite} isFavorite={isFavorite} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── INBOX ────────────────────────────────────────────────────────── */}
        {activeSection === 'inbox' && (
          <div className="space-y-6">
            <SectionTitle title="Inbox" sub="Your conversations with other members" />
            <InboxSection
              initialRecipientId={searchParams.get('recipientId') ?? undefined}
              initialRecipientName={searchParams.get('recipientName') ?? undefined}
              tradeRequest={
                searchParams.get('service')
                  ? {
                      serviceName: searchParams.get('service')!,
                      barterPercentage: Number(searchParams.get('barter') ?? 0),
                    }
                  : undefined
              }
            />
          </div>
        )}

        {/* ── WALLET ───────────────────────────────────────────────────────── */}
        {activeSection === 'wallet' && (
          <WalletSection userId={user?.id} barterPoints={barterPoints} barterPointsLoading={barterPointsLoading} />
        )}





        {/* ── ORDERS ───────────────────────────────────────────────────────── */}
        {activeSection === 'orders' && (
          <div className="space-y-6">
            <SectionTitle title="Orders" sub="Track your barter and purchase orders" />
            <OrderTracking />
          </div>
        )}

        {/* ── REVIEWS ──────────────────────────────────────────────────────── */}
        {activeSection === 'reviews' && (
          <div className="space-y-6">
            <SectionTitle title="Reviews" sub="Ratings and feedback from your trades" />
            <ReviewSystem />
          </div>
        )}

        {/* ── REFERRALS ────────────────────────────────────────────────────── */}
        {activeSection === 'referrals' && (
          <div className="space-y-6">
            <SectionTitle title="Referrals" sub="Earn rewards by inviting others" />
            <ReferralSystem />
          </div>
        )}

        {/* ── LEDGER ───────────────────────────────────────────────────────── */}
        {activeSection === 'ledger' && (
          <LedgerSection />
        )}

        {/* ── SUPPORT ──────────────────────────────────────────────────────── */}
        {activeSection === 'support' && (
          <MerchantSupportTab />
        )}

        {/* ── TRADE: SEND / REQUEST ────────────────────────────────────────── */}
        {activeSection === 'trade-send-request' && (
          <div className="space-y-6">
            {tradeSub !== 'Trade Requests' && (
              <div>
                <h2 className="text-xl font-bold text-gray-900">Trade: Send / Request</h2>
                <p className="text-sm text-gray-500 mt-0.5">Send barter credits or request payment for services</p>
              </div>
            )}
            {(!tradeSub || tradeSub === 'Send Barter') && (
              <div className={tradeSub === 'Send Barter' ? '' : 'grid grid-cols-1 md:grid-cols-2 gap-6'}>
                <CreatePaymentRequest mode="send" />
                {!tradeSub && <CreatePaymentRequest mode="request" />}
              </div>
            )}
            {tradeSub === 'Request Barter' && (
              <CreatePaymentRequest mode="request" />
            )}
            {tradeSub === 'Trade Requests' && (
              <TradeRequestsPage embedded />
            )}
            {tradeSub === 'Barter Notifications' && (() => {
              const byNewest = (a: { created_at: string }, b: { created_at: string }) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
              const pendingSends = receivedRequests
                .filter(r => r.metadata?.type === 'send' && r.status === 'pending' && !r.is_expired)
                .sort(byNewest);
              const completedSends = receivedRequests
                .filter(r => r.metadata?.type === 'send' && (r.status === 'paid' || r.status === 'rejected' || r.status === 'cancelled'))
                .sort(byNewest);
              const mySentSends = sentRequests
                .filter(r => r.metadata?.type === 'send')
                .sort(byNewest);
              const statusBadge = (status: string, isSent = false) => {
                if (status === 'pending') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Pending</span>;
                if (status === 'paid') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{isSent ? 'Accepted' : 'Received'}</span>;
                if (status === 'rejected') return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Rejected</span>;
                return <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Cancelled</span>;
              };
              const hasHistory = completedSends.length > 0 || mySentSends.length > 0;
              return (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Barter Notifications</h2>
                    <p className="text-sm text-gray-500 mt-0.5">Incoming barter credit activity and pending actions</p>
                  </div>

                  {/* ── Pending Actions ── */}
                  {pendingSends.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-bold text-amber-700 uppercase tracking-wide flex items-center gap-2">
                        <Clock className="h-4 w-4" /> Pending Acceptance ({pendingSends.length})
                      </h3>
                      {pendingSends.map(req => (
                        <div key={req.id} className="bg-white border-2 border-amber-200 rounded-2xl p-4 space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                                <ArrowDownLeft className="h-5 w-5 text-emerald-600" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-900">
                                  {req.seller_business_name || req.seller_full_name || 'A merchant'}
                                </p>
                                <p className="text-xs text-gray-500">{req.service_description}</p>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-lg font-black text-emerald-700">${req.total_amount.toFixed(2)}</p>
                              <p className="text-[10px] text-gray-400">credits</p>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              disabled={processingId === req.id}
                              onClick={async () => {
                                setProcessingId(req.id);
                                try {
                                  await acceptSendRequest(req.id, req.seller_id, req.total_amount, req.service_description);
                                } finally {
                                  setProcessingId(null);
                                }
                              }}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold text-sm transition-all disabled:opacity-50"
                            >
                              {processingId === req.id ? 'Processing...' : '✓ Accept & Receive'}
                            </button>
                            <button
                              disabled={processingId === req.id}
                              onClick={async () => {
                                setProcessingId(req.id);
                                try {
                                  await rejectPaymentRequest(req.id);
                                } finally {
                                  setProcessingId(null);
                                }
                              }}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-red-200 text-red-500 hover:bg-red-50 font-semibold text-sm transition-all disabled:opacity-50"
                            >
                              ✕ Reject
                            </button>
                          </div>
                          <p className="text-[10px] text-gray-400 text-right">
                            {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ── History ── merged & sorted newest first ── */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">History</h3>
                    {!hasHistory ? (
                      <div className="text-center py-10 text-gray-400">
                        <Bell className="h-10 w-10 mx-auto mb-3 opacity-30" />
                        <p className="text-sm">No barter activity yet</p>
                      </div>
                    ) : (
                      [
                        ...completedSends.map(r => ({ kind: 'received' as const, date: r.created_at, data: r })),
                        ...mySentSends.map(r => ({ kind: 'sent' as const, date: r.created_at, data: r })),
                      ]
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map(item => {
                          if (item.kind === 'received') {
                            const req = item.data as typeof completedSends[0];
                            return (
                              <div key={`r-${req.id}`} className="flex items-center justify-between gap-3 p-4 rounded-xl border border-gray-100 bg-white">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${req.status === 'paid' ? 'bg-emerald-100' : 'bg-red-50'}`}>
                                    <ArrowDownLeft className={`h-4 w-4 ${req.status === 'paid' ? 'text-emerald-600' : 'text-red-400'}`} />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs text-gray-400 mb-0.5">Received from</p>
                                    <p className="text-sm font-semibold text-gray-900 truncate">{req.seller_business_name || req.seller_full_name || 'A merchant'}</p>
                                    <p className="text-xs text-gray-400 truncate">{req.service_description}</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">{formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}</p>
                                  </div>
                                </div>
                                <div className="shrink-0 text-right space-y-1">
                                  <p className={`text-sm font-bold ${req.status === 'paid' ? 'text-emerald-700' : 'text-gray-400'}`}>${req.total_amount.toFixed(2)}</p>
                                  {statusBadge(req.status)}
                                </div>
                              </div>
                            );
                          }
                          if (item.kind === 'sent') {
                            const req = item.data as typeof mySentSends[0];
                            return (
                              <div key={`s-${req.id}`} className="flex items-center justify-between gap-3 p-4 rounded-xl border border-gray-100 bg-white">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className={`shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${req.status === 'paid' ? 'bg-emerald-100' : req.status === 'rejected' ? 'bg-red-50' : 'bg-amber-50'}`}>
                                    <ArrowUpRight className={`h-4 w-4 ${req.status === 'paid' ? 'text-emerald-600' : req.status === 'rejected' ? 'text-red-400' : 'text-amber-500'}`} />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs text-gray-400 mb-0.5">Sent to</p>
                                    <p className="text-sm font-semibold text-gray-900 truncate">{req.buyer_business_name || req.buyer_full_name || 'A merchant'}</p>
                                    <p className="text-xs text-gray-400 truncate">{req.service_description}</p>
                                    <p className="text-[10px] text-gray-400 mt-0.5">{formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}</p>
                                  </div>
                                </div>
                                <div className="shrink-0 text-right space-y-1">
                                  <p className={`text-sm font-bold ${req.status === 'paid' ? 'text-emerald-700' : 'text-gray-500'}`}>${req.total_amount.toFixed(2)}</p>
                                  {statusBadge(req.status, true)}
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ── PAYMENT REQUESTS ─────────────────────────────────────────────── */}
        {activeSection === 'payment-requests' && (
          <MerchantDashboard embedded externalSub={paymentSub} />
        )}

        {/* ── PROFILE ──────────────────────────────────────────────────────── */}
        {activeSection === 'profile' && (
          <ProfileSection user={user} userProfile={userProfile} activeSub={profileSub} onProfileSaved={setUserProfile} posIntegrations={posIntegrations} navigate={navigate} />
        )}

      </main>
    </div>
  );
};

export default Dashboard;
