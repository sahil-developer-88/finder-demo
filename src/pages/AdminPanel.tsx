import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import UsersSection from '@/components/admin/UsersSection';
import OverviewSection, { OverviewExceptions } from '@/components/admin/OverviewSection';
import DisputesSection from '@/components/admin/DisputesSection';
import SupplyMapSection from '@/components/admin/SupplyMapSection';
import CreditRiskSection from '@/components/admin/CreditRiskSection';
import SystemHealthSection from '@/components/admin/SystemHealthSection';
import ReferralsSection from '@/components/admin/ReferralsSection';
import GrowthSection from '@/components/admin/GrowthSection';
import MerchantDetailPanel from '@/components/admin/MerchantDetailPanel';
import LiquiditySection from '@/components/admin/LiquiditySection';
import TxMonSection from '@/components/admin/TxMonSection';
import ActivitySection from '@/components/admin/ActivitySection';
import TaxSection from '@/components/admin/TaxSection';
import CreditsSection from '@/components/admin/CreditsSection';
import ListingsSection from '@/components/admin/ListingsSection';
import AdsSection from '@/components/admin/AdsSection';
import { generateFilledW9Pdf, downloadFilledW9Pdf } from '@/utils/w9PdfGenerator';
import { download1099BPdf } from '@/utils/form1099BGenerator';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  LayoutDashboard, Store, CreditCard, Receipt, Users, Activity,
  Shield, CheckCircle, XCircle, AlertTriangle, Loader2, Search,
  TrendingUp, DollarSign, FileText, Flag, Clock, Download, Upload, Eye,
  Edit2, Trash2, Pause, ArrowUpRight, ArrowDownRight, ArrowDownLeft, ArrowLeft, AlertCircle,
  Ban, Zap, Bell, RefreshCw, Settings, Filter, MessageSquare,
  Package, ChevronRight, ChevronDown, BarChart2, User, Star, StickyNote, Gift, Award, Scale, Plug,
  BookOpen, Coins,
} from "lucide-react";
import { useHasRole } from '@/hooks/useHasRole';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import MerchantSearchCombobox from '@/components/payment-requests/MerchantSearchCombobox';
import InboxSection from '@/components/messaging/InboxSection';

// ─── Nav ─────────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'overview', icon: LayoutDashboard, label: 'Overview',   subs: [] },
  { id: 'listings', icon: Store,           label: 'Listings',   subs: [
    'Listings Overview',
    'Moderation Queue',
    'Listing Details',
    'Admin Controls',
    'Marketplace Analytics',
  ]},
  { id: 'credits',  icon: CreditCard,      label: 'Exchange Ledger', subs: [
    'Summary',
    'Member Balances',
    'Adjustments',
    'Aging & Risk',
    'Suspended',
    'Write-offs',
    'Platform Ledger',
  ]},
  { id: 'tax',      icon: Receipt,         label: 'Tax & 1099', subs: [
    'W-9 Tracking',
    'Annual Totals',
    '1099-B Prep',
    'Documents',
    'Audit Trail',
    'State Compliance',
    'Backup Withholding',
  ]},
  { id: 'users',    icon: Users,           label: 'Users',      subs: [] },
  { id: 'activity', icon: Activity,        label: 'Activity',   subs: [
    'Transaction Feed',
    'User Activity',
    'System Alerts',
    'Suspicious Behavior',
    'Disputes',
  ]},
  { id: 'txmon', icon: AlertTriangle, label: 'Tx Monitor', subs: [
    'All Transactions',
    'Barter Split',
    'POS Sources',
    'Flags & Fraud',
  ]},
  { id: 'growth', icon: TrendingUp, label: 'Growth & Funnel', subs: [
    'Funnel',
    'Monthly Active',
    'Credits Health',
  ]},
  { id: 'referrals', icon: Gift, label: 'Referrals', subs: [
    'Overview',
    'Referrers',
    'Activity',
  ]},
  { id: 'liquidity', icon: TrendingUp, label: 'Liquidity', subs: [
    'Overview',
    'Credit Velocity',
    'Dormant Credits',
    'Imbalances',
    'Category Supply',
  ]},
  { id: 'creditrisk', icon: Shield, label: 'Credit Risk', subs: [
    'Overview',
    'Risk Scorecard',
    'Deposits & Guarantees',
  ]},
  { id: 'syshealth', icon: Bell, label: 'System Health', subs: [
    'Dashboard',
    'POS & OAuth',
    'Sync & QR',
    'Financial Alerts',
  ]},
  { id: 'disputes', icon: Scale, label: 'Disputes', subs: [
    'Open Disputes',
    'Evidence',
    'Repeat Offenders',
  ]},
  { id: 'supplymap', icon: BarChart2, label: 'Supply Map', subs: [
    'Categories',
    'Regional',
    'Top Earners & Spenders',
  ]},
  { id: 'support', icon: MessageSquare, label: 'Support Inbox', subs: [] },
  { id: 'ads', icon: Bell, label: 'Ads & Banners', subs: ['Banners', 'Push Messages'] },
];

const SUB_TABS: Record<string, string[]> = {
  listings: ['Overview', 'Moderation Queue', 'Marketplace Analytics'],
  credits:  ['Summary', 'Member Balances', 'Adjustments', 'Aging & Risk', 'Suspended', 'Write-offs', 'Platform Ledger'],
  tax:      ['W-9 Tracking', 'Annual Totals', '1099-B Prep', 'Documents', 'Audit Trail', 'State Compliance', 'Backup Withholding'],
  activity: ['Transaction Feed', 'User Activity', 'System Alerts', 'Suspicious Behavior', 'Disputes'],
  txmon: ['All Transactions', 'Barter Split', 'POS Sources', 'Flags & Fraud'],
  growth:    ['Funnel', 'Monthly Active', 'Credits Health'],
  referrals: ['Overview', 'Referrers', 'Activity'],
  liquidity: ['Overview', 'Credit Velocity', 'Dormant Credits', 'Imbalances', 'Category Supply'],
  creditrisk: ['Overview', 'Risk Scorecard', 'Deposits & Guarantees'],
  syshealth:  ['Dashboard', 'POS & OAuth', 'Sync & QR', 'Financial Alerts'],
  disputes:   ['Open Disputes', 'Evidence', 'Repeat Offenders'],
  supplymap:  ['Categories', 'Regional', 'Top Earners & Spenders'],
  ads:        ['Banners', 'Push Messages'],
};


