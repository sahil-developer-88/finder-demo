import React, { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, AlertTriangle, CheckCircle, Clock, Download, Eye, FileText, Flag, Loader2, Shield, Upload } from 'lucide-react';
import { SectionTitle, StatCard, Pill, TH, TD, AdminPager, SHSearch } from '@/components/admin/shared/ui';
import { generateFilledW9Pdf, downloadFilledW9Pdf } from '@/utils/w9PdfGenerator';
import { download1099BPdf } from '@/utils/form1099BGenerator';
import { useToast } from '@/hooks/use-toast';

const PAGE_SIZE = 10;

// ─── State filing rules (sourced from IRS + state revenue depts) ─────────────
const STATE_RULES: Record<string, { label: string; requires1099B: boolean; directFile: boolean; threshold: number | null; noTax: boolean; note: string }> = {
  CA: { label: 'California',    requires1099B: true,  directFile: false, threshold: 0,    noTax: false, note: 'CF/SF handles it; no minimum' },
  NY: { label: 'New York',      requires1099B: false, directFile: false, threshold: null, noTax: false, note: 'No state 1099-B filing required' },
  TX: { label: 'Texas',         requires1099B: false, directFile: false, threshold: null, noTax: true,  note: 'No state income tax' },
  FL: { label: 'Florida',       requires1099B: false, directFile: false, threshold: null, noTax: true,  note: 'No state income tax' },
  IL: { label: 'Illinois',      requires1099B: false, directFile: false, threshold: null, noTax: false, note: 'Voluntary only; not mandatory' },
  WA: { label: 'Washington',    requires1099B: false, directFile: false, threshold: null, noTax: true,  note: 'No state income tax' },
  MA: { label: 'Massachusetts', requires1099B: true,  directFile: true,  threshold: 600,  noTax: false, note: 'Direct file required; $600 threshold' },
  CO: { label: 'Colorado',      requires1099B: true,  directFile: true,  threshold: null, noTax: false, note: 'Direct file if CO tax withheld' },
  OR: { label: 'Oregon',        requires1099B: false, directFile: false, threshold: null, noTax: false, note: '1099-B not required by OR' },
  NJ: { label: 'New Jersey',    requires1099B: true,  directFile: false, threshold: 1000, noTax: false, note: 'CF/SF handles it; $1,000 threshold' },
  NV: { label: 'Nevada',        requires1099B: false, directFile: false, threshold: null, noTax: true,  note: 'No state income tax' },
  AK: { label: 'Alaska',        requires1099B: false, directFile: false, threshold: null, noTax: true,  note: 'No state income tax' },
  SD: { label: 'South Dakota',  requires1099B: false, directFile: false, threshold: null, noTax: true,  note: 'No state income tax' },
  TN: { label: 'Tennessee',     requires1099B: false, directFile: false, threshold: null, noTax: true,  note: 'No state income tax' },
  NH: { label: 'New Hampshire', requires1099B: false, directFile: false, threshold: null, noTax: true,  note: 'No state income tax' },
  WY: { label: 'Wyoming',       requires1099B: false, directFile: false, threshold: null, noTax: true,  note: 'No state income tax' },
};

