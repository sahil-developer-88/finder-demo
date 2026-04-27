import {
  LayoutDashboard, Store, CreditCard, Receipt, Users, Activity,
  Shield, TrendingUp, Gift, AlertTriangle, Bell, Scale, BarChart2,
} from 'lucide-react';

export const NAV_ITEMS = [
  { id: 'overview',   icon: LayoutDashboard, label: 'Overview',         subs: [] },
  { id: 'listings',   icon: Store,           label: 'Listings',         subs: ['Listings Overview', 'Moderation Queue', 'Listing Details', 'Admin Controls', 'Marketplace Analytics'] },
  { id: 'credits',    icon: CreditCard,      label: 'Exchange Ledger',  subs: ['Summary', 'Member Balances', 'Adjustments', 'Aging & Risk', 'Suspended', 'Write-offs', 'Platform Ledger'] },
  { id: 'tax',        icon: Receipt,         label: 'Tax & 1099',       subs: ['W-9 Tracking', 'Annual Totals', '1099-B Prep', 'Documents', 'Audit Trail', 'State Compliance', 'Backup Withholding'] },
  { id: 'users',      icon: Users,           label: 'Users',            subs: [] },
  { id: 'activity',   icon: Activity,        label: 'Activity',         subs: ['Transaction Feed', 'User Activity', 'System Alerts', 'Suspicious Behavior', 'Disputes'] },
  { id: 'txmon',      icon: AlertTriangle,   label: 'Tx Monitor',       subs: ['All Transactions', 'Barter Split', 'POS Sources', 'Flags & Fraud'] },
  { id: 'growth',     icon: TrendingUp,      label: 'Growth & Funnel',  subs: ['Funnel', 'Monthly Active', 'Credits Health'] },
  { id: 'referrals',  icon: Gift,            label: 'Referrals',        subs: ['Overview', 'Referrers', 'Activity'] },
  { id: 'liquidity',  icon: TrendingUp,      label: 'Liquidity',        subs: ['Overview', 'Credit Velocity', 'Dormant Credits', 'Imbalances', 'Category Supply'] },
  { id: 'creditrisk', icon: Shield,          label: 'Credit Risk',      subs: ['Overview', 'Risk Scorecard', 'Deposits & Guarantees'] },
  { id: 'syshealth',  icon: Bell,            label: 'System Health',    subs: ['Dashboard', 'POS & OAuth', 'Sync & QR', 'Financial Alerts'] },
  { id: 'disputes',   icon: Scale,           label: 'Disputes',         subs: ['Open Disputes', 'Evidence', 'Repeat Offenders'] },
  { id: 'supplymap',  icon: BarChart2,       label: 'Supply Map',       subs: ['Categories', 'Regional', 'Top Earners & Spenders'] },
];

export const SUB_TABS: Record<string, string[]> = {
  listings:   ['Overview', 'Moderation Queue', 'Marketplace Analytics'],
  credits:    ['Summary', 'Member Balances', 'Adjustments', 'Aging & Risk', 'Suspended', 'Write-offs', 'Platform Ledger'],
  tax:        ['W-9 Tracking', 'Annual Totals', '1099-B Prep', 'Documents', 'Audit Trail', 'State Compliance', 'Backup Withholding'],
  activity:   ['Transaction Feed', 'User Activity', 'System Alerts', 'Suspicious Behavior', 'Disputes'],
  txmon:      ['All Transactions', 'Barter Split', 'POS Sources', 'Flags & Fraud'],
  growth:     ['Funnel', 'Monthly Active', 'Credits Health'],
  referrals:  ['Overview', 'Referrers', 'Activity'],
  liquidity:  ['Overview', 'Credit Velocity', 'Dormant Credits', 'Imbalances', 'Category Supply'],
  creditrisk: ['Overview', 'Risk Scorecard', 'Deposits & Guarantees'],
  syshealth:  ['Dashboard', 'POS & OAuth', 'Sync & QR', 'Financial Alerts'],
  disputes:   ['Open Disputes', 'Evidence', 'Repeat Offenders'],
  supplymap:  ['Categories', 'Regional', 'Top Earners & Spenders'],
};