const AdminPanel = () => {
  const { user } = useAuth();
  const { hasRole: isAdmin, loading, error } = useHasRole('admin');
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();

  // Handle OAuth callback redirect from POS connection (admin flow)
  useEffect(() => {
    const oauthSuccess = searchParams.get('oauth_success');
    const provider = searchParams.get('provider');
    if (oauthSuccess === 'true') {
      toast({
        title: 'POS Connected!',
        description: `${provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : 'POS'} has been connected for this merchant.`,
      });
      // Clean up URL params without losing section/sub
      setSearchParams(prev => {
        const next = new URLSearchParams(prev);
        next.delete('oauth_success');
        next.delete('provider');
        next.delete('warning');
        return next;
      }, { replace: true });
    }
  }, []);

  const DEFAULT_SUBS: Record<string, string> = {
    listings:   'Listings Overview',
    credits:    'Summary',
    tax:        'W-9 Tracking',
    activity:   'Transaction Feed',
    txmon:      'All Transactions',
    growth:     'Funnel',
    referrals:  'Overview',
    liquidity:  'Overview',
    creditrisk: 'Overview',
    syshealth:  'Dashboard',
    disputes:   'Open Disputes',
    supplymap:  'Categories',
    ads:        'Banners',
  };

  const [activeSection, setActiveSectionState] = useState(
    searchParams.get('section') || 'overview'
  );
  const [subSections, setSubSections] = useState<Record<string, string>>(() => ({
    ...DEFAULT_SUBS,
    ...(searchParams.get('section') && searchParams.get('sub')
      ? { [searchParams.get('section')!]: searchParams.get('sub')! }
      : {}),
  }));
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set([searchParams.get('section') || 'overview'])
  );
  const [adminSidebarOpen, setAdminSidebarOpen] = useState(false);
  const [adminBackStack, setAdminBackStack] = useState<{ section: string; sub: string }[]>([]);

  // Keep URL in sync — always replace so browser history stays clean.
  const setActiveSection = (section: string) => {
    // Push current position onto internal back stack before moving away
    setAdminBackStack(prev => [...prev, { section: activeSection, sub: subSections[activeSection] ?? '' }]);
    setActiveSectionState(section);
    const sub = subSections[section];
    const params = new URLSearchParams();
    params.set('section', section);
    if (sub) params.set('sub', sub);
    navigate(`/admin?${params.toString()}`, { replace: true });
  };

  const setSub = (section: string, sub: string) => {
    setSubSections(prev => ({ ...prev, [section]: sub }));
    if (section === activeSection) {
      const params = new URLSearchParams();
      params.set('section', section);
      params.set('sub', sub);
      navigate(`/admin?${params.toString()}`, { replace: true });
    }
  };

  const handleAdminBack = () => {
    if (adminBackStack.length > 0) {
      const prev = adminBackStack[adminBackStack.length - 1];
      setAdminBackStack(stack => stack.slice(0, -1));
      setActiveSectionState(prev.section);
      if (prev.sub) setSubSections(s => ({ ...s, [prev.section]: prev.sub }));
      setExpandedSections(s => new Set([...s, prev.section]));
      const params = new URLSearchParams();
      params.set('section', prev.section);
      if (prev.sub) params.set('sub', prev.sub);
      navigate(`/admin?${params.toString()}`, { replace: true });
    } else {
      navigate('/account-dashboard');
    }
  };

  // Sync state when URL changes externally (e.g. message icon click)
  useEffect(() => {
    const section = searchParams.get('section');
    const sub = searchParams.get('sub');
    if (section && section !== activeSection) {
      setActiveSectionState(section);
      setExpandedSections(prev => new Set([...prev, section]));
      if (sub) setSubSections(prev => ({ ...prev, [section]: sub }));
    }
  }, [searchParams]);

  // Real data state
  const [statsLoading, setStatsLoading] = useState(true);
  const [stats, setStats] = useState({ totalUsers: null as number | null, activeListings: null as number | null, completedTrades: null as number | null, pendingApprovals: null as number | null, w9Rate: null as number | null, totalCreditsIssued: null as number | null, totalAvailableCredits: null as number | null, required1099s: null as number | null });
  const [monthlyData, setMonthlyData] = useState<{ month: string; credits: number; trades: number }[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [listings, setListings] = useState<any[]>([]);
  const [listingsLoading, setListingsLoading] = useState(true);
  const [memberCredits, setMemberCredits] = useState<any[]>([]);
  const [memberCreditsLoading, setMemberCreditsLoading] = useState(true);
  const [w9Data, setW9Data] = useState<any[]>([]);
  const [w9Loading, setW9Loading] = useState(true);
  const [annualTotals, setAnnualTotals] = useState<any[]>([]);
  const [annualLoading, setAnnualLoading] = useState(true);
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(true);
  // Activity section state
  const [activityTxns, setActivityTxns]             = useState<any[]>([]);
  const [activityAudit, setActivityAudit]           = useState<any[]>([]);
  const [systemAlerts, setSystemAlerts]             = useState<any[]>([]);
  const [suspiciousList, setSuspiciousList]         = useState<any[]>([]);
  const [disputesList, setDisputesList]             = useState<any[]>([]);
  const [activityLoading, setActivityLoading]       = useState(true);

  // Exchange Ledger real data
  const [creditAdjLog, setCreditAdjLog]         = useState<any[]>([]);
  const [creditAdjLoading, setCreditAdjLoading] = useState(true);
  const [agingData, setAgingData]               = useState<any[]>([]);
  const [agingLoading, setAgingLoading]         = useState(true);
  const [suspendedAccounts, setSuspendedAccounts] = useState<any[]>([]);

  // Transaction Monitoring state
  const [txMonData, setTxMonData]       = useState<any[]>([]);
  const [txMonLoading, setTxMonLoading] = useState(true);
  const [riskProfiles, setRiskProfiles] = useState<any[]>([]);
  const [reportsData, setReportsData]   = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);

  // Liquidity Dashboard state
  const [liquidityData, setLiquidityData]       = useState<any>(null);
  const [liquidityLoading, setLiquidityLoading] = useState(true);

  // Growth & Funnel state
  const [growthData, setGrowthData]       = useState<any>(null);
  const [growthLoading, setGrowthLoading] = useState(true);

  // Referrals state
  const [referralData, setReferralData]       = useState<{ referrers: any[]; activity: any[] }>({ referrers: [], activity: [] });
  const [referralLoading, setReferralLoading] = useState(true);

  // Credit Risk state
  const [creditRiskData, setCreditRiskData]       = useState<any[]>([]);
  const [creditRiskLoading, setCreditRiskLoading] = useState(true);

  // System Health state
  const [sysHealthData, setSysHealthData]       = useState<SysHealthData | null>(null);
  const [sysHealthLoading, setSysHealthLoading] = useState(true);
  const [reconReports, setReconReports]         = useState<any[]>([]);
  const [reconRunning, setReconRunning]         = useState(false);

  // Disputes & Mediation state
  const [disputesData, setDisputesData]           = useState<DisputeRow[]>([]);
  const [evidenceData, setEvidenceData]           = useState<EvidenceRow[]>([]);
  const [disputesMedLoading, setDisputesMedLoading] = useState(true);

  // Supply Map state
  const [supplyMapData, setSupplyMapData]       = useState<any>(null);
  const [supplyMapLoading, setSupplyMapLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;

    const fetchAll = async () => {
      try {
      const since12m = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();

      const [usersRes, listingsRes, tradesRes, pendingRes, w9Res, totalBizRes, credTotalsRes, required1099Res, txMonthlyRes, tradeMonthlyRes] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('transactions').select('*', { count: 'exact', head: true }).eq('status', 'completed'),
        supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('tax_info').select('*', { count: 'exact', head: true }),
        supabase.from('businesses').select('*', { count: 'exact', head: true }),
        supabase.from('user_credits').select('earned_credits, available_credits'),
        supabase.from('tax_info').select('user_id', { count: 'exact', head: true }).not('tax_id', 'is', null),
        supabase.from('pos_transactions').select('barter_amount, transaction_date').gte('transaction_date', since12m),
        supabase.from('transactions').select('created_at').eq('status', 'completed').gte('created_at', since12m),
      ]);

      const w9Count  = w9Res.count ?? 0;
      const bizCount = totalBizRes.count ?? 1;

      const totalIssued    = (credTotalsRes.data || []).reduce((s, c) => s + (c.earned_credits    ?? 0), 0);
      const totalAvailable = (credTotalsRes.data || []).reduce((s, c) => s + (c.available_credits ?? 0), 0);

      // Build monthly chart data (last 12 months)
      const monthMap: Record<string, { credits: number; trades: number }> = {};
      const monthLabels: string[] = [];
      for (let i = 11; i >= 0; i--) {
        const d = new Date(); d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleString('default', { month: 'short' });
        monthLabels.push(label);
        monthMap[key] = { credits: 0, trades: 0 };
      }
      (txMonthlyRes.data || []).forEach(tx => {
        const key = tx.transaction_date?.slice(0, 7);
        if (key && monthMap[key]) monthMap[key].credits += tx.barter_amount ?? 0;
      });
      (tradeMonthlyRes.data || []).forEach(tx => {
        const key = tx.created_at?.slice(0, 7);
        if (key && monthMap[key]) monthMap[key].trades += 1;
      });
      const builtMonthly = Object.entries(monthMap).map(([, v], i) => ({ month: monthLabels[i], credits: Math.round(v.credits), trades: v.trades }));
      setMonthlyData(builtMonthly);

      setStats({
        totalUsers:           usersRes.count ?? 0,
        activeListings:       listingsRes.count ?? 0,
        completedTrades:      tradesRes.count ?? 0,
        pendingApprovals:     pendingRes.count ?? 0,
        w9Rate:               Math.round((w9Count / bizCount) * 100),
        totalCreditsIssued:   Math.round(totalIssued),
        totalAvailableCredits:Math.round(totalAvailable),
        required1099s:        required1099Res.count ?? 0,
      });
      setStatsLoading(false);

      // Fetch user list
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, business_name, onboarding_completed, created_at')
        .order('created_at', { ascending: false });

      if (profiles) {
        const ids = profiles.map(p => p.user_id);

        // Fetch emails from auth.users via security-definer RPC (fills in missing profile emails)
        const { data: authEmailRows } = await supabase.rpc('get_user_emails' as any);
        const emailMap: Record<string, string> = {};
        (authEmailRows || []).forEach((r: any) => { if (r.email) emailMap[r.id] = r.email; });

        const [creditsRes, taxRes] = await Promise.all([
          supabase.from('user_credits').select('user_id, available_credits').in('user_id', ids),
          supabase.from('tax_info').select('user_id').in('user_id', ids),
        ]);
        const credMap = Object.fromEntries((creditsRes.data || []).map(c => [c.user_id, c.available_credits]));
        const taxSet  = new Set((taxRes.data || []).map(t => t.user_id));
        setUsers(profiles.map(p => ({
          ...p,
          email:            p.email || emailMap[p.user_id] || '—',
          available_credits: credMap[p.user_id] ?? 0,
          w9_completed:     taxSet.has(p.user_id),
        })));

        // Fetch member credit balances — all users, with credits defaulting to 0
        const { data: creditsData } = await supabase
          .from('user_credits')
          .select('user_id, available_credits, earned_credits, spent_credits');

        const creditsMap = Object.fromEntries(
          (creditsData || []).map(c => [c.user_id, c])
        );

        setMemberCredits(profiles.map(p => {
          const c       = creditsMap[p.user_id];
          const balance = c ? (c.available_credits ?? 0) : 0;
          const earned  = c ? (c.earned_credits  ?? 0) : 0;
          const spent   = c ? (c.spent_credits   ?? 0) : 0;
          const limit   = Math.max(1000, earned);
          const available = Math.max(0, balance);
          const status  = balance < 0 ? 'negative' : balance === 0 ? 'dormant' : 'good';
          return {
            id:           p.user_id,
            businessName: p.business_name || p.full_name || p.email || 'Unknown',
            balance,
            earned,
            spent,
            limit,
            available,
            status,
          };
        }).sort((a, b) => a.balance - b.balance));
        setMemberCreditsLoading(false);

        // Fetch W-9 / tax_info data
        const { data: taxInfoData } = await supabase
          .from('tax_info')
          .select('user_id, business_name, legal_name, tax_id, tax_id_type, business_type, llc_classification, address, city, state, zip_code, account_number, exempt_from_backup_withholding, certification_agreed, signature, signature_date');

        const taxMap = Object.fromEntries((taxInfoData || []).map(t => [t.user_id, t]));

        setW9Data(profiles.map(p => {
          const tax = taxMap[p.user_id] || null;
          return {
            id:                 p.user_id,
            businessName:       p.business_name || p.full_name || p.email,
            email:              p.email || emailMap[p.user_id] || '—',
            submitted:          !!tax,
            ein:                tax ? (tax.tax_id_type === 'EIN' ? 'verified' : 'unverified') : 'pending',
            backupWithholding:  tax ? !tax.exempt_from_backup_withholding : false,
            legalName:          tax?.legal_name || null,
            taxIdType:          tax?.tax_id_type || null,
            certificationAgreed: tax?.certification_agreed || false,
            signatureDate:      tax?.signature_date || null,
            state:              tax?.state || null,
            city:               tax?.city  || null,
            // Full fields for PDF generation
            taxId:              tax?.tax_id || null,
            businessType:       tax?.business_type || null,
            llcClassification:  tax?.llc_classification || null,
            address:            tax?.address || null,
            zipCode:            tax?.zip_code || null,
            accountNumber:      tax?.account_number || null,
            signature:          tax?.signature || null,
          };
        }));
        setW9Loading(false);

        setListingsLoading(false);
      }
      setUsersLoading(false);
      } catch (err) {
        console.error('Admin panel data fetch failed:', err);
        setStatsLoading(false);
        setUsersLoading(false);
        setListingsLoading(false);
      }
    };

    fetchAll();
  }, [isAdmin]);

  // Listings live — own effect with Realtime so any change reflects instantly
  useEffect(() => {
    if (!isAdmin) return;

    const fetchListings = async () => {
      const [{ data: bizData }, { data: profilesData }] = await Promise.all([
        supabase.from('businesses').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('user_id, full_name, email'),
      ]);
      if (bizData) {
        const profileMap = Object.fromEntries((profilesData || []).map(p => [p.user_id, p.full_name || p.email]));
        setListings(bizData.map(b => ({ ...b, owner: profileMap[b.user_id] || '—' })));
      }
      setListingsLoading(false);
    };

    fetchListings();

    // Realtime — re-fetch on any INSERT, UPDATE, or DELETE in businesses
    const channel = supabase
      .channel('admin_listings_live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'businesses' }, () => {
        fetchListings();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [isAdmin]);

  // Re-fetch annual totals whenever taxYear changes
  useEffect(() => {
    if (!isAdmin) return;
    const fetchAnnual = async () => {
      setAnnualLoading(true);
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, business_name');
      const { data: txData } = await supabase
        .from('transactions')
        .select('to_user_id, points_amount, created_at')
        .eq('status', 'completed')
        .gte('created_at', `${taxYear}-01-01T00:00:00.000Z`)
        .lte('created_at', `${taxYear}-12-31T23:59:59.999Z`);
      if (txData) {
        const profileMap = Object.fromEntries((profilesData || []).map(p => [p.user_id, p.business_name || p.full_name || p.email]));
        const merchantMap: Record<string, { businessName: string; q1: number; q2: number; q3: number; q4: number }> = {};
        txData.forEach(tx => {
          const month = new Date(tx.created_at).getMonth() + 1;
          const quarter = month <= 3 ? 'q1' : month <= 6 ? 'q2' : month <= 9 ? 'q3' : 'q4';
          const amount = tx.points_amount ?? 0;
          if (!merchantMap[tx.to_user_id]) {
            merchantMap[tx.to_user_id] = { businessName: profileMap[tx.to_user_id] || 'Unknown', q1: 0, q2: 0, q3: 0, q4: 0 };
          }
          merchantMap[tx.to_user_id][quarter] += amount;
        });
        setAnnualTotals(
          Object.entries(merchantMap).map(([id, d]) => ({
            id,
            businessName: d.businessName,
            q1: d.q1, q2: d.q2, q3: d.q3, q4: d.q4,
            total: d.q1 + d.q2 + d.q3 + d.q4,
          })).sort((a, b) => b.total - a.total)
        );
      } else {
        setAnnualTotals([]);
      }
      setAnnualLoading(false);
    };
    fetchAnnual();
  }, [isAdmin, taxYear]);

  // Fetch tax audit logs from audit_logs table + live realtime subscription
  useEffect(() => {
    if (!isAdmin) return;

    const fetchAudit = async () => {
      setAuditLoading(true);
      const { data: logsData } = await supabase
        .from('audit_logs')
        .select('id, action, table_name, record_id, user_id, new_data, old_data, created_at')
        .eq('table_name', 'tax_info')
        .order('created_at', { ascending: false })
        .limit(200);

      if (logsData && logsData.length > 0) {
        const adminIds = [...new Set(logsData.map(l => l.user_id))];
        const { data: adminProfiles } = await supabase
          .from('profiles')
          .select('user_id, email, full_name')
          .in('user_id', adminIds);
        const adminMap = Object.fromEntries((adminProfiles || []).map(p => [p.user_id, p.email || p.full_name || p.user_id]));

        setAuditLogs(logsData.map(l => {
          const newData = l.new_data as Record<string, any> | null;
          const oldData = l.old_data as Record<string, any> | null;
          const target = newData?.business_name || newData?.legal_name || oldData?.business_name || oldData?.legal_name || l.record_id.slice(0, 8);
          return {
            id:        l.id,
            admin:     adminMap[l.user_id] || l.user_id.slice(0, 8),
            action:    l.action === 'INSERT' ? 'W-9 submitted' : l.action === 'UPDATE' ? 'Tax info updated' : l.action === 'DELETE' ? 'Tax info deleted' : l.action,
            target,
            date:      new Date(l.created_at).toLocaleString(),
          };
        }));
      } else {
        setAuditLogs([]);
      }
      setAuditLoading(false);
    };

    fetchAudit();

    // Realtime — watch tax_info directly
    const channel = supabase
      .channel(`tax_info_watch_${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tax_info' },
        () => { fetchAudit(); }
      )
      .subscribe();

    // Polling fallback every 10s in case Realtime doesn't fire
    const poll = setInterval(fetchAudit, 10000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, [isAdmin]);

  // Fetch all activity data
  useEffect(() => {
    if (!isAdmin) return;
    const fetchActivity = async () => {
      setActivityLoading(true);

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, business_name');
      const pMap = Object.fromEntries((profilesData || []).map(p => [p.user_id, p]));
      const displayName = (uid: string | null): string => {
        if (!uid) return 'System';
        const p = pMap[uid];
        return p ? (p.business_name || p.full_name || p.email || uid.slice(0, 8)) : uid.slice(0, 8);
      };
      const ownerName = (uid: string | null): string | null => {
        if (!uid) return null;
        return pMap[uid]?.full_name || null;
      };
      const emailOf = (uid: string | null): string | null => {
        if (!uid) return null;
        return pMap[uid]?.email || null;
      };

      // Transaction Feed
      const { data: txData } = await supabase
        .from('transactions')
        .select('id, from_user_id, to_user_id, points_amount, transaction_type, service_description, status, created_at')
        .order('created_at', { ascending: false })
        .limit(500);
      setActivityTxns((txData || []).map(t => ({
        id:              t.id,
        fromId:          t.from_user_id,
        toId:            t.to_user_id,
        from:            displayName(t.from_user_id) || 'System',
        fromOwner:       ownerName(t.from_user_id),
        fromEmail:       emailOf(t.from_user_id),
        to:              displayName(t.to_user_id) || '—',
        toOwner:         ownerName(t.to_user_id),
        toEmail:         emailOf(t.to_user_id),
        amount:          t.points_amount ?? 0,
        type:            t.transaction_type || 'barter',
        description:     t.service_description,
        status:          t.status || 'completed',
        time:            new Date(t.created_at).toLocaleString(),
        rawCreatedAt:    t.created_at,
      })));

      // User Activity — all audit_logs
      const { data: allLogs } = await supabase
        .from('audit_logs')
        .select('id, action, table_name, record_id, user_id, created_at')
        .order('created_at', { ascending: false })
        .limit(200);
      const tableLabels: Record<string, string> = {
        businesses: 'business listing', profiles: 'profile', tax_info: 'tax information',
        transactions: 'transaction', user_credits: 'barter credits', pos_integrations: 'POS integration',
        products: 'product', reviews: 'review', audit_logs: 'audit log',
      };
      setActivityAudit((allLogs || []).map(l => {
        const table = tableLabels[l.table_name] || l.table_name.replace(/_/g, ' ');
        const verb = l.action === 'INSERT' ? 'Created' : l.action === 'UPDATE' ? 'Updated' : l.action === 'DELETE' ? 'Deleted' : l.action;
        const profile = pMap[l.user_id];
        return {
          id:           l.id,
          userId:       l.user_id || '—',
          businessName: profile?.business_name || null,
          fullName:     profile?.full_name || null,
          email:        profile?.email || null,
          action:       `${verb} ${table}`,
          recordId:     l.record_id || null,
          time:         new Date(l.created_at).toLocaleString(),
        };
      }));

      // System Alerts
      const alerts: any[] = [];

      // 1. Non-active POS integrations (disconnected / inactive / error / pending / disconnect_requested)
      const { data: badIntegrations } = await supabase
        .from('pos_integrations')
        .select('id, provider, status, last_sync_at, token_expires_at, user_id, updated_at')
        .neq('status', 'active')
        .order('updated_at', { ascending: false })
        .limit(50);
      (badIntegrations || []).forEach(i => {
        alerts.push({
          id:              i.id,
          kind:            'pos',
          type:            i.status === 'error' ? 'error' : 'warning',
          title:           i.status === 'disconnect_requested'
            ? `POS Disconnect Request — ${i.provider || 'Unknown'}`
            : `POS Disconnected — ${i.provider || 'Unknown'}`,
          message:         i.status === 'error'
            ? `Connection error detected. The integration stopped responding.`
            : i.status === 'pending'
            ? `Integration is pending setup and has not been activated yet.`
            : i.status === 'disconnected'
            ? `POS is disconnected and no longer syncing for this account.`
            : i.status === 'disconnect_requested'
            ? `This merchant requested to disconnect their POS. Approve or keep it connected.`
            : `Integration status is "${i.status}". Action may be required.`,
          provider:        i.provider,
          posStatus:       i.status,
          lastSync:        i.last_sync_at ? new Date(i.last_sync_at).toLocaleString() : null,
          userId:          displayName(i.user_id),
          merchantId:      i.user_id,
          merchantEmail:   emailOf(i.user_id),
          time:            i.updated_at ? new Date(i.updated_at).toLocaleString() : '—',
        });
      });

      // 2. Active POS integrations that haven't synced in 7+ days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: staleIntegrations } = await supabase
        .from('pos_integrations')
        .select('id, provider, status, last_sync_at, user_id, updated_at')
        .eq('status', 'active')
        .or(`last_sync_at.is.null,last_sync_at.lt.${sevenDaysAgo}`)
        .order('last_sync_at', { ascending: true })
        .limit(30);
      (staleIntegrations || []).forEach(i => {
        alerts.push({
          id:            `stale-${i.id}`,
          kind:          'pos_stale',
          type:          'warning',
          title:         `POS Not Syncing — ${i.provider || 'Unknown'}`,
          message:       i.last_sync_at
            ? `No sync in over 7 days. Transaction data may be out of date.`
            : `This integration has never synced. Check connection.`,
          provider:      i.provider,
          posStatus:     i.status,
          lastSync:      i.last_sync_at ? new Date(i.last_sync_at).toLocaleString() : 'Never',
          userId:        displayName(i.user_id),
          merchantId:    i.user_id,
          merchantEmail: emailOf(i.user_id),
          time:          i.updated_at ? new Date(i.updated_at).toLocaleString() : '—',
        });
      });

      // 3. POS tokens expiring within 7 days
      const nowIso   = new Date().toISOString();
      const in7dIso  = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: expiringTokens } = await supabase
        .from('pos_integrations')
        .select('id, provider, status, token_expires_at, user_id, updated_at')
        .gte('token_expires_at', nowIso)
        .lte('token_expires_at', in7dIso)
        .limit(20);
      (expiringTokens || []).forEach(i => {
        const expiresIn = Math.ceil((new Date(i.token_expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        alerts.push({
          id:            `token-${i.id}`,
          kind:          'token',
          type:          expiresIn <= 2 ? 'error' : 'warning',
          title:         `OAuth Token Expiring — ${i.provider || 'Unknown'}`,
          message:       `Token expires in ${expiresIn} day${expiresIn !== 1 ? 's' : ''}. Merchant must re-authenticate or POS will disconnect.`,
          provider:      i.provider,
          posStatus:     i.status,
          lastSync:      null,
          userId:        displayName(i.user_id),
          merchantId:    i.user_id,
          merchantEmail: emailOf(i.user_id),
          time:          new Date(i.token_expires_at).toLocaleString(),
        });
      });

      // 4. Disputes open for more than 14 days
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
      const { data: overdueDisputes } = await supabase
        .from('transactions')
        .select('id, from_user_id, points_amount, service_description, created_at')
        .eq('status', 'disputed')
        .lt('created_at', fourteenDaysAgo)
        .order('created_at', { ascending: true })
        .limit(20);
      (overdueDisputes || []).forEach(d => {
        const days = Math.floor((Date.now() - new Date(d.created_at).getTime()) / (1000 * 60 * 60 * 24));
        alerts.push({
          id:            `dispute-${d.id}`,
          kind:          'dispute',
          type:          'error',
          title:         `Overdue Dispute — ${days} days open`,
          message:       `Dispute for "${d.service_description || 'transaction'}" ($${d.points_amount || 0}) has been unresolved for ${days} days.`,
          userId:        displayName(d.from_user_id),
          merchantId:    d.from_user_id,
          merchantEmail: emailOf(d.from_user_id),
          time:          new Date(d.created_at).toLocaleString(),
        });
      });

      // 5. W9 missing for merchants who earned >$600 this year
      const yearStart = new Date(new Date().getFullYear(), 0, 1).toISOString();
      const { data: yearTxns } = await supabase
        .from('transactions')
        .select('to_user_id, points_amount')
        .gte('created_at', yearStart)
        .eq('status', 'completed');
      const earningsMap: Record<string, number> = {};
      (yearTxns || []).forEach(t => {
        if (t.to_user_id) earningsMap[t.to_user_id] = (earningsMap[t.to_user_id] || 0) + (t.points_amount || 0);
      });
      const highEarners = Object.entries(earningsMap).filter(([, amt]) => amt >= 600).map(([uid]) => uid);
      if (highEarners.length > 0) {
        const { data: filedW9s } = await supabase
          .from('tax_info')
          .select('user_id')
          .in('user_id', highEarners);
        const filedSet = new Set((filedW9s || []).map(w => w.user_id));
        highEarners.filter(uid => !filedSet.has(uid)).slice(0, 20).forEach(uid => {
          alerts.push({
            id:            `w9-${uid}`,
            kind:          'w9',
            type:          'warning',
            title:         `W-9 Missing — ${displayName(uid)}`,
            message:       `This merchant has earned $${earningsMap[uid].toFixed(2)} this year but has no W-9 on file. Required before 1099 filing.`,
            userId:        displayName(uid),
            merchantId:    uid,
            merchantEmail: emailOf(uid),
            time:          '—',
          });
        });
      }

      alerts.sort((a, b) => {
        const order: Record<string, number> = { error: 0, warning: 1 };
        return (order[a.type] ?? 2) - (order[b.type] ?? 2);
      });
      setSystemAlerts(alerts);

      // Disputes — transactions with status 'disputed' or 'resolved' or 'mediation'
      const { data: disputed } = await supabase
        .from('transactions')
        .select('id, from_user_id, to_user_id, points_amount, service_description, status, created_at')
        .in('status', ['disputed', 'resolved', 'mediation'])
        .order('created_at', { ascending: false })
        .limit(100);
      setDisputesList((disputed || []).map(d => ({
        id:      d.id,
        reporter: displayName(d.from_user_id),
        reported: displayName(d.to_user_id),
        issue:    d.service_description || 'Dispute',
        amount:   d.points_amount,
        status:   d.status === 'disputed' ? 'open' : d.status,
        date:     new Date(d.created_at).toLocaleDateString(),
        rawDate:  d.created_at,
      })));

      // Suspicious — flagged/disputed transactions + high-frequency senders in last 30 days
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentTxns } = await supabase
        .from('transactions')
        .select('from_user_id, to_user_id, status, points_amount')
        .gte('created_at', since);

      const freqMap: Record<string, { sent: number; received: number; flagged: boolean; disputed: boolean; highValue: boolean }> = {};
      (recentTxns || []).forEach(t => {
        if (t.from_user_id) {
          if (!freqMap[t.from_user_id]) freqMap[t.from_user_id] = { sent: 0, received: 0, flagged: false, disputed: false, highValue: false };
          freqMap[t.from_user_id].sent++;
          if (t.status === 'flagged')   freqMap[t.from_user_id].flagged = true;
          if (t.status === 'disputed')  freqMap[t.from_user_id].disputed = true;
          if ((t.points_amount || 0) > 5000) freqMap[t.from_user_id].highValue = true;
        }
        if (t.to_user_id) {
          if (!freqMap[t.to_user_id]) freqMap[t.to_user_id] = { sent: 0, received: 0, flagged: false, disputed: false, highValue: false };
          freqMap[t.to_user_id].received++;
          if (t.status === 'flagged')  freqMap[t.to_user_id].flagged = true;
          if (t.status === 'disputed') freqMap[t.to_user_id].disputed = true;
        }
      });

      // Also pull suspended status from businesses table
      const { data: bizData } = await supabase.from('businesses').select('user_id, status');
      const bizStatusMap = Object.fromEntries((bizData || []).map(b => [b.user_id, b.status]));

      const suspicious = Object.entries(freqMap)
        .filter(([, v]) => v.flagged || v.disputed || v.highValue || v.sent >= 20)
        .sort(([, a], [, b]) => {
          const scoreA = (a.flagged ? 3 : 0) + (a.disputed ? 2 : 0) + (a.highValue ? 1 : 0) + (a.sent >= 20 ? 1 : 0);
          const scoreB = (b.flagged ? 3 : 0) + (b.disputed ? 2 : 0) + (b.highValue ? 1 : 0) + (b.sent >= 20 ? 1 : 0);
          return scoreB - scoreA;
        })
        .slice(0, 50)
        .map(([uid, v]) => {
          const issues: string[] = [];
          if (v.flagged)         issues.push('Flagged transaction');
          if (v.disputed)        issues.push('Disputed transaction');
          if (v.highValue)       issues.push('High-value transaction (>5000 pts)');
          if (v.sent >= 20)      issues.push(`High frequency (${v.sent} sent in 30d)`);
          const severity = (v.flagged || v.disputed) ? 'high' : v.highValue ? 'medium' : 'low';
          return {
            id:           uid,
            businessName: displayName(uid),
            email:        emailOf(uid),
            issue:        issues.join(' · '),
            sent:         v.sent,
            received:     v.received,
            flagged:      v.flagged || v.disputed,
            severity,
            suspended:    bizStatusMap[uid] === 'suspended',
          };
        });
      setSuspiciousList(suspicious);

      setActivityLoading(false);
    };
    fetchActivity();
  }, [isAdmin]);

  // Fetch credit adjustment log from audit_logs (user_credits changes)
  useEffect(() => {
    if (!isAdmin) return;
    const fetchAdjLog = async () => {
      setCreditAdjLoading(true);
      const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name, email, business_name');
      const pMap = Object.fromEntries((profilesData || []).map((p: any) => [p.user_id, p.business_name || p.full_name || p.email]));
      const { data: logs } = await supabase
        .from('audit_logs')
        .select('id, action, user_id, record_id, new_data, old_data, created_at')
        .eq('table_name', 'user_credits')
        .order('created_at', { ascending: false })
        .limit(500);
      setCreditAdjLog((logs || []).map((l: any) => {
        const nd = l.new_data as Record<string, any> | null;
        const od = l.old_data as Record<string, any> | null;
        const newBal = nd?.available_credits ?? null;
        const oldBal = od?.available_credits ?? null;
        const diff = (newBal !== null && oldBal !== null) ? newBal - oldBal : null;
        return {
          id:     l.id,
          admin:  pMap[l.user_id] || l.user_id?.slice(0, 8) || '—',
          target: pMap[l.record_id] || l.record_id?.slice(0, 8) || '—',
          action: l.action,
          diff,
          oldBal,
          newBal,
          date:   l.created_at,
          reason: nd?.reason || '—',
          notes:  nd?.notes  || '',
        };
      }));
      setCreditAdjLoading(false);
    };
    fetchAdjLog();
  }, [isAdmin]);

  // Fetch aging data — negative-balance users + approximate days negative
  useEffect(() => {
    if (!isAdmin) return;
    const fetchAging = async () => {
      setAgingLoading(true);
      const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name, email, business_name');
      const pMap = Object.fromEntries((profilesData || []).map((p: any) => [p.user_id, p.business_name || p.full_name || p.email]));
      const { data: negativeUsers } = await supabase
        .from('user_credits')
        .select('user_id, available_credits, earned_credits, spent_credits')
        .lt('available_credits', 0);
      let aging: any[] = [];
      if (negativeUsers && negativeUsers.length > 0) {
        const userIds = negativeUsers.map((u: any) => u.user_id);
        const { data: lastTxns } = await supabase
          .from('transactions')
          .select('from_user_id, created_at')
          .in('from_user_id', userIds)
          .order('created_at', { ascending: false });
        const lastTxMap: Record<string, string> = {};
        (lastTxns || []).forEach((t: any) => {
          if (!lastTxMap[t.from_user_id]) lastTxMap[t.from_user_id] = t.created_at;
        });
        const now = Date.now();
        aging = negativeUsers.map((u: any) => {
          const lastActivity = lastTxMap[u.user_id];
          const daysNegative = lastActivity
            ? Math.floor((now - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
            : 999;
          const risk = daysNegative >= 90 ? 'critical' : daysNegative >= 60 ? 'high' : daysNegative >= 30 ? 'medium' : 'low';
          return {
            id:           u.user_id,
            businessName: pMap[u.user_id] || '—',
            balance:      u.available_credits,
            earned:       u.earned_credits || 0,
            daysNegative,
            risk,
          };
        }).sort((a: any, b: any) => b.daysNegative - a.daysNegative);
      }
      setAgingData(aging);

      // Fetch suspended accounts — independent of negative balance check
      const { data: suspBiz } = await supabase
        .from('businesses')
        .select('user_id, business_name, status')
        .eq('status', 'suspended');
      if (suspBiz && suspBiz.length > 0) {
        const suspIds = suspBiz.map((b: any) => b.user_id);
        const { data: suspCredits } = await supabase
          .from('user_credits')
          .select('user_id, available_credits')
          .in('user_id', suspIds);
        const credMap = Object.fromEntries((suspCredits || []).map((c: any) => [c.user_id, c.available_credits ?? 0]));
        setSuspendedAccounts(suspBiz.map((b: any) => {
          const uid = b.user_id;
          const agingEntry = aging.find((a: any) => a.id === uid);
          return {
            id:           uid,
            businessName: b.business_name || pMap[uid] || '—',
            balance:      credMap[uid] ?? 0,
            daysNegative: agingEntry?.daysNegative ?? 0,
            risk:         agingEntry?.risk ?? 'high',
          };
        }));
      } else {
        setSuspendedAccounts([]);
      }

      setAgingLoading(false);
    };
    fetchAging();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchTxMon = async () => {
      setTxMonLoading(true);

      // Fetch profiles for name lookup (include created_at for account age)
      const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name, email, business_name, created_at');
      const pMap        = Object.fromEntries((profilesData || []).map((p: any) => [p.user_id, p.business_name || p.full_name || p.email || p.user_id?.slice(0,8)]));
      const profilesMap = Object.fromEntries((profilesData || []).map((p: any) => [p.user_id, p]));

      // Fetch existing flag overrides from DB
      const { data: flagRows } = await supabase.from('merchant_credit_profiles').select('user_id, flag_status, flag_reasons, flagged_at');
      const flagMap = Object.fromEntries((flagRows || []).map((f: any) => [f.user_id, f]));

      // Fetch POS transactions
      const { data: posTxns } = await supabase
        .from('pos_transactions')
        .select('id, merchant_id, pos_provider, total_amount, barter_amount, cash_amount, card_amount, barter_percentage, status, transaction_date, created_at, external_transaction_id, items')
        .order('transaction_date', { ascending: false })
        .limit(500);

      // Fetch barter transactions
      const { data: barterTxns } = await supabase
        .from('transactions')
        .select('id, from_user_id, to_user_id, points_amount, service_description, status, transaction_type, created_at')
        .order('created_at', { ascending: false })
        .limit(500);

      const posList = (posTxns || []).map((t: any) => ({
        id: t.id,
        source: 'pos',
        provider: t.pos_provider,
        merchant: pMap[t.merchant_id] || t.merchant_id?.slice(0,8) || '—',
        merchant_id: t.merchant_id,
        amount: t.total_amount,
        barter_amount: t.barter_amount || 0,
        cash_amount: (t.cash_amount || 0) + (t.card_amount || 0),
        barter_pct: t.barter_percentage || 0,
        status: t.status,
        date: t.transaction_date || t.created_at,
        description: t.external_transaction_id,
        type: 'pos',
      }));

      const barterList = (barterTxns || []).map((t: any) => ({
        id: t.id,
        source: 'barter',
        provider: 'barter',
        merchant: pMap[t.from_user_id] || t.from_user_id?.slice(0,8) || '—',
        merchant_id: t.from_user_id,
        recipient: pMap[t.to_user_id] || t.to_user_id?.slice(0,8) || '—',
        amount: t.points_amount,
        barter_amount: t.points_amount,
        cash_amount: 0,
        barter_pct: 100,
        status: t.status,
        date: t.created_at,
        description: t.service_description || t.transaction_type,
        type: 'barter',
      }));

      // Combine and sort by date
      const combined = [...posList, ...barterList].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // ── Per-merchant stats for risk scoring ──────────────────────────────────
      const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const merchantStats: Record<string, any> = {};
      combined.forEach(t => {
        const mid = t.merchant_id;
        if (!mid) return;
        if (!merchantStats[mid]) {
          const profile = profilesMap[mid];
          merchantStats[mid] = {
            user_id: mid,
            businessName: t.merchant,
            createdAt: profile?.created_at || null,
            totalTxns: 0, disputedTxns: 0, voidedRefundedTxns: 0,
            txnsLast7d: 0, maxAmount: 0,
          };
        }
        const s = merchantStats[mid];
        s.totalTxns++;
        if (t.status === 'disputed')                          s.disputedTxns++;
        if (t.status === 'refunded' || t.status === 'voided') s.voidedRefundedTxns++;
        if (t.date >= since7d)                                s.txnsLast7d++;
        if ((t.amount ?? 0) > s.maxAmount)                   s.maxAmount = t.amount ?? 0;
      });

      // ── Score each merchant ───────────────────────────────────────────────────
      const computed = Object.values(merchantStats).map((s: any) => {
        let score = 0;
        const signals: string[] = [];
        const accountAgeDays = s.createdAt
          ? Math.floor((Date.now() - new Date(s.createdAt).getTime()) / 86400000)
          : 999;

        if (accountAgeDays < 30 && s.maxAmount > 500) {
          score += 40; signals.push('New account + high-value trade');
        }
        if (s.disputedTxns >= 3) {
          score += 30; signals.push(`${s.disputedTxns} disputes`);
        } else if (s.disputedTxns >= 1) {
          score += 15; signals.push(`${s.disputedTxns} dispute${s.disputedTxns > 1 ? 's' : ''}`);
        }
        if (s.voidedRefundedTxns >= 4) {
          score += 20; signals.push(`${s.voidedRefundedTxns} refunds/voids`);
        }
        if (s.txnsLast7d > 20) {
          score += 20; signals.push('High velocity (20+ txns / 7 days)');
        } else if (s.txnsLast7d > 10) {
          score += 10; signals.push('Moderate velocity (10+ txns / 7 days)');
        }
        if (s.maxAmount > 2000) {
          score += 20; signals.push('Large transaction (>$2,000)');
        } else if (s.maxAmount > 1000) {
          score += 10; signals.push('Large transaction (>$1,000)');
        }

        const computedFlag: 'hard' | 'soft' | 'none' = score >= 60 ? 'hard' : score >= 30 ? 'soft' : 'none';
        const dbRecord      = flagMap[s.user_id];
        // DB override takes priority; fall back to computed
        const flag_status   = dbRecord?.flag_status ?? computedFlag;
        const flag_reasons  = dbRecord?.flag_reasons?.length ? dbRecord.flag_reasons : signals;

        return { ...s, score, signals, computedFlag, flag_status, flag_reasons, flagged_at: dbRecord?.flagged_at ?? null };
      });

      setRiskProfiles(computed);

      // ── Transaction-level fraud badge (lightweight, for All Txns table) ──────
      const withFraud = combined.map(t => {
        const rp = computed.find(r => r.user_id === t.merchant_id);
        const fraudScore = rp ? Math.round(rp.score) : 0;
        const flag = fraudScore >= 60 ? 'high' : fraudScore >= 30 ? 'medium' : 'low';
        return { ...t, fraudScore, flag };
      });

      setTxMonData(withFraud);
      setTxMonLoading(false);
    };
    fetchTxMon();
  }, [isAdmin]);

  // Fetch community reports
  useEffect(() => {
    if (!isAdmin) return;
    const fetchReports = async () => {
      setReportsLoading(true);
      const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name, email, business_name');
      const pMap = Object.fromEntries((profilesData || []).map((p: any) => [p.user_id, p.business_name || p.full_name || p.email || '—']));

      const { data: rows } = await supabase
        .from('business_reports')
        .select('id, reporter_id, reported_business_id, reason, details, status, created_at, businesses!reported_business_id(id, business_name, user_id)')
        .order('created_at', { ascending: false });

      setReportsData((rows || []).map((r: any) => ({
        id:              r.id,
        reporterName:    pMap[r.reporter_id] || '—',
        businessName:    r.businesses?.business_name || '—',
        businessUserId:  r.businesses?.user_id || null,
        businessId:      r.reported_business_id,
        reason:          r.reason,
        details:         r.details || '',
        status:          r.status,
        date:            r.created_at,
      })));
      setReportsLoading(false);
    };
    fetchReports();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchLiquidity = async () => {
      setLiquidityLoading(true);

      const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name, email, business_name');
      const pMap = Object.fromEntries((profilesData || []).map((p: any) => [p.user_id, p.business_name || p.full_name || p.email || p.user_id?.slice(0,8)]));

      // Fetch all user credits
      const { data: credits } = await supabase
        .from('user_credits')
        .select('user_id, available_credits, earned_credits, spent_credits');

      // Fetch businesses for category data
      const { data: bizData } = await supabase
        .from('businesses')
        .select('user_id, category, business_name, status')
        .eq('status', 'active');

      // Fetch recent transactions for velocity (last 90 days)
      const since90 = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const since365 = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
      const [recentRes, allLastRes] = await Promise.all([
        supabase
          .from('transactions')
          .select('id, from_user_id, to_user_id, points_amount, created_at, status')
          .gte('created_at', since90)
          .eq('status', 'completed'),
        // Last-activity per user within 1 year (capped at 2000 rows)
        supabase
          .from('transactions')
          .select('from_user_id, to_user_id, created_at')
          .gte('created_at', since365)
          .order('created_at', { ascending: false })
          .limit(2000),
      ]);
      const recentTxns = recentRes.data || [];

      // Build last activity map — count BOTH sending and receiving as activity
      const lastActivityMap: Record<string, string> = {};
      (allLastRes.data || []).forEach((t: any) => {
        if (t.from_user_id && !lastActivityMap[t.from_user_id]) lastActivityMap[t.from_user_id] = t.created_at;
        if (t.to_user_id   && !lastActivityMap[t.to_user_id])   lastActivityMap[t.to_user_id]   = t.created_at;
      });

      const creditList = (credits || []).map((c: any) => ({
        id: c.user_id,
        name: pMap[c.user_id] || '—',
        earned: c.earned_credits || 0,
        spent: c.spent_credits || 0,
        balance: c.available_credits || 0,
      }));

      // Velocity: credits moved in last 90 days
      const totalVolume90 = recentTxns.reduce((s: number, t: any) => s + (t.points_amount || 0), 0);
      const totalCreditsIssued = creditList.reduce((s, c) => s + c.earned, 0);
      const velocityRate = totalCreditsIssued > 0 ? (totalVolume90 / totalCreditsIssued) * 100 : 0;

      // Per-member velocity (txns in last 90 days)
      const memberTxCount: Record<string, number> = {};
      const memberTxVol: Record<string, number> = {};
      recentTxns.forEach((t: any) => {
        // Count both sender and receiver as "active"
        if (t.from_user_id) {
          memberTxCount[t.from_user_id] = (memberTxCount[t.from_user_id] || 0) + 1;
          memberTxVol[t.from_user_id]   = (memberTxVol[t.from_user_id]   || 0) + (t.points_amount || 0);
        }
        if (t.to_user_id && t.to_user_id !== t.from_user_id) {
          memberTxCount[t.to_user_id] = (memberTxCount[t.to_user_id] || 0) + 1;
        }
      });

      const now = Date.now();
      const velocityMembers = creditList.map(c => ({
        ...c,
        txCount90: memberTxCount[c.id] || 0,
        txVol90: memberTxVol[c.id] || 0,
        velocityScore: c.earned > 0 ? Math.round(((memberTxVol[c.id] || 0) / Math.max(1, c.earned)) * 100) : 0,
      })).sort((a, b) => a.velocityScore - b.velocityScore);

      // Dormant: earned > 0 but zero transactions in 90 days — use real last activity date
      const dormant = creditList.filter(c => c.earned > 0 && !memberTxCount[c.id]).map(c => {
        const lastDate = lastActivityMap[c.id] ? new Date(lastActivityMap[c.id]) : null;
        const dormantDays = lastDate ? Math.floor((now - lastDate.getTime()) / (1000 * 60 * 60 * 24)) : null;
        return {
          ...c,
          lastActivityDate: lastDate ? lastDate.toLocaleDateString() : null,
          dormantDays,
        };
      }).sort((a, b) => (b.dormantDays ?? 99999) - (a.dormantDays ?? 99999));

      // Hoarders: earned much more than spent (earn/spend ratio > 3, balance > 200)
      const hoarders = creditList.filter(c => c.earned > 200 && c.spent < c.earned * 0.2).map(c => ({
        ...c,
        ratio: c.spent > 0 ? Math.min(99, Math.round(c.earned / c.spent)) : null,
        alert: 'hoarding',
      })).sort((a, b) => b.balance - a.balance);

      // Over-drawers: spent much more than earned (negative balance)
      const overdrawers = creditList.filter(c => c.balance < -100).map(c => ({
        ...c,
        deficit: Math.abs(c.balance),
        alert: 'imbalance',
      })).sort((a, b) => a.balance - b.balance);

      // Category supply/demand
      const categoryMap: Record<string, { count: number; earned: number; spent: number }> = {};
      (bizData || []).forEach((b: any) => {
        const cat = b.category || 'Uncategorized';
        if (!categoryMap[cat]) categoryMap[cat] = { count: 0, earned: 0, spent: 0 };
        categoryMap[cat].count++;
        const cred = creditList.find(c => c.id === b.user_id);
        if (cred) {
          categoryMap[cat].earned += cred.earned;
          categoryMap[cat].spent += cred.spent;
        }
      });
      const categories = Object.entries(categoryMap).map(([cat, v]) => ({
        category: cat,
        count: v.count,
        earned: v.earned,
        spent: v.spent,
        imbalance: v.earned > 0 ? Math.round(((v.earned - v.spent) / v.earned) * 100) : 0,
      })).sort((a, b) => b.count - a.count);

      setLiquidityData({
        velocityRate: Math.round(velocityRate),
        totalVolume90,
        totalCreditsIssued,
        dormantCount: dormant.length,
        hoarderCount: hoarders.length,
        overdrawerCount: overdrawers.length,
        velocityMembers,
        dormant,
        hoarders,
        overdrawers,
        categories,
        alerts: [
          ...hoarders.slice(0, 5).map(h => ({ type: 'hoarding', member: h.name, detail: `$${h.balance.toLocaleString()} sitting idle — ${h.ratio != null ? `ratio ${h.ratio}:1 earn/spend` : 'never spent any credits'}`, severity: 'amber' })),
          ...overdrawers.slice(0, 5).map(o => ({ type: 'imbalance', member: o.name, detail: `$${o.deficit.toLocaleString()} deficit — trade imbalance risk`, severity: 'red' })),
          ...categories.filter(c => c.imbalance > 70 && c.count >= 3).slice(0, 3).map(c => ({ type: 'category', member: c.category, detail: `${c.count} members, ${c.imbalance}% of credits unspent — supply glut`, severity: 'amber' })),
        ],
      });
      setLiquidityLoading(false);
    };
    fetchLiquidity();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchGrowth = async () => {
      setGrowthLoading(true);

      const [profilesRes, taxRes, posRes, creditsRes, txRes] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name, email, business_name, onboarding_completed, created_at'),
        supabase.from('tax_info').select('user_id'),
        supabase.from('pos_integrations').select('user_id, status').eq('status', 'active'),
        supabase.from('user_credits').select('user_id, earned_credits, spent_credits, available_credits'),
        supabase.from('pos_transactions')
          .select('merchant_id, transaction_date, barter_amount')
          .eq('status', 'completed')
          .gte('transaction_date', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const profiles   = profilesRes.data  || [];
      const taxUsers   = new Set((taxRes.data  || []).map((t: any) => t.user_id));
      const posUsers   = new Set((posRes.data  || []).map((p: any) => p.user_id));
      const credits    = creditsRes.data   || [];
      const txns       = txRes.data        || [];

      // Fill missing emails from auth.users via RPC
      const { data: authEmailRows } = await supabase.rpc('get_user_emails' as any);
      const emailMap: Record<string, string> = {};
      (authEmailRows || []).forEach((r: any) => { if (r.email) emailMap[r.id] = r.email; });

      // Funnel stages
      const totalSignups  = profiles.length;
      const onboarded     = profiles.filter((p: any) => p.onboarding_completed).length;
      const w9Complete    = taxUsers.size;
      const posConnected  = posUsers.size;

      // Per-stage user lists for drill-down
      const signedUpUsers  = profiles
        .map((p: any) => ({ user_id: p.user_id, full_name: p.full_name, email: p.email || emailMap[p.user_id] || '—', business_name: p.business_name, onboarding_completed: p.onboarding_completed, created_at: p.created_at, w9: taxUsers.has(p.user_id), pos: posUsers.has(p.user_id) }))
        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const onboardedUsers = signedUpUsers.filter((p: any) => p.onboarding_completed);
      const w9Users        = signedUpUsers.filter((p: any) => p.w9);
      const posActiveUsers = signedUpUsers.filter((p: any) => p.pos);

      // Pending / incomplete counts
      const pendingOnboarding = totalSignups - onboarded;
      const w9Incomplete      = onboarded - w9Complete;
      const posNotConnected   = onboarded - posConnected;

      // Conversion rates
      const toOnboarded  = totalSignups  > 0 ? Math.round((onboarded    / totalSignups)  * 100) : 0;
      const toW9         = onboarded     > 0 ? Math.round((w9Complete   / onboarded)     * 100) : 0;
      const toPOS        = onboarded     > 0 ? Math.round((posConnected / onboarded)     * 100) : 0;

      // Churn approx — onboarded but no tx in last 90 days
      const active90dIds = new Set(
        txns
          .filter((t: any) => new Date(t.transaction_date) >= new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))
          .map((t: any) => t.merchant_id)
      );
      const churned = profiles.filter((p: any) => p.onboarding_completed && !active90dIds.has(p.user_id)).length;
      const churnRate = onboarded > 0 ? Math.round((churned / onboarded) * 100) : 0;

      // Monthly active merchants (last 12 months)
      const monthlyMap: Record<string, Set<string>> = {};
      const signupMap:  Record<string, number>       = {};
      profiles.forEach((p: any) => {
        const m = new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        signupMap[m] = (signupMap[m] || 0) + 1;
      });
      txns.forEach((t: any) => {
        const m = new Date(t.transaction_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        if (!monthlyMap[m]) monthlyMap[m] = new Set();
        monthlyMap[m].add(t.merchant_id);
      });
      const months = [...new Set([...Object.keys(monthlyMap), ...Object.keys(signupMap)])].sort((a, b) =>
        new Date('01 ' + a).getTime() - new Date('01 ' + b).getTime()
      );
      const monthlyActive = months.map(m => ({
        month:    m,
        active:   monthlyMap[m]?.size ?? 0,
        signups:  signupMap[m]  ?? 0,
      }));

      // Credits health
      const totalEarned    = credits.reduce((s: number, c: any) => s + (c.earned_credits  || 0), 0);
      const totalSpent     = credits.reduce((s: number, c: any) => s + (c.spent_credits   || 0), 0);
      const totalAvailable = credits.reduce((s: number, c: any) => s + (c.available_credits || 0), 0);
      const utilizationRate = totalEarned > 0 ? Math.round((totalSpent / totalEarned) * 100) : 0;

      // IRTA-based metrics
      const annualTradeVolume  = txns.reduce((s: number, t: any) => s + (t.barter_amount || 0), 0);
      const monthlyAvgVolume   = annualTradeVolume / 12;
      const outstandingRatio   = monthlyAvgVolume > 0 ? parseFloat((totalAvailable / monthlyAvgVolume).toFixed(2)) : 0;
      const velocity           = totalAvailable > 0 ? parseFloat((annualTradeVolume / totalAvailable).toFixed(2)) : 0;

      // IRTA health status
      const liabilityStatus = outstandingRatio <= 2.5 ? 'healthy' : outstandingRatio <= 3 ? 'warning' : 'danger';
      const velocityStatus  = velocity >= 3 ? 'healthy' : velocity >= 1 ? 'warning' : 'danger';

      // Per-user credit health breakdown
      const profileMap = Object.fromEntries(profiles.map((p: any) => [p.user_id, p]));
      const memberCreditHealth = credits.map((c: any) => {
        const p = profileMap[c.user_id] || {};
        const earned      = c.earned_credits  || 0;
        const spent       = c.spent_credits   || 0;
        const outstanding = c.available_credits || 0;
        const utilization = earned > 0 ? Math.round((spent / earned) * 100) : 0;
        const status      = outstanding < 0 ? 'negative' : outstanding === 0 && earned === 0 ? 'dormant' : outstanding === 0 ? 'spent' : 'good';
        return {
          user_id:     c.user_id,
          name:        p.business_name || p.full_name || p.email || emailMap[c.user_id] || '—',
          email:       p.email || emailMap[c.user_id] || '—',
          earned,
          spent,
          outstanding,
          utilization,
          status,
        };
      });

      setGrowthData({
        funnel: { totalSignups, onboarded, w9Complete, posConnected, pendingOnboarding, w9Incomplete, posNotConnected, toOnboarded, toW9, toPOS, churned, churnRate, signedUpUsers, onboardedUsers, w9Users, posActiveUsers },
        monthlyActive,
        credits: { totalEarned, totalSpent, totalAvailable, utilizationRate, annualTradeVolume, monthlyAvgVolume, outstandingRatio, velocity, liabilityStatus, velocityStatus, memberCreditHealth },
      });
      setGrowthLoading(false);
    };
    fetchGrowth();
  }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchReferrals = async () => {
      setReferralLoading(true);

      const { data: rows } = await supabase
        .from('referrals')
        .select('id, referrer_id, referred_id, referral_code, status, points_awarded, created_at, completed_at')
        .order('created_at', { ascending: false });

      if (!rows || rows.length === 0) {
        setReferralLoading(false);
        return;
      }

      const allUserIds = [...new Set([...rows.map(r => r.referrer_id), ...rows.map(r => r.referred_id)])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, referral_code')
        .in('user_id', allUserIds);

      const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));

      // Build activity list
      const activity = rows.map(r => ({
        ...r,
        referrerName:  profileMap[r.referrer_id]?.full_name ?? null,
        referrerEmail: profileMap[r.referrer_id]?.email ?? '—',
        referredName:  profileMap[r.referred_id]?.full_name ?? null,
        referredEmail: profileMap[r.referred_id]?.email ?? '—',
      }));

      // Build per-referrer summary
      const referrerMap: Record<string, any> = {};
      rows.forEach(r => {
        if (!referrerMap[r.referrer_id]) {
          const p = profileMap[r.referrer_id];
          referrerMap[r.referrer_id] = {
            id: r.referrer_id,
            name: p?.full_name ?? null,
            email: p?.email ?? '—',
            referralCode: p?.referral_code ?? r.referral_code,
            total: 0, completed: 0, pending: 0, pointsEarned: 0,
          };
        }
        referrerMap[r.referrer_id].total++;
        if (r.status === 'completed') {
          referrerMap[r.referrer_id].completed++;
          referrerMap[r.referrer_id].pointsEarned += r.points_awarded;
        } else {
          referrerMap[r.referrer_id].pending++;
        }
      });

      setReferralData({ referrers: Object.values(referrerMap), activity });
      setReferralLoading(false);
    };
    fetchReferrals();
  }, [isAdmin]);

  // Fetch credit risk profiles
  useEffect(() => {
    if (!isAdmin) return;
    const fetchCreditRisk = async () => {
      setCreditRiskLoading(true);
      const [{ data: profiles }, { data: credits }, { data: riskProfiles }, { data: disputes }] = await Promise.all([
        supabase.from('profiles').select('user_id, business_name, full_name, email'),
        supabase.from('user_credits').select('user_id, available_credits, earned_credits'),
        supabase.from('merchant_credit_profiles').select('*'),
        supabase.from('disputes').select('reported_id, status'),
      ]);

      const creditsMap = Object.fromEntries((credits || []).map(c => [c.user_id, c]));
      const riskMap    = Object.fromEntries((riskProfiles || []).map(r => [r.user_id, r]));

      // Failure count = times reported in a dispute
      const failureMap: Record<string, { total: number; open: number }> = {};
      (disputes || []).forEach((d: any) => {
        if (!failureMap[d.reported_id]) failureMap[d.reported_id] = { total: 0, open: 0 };
        failureMap[d.reported_id].total++;
        if (['open', 'under_review', 'escalated'].includes(d.status)) failureMap[d.reported_id].open++;
      });

      const rows = (profiles || []).map(p => {
        const cr      = creditsMap[p.user_id];
        const rp      = riskMap[p.user_id];
        const balance = cr ? Number(cr.available_credits) : 0;
        const earned  = cr ? Number(cr.earned_credits ?? 0) : 0;
        const creditLine = rp ? Number(rp.credit_line) : 500;
        const utilization = creditLine > 0 && balance < 0 ? Math.abs(balance) / creditLine : 0;
        const failures = failureMap[p.user_id] ?? { total: 0, open: 0 };

        // Numeric risk score 0–100
        let score = 0;
        if (balance < 0)        score += 40;
        if (utilization >= 0.8) score += 20;
        else if (utilization >= 0.5) score += 10;
        if (failures.total >= 4) score += 30;
        else if (failures.total >= 2) score += 20;
        if (failures.open >= 1)  score += 10;

        return {
          user_id:                    p.user_id,
          businessName:               p.business_name || p.full_name || p.email,
          balance,
          earned_credits:             earned,
          credit_line:                creditLine,
          risk_score:                 rp?.risk_score ?? '',
          security_deposit_amount:    rp ? Number(rp.security_deposit_amount)   : 0,
          personal_guarantee_on_file: rp?.personal_guarantee_on_file            ?? false,
          auto_suspend_threshold:     rp ? Number(rp.auto_suspend_threshold)    : 500,
          notes:                      rp?.notes ?? '',
          failureCount:               failures.total,
          openDisputes:               failures.open,
          numericRiskScore:           Math.min(score, 100),
        };
      });

      setCreditRiskData(rows);
      setCreditRiskLoading(false);
    };
    fetchCreditRisk();
  }, [isAdmin]);

  // Fetch system health data
  useEffect(() => {
    if (!isAdmin) return;
    const fetchSysHealth = async () => {
      setSysHealthLoading(true);
      const since7d  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000).toISOString();
      const since24h = new Date(Date.now() - 1  * 24 * 60 * 60 * 1000).toISOString();
      const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const now7d    = new Date(Date.now() + 7  * 24 * 60 * 60 * 1000).toISOString();

      const { data: profilesData } = await supabase.from('profiles').select('user_id, business_name, full_name, email');
      const pMap = Object.fromEntries((profilesData || []).map((p: any) => [p.user_id, p.business_name || p.full_name || p.email]));

      const [
        { data: posData },
        { data: syncProgressData },
        { data: qrData },
        { data: adjData },
        { data: txnData },
        { data: creditsData },
      ] = await Promise.all([
        supabase.from('pos_integrations').select('id, user_id, provider, status, last_sync_at, token_expires_at').order('updated_at', { ascending: false }),
        supabase.from('product_sync_progress').select('id, pos_integration_id, user_id, status, error, error_items, started_at, completed_at').eq('status', 'failed').gte('started_at', since7d).order('started_at', { ascending: false }).limit(100),
        supabase.from('qr_failure_log').select('id, customer_id, merchant_id, token, failure_code, expired_at, scanned_at, seconds_late').gte('created_at', since24h).order('created_at', { ascending: false }).limit(50),
        supabase.from('audit_logs').select('id, user_id, record_id, new_data, old_data, created_at').eq('table_name', 'user_credits').gte('created_at', since7d).order('created_at', { ascending: false }).limit(200),
        supabase.from('transactions').select('id, from_user_id, status').gte('created_at', since30d),
        supabase.from('user_credits').select('user_id, available_credits'),
      ]);

      // POS failures — status != active OR last_sync > 24h ago
      const posFailureItems = (posData || []).filter(p =>
        p.status !== 'active' || (p.last_sync_at && new Date(p.last_sync_at) < new Date(since24h))
      ).map(p => {
        const daysSince = p.last_sync_at ? Math.floor((Date.now() - new Date(p.last_sync_at).getTime()) / 86400000) : 999;
        return { id: p.id, businessName: pMap[p.user_id] || '—', provider: p.provider, status: p.status, lastSync: p.last_sync_at ? new Date(p.last_sync_at).toLocaleDateString() : 'Never', daysSince };
      });

      // OAuth expiring within 7 days
      const oauthItems = (posData || []).filter(p => p.token_expires_at && new Date(p.token_expires_at) < new Date(now7d) && new Date(p.token_expires_at) > new Date())
        .map(p => {
          const daysLeft = Math.ceil((new Date(p.token_expires_at!).getTime() - Date.now()) / 86400000);
          return { id: p.id, businessName: pMap[p.user_id] || '—', provider: p.provider, expiresAt: new Date(p.token_expires_at!).toLocaleDateString(), daysLeft };
        }).sort((a, b) => a.daysLeft - b.daysLeft);

      // Sync errors — from product_sync_progress where status = 'failed'
      const posIntMap = Object.fromEntries((posData || []).map(p => [p.id, p]));
      const syncItems = (syncProgressData || []).map(s => {
        const integration = posIntMap[s.pos_integration_id] || null;
        return {
          id:       s.id,
          provider: integration?.provider || '—',
          endpoint: `${integration?.provider || 'POS'} product sync`,
          error:    s.error || `${s.error_items ?? 0} items failed`,
          time:     new Date(s.started_at).toLocaleString(),
        };
      });

      // QR failures — from qr_failure_log (merchant scanned an expired/invalid QR)
      const codeLabel: Record<string, string> = { P0001: 'Not found', P0002: 'Already used', P0003: 'Expired at scan' };
      const qrItems = (qrData || []).map(q => ({
        id:          q.id,
        customer:    pMap[q.customer_id] || '—',
        merchant:    pMap[q.merchant_id] || '—',
        failureCode: q.failure_code,
        reason:      codeLabel[q.failure_code] || q.failure_code,
        expiredAt:   q.expired_at ? new Date(q.expired_at).toLocaleString() : '—',
        scannedAt:   new Date(q.scanned_at).toLocaleString(),
        secondsLate: q.seconds_late ?? null,
      }));

      // High dispute rate per merchant
      const txByUser: Record<string, { total: number; disputed: number }> = {};
      (txnData || []).forEach(t => {
        if (!txByUser[t.from_user_id]) txByUser[t.from_user_id] = { total: 0, disputed: 0 };
        txByUser[t.from_user_id].total++;
        if (t.status === 'disputed') txByUser[t.from_user_id].disputed++;
      });
      const highRefundItems = Object.entries(txByUser)
        .filter(([, v]) => v.total >= 5 && (v.disputed / v.total) > 0.1)
        .map(([uid, v]) => ({
          userId: uid, businessName: pMap[uid] || '—', totalTrades: v.total, disputed: v.disputed,
          rate: ((v.disputed / v.total) * 100).toFixed(1),
        })).sort((a: any, b: any) => parseFloat(b.rate) - parseFloat(a.rate));

      // High manual adjustments (|diff| > 500)
      const highAdjItems = (adjData || []).map((l: any) => {
        const nd = l.new_data as Record<string, any> | null;
        const od = l.old_data as Record<string, any> | null;
        const diff = (nd?.available_credits != null && od?.available_credits != null) ? nd.available_credits - od.available_credits : null;
        return { id: l.id, admin: pMap[l.user_id] || '—', target: pMap[l.record_id] || '—', diff, reason: nd?.reason || '—', date: new Date(l.created_at).toLocaleString() };
      }).filter((a: any) => a.diff != null && Math.abs(a.diff) > 500)
        .sort((a: any, b: any) => Math.abs(b.diff) - Math.abs(a.diff));

      // Credit imbalance
      const allCredits = creditsData || [];
      const totalPositive = allCredits.filter(c => Number(c.available_credits) > 0).reduce((s, c) => s + Number(c.available_credits), 0);
      const totalNegative = Math.abs(allCredits.filter(c => Number(c.available_credits) < 0).reduce((s, c) => s + Number(c.available_credits), 0));
      const ratio = totalPositive > 0 ? totalNegative / totalPositive : 0;

      setSysHealthData({
        posFailures:   { count: posFailureItems.length, items: posFailureItems },
        oauthExpiring: { count: oauthItems.length,      items: oauthItems      },
        syncErrors:    { count: syncItems.length,        items: syncItems       },
        qrFailures:    { count: qrItems.length,          items: qrItems         },
        highRefunds:   { count: highRefundItems.length,  items: highRefundItems },
        highAdj:       { count: highAdjItems.length,     items: highAdjItems    },
        creditImbalance: { totalPositive, totalNegative, ratio },
      });
      setSysHealthLoading(false);

      // Fetch last 10 reconciliation reports
      const { data: recon } = await supabase
        .from('reconciliation_reports')
        .select('*')
        .order('run_at', { ascending: false })
        .limit(10);
      setReconReports(recon ?? []);
    };
    fetchSysHealth();
  }, [isAdmin]);

  const fetchDisputesData = async () => {
    if (!isAdmin) return;
    setDisputesMedLoading(true);
    const { data: profilesData } = await supabase.from('profiles').select('user_id, full_name, email, business_name');
    const pMap = Object.fromEntries((profilesData || []).map((p: any) => [p.user_id, p.business_name || p.full_name || p.email || 'Unknown']));
    const { data: rawDisputes } = await supabase
      .from('disputes')
      .select('id, transaction_id, reporter_id, reported_id, status, dispute_type, description, admin_notes, arbitration_outcome, partial_refund_amount, resolved_at, created_at')
      .order('created_at', { ascending: false })
      .limit(500);
    setDisputesData((rawDisputes || []).map((d: any) => ({
      id: d.id, transaction_id: d.transaction_id,
      reporter_id: d.reporter_id, reported_id: d.reported_id,
      reporterName: pMap[d.reporter_id] || d.reporter_id.slice(0, 8),
      reportedName: pMap[d.reported_id] || d.reported_id.slice(0, 8),
      status: d.status, dispute_type: d.dispute_type,
      description: d.description || '', admin_notes: d.admin_notes || '',
      arbitration_outcome: d.arbitration_outcome || '',
      partial_refund_amount: d.partial_refund_amount, resolved_at: d.resolved_at, created_at: d.created_at,
    })));
    const { data: rawEvidence } = await supabase
      .from('dispute_evidence')
      .select('id, dispute_id, uploaded_by, file_url, file_name, file_type, uploaded_at')
      .order('uploaded_at', { ascending: false })
      .limit(500);
    setEvidenceData((rawEvidence || []).map((e: any) => ({
      id: e.id, dispute_id: e.dispute_id, uploaded_by: e.uploaded_by,
      uploaderName: pMap[e.uploaded_by] || e.uploaded_by.slice(0, 8),
      file_url: e.file_url, file_name: e.file_name, file_type: e.file_type, uploaded_at: e.uploaded_at,
    })));
    setDisputesMedLoading(false);
  };

  useEffect(() => { fetchDisputesData(); }, [isAdmin]);

  useEffect(() => {
    if (!isAdmin) return;
    const fetchSupplyMap = async () => {
      setSupplyMapLoading(true);

      // Businesses: category, location, estimated_value, user_id
      const { data: bizData } = await supabase
        .from('businesses')
        .select('id, user_id, category, location, estimated_value, status');

      // POS transactions for avg ticket size per merchant
      const { data: posTx } = await supabase
        .from('pos_transactions')
        .select('merchant_id, total_amount, barter_amount');

      // User credits for earners/spenders
      const { data: credData } = await supabase
        .from('user_credits')
        .select('user_id, earned_credits, spent_credits');

      // Profiles for names
      const { data: profData } = await supabase
        .from('profiles')
        .select('user_id, full_name, business_name, location');

      const profMap = Object.fromEntries((profData || []).map(p => [p.user_id, p]));

      // ── Categories ──
      const catMap: Record<string, { listingCount: number; merchantIds: Set<string>; totalValue: number; valueCount: number; totalTicket: number; ticketCount: number }> = {};
      (bizData || []).forEach(b => {
        const cat = b.category || 'Other';
        if (!catMap[cat]) catMap[cat] = { listingCount: 0, merchantIds: new Set(), totalValue: 0, valueCount: 0, totalTicket: 0, ticketCount: 0 };
        catMap[cat].listingCount++;
        catMap[cat].merchantIds.add(b.user_id);
        if (b.estimated_value) { catMap[cat].totalValue += b.estimated_value; catMap[cat].valueCount++; }
      });

      // Map merchant → category for ticket size
      const merchantCat = Object.fromEntries((bizData || []).map(b => [b.user_id, b.category || 'Other']));
      (posTx || []).forEach(tx => {
        const cat = merchantCat[tx.merchant_id];
        if (cat && catMap[cat]) {
          catMap[cat].totalTicket += tx.total_amount ?? 0;
          catMap[cat].ticketCount++;
        }
      });

      const categories = Object.entries(catMap).map(([category, v]) => ({
        category,
        listingCount:  v.listingCount,
        merchantCount: v.merchantIds.size,
        avgValue:      v.valueCount > 0 ? v.totalValue / v.valueCount : 0,
        avgTicket:     v.ticketCount > 0 ? v.totalTicket / v.ticketCount : 0,
      })).sort((a, b) => b.listingCount - a.listingCount);

      // ── Regions ──
      const regMap: Record<string, { listingCount: number; merchantIds: Set<string>; totalValue: number; valueCount: number }> = {};
      (bizData || []).forEach(b => {
        const region = (b.location || 'Unknown').split(',').pop()?.trim() || b.location || 'Unknown';
        if (!regMap[region]) regMap[region] = { listingCount: 0, merchantIds: new Set(), totalValue: 0, valueCount: 0 };
        regMap[region].listingCount++;
        regMap[region].merchantIds.add(b.user_id);
        if (b.estimated_value) { regMap[region].totalValue += b.estimated_value; regMap[region].valueCount++; }
      });
      const regions = Object.entries(regMap).map(([region, v]) => ({
        region,
        listingCount:  v.listingCount,
        merchantCount: v.merchantIds.size,
        avgValue:      v.valueCount > 0 ? v.totalValue / v.valueCount : 0,
      })).sort((a, b) => b.listingCount - a.listingCount);

      // ── Top Earners / Spenders ──
      const bizByUser = Object.fromEntries((bizData || []).map(b => [b.user_id, b]));
      const credMap = Object.fromEntries((credData || []).map(c => [c.user_id, c]));

      const allUserIds = new Set([...(credData || []).map(c => c.user_id)]);
      const topEarners = [...allUserIds]
        .map(uid => {
          const prof = profMap[uid]; const biz = bizByUser[uid]; const cred = credMap[uid];
          return { userId: uid, name: biz?.business_name || prof?.business_name || prof?.full_name || 'Unknown', location: prof?.location || biz?.location || '', category: biz?.category || '', earned: Math.round(cred?.earned_credits ?? 0), spent: Math.round(cred?.spent_credits ?? 0) };
        })
        .filter(u => u.earned > 0)
        .sort((a, b) => b.earned - a.earned)
        .slice(0, 50);

      const topSpenders = [...allUserIds]
        .map(uid => {
          const prof = profMap[uid]; const biz = bizByUser[uid]; const cred = credMap[uid];
          return { userId: uid, name: biz?.business_name || prof?.business_name || prof?.full_name || 'Unknown', location: prof?.location || biz?.location || '', category: biz?.category || '', earned: Math.round(cred?.earned_credits ?? 0), spent: Math.round(cred?.spent_credits ?? 0) };
        })
        .filter(u => u.spent > 0)
        .sort((a, b) => b.spent - a.spent)
        .slice(0, 50);

      setSupplyMapData({ categories, regions, topEarners, topSpenders });
      setSupplyMapLoading(false);
    };
    fetchSupplyMap();
  }, [isAdmin]);

  const handleSaveCreditProfile = async (row: any) => {
    await supabase
      .from('merchant_credit_profiles')
      .upsert({
        user_id:                    row.user_id,
        credit_line:                row.credit_line,
        risk_score:                 row.risk_score || 'low',
        security_deposit_amount:    row.security_deposit_amount,
        personal_guarantee_on_file: row.personal_guarantee_on_file,
        auto_suspend_threshold:     row.auto_suspend_threshold,
        notes:                      row.notes,
      }, { onConflict: 'user_id' });

    setCreditRiskData(prev => prev.map(r =>
      r.user_id === row.user_id ? { ...r, ...row } : r
    ));
  };

  const handleFlagUpdate = async (userId: string, flagStatus: 'none' | 'soft' | 'hard', signals: string[]) => {
    await supabase.from('merchant_credit_profiles').upsert({
      user_id:      userId,
      flag_status:  flagStatus,
      flag_reasons: signals,
      flagged_at:   flagStatus !== 'none' ? new Date().toISOString() : null,
      flagged_by:   user?.id ?? null,
    }, { onConflict: 'user_id' });
    setRiskProfiles(prev => prev.map(r =>
      r.user_id === userId ? { ...r, flag_status: flagStatus, flag_reasons: signals } : r
    ));
  };

  const handleReportAction = async (reportId: string, status: 'reviewed' | 'dismissed') => {
    await supabase.from('business_reports').update({ status }).eq('id', reportId);
    setReportsData(prev => prev.map(r => r.id === reportId ? { ...r, status } : r));
  };

  const handleSuspendFromFlag = async (userId: string) => {
    await supabase.from('businesses').update({ status: 'suspended' }).eq('user_id', userId);
    await handleFlagUpdate(userId, 'hard', ['Manually suspended by admin']);
    await supabase.from('audit_logs').insert({
      user_id:    user?.id,
      admin_id:   user?.id,
      action:     'account_suspended',
      table_name: 'businesses',
      record_id:  userId,
      old_data:   { status: 'active' },
      new_data:   { status: 'suspended' },
      reason:     'Suspended from fraud flag by admin',
      section:    'TX Monitor > Flags & Fraud',
    });
  };



  const handleListingEdit = async (id: string, data: Record<string, any>) => {
    await supabase.from('businesses').update(data).eq('id', id);
    setListings(prev => prev.map(l => l.id === id ? { ...l, ...data } : l));
    await supabase.from('audit_logs').insert({
      user_id:    user?.id,
      admin_id:   user?.id,
      action:     'listing_edited',
      table_name: 'businesses',
      record_id:  id,
      new_data:   data,
      reason:     'Listing fields edited by admin',
      section:    'Listings > Admin Controls',
    });
  };

  const handleListingAction = async (id: string, action: string) => {
    const statusMap: Record<string, string> = {
      approve:  'active',
      reject:   'rejected',
      suspend:  'suspended',

      remove:   'removed',
    };
    const newStatus = statusMap[action];
    if (!newStatus) return;
    const prevListing = listings.find(l => l.id === id);
    await supabase.from('businesses').update({ status: newStatus }).eq('id', id);
    await supabase.from('audit_logs').insert({
      user_id:    user?.id,
      admin_id:   user?.id,
      action:     `listing_${action}`,
      table_name: 'businesses',
      record_id:  id,
      old_data:   { status: prevListing?.status, business_name: prevListing?.business_name },
      new_data:   { status: newStatus },
      reason:     `Listing ${action}d by admin`,
      section:    'Listings > Moderation Queue',
    });
    // Optimistically update local state
    setListings(prev => prev.map(l => l.id === id ? { ...l, status: newStatus } : l));
    // Also refresh overview stats
    const [activeRes, pendingRes] = await Promise.all([
      supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('businesses').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    ]);
    setStats(prev => ({
      ...prev,
      activeListings:   activeRes.count ?? prev.activeListings,
      pendingApprovals: pendingRes.count ?? prev.pendingApprovals,
    }));
  };

  // ─── Auth guards ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
          Verifying admin access…
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Alert className="max-w-md border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">Error verifying admin access: {error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Shield className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Access Denied</h2>
          <p className="text-gray-500 text-sm mt-2">You don't have admin privileges to view this page.</p>
          {user && <p className="text-xs text-gray-400 mt-1">{user.email}</p>}
        </div>
      </div>
    );
  }

  // ─── Dashboard Layout ───────────────────────────────────────────────────────
  return (
    <div className="flex bg-gray-50 overflow-hidden" style={{ height: 'calc(100vh - 64px)' }}>
      {/* Mobile sidebar backdrop */}
      {adminSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setAdminSidebarOpen(false)} />
      )}
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className={`fixed md:static top-0 bottom-0 left-0 z-50 md:z-auto w-56 bg-[#0f1117] flex flex-col shrink-0 overflow-hidden transition-transform duration-300 ${adminSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
        style={{ height: '100%' }}>
        {/* Logo */}
        <div className="h-14 flex items-center px-5 border-b border-white/10 shrink-0">
          <Shield className="h-5 w-5 text-emerald-400 mr-2.5" />
          <span className="text-white font-bold">Admin Panel</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ id, icon: Icon, label, subs }) => {
            const active   = activeSection === id;
            const hasSubs  = subs.length > 0;
            const isOpen   = expandedSections.has(id);

            return (
              <div key={id}>
                {/* Parent nav item */}
                <button
                  onClick={() => {
                    setActiveSection(id);
                    if (!hasSubs) setAdminSidebarOpen(false);
                    if (hasSubs) {
                      setExpandedSections(prev => {
                        const next = new Set(prev);
                        next.has(id) ? next.delete(id) : next.add(id);
                        return next;
                      });
                    }
                  }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all text-left ${
                    active && !hasSubs
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : active
                      ? 'text-white'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${active ? 'text-emerald-400' : ''}`} />
                  <span className="flex-1">{label}</span>
                  {id === 'activity' && systemAlerts.filter(a => a.type === 'error').length > 0 && (
                    <span className="h-4 w-4 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">
                      {systemAlerts.filter(a => a.type === 'error').length}
                    </span>
                  )}
                  {hasSubs && (
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  )}
                </button>

                {/* Sub-items */}
                {hasSubs && isOpen && (
                  <div className="mt-0.5 ml-3 pl-3 border-l border-white/10 space-y-0.5">
                    {subs.map(sub => {
                      const subActive = active && subSections[id] === sub;
                      return (
                        <button
                          key={sub}
                          onClick={() => {
                            setActiveSection(id);
                            setSub(id, sub);
                            setAdminSidebarOpen(false);
                          }}
                          className={`w-full text-left text-xs px-2.5 py-2 rounded-lg transition-all ${
                            subActive
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

        {/* User */}
        <div className="px-4 py-4 border-t border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-xs font-bold text-white shrink-0">A</div>
            <div className="min-w-0">
              <p className="text-white text-xs font-medium">Admin</p>
              <p className="text-gray-500 text-xs truncate">{user?.email}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-14 bg-white border-b flex items-center justify-between px-4 sm:px-6 shrink-0">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <button className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 mr-1" onClick={() => setAdminSidebarOpen(true)}>
              <svg className="h-5 w-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <button
              onClick={handleAdminBack}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors group"
            >
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
              Back
            </button>
            <span className="text-gray-300">|</span>
            <Shield className="h-4 w-4 text-emerald-500" />
            <ChevronRight className="h-3 w-3" />
            <span className="capitalize">{activeSection.replace('-', ' ')}</span>
            {subSections[activeSection] && (
              <>
                <ChevronRight className="h-3 w-3" />
                <span className="text-gray-900 font-semibold">{subSections[activeSection]}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              <CheckCircle className="h-3 w-3" />Admin Verified
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          {activeSection === 'overview' && (
            <OverviewSection
              stats={stats}
              loading={statsLoading}
              monthlyData={monthlyData}
              exceptions={{
                disputes:          disputesData.filter((d: any) => ['open', 'under_review', 'escalated'].includes(d.status)).length,
                reconMismatches:   reconReports.filter((r: any) => r.status === 'mismatch').length,
                negativeBalances:  agingData.filter((a: any) => a.balance < 0).length,
                tokensExpiring:    sysHealthData?.oauthExpiring.count ?? 0,
                pendingApprovals:  stats.pendingApprovals ?? 0,
                syncFailures:      sysHealthData?.syncErrors.count ?? 0,
                suspendedAccounts: suspendedAccounts.length,
              }}
              onNavigate={(section, sub) => {
                setActiveSection(section);
                setSub(section, sub);
              }}
            />
          )}
          {activeSection === 'listings' && (
            <ListingsSection
              sub={subSections.listings}
              listings={listings}
              loading={listingsLoading}
              onAction={handleListingAction}
              onEdit={handleListingEdit}
            />
          )}
          {activeSection === 'credits' && (
            <CreditsSection
              sub={subSections.credits}
              setSub={(s) => setSub('credits', s)}
              memberCredits={memberCredits}
              memberCreditsLoading={memberCreditsLoading}
              setMemberCredits={setMemberCredits}
              creditAdjLog={creditAdjLog}
              setCreditAdjLog={setCreditAdjLog}
              creditAdjLoading={creditAdjLoading}
              agingData={agingData}
              agingLoading={agingLoading}
              suspendedAccounts={suspendedAccounts}
              setSuspendedAccounts={setSuspendedAccounts}
              monthlyData={monthlyData}
              allUsers={users}
            />
          )}
          {activeSection === 'tax' && (
            <TaxSection sub={subSections.tax} setSub={s => setSub('tax', s)} w9Data={w9Data} w9Loading={w9Loading} annualTotals={annualTotals} annualLoading={annualLoading} taxYear={taxYear} setTaxYear={setTaxYear} auditLogs={auditLogs} auditLoading={auditLoading} />
          )}
          {activeSection === 'users' && (
            <UsersSection users={users} loading={usersLoading} />
          )}
          {activeSection === 'activity' && (
            <ActivitySection sub={subSections.activity} setSub={s => setSub('activity', s)} activityTxns={activityTxns} activityAudit={activityAudit} systemAlerts={systemAlerts} suspiciousList={suspiciousList} disputesList={disputesList} activityLoading={activityLoading} />
          )}
          {activeSection === 'txmon' && (
            <TxMonSection
              sub={subSections.txmon}
              setSub={(s) => setSub('txmon', s)}
              data={txMonData}
              loading={txMonLoading}
              riskProfiles={riskProfiles}
              reports={reportsData}
              reportsLoading={reportsLoading}
              onFlagUpdate={handleFlagUpdate}
              onReportAction={handleReportAction}
              onSuspend={handleSuspendFromFlag}
            />
          )}
          {activeSection === 'growth' && (
            <GrowthSection
              sub={subSections.growth}
              data={growthData}
              loading={growthLoading}
            />
          )}
          {activeSection === 'referrals' && (
            <ReferralsSection
              sub={subSections.referrals}
              data={referralData}
              loading={referralLoading}
            />
          )}
          {activeSection === 'liquidity' && (
            <LiquiditySection
              sub={subSections.liquidity}
              setSub={(s) => setSub('liquidity', s)}
              data={liquidityData}
              loading={liquidityLoading}
            />
          )}
          {activeSection === 'creditrisk' && (
            <CreditRiskSection
              sub={subSections.creditrisk}
              data={creditRiskData}
              loading={creditRiskLoading}
              onSave={handleSaveCreditProfile}
            />
          )}
          {activeSection === 'syshealth' && (
            <SystemHealthSection
              sub={subSections.syshealth}
              setSub={s => setSub('syshealth', s)}
              data={sysHealthData}
              loading={sysHealthLoading}
              reconReports={reconReports}
              reconRunning={reconRunning}
              onRunReconciliation={async () => {
                setReconRunning(true);
                await supabase.functions.invoke('credit-reconciliation');
                const { data: recon } = await supabase
                  .from('reconciliation_reports')
                  .select('*')
                  .order('run_at', { ascending: false })
                  .limit(10);
                setReconReports(recon ?? []);
                setReconRunning(false);
              }}
            />
          )}
          {activeSection === 'disputes' && (
            <DisputesSection
              sub={subSections.disputes}
              setSub={s => setSub('disputes', s)}
              disputes={disputesData}
              evidence={evidenceData}
              loading={disputesMedLoading}
              onRefresh={fetchDisputesData}
            />
          )}
          {activeSection === 'supplymap' && (
            <SupplyMapSection
              sub={subSections.supplymap}
              setSub={s => setSub('supplymap', s)}
              data={supplyMapData}
              loading={supplyMapLoading}
            />
          )}
          {activeSection === 'support' && (
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Support Inbox</h2>
                <p className="text-sm text-gray-500 mt-0.5">Messages from merchants requesting support</p>
              </div>
              <InboxSection variant="embedded" />
            </div>
          )}

          {activeSection === 'ads' && (
            <AdsSection activeSubTab={subSections['ads'] ?? 'Banners'} />
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminPanel;