const TaxSection = ({ sub, setSub, w9Data: realW9, w9Loading, annualTotals: realAnnual, annualLoading, taxYear, setTaxYear, auditLogs: realAudit, auditLoading }: {
  sub: string;
  setSub: (s: string) => void;
  w9Data: any[];
  w9Loading: boolean;
  annualTotals: any[];
  annualLoading: boolean;
  taxYear: number;
  setTaxYear: (y: number) => void;
  auditLogs: any[];
  auditLoading: boolean;
}) => {
  const { toast } = useToast();
  const w9 = realW9;
  const annual = realAnnual;
  const [f1099Page, setF1099Page] = useState(1);
  const [f1099Search, setF1099Search] = useState('');
  const [f1099Sort, setF1099Sort] = useState<'name' | 'gross-desc' | 'gross-asc' | 'eligible' | 'w9-submitted' | 'w9-pending'>('gross-desc');
  const [taxAuditSearch, setTaxAuditSearch] = useState('');
  const [taxAuditSort, setTaxAuditSort] = useState<'date-desc' | 'date-asc' | 'admin' | 'action' | 'target'>('date-desc');
  const [stateSearch, setStateSearch] = useState('');
  const [bwMissingSearch, setBwMissingSearch] = useState('');
  const [bwFlaggedSearch, setBwFlaggedSearch] = useState('');
  const [bwMissingSort, setBwMissingSort] = useState<'name' | 'volume-desc' | 'volume-asc'>('volume-desc');
  const [bwFlaggedSort, setBwFlaggedSort] = useState<'name' | 'volume-desc' | 'volume-asc'>('volume-desc');

  // Derive 1099-B eligibility from annual totals: merchants with gross barter >= $600
  const w9Map = Object.fromEntries(realW9.map(w => [w.id, w]));
  // Annual volume lookup by user id — used in multiple sub-tabs
  const annualById = Object.fromEntries(annual.map(a => [a.id, a.total]));

  // IRS rule: barter exchanges must report ALL transactions ($0 threshold)
  // Exception: platform < 100 total transactions OR FMV < $1.00
  const form1099Data = annual.map(m => ({
    id:           m.id,
    businessName: m.businessName,
    grossBarter:  m.total,
    eligible:     m.total > 0,
    w9Submitted:  w9Map[m.id]?.submitted ?? false,
  }));

  const [w9Page, setW9Page] = useState(1);
  const [w9Search, setW9Search] = useState('');
  const [w9Sort, setW9Sort] = useState<'name' | 'status-submitted' | 'status-pending' | 'withholding'>('name');
  const [w9StatusFilter, setW9StatusFilter] = useState<'all' | 'submitted' | 'pending' | 'withholding'>('all');
  const [f1099EligFilter, setF1099EligFilter] = useState<'all' | 'eligible' | 'w9-submitted' | 'missing-w9'>('all');
  const [annualPage, setAnnualPage] = useState(1);
  const [annualSearch, setAnnualSearch] = useState('');
  const [annualSort, setAnnualSort] = useState<'name' | 'total-desc' | 'total-asc' | 'q1-desc' | 'q2-desc' | 'q3-desc' | 'q4-desc'>('total-desc');
  const [docsPage, setDocsPage] = useState(1);
  const [docsSearch, setDocsSearch] = useState('');
  const [auditPage, setAuditPage] = useState(1);
  const [stateCompPage, setStateCompPage] = useState(1);
  const [bwMissingPage, setBwMissingPage] = useState(1);
  const [bwFlaggedPage, setBwFlaggedPage] = useState(1);
  const exportAnnualCSV = () => {
    const hdr = ['Business', 'Q1 ($)', 'Q2 ($)', 'Q3 ($)', 'Q4 ($)', `Annual Total ${taxYear} ($)`];
    const rows = annual.map((m: any) => [
      `"${(m.businessName ?? '').replace(/"/g, '""')}"`,
      (m.q1 ?? 0).toFixed(2), (m.q2 ?? 0).toFixed(2),
      (m.q3 ?? 0).toFixed(2), (m.q4 ?? 0).toFixed(2),
      (m.total ?? 0).toFixed(2),
    ]);
    const csv = [hdr, ...rows].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = `annual_totals_${taxYear}.csv`;
    a.click();
  };

  const filteredAnnual   = (annualSearch.trim()
    ? annual.filter((m: any) => m.businessName?.toLowerCase().includes(annualSearch.toLowerCase()))
    : annual
  ).slice().sort((a: any, b: any) => {
    if (annualSort === 'name')       return (a.businessName ?? '').localeCompare(b.businessName ?? '');
    if (annualSort === 'total-desc') return (b.total ?? 0) - (a.total ?? 0);
    if (annualSort === 'total-asc')  return (a.total ?? 0) - (b.total ?? 0);
    if (annualSort === 'q1-desc')    return (b.q1 ?? 0) - (a.q1 ?? 0);
    if (annualSort === 'q2-desc')    return (b.q2 ?? 0) - (a.q2 ?? 0);
    if (annualSort === 'q3-desc')    return (b.q3 ?? 0) - (a.q3 ?? 0);
    if (annualSort === 'q4-desc')    return (b.q4 ?? 0) - (a.q4 ?? 0);
    return 0;
  });
  const annualTotalPages = Math.ceil(filteredAnnual.length / PAGE_SIZE);
  const pagedAnnual      = filteredAnnual.slice((annualPage - 1) * PAGE_SIZE, annualPage * PAGE_SIZE);

  const filteredW9  = (w9Search.trim()
    ? w9.filter(w => [w.businessName, w.legalName, w.email, w.ein].some(v => v?.toLowerCase().includes(w9Search.toLowerCase())))
    : w9
  ).filter(w => {
    if (w9StatusFilter === 'submitted')   return w.submitted;
    if (w9StatusFilter === 'pending')     return !w.submitted;
    if (w9StatusFilter === 'withholding') return w.backupWithholding;
    return true;
  }).slice().sort((a, b) => {
    if (w9Sort === 'name')             return (a.businessName ?? '').localeCompare(b.businessName ?? '');
    if (w9Sort === 'status-submitted') return (b.submitted ? 1 : 0) - (a.submitted ? 1 : 0);
    if (w9Sort === 'status-pending')   return (a.submitted ? 1 : 0) - (b.submitted ? 1 : 0);
    if (w9Sort === 'withholding')      return (b.backupWithholding ? 1 : 0) - (a.backupWithholding ? 1 : 0);
    return 0;
  });
  const totalPages  = Math.ceil(filteredW9.length / PAGE_SIZE);
  const pagedW9     = filteredW9.slice((w9Page - 1) * PAGE_SIZE, w9Page * PAGE_SIZE);

  return (
  <div>
    <SectionTitle title="Tax & 1099" sub="Compliance center — W-9 tracking, 1099-B preparation, and filing" />

    {sub === 'W-9 Tracking' && (
      <div className="space-y-5">
        {w9Loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <StatCard icon={CheckCircle} label="W-9 Submitted"      value={w9.filter(w => w.submitted).length}          color="emerald"
                onClick={() => { setW9StatusFilter(w9StatusFilter === 'submitted'   ? 'all' : 'submitted');   setW9Page(1); }} />
              <StatCard icon={Clock}       label="W-9 Pending"        value={w9.filter(w => !w.submitted).length}         color="amber"
                onClick={() => { setW9StatusFilter(w9StatusFilter === 'pending'     ? 'all' : 'pending');     setW9Page(1); }} />
              <StatCard icon={AlertCircle} label="Backup Withholding" value={w9.filter(w => w.backupWithholding).length}  color="red"
                onClick={() => { setW9StatusFilter(w9StatusFilter === 'withholding' ? 'all' : 'withholding'); setW9Page(1); }} />
            </div>

            <Card className="border-0 shadow-sm">
              <div className="flex items-center gap-3 px-4 py-3 border-b flex-wrap">
                <SHSearch value={w9Search} onChange={v => { setW9Search(v); setW9Page(1); }} placeholder="Search business, email, or EIN…" />
                <select
                  value={w9Sort}
                  onChange={e => setW9Sort(e.target.value as any)}
                  className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-600"
                >
                  <option value="name">Name: A → Z</option>
                  <option value="status-submitted">Status: Submitted first</option>
                  <option value="status-pending">Status: Pending first</option>
                  <option value="withholding">Backup Withholding first</option>
                </select>
                <span className="text-xs text-gray-400 shrink-0">{filteredW9.length} of {w9.length}</span>
              </div>
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead className="border-y bg-gray-50">
                    <tr><TH>Business</TH><TH>Email</TH><TH>W-9 Status</TH><TH>EIN / Tax ID</TH><TH>Backup Withholding</TH><TH right>Actions</TH></tr>
                  </thead>
                  <tbody className="divide-y">
                    {pagedW9.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">{w9Search ? 'No results match your search' : 'No users found'}</td></tr>
                    ) : pagedW9.map(w => (
                      <tr key={w.id} className="hover:bg-gray-50">
                        <TD>
                          <p className="font-medium text-gray-900">{w.businessName}</p>
                          {w.legalName && w.legalName !== w.businessName && (
                            <p className="text-xs text-gray-400">{w.legalName}</p>
                          )}
                        </TD>
                        <TD><p className="text-gray-500 text-xs">{w.email}</p></TD>
                        <TD>{w.submitted ? <Pill status="verified" /> : <Pill status="pending" />}</TD>
                        <TD>
                          {w.submitted
                            ? <div className="flex items-center gap-1.5"><Pill status={w.ein} /><span className="text-xs text-gray-400">{w.taxIdType}</span></div>
                            : <span className="text-xs text-gray-400">—</span>}
                        </TD>
                        <TD>
                          {w.backupWithholding
                            ? <span className="text-xs text-red-600 font-medium flex items-center gap-1"><AlertCircle className="h-3 w-3" />Required</span>
                            : <span className="text-xs text-gray-400">Not required</span>}
                        </TD>
                        <td className="px-4 py-3 text-right">
                          {!w.submitted && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={async () => {
                                const adminUser = (await supabase.auth.getUser()).data.user;
                                if (!adminUser) return;

                                const [notifRes, msgRes] = await Promise.all([
                                  supabase.from('notifications').insert({
                                    user_id: w.id,
                                    title: 'W-9 Required',
                                    message: 'Your W-9 tax form is required to continue trading on Value Exchange. Please complete it in your Profile Settings under the Tax tab.',
                                    type: 'warning',
                                  }),
                                  supabase.from('messages').insert({
                                    sender_id: adminUser.id,
                                    recipient_id: w.id,
                                    content: `Hi ${w.businessName},\n\nThis is a reminder from the Value Exchange admin team that your W-9 tax form has not been completed yet.\n\nPlease log in and go to Profile Settings → Tax to complete and submit your W-9. This is required to remain active on the platform.\n\nThank you,\nValue Exchange Admin`,
                                    message_type: 'text',
                                  }),
                                ]);

                                if (notifRes.error || msgRes.error) {
                                  alert('Failed to send: ' + (notifRes.error?.message || msgRes.error?.message));
                                } else {
                                  alert(`Notification and message sent to ${w.businessName}`);
                                }
                              }}
                            >
                              <Upload className="h-3.5 w-3.5 mr-1" />Request W-9
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

              </CardContent>
              <AdminPager total={filteredW9.length} page={w9Page} setPage={setW9Page} />
            </Card>
          </>
        )}
      </div>
    )}

    {sub === 'Annual Totals' && (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <p className="text-sm text-gray-500">Tax year</p>
            <select
              className="border rounded-lg px-2 py-1 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-indigo-400"
              value={taxYear}
              onChange={e => setTaxYear(Number(e.target.value))}
            >
              {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <Button variant="outline" size="sm" onClick={exportAnnualCSV} disabled={annual.length === 0}>
            <Download className="h-4 w-4 mr-1.5" />Export CSV
          </Button>
        </div>

        {annualLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
          </div>
        ) : (
          <Card className="border-0 shadow-sm">
            <div className="flex items-center gap-3 px-4 py-3 border-b flex-wrap">
              <SHSearch value={annualSearch} onChange={v => { setAnnualSearch(v); setAnnualPage(1); }} placeholder="Search business…" />
              <select
                value={annualSort}
                onChange={e => setAnnualSort(e.target.value as any)}
                className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-600"
              >
                <option value="total-desc">Annual Total: Highest first</option>
                <option value="total-asc">Annual Total: Lowest first</option>
                <option value="name">Name: A → Z</option>
                <option value="q1-desc">Q1: Highest first</option>
                <option value="q2-desc">Q2: Highest first</option>
                <option value="q3-desc">Q3: Highest first</option>
                <option value="q4-desc">Q4: Highest first</option>
              </select>
              <span className="text-xs text-gray-400 shrink-0">{filteredAnnual.length} of {annual.length}</span>
            </div>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead className="border-y bg-gray-50">
                  <tr><TH>Business</TH><TH right>Q1</TH><TH right>Q2</TH><TH right>Q3</TH><TH right>Q4</TH><TH right>Annual Total</TH></tr>
                </thead>
                <tbody className="divide-y">
                  {pagedAnnual.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">{annualSearch ? 'No results match your search' : `No transactions found for ${taxYear}`}</td></tr>
                  ) : pagedAnnual.map(m => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <TD><p className="font-medium text-gray-900">{m.businessName}</p></TD>
                      <TD right>{m.q1 > 0 ? `$${m.q1.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : <span className="text-gray-300">—</span>}</TD>
                      <TD right>{m.q2 > 0 ? `$${m.q2.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : <span className="text-gray-300">—</span>}</TD>
                      <TD right>{m.q3 > 0 ? `$${m.q3.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : <span className="text-gray-300">—</span>}</TD>
                      <TD right>{m.q4 > 0 ? `$${m.q4.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : <span className="text-gray-300">—</span>}</TD>
                      <td className="px-4 py-3 text-right text-sm font-bold text-gray-900">${m.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

            </CardContent>
            <AdminPager total={filteredAnnual.length} page={annualPage} setPage={setAnnualPage} />
          </Card>
        )}
      </div>
    )}

    {sub === '1099-B Prep' && (
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard icon={FileText}    label="Eligible Members"  value={form1099Data.filter(f => f.eligible).length}                       color="blue"
            onClick={() => { setF1099EligFilter(f1099EligFilter === 'eligible'     ? 'all' : 'eligible');     setF1099Page(1); }} />
          <StatCard icon={CheckCircle} label="W-9 Submitted"    value={form1099Data.filter(f => f.eligible && f.w9Submitted).length}  color="emerald"
            onClick={() => { setF1099EligFilter(f1099EligFilter === 'w9-submitted' ? 'all' : 'w9-submitted'); setF1099Page(1); }} />
          <StatCard icon={Clock}       label="Missing W-9"      value={form1099Data.filter(f => f.eligible && !f.w9Submitted).length} color="amber"
            onClick={() => { setF1099EligFilter(f1099EligFilter === 'missing-w9'   ? 'all' : 'missing-w9');   setF1099Page(1); }} />
        </div>

        <Card className="border-0 shadow-sm">
          <div className="flex items-center gap-3 px-4 py-3 border-b flex-wrap">
            <SHSearch value={f1099Search} onChange={v => { setF1099Search(v); setF1099Page(1); }} placeholder="Search business…" />
            <select
              value={f1099Sort}
              onChange={e => setF1099Sort(e.target.value as any)}
              className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-600"
            >
              <option value="gross-desc">Gross Barter: Highest first</option>
              <option value="gross-asc">Gross Barter: Lowest first</option>
              <option value="name">Name: A → Z</option>
              <option value="eligible">Eligible first</option>
              <option value="w9-submitted">W-9 Submitted first</option>
              <option value="w9-pending">W-9 Pending first</option>
            </select>
            {f1099Search && <span className="text-xs text-gray-400 shrink-0">{form1099Data.filter(f=>f.businessName?.toLowerCase().includes(f1099Search.toLowerCase())).length} of {form1099Data.length}</span>}
          </div>
          <CardContent className="p-0 overflow-x-auto">
            {(() => {
              const filt1099 = (f1099Search.trim() ? form1099Data.filter(f => f.businessName?.toLowerCase().includes(f1099Search.toLowerCase())) : form1099Data)
                .filter(f => {
                  if (f1099EligFilter === 'eligible')     return f.eligible;
                  if (f1099EligFilter === 'w9-submitted') return f.eligible && f.w9Submitted;
                  if (f1099EligFilter === 'missing-w9')   return f.eligible && !f.w9Submitted;
                  return true;
                })
                .slice().sort((a: any, b: any) => {
                  if (f1099Sort === 'gross-desc')    return (b.grossBarter ?? 0) - (a.grossBarter ?? 0);
                  if (f1099Sort === 'gross-asc')     return (a.grossBarter ?? 0) - (b.grossBarter ?? 0);
                  if (f1099Sort === 'name')          return (a.businessName ?? '').localeCompare(b.businessName ?? '');
                  if (f1099Sort === 'eligible')      return (b.eligible ? 1 : 0) - (a.eligible ? 1 : 0);
                  if (f1099Sort === 'w9-submitted')  return (b.w9Submitted ? 1 : 0) - (a.w9Submitted ? 1 : 0);
                  if (f1099Sort === 'w9-pending')    return (a.w9Submitted ? 1 : 0) - (b.w9Submitted ? 1 : 0);
                  return 0;
                });
              return (
            <table className="w-full min-w-[500px]">
              <thead className="border-y bg-gray-50">
                <tr><TH>Business</TH><TH right>Gross Barter {taxYear}</TH><TH>IRS Reporting</TH><TH>Eligible</TH><TH>W-9 Status</TH><TH right>Actions</TH></tr>
              </thead>
              <tbody className="divide-y">
                {annualLoading ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center"><Loader2 className="h-6 w-6 animate-spin text-indigo-400 mx-auto" /></td></tr>
                ) : filt1099.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">{f1099Search ? 'No results match your search' : `No barter transactions found for ${taxYear}`}</td></tr>
                ) : filt1099.slice((f1099Page-1)*PAGE_SIZE, f1099Page*PAGE_SIZE).map(f => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <TD><p className="font-medium">{f.businessName}</p></TD>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">${f.grossBarter.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                    <TD>
                      {f.grossBarter > 0
                        ? <span className="text-xs text-emerald-600 font-medium">Required — all barter</span>
                        : <span className="text-xs text-gray-400">No transactions</span>}
                    </TD>
                    <TD>{f.eligible ? <Pill status="active" /> : <span className="text-xs text-gray-400">Below threshold</span>}</TD>
                    <TD>{f.w9Submitted ? <Pill status="filed" /> : <Pill status="pending" />}</TD>
                    <td className="px-4 py-3 text-right">
                      {f.eligible && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={!f.w9Submitted}
                          onClick={async () => {
                            const w9 = w9Map[f.id];
                            await download1099BPdf({
                              taxYear: taxYear,
                              payerName: 'Value Exchange',
                              payerAddress: '',
                              payerCityStateZip: '',
                              payerTin: '',
                              recipientName:       f.businessName,
                              recipientLegalName:  w9?.legalName || f.businessName,
                              recipientAddress:    w9?.address || '',
                              recipientCityStateZip: w9 ? `${w9.city || ''}, ${w9.state || ''} ${w9.zipCode || ''}`.trim() : '',
                              recipientTin:        w9?.taxId || '',
                              taxIdType:           w9?.taxIdType || 'SSN',
                              grossBarter:         f.grossBarter,
                              q1: annual.find((a: any) => a.id === f.id)?.q1 ?? 0,
                              q2: annual.find((a: any) => a.id === f.id)?.q2 ?? 0,
                              q3: annual.find((a: any) => a.id === f.id)?.q3 ?? 0,
                              q4: annual.find((a: any) => a.id === f.id)?.q4 ?? 0,
                            });
                          }}
                        >
                          <Download className="h-3.5 w-3.5 mr-1" />Generate
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
              );
            })()}
            <AdminPager total={f1099Search.trim() ? form1099Data.filter(f => f.businessName?.toLowerCase().includes(f1099Search.toLowerCase())).length : form1099Data.length} page={f1099Page} setPage={setF1099Page} />
          </CardContent>
        </Card>
      </div>
    )}

    {sub === 'Documents' && (() => {
      const allDocs = realW9.filter(w => w.submitted).map(w => ({
        id:   w.id,
        name: `W-9 — ${w.businessName}`,
        date: w.signatureDate ? new Date(w.signatureDate).toLocaleDateString() : '—',
        raw:  w,
      }));
      const w9Docs = docsSearch.trim()
        ? allDocs.filter(d => d.name.toLowerCase().includes(docsSearch.toLowerCase()))
        : allDocs;
      const docsTotalPages = Math.ceil(w9Docs.length / PAGE_SIZE);
      const pagedDocs = w9Docs.slice((docsPage - 1) * PAGE_SIZE, docsPage * PAGE_SIZE);
      return (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              Stored Documents
              <span className="text-xs font-normal text-gray-400">{allDocs.length} W-9{allDocs.length !== 1 ? 's' : ''} on file</span>
            </CardTitle>
          </CardHeader>
          <div className="flex items-center justify-between px-4 pb-3 gap-3 border-b">
            <SHSearch value={docsSearch} onChange={v => { setDocsSearch(v); setDocsPage(1); }} placeholder="Search business…" />
            {docsSearch && <span className="text-xs text-gray-400 shrink-0">{w9Docs.length} of {allDocs.length}</span>}
          </div>
          <CardContent className="space-y-3 pt-3">
            {w9Loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
              </div>
            ) : pagedDocs.length === 0 ? (
              <div className="text-center py-12 text-sm text-gray-400">{docsSearch ? 'No results match your search' : 'No W-9 documents on file'}</div>
            ) : pagedDocs.map(d => (
              <div key={d.id} className="flex items-center justify-between p-3 border rounded-xl hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 bg-blue-50 rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{d.name}</p>
                    <p className="text-xs text-gray-400">Signed {d.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm" variant="outline" className="h-7 text-xs gap-1"
                    onClick={async () => {
                      const w = d.raw;
                      const url = await generateFilledW9Pdf({
                        legalName: w.legalName || '',
                        businessName: w.businessName || '',
                        businessType: w.businessType || '',
                        taxId: w.taxId || '',
                        taxIdType: w.taxIdType || '',
                        address: w.address || '',
                        city: w.city || '',
                        state: w.state || '',
                        zipCode: w.zipCode || '',
                        accountNumber: w.accountNumber || '',
                        exemptFromBackupWithholding: w.certificationAgreed || false,
                        certificationAgreed: w.certificationAgreed || false,
                        signature: w.signature || '',
                        signatureDate: w.signatureDate || '',
                      });
                      window.open(url, '_blank');
                    }}
                  >
                    <Eye className="h-3.5 w-3.5" />View
                  </Button>
                  <Button
                    size="sm" variant="outline" className="h-7 text-xs gap-1"
                    onClick={async () => {
                      const w = d.raw;
                      await downloadFilledW9Pdf({
                        legalName: w.legalName || '',
                        businessName: w.businessName || '',
                        businessType: w.businessType || '',
                        taxId: w.taxId || '',
                        taxIdType: w.taxIdType || '',
                        address: w.address || '',
                        city: w.city || '',
                        state: w.state || '',
                        zipCode: w.zipCode || '',
                        accountNumber: w.accountNumber || '',
                        exemptFromBackupWithholding: w.certificationAgreed || false,
                        certificationAgreed: w.certificationAgreed || false,
                        signature: w.signature || '',
                        signatureDate: w.signatureDate || '',
                      }, `w9-${(w.legalName || w.businessName || 'document').replace(/\s+/g, '-').toLowerCase()}.pdf`);
                    }}
                  >
                    <Download className="h-3.5 w-3.5" />Download
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
          <AdminPager total={w9Docs.length} page={docsPage} setPage={setDocsPage} />
        </Card>
      );
    })()}

    {sub === 'Audit Trail' && (() => {
      const filtAudit = (taxAuditSearch.trim()
        ? realAudit.filter((a: any) => { const q = taxAuditSearch.toLowerCase(); return [a.admin, a.action, a.target].some((v: any) => v?.toLowerCase().includes(q)); })
        : realAudit
      ).slice().sort((a: any, b: any) => {
        if (taxAuditSort === 'date-desc') return String(b.date ?? '').localeCompare(String(a.date ?? ''));
        if (taxAuditSort === 'date-asc')  return String(a.date ?? '').localeCompare(String(b.date ?? ''));
        if (taxAuditSort === 'admin')     return (a.admin ?? '').localeCompare(b.admin ?? '');
        if (taxAuditSort === 'action')    return (a.action ?? '').localeCompare(b.action ?? '');
        if (taxAuditSort === 'target')    return (a.target ?? '').localeCompare(b.target ?? '');
        return 0;
      });
      const auditTotalPages = Math.ceil(filtAudit.length / PAGE_SIZE);
      const pagedAudit = filtAudit.slice((auditPage - 1) * PAGE_SIZE, auditPage * PAGE_SIZE);
      return (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base">Tax Data Change Log</CardTitle></CardHeader>
          <div className="flex items-center gap-3 px-4 pb-3 flex-wrap border-b">
            <SHSearch value={taxAuditSearch} onChange={v => { setTaxAuditSearch(v); setAuditPage(1); }} placeholder="Search admin, action, target…" />
            <select
              value={taxAuditSort}
              onChange={e => setTaxAuditSort(e.target.value as any)}
              className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-gray-600"
            >
              <option value="date-desc">Date: Newest first</option>
              <option value="date-asc">Date: Oldest first</option>
              <option value="admin">Admin: A → Z</option>
              <option value="action">Action: A → Z</option>
              <option value="target">Target: A → Z</option>
            </select>
            {taxAuditSearch && <span className="text-xs text-gray-400 shrink-0">{filtAudit.length} of {realAudit.length}</span>}
          </div>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full min-w-[500px]">
              <thead className="border-y bg-gray-50">
                <tr><TH>Admin</TH><TH>Action</TH><TH>Target</TH><TH>Date & Time</TH></tr>
              </thead>
              <tbody className="divide-y">
                {auditLoading ? (
                  <tr><td colSpan={4} className="px-4 py-12 text-center"><Loader2 className="h-6 w-6 animate-spin text-indigo-400 mx-auto" /></td></tr>
                ) : pagedAudit.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-gray-400">{taxAuditSearch ? 'No results match your search' : 'No audit entries found'}</td></tr>
                ) : pagedAudit.map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <TD><p className="text-gray-500 text-xs">{a.admin}</p></TD>
                    <TD><p className="font-medium">{a.action}</p></TD>
                    <TD>{a.target}</TD>
                    <TD><p className="text-gray-400 text-xs font-mono">{a.date}</p></TD>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
          <AdminPager total={filtAudit.length} page={auditPage} setPage={setAuditPage} />
        </Card>
      );
    })()}
    {sub === 'State Compliance' && (() => {
      // Group merchants by state from w9Data
      const stateMap: Record<string, { merchants: any[]; volume: number }> = {};
      w9.filter(w => w.submitted && w.state).forEach(w => {
        const s = (w.state as string).toUpperCase().trim();
        if (!stateMap[s]) stateMap[s] = { merchants: [], volume: 0 };
        stateMap[s].merchants.push(w);
      });
      // Add volume from annualTotals
      w9.filter(w => w.submitted && w.state).forEach(w => {
        const s = (w.state as string).toUpperCase().trim();
        if (stateMap[s]) stateMap[s].volume += annualById[w.id] || 0;
      });
      const stateRowsAll = Object.entries(stateMap).map(([code, d]) => {
        const rule = STATE_RULES[code];
        return { code, label: rule?.label || code, count: d.merchants.length, volume: d.volume, rule };
      }).sort((a, b) => b.count - a.count);
      const stateRows = stateSearch.trim()
        ? stateRowsAll.filter(r => r.code.toLowerCase().includes(stateSearch.toLowerCase()) || r.label.toLowerCase().includes(stateSearch.toLowerCase()))
        : stateRowsAll;

      const directFileStates  = stateRows.filter(r => r.rule?.directFile);
      const noTaxStates       = stateRows.filter(r => r.rule?.noTax);
      const cfsfStates        = stateRows.filter(r => r.rule?.requires1099B && !r.rule?.directFile);

      const scTotalPages = Math.max(1, Math.ceil(stateRows.length / PAGE_SIZE));
      const pagedStateRows = stateRows.slice((stateCompPage - 1) * PAGE_SIZE, stateCompPage * PAGE_SIZE);

      return (
        <div className="space-y-5">
          {/* IRS note */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
            <div className="text-sm text-blue-800">
              <span className="font-semibold">Federal rule:</span> Barter exchanges must report <span className="font-semibold">all transactions</span> on Form 1099-B — no dollar minimum. State rules below apply to additional state-level 1099-B filings only.
            </div>
          </div>

          {/* KPI */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={AlertCircle} label="Direct File Required" value={directFileStates.length}  color="red"     sub="states need direct filing" />
            <StatCard icon={FileText}    label="CF/SF Handled"        value={cfsfStates.length}         color="emerald" sub="IRS forwards automatically" />
            <StatCard icon={CheckCircle} label="No State Tax"         value={noTaxStates.length}        color="blue"    sub="no state filing needed" />
          </div>

          <div className="flex items-center gap-3">
            <SHSearch value={stateSearch} onChange={v => { setStateSearch(v); setStateCompPage(1); }} placeholder="Search state code or name…" />
            {stateSearch && <span className="text-xs text-gray-400 shrink-0">{stateRows.length} of {stateRowsAll.length}</span>}
          </div>

          {stateRowsAll.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-12 text-center text-sm text-gray-400">
                No state data available — members must complete W-9 with state info.
              </CardContent>
            </Card>
          ) : stateRows.length === 0 ? (
            <Card className="border-0 shadow-sm">
              <CardContent className="py-12 text-center text-sm text-gray-400">No results match your search</CardContent>
            </Card>
          ) : (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-0 overflow-x-auto">
                <table className="w-full min-w-[500px]">
                  <thead className="border-y bg-gray-50">
                    <tr><TH>State</TH><TH right>Merchants</TH><TH right>Barter Volume</TH><TH>1099-B Required?</TH><TH>Filing Method</TH><TH>Threshold</TH><TH>Notes</TH></tr>
                  </thead>
                  <tbody className="divide-y">
                    {pagedStateRows.map(r => (
                      <tr key={r.code} className="hover:bg-gray-50">
                        <TD>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded font-bold">{r.code}</span>
                            <span className="font-medium text-gray-900">{r.label}</span>
                            {r.rule?.noTax && <span className="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">No Tax</span>}
                          </div>
                        </TD>
                        <TD right><span className="font-medium">{r.count}</span></TD>
                        <TD right>{r.volume > 0 ? `$${r.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}</TD>
                        <TD>
                          {!r.rule ? <span className="text-xs text-gray-400">Unknown</span>
                            : r.rule.requires1099B
                            ? <span className="text-xs font-medium text-red-600 flex items-center gap-1"><AlertCircle className="h-3 w-3" />Yes</span>
                            : <span className="text-xs text-gray-400">No</span>}
                        </TD>
                        <TD>
                          {!r.rule ? <span className="text-xs text-gray-400">—</span>
                            : r.rule.noTax ? <span className="text-xs text-gray-400">N/A</span>
                            : r.rule.directFile
                            ? <span className="text-xs font-medium text-amber-600">Direct File</span>
                            : r.rule.requires1099B
                            ? <span className="text-xs text-emerald-600">CF/SF Program</span>
                            : <span className="text-xs text-gray-400">Not required</span>}
                        </TD>
                        <TD>
                          {r.rule?.threshold === 0 ? <span className="text-xs text-red-600">All transactions</span>
                            : r.rule?.threshold ? <span className="text-xs font-medium">${r.rule.threshold.toLocaleString()}</span>
                            : <span className="text-xs text-gray-400">—</span>}
                        </TD>
                        <TD><span className="text-xs text-gray-500">{r.rule?.note || '—'}</span></TD>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {scTotalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                    <span className="text-xs text-gray-400">
                      Showing {(stateCompPage - 1) * PAGE_SIZE + 1}–{Math.min(stateCompPage * PAGE_SIZE, stateRows.length)} of {stateRows.length} states
                    </span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setStateCompPage(p => Math.max(1, p - 1))} disabled={stateCompPage === 1} className="px-3 py-1 text-base font-bold rounded border-2 border-gray-300 bg-white hover:bg-gray-100 hover:border-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed">&#8249;</button>
                      {Array.from({ length: scTotalPages }, (_, i) => i + 1).map(p => (
                        <button key={p} onClick={() => setStateCompPage(p)} className={`px-3 py-1 text-sm rounded border-2 ${p === stateCompPage ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold' : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300'}`}>{p}</button>
                      ))}
                      <button onClick={() => setStateCompPage(p => Math.min(scTotalPages, p + 1))} disabled={stateCompPage === scTotalPages} className="px-3 py-1 text-base font-bold rounded border-2 border-gray-300 bg-white hover:bg-gray-100 hover:border-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed">&#8250;</button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Direct file action items */}
          {directFileStates.length > 0 && (
            <Card className="border-0 shadow-sm border-l-4 border-l-red-400">
              <CardHeader className="pb-2"><CardTitle className="text-base text-red-700 flex items-center gap-2"><AlertTriangle className="h-4 w-4" />Action Required — Direct File States</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {directFileStates.map(r => (
                  <div key={r.code} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-red-900">{r.label} ({r.code}) — {r.count} merchant{r.count !== 1 ? 's' : ''}</p>
                      <p className="text-xs text-red-700">{r.rule?.note}</p>
                    </div>
                    <span className="text-sm font-bold text-red-700">${r.volume.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      );
    })()}

    {sub === 'Backup Withholding' && (() => {
      const missingW9All = w9.filter(w => !w.submitted && (annualById[w.id] || 0) > 0);
      const flaggedAll   = w9.filter(w => w.backupWithholding);
      const sortBW = (arr: any[], sortVal: 'name' | 'volume-desc' | 'volume-asc') => arr.slice().sort((a, b) => {
        if (sortVal === 'name')        return (a.businessName ?? '').localeCompare(b.businessName ?? '');
        if (sortVal === 'volume-desc') return (annualById[b.id] || 0) - (annualById[a.id] || 0);
        if (sortVal === 'volume-asc')  return (annualById[a.id] || 0) - (annualById[b.id] || 0);
        return 0;
      });
      const missingW9    = sortBW(bwMissingSearch.trim() ? missingW9All.filter(w => [w.businessName, w.email].some((v: any) => v?.toLowerCase().includes(bwMissingSearch.toLowerCase()))) : missingW9All, bwMissingSort);
      const flagged      = sortBW(bwFlaggedSearch.trim() ? flaggedAll.filter(w => [w.businessName, w.email].some((v: any) => v?.toLowerCase().includes(bwFlaggedSearch.toLowerCase()))) : flaggedAll, bwFlaggedSort);
      const withholdRate = 0.24;
      const currentYear  = new Date().getFullYear();

      const bwMissingTotalPages = Math.max(1, Math.ceil(missingW9.length / PAGE_SIZE));
      const pagedMissingW9 = missingW9.slice((bwMissingPage - 1) * PAGE_SIZE, bwMissingPage * PAGE_SIZE);
      const bwFlaggedTotalPages = Math.max(1, Math.ceil(flagged.length / PAGE_SIZE));
      const pagedFlagged = flagged.slice((bwFlaggedPage - 1) * PAGE_SIZE, bwFlaggedPage * PAGE_SIZE);

      return (
        <div className="space-y-5">
          {/* Form 945 reminder */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800">
              <span className="font-semibold">Form 945 due January 31, {currentYear + 1}</span> — File if any backup withholding was applied during {currentYear}.
              Backup withholding rate: <span className="font-bold">24%</span> (IRS mandated). Remit via EFTPS.
            </div>
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard icon={AlertCircle} label="Missing W-9"         value={missingW9.length} color="red"    sub="begin 24% withholding immediately" />
            <StatCard icon={Flag}        label="Flagged for BW"      value={flagged.length}   color="amber"  sub="not exempt from withholding" />
            <StatCard icon={Shield}      label="Withholding Rate"    value="24%"              color="indigo" sub="current IRS rate" />
          </div>

          {/* Members missing W-9 */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                Members Missing W-9 — Withholding Required Immediately
              </CardTitle>
            </CardHeader>
            <div className="flex items-center gap-3 px-4 pb-3 flex-wrap border-b">
              <SHSearch value={bwMissingSearch} onChange={v => { setBwMissingSearch(v); setBwMissingPage(1); }} placeholder="Search business or email…" />
              <select
                value={bwMissingSort}
                onChange={e => setBwMissingSort(e.target.value as any)}
                className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-red-300 bg-white text-gray-600"
              >
                <option value="volume-desc">Barter Volume: Highest first</option>
                <option value="volume-asc">Barter Volume: Lowest first</option>
                <option value="name">Name: A → Z</option>
              </select>
              {bwMissingSearch && <span className="text-xs text-gray-400 shrink-0">{missingW9.length} of {missingW9All.length}</span>}
            </div>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead className="border-y bg-gray-50">
                  <tr><TH>Business</TH><TH>Email</TH><TH right>Barter Volume {taxYear}</TH><TH right>24% Withheld Est.</TH><TH right>Action</TH></tr>
                </thead>
                <tbody className="divide-y">
                  {missingW9.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-sm text-emerald-600 font-medium">{bwMissingSearch ? 'No results match your search' : '✅ All active members have submitted W-9'}</td></tr>
                  ) : pagedMissingW9.map(w => {
                    const vol = annualById[w.id] || 0;
                    return (
                      <tr key={w.id} className="hover:bg-gray-50 bg-red-50/40">
                        <TD><p className="font-medium text-gray-900">{w.businessName}</p></TD>
                        <TD><p className="text-xs text-gray-500">{w.email}</p></TD>
                        <TD right><span className="font-medium">{vol > 0 ? `$${vol.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}</span></TD>
                        <TD right><span className="font-semibold text-red-600">{vol > 0 ? `$${(vol * withholdRate).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}</span></TD>
                        <td className="px-4 py-3 text-right">
                          <Button size="sm" variant="outline" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50"
                            onClick={async () => {
                              const adminUser = (await supabase.auth.getUser()).data.user;
                              if (!adminUser) return;
                              await Promise.all([
                                supabase.from('notifications').insert({
                                  user_id: w.id,
                                  title: 'W-9 Required — Withholding Notice',
                                  message: `Your W-9 is required. Without it, 24% backup withholding applies to your barter income. Please complete it under Profile Settings → Tax.`,
                                  type: 'warning',
                                }),
                                supabase.from('messages').insert({
                                  sender_id: adminUser.id,
                                  recipient_id: w.id,
                                  content: `Hi ${w.businessName},\n\nOur records show you have not submitted a W-9 tax form. Per IRS regulations, we are required to apply 24% backup withholding to your barter income until a valid W-9 is on file.\n\nPlease log in and complete your W-9 under Profile Settings → Tax as soon as possible.\n\nThank you,\nValue Exchange Admin`,
                                  message_type: 'text',
                                }),
                              ]);
                              alert(`Withholding notice sent to ${w.businessName}`);
                            }}
                          >
                            <Upload className="h-3 w-3 mr-1" />Send Notice
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {missingW9.length > 0 && bwMissingTotalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                  <span className="text-xs text-gray-400">
                    Showing {(bwMissingPage - 1) * PAGE_SIZE + 1}–{Math.min(bwMissingPage * PAGE_SIZE, missingW9.length)} of {missingW9.length} members
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setBwMissingPage(p => Math.max(1, p - 1))} disabled={bwMissingPage === 1} className="px-3 py-1 text-base font-bold rounded border-2 border-gray-300 bg-white hover:bg-gray-100 hover:border-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed">&#8249;</button>
                    {Array.from({ length: bwMissingTotalPages }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => setBwMissingPage(p)} className={`px-3 py-1 text-sm rounded border-2 ${p === bwMissingPage ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold' : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300'}`}>{p}</button>
                    ))}
                    <button onClick={() => setBwMissingPage(p => Math.min(bwMissingTotalPages, p + 1))} disabled={bwMissingPage === bwMissingTotalPages} className="px-3 py-1 text-base font-bold rounded border-2 border-gray-300 bg-white hover:bg-gray-100 hover:border-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed">&#8250;</button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Members flagged for backup withholding */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Flag className="h-4 w-4 text-amber-500" />
                Backup Withholding Flagged — Not Exempt
              </CardTitle>
            </CardHeader>
            <div className="flex items-center gap-3 px-4 pb-3 flex-wrap border-b">
              <SHSearch value={bwFlaggedSearch} onChange={v => { setBwFlaggedSearch(v); setBwFlaggedPage(1); }} placeholder="Search business or email…" />
              <select
                value={bwFlaggedSort}
                onChange={e => setBwFlaggedSort(e.target.value as any)}
                className="text-xs border rounded-lg px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-amber-300 bg-white text-gray-600"
              >
                <option value="volume-desc">Barter Volume: Highest first</option>
                <option value="volume-asc">Barter Volume: Lowest first</option>
                <option value="name">Name: A → Z</option>
              </select>
              {bwFlaggedSearch && <span className="text-xs text-gray-400 shrink-0">{flagged.length} of {flaggedAll.length}</span>}
            </div>
            <CardContent className="p-0 overflow-x-auto">
              <table className="w-full min-w-[500px]">
                <thead className="border-y bg-gray-50">
                  <tr><TH>Business</TH><TH>Email</TH><TH>Tax ID Type</TH><TH>W-9 Submitted</TH><TH right>Barter Volume {taxYear}</TH><TH right>Action</TH></tr>
                </thead>
                <tbody className="divide-y">
                  {flagged.length === 0 ? (
                    <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-emerald-600 font-medium">{bwFlaggedSearch ? 'No results match your search' : '✅ No members flagged for backup withholding'}</td></tr>
                  ) : pagedFlagged.map(w => {
                    const vol = annualById[w.id] || 0;
                    return (
                      <tr key={w.id} className="hover:bg-gray-50 bg-amber-50/40">
                        <TD><p className="font-medium text-gray-900">{w.businessName}</p></TD>
                        <TD><p className="text-xs text-gray-500">{w.email}</p></TD>
                        <TD><span className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">{w.taxIdType || '—'}</span></TD>
                        <TD>{w.submitted ? <Pill status="verified" /> : <Pill status="pending" />}</TD>
                        <TD right><span className="font-medium">{vol > 0 ? `$${vol.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}</span></TD>
                        <TD right>
                          <Button size="sm" variant="outline" className="h-7 text-xs text-amber-600 border-amber-200 hover:bg-amber-50"
                            onClick={async () => {
                              const adminUser = (await supabase.auth.getUser()).data.user;
                              if (!adminUser) return;
                              await Promise.all([
                                supabase.from('notifications').insert({
                                  user_id: w.id,
                                  title: 'Backup Withholding — You Are Flagged',
                                  message: `Your account is flagged for backup withholding. You are not currently marked as exempt. Per IRS rules, 24% backup withholding applies to your barter income. Please review your W-9 under Profile Settings → Tax.`,
                                  type: 'warning',
                                }),
                                supabase.from('messages').insert({
                                  sender_id: adminUser.id,
                                  recipient_id: w.id,
                                  content: `Hi ${w.businessName},\n\nYour account has been flagged for backup withholding. You are not currently marked as exempt from IRS backup withholding requirements.\n\nPer IRS regulations, we are required to withhold 24% of your barter income and remit it to the IRS until your exemption status is resolved.\n\nPlease log in and review your W-9 information under Profile Settings → Tax. If you believe this is an error, ensure your W-9 certification is complete and that your exempt status is correctly indicated.\n\nThank you,\nValue Exchange Admin`,
                                  message_type: 'text',
                                }),
                              ]);
                              toast({ title: 'Notice sent', description: `Backup withholding notice sent to ${w.businessName}` });
                            }}
                          >Send Notice</Button>
                        </TD>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {flagged.length > 0 && bwFlaggedTotalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
                  <span className="text-xs text-gray-400">
                    Showing {(bwFlaggedPage - 1) * PAGE_SIZE + 1}–{Math.min(bwFlaggedPage * PAGE_SIZE, flagged.length)} of {flagged.length} members
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setBwFlaggedPage(p => Math.max(1, p - 1))} disabled={bwFlaggedPage === 1} className="px-3 py-1 text-base font-bold rounded border-2 border-gray-300 bg-white hover:bg-gray-100 hover:border-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed">&#8249;</button>
                    {Array.from({ length: bwFlaggedTotalPages }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => setBwFlaggedPage(p)} className={`px-3 py-1 text-sm rounded border-2 ${p === bwFlaggedPage ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold' : 'border-gray-200 bg-white text-gray-600 hover:border-emerald-300'}`}>{p}</button>
                    ))}
                    <button onClick={() => setBwFlaggedPage(p => Math.min(bwFlaggedTotalPages, p + 1))} disabled={bwFlaggedPage === bwFlaggedTotalPages} className="px-3 py-1 text-base font-bold rounded border-2 border-gray-300 bg-white hover:bg-gray-100 hover:border-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed">&#8250;</button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    })()}

  </div>
  );
};

export default TaxSection;
