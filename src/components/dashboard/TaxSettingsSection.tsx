import React, { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Download } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import TaxReporting from '@/components/tax/TaxReporting';
import W9Form from '@/components/tax/W9Form';

const TaxSettingsSection = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [existingTaxInfo, setExistingTaxInfo] = useState<any>(null);

  // Year-end report state
  const [yearEndYear, setYearEndYear] = useState(() => new Date().getFullYear());
  const [yearEndData, setYearEndData] = useState<{ month_label: string; month_num: number; earned: number; spent: number }[]>([]);
  const [yearEndLoading, setYearEndLoading] = useState(false);
  const [yearEndLoaded, setYearEndLoaded] = useState(false);

  const fetchYearEndData = async (year: number) => {
    setYearEndLoading(true);
    const { data, error } = await supabase.rpc('merchant_get_yearly_barter_earnings', { p_year: year });
    if (!error) { setYearEndData(data || []); setYearEndLoaded(true); }
    setYearEndLoading(false);
  };

  const downloadYearEndCSV = () => {
    const headers = ['Month', 'Barter Earned', 'Barter Spent', 'Net'];
    const rows = yearEndData.map(r => [r.month_label, Number(r.earned).toFixed(2), Number(r.spent).toFixed(2), (Number(r.earned) - Number(r.spent)).toFixed(2)]);
    const totals = ['TOTAL',
      yearEndData.reduce((s, r) => s + Number(r.earned), 0).toFixed(2),
      yearEndData.reduce((s, r) => s + Number(r.spent), 0).toFixed(2),
      yearEndData.reduce((s, r) => s + Number(r.earned) - Number(r.spent), 0).toFixed(2),
    ];
    const csv = [headers, ...rows, totals].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `year-end-barter-report-${yearEndYear}.csv`; a.click(); URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (!user) return;
    supabase
      .from('tax_info')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setExistingTaxInfo(data || null);
        setLoading(false);
      });
  }, [user]);

  const handleW9Submit = async (w9Data: any) => {
    if (!user) return;

    const record = {
      user_id: user.id,
      legal_name: w9Data.legalName,
      business_name: w9Data.businessName,
      business_type: w9Data.businessType,
      llc_classification: w9Data.llcClassification,
      tax_id: w9Data.taxId,
      tax_id_type: w9Data.taxIdType,
      address: w9Data.address,
      city: w9Data.city,
      state: w9Data.state,
      zip_code: w9Data.zipCode,
      account_number: w9Data.accountNumber,
      exempt_from_backup_withholding: w9Data.exemptFromBackupWithholding,
      certification_agreed: w9Data.certificationAgreed,
      signature: w9Data.signature,
      signature_date: w9Data.signatureDate,
    };

    const { error } = existingTaxInfo
      ? await supabase.from('tax_info').update(record).eq('user_id', user.id)
      : await supabase.from('tax_info').insert(record);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      setExistingTaxInfo(record);
      toast({ title: 'Saved', description: 'Your W-9 tax information has been updated.' });
    }
  };

  const initialData = existingTaxInfo ? (() => {
    const parts = (existingTaxInfo.legal_name || '').trim().split(/\s+/);
    const firstName = parts[0] || '';
    const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
    const middleName = parts.length > 2 ? parts.slice(1, -1).join(' ') : '';
    return {
      firstName,
      middleName,
      lastName,
      legalName: existingTaxInfo.legal_name || '',
      businessName: existingTaxInfo.business_name || '',
      businessType: existingTaxInfo.business_type || '',
      llcClassification: existingTaxInfo.llc_classification,
      taxId: existingTaxInfo.tax_id || '',
      taxIdType: existingTaxInfo.tax_id_type || '',
      address: existingTaxInfo.address || '',
      city: existingTaxInfo.city || '',
      state: existingTaxInfo.state || '',
      zipCode: existingTaxInfo.zip_code || '',
      accountNumber: existingTaxInfo.account_number || '',
      exemptFromBackupWithholding: existingTaxInfo.exempt_from_backup_withholding || false,
      certificationAgreed: existingTaxInfo.certification_agreed || false,
      signature: existingTaxInfo.signature || '',
      signatureDate: existingTaxInfo.signature_date || '',
    };
  })() : undefined;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <Tabs defaultValue="reports" className="space-y-4">
      <TabsList>
        <TabsTrigger value="reports">Tax Reports</TabsTrigger>
        <TabsTrigger value="yearend">Year-End Report</TabsTrigger>
        <TabsTrigger value="w9">{existingTaxInfo ? 'Edit W-9' : 'Submit W-9'}</TabsTrigger>
      </TabsList>

      <TabsContent value="reports">
        <TaxReporting />
      </TabsContent>

      <TabsContent value="yearend">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <CardTitle className="text-base font-semibold text-gray-900">Year-End Barter Report</CardTitle>
                <p className="text-xs text-gray-400 mt-0.5">Monthly barter credits earned vs spent — use for tax filing</p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={yearEndYear}
                  onChange={e => { setYearEndYear(Number(e.target.value)); setYearEndLoaded(false); }}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-emerald-400 bg-white"
                >
                  {[new Date().getFullYear(), new Date().getFullYear() - 1, new Date().getFullYear() - 2].map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
                <button
                  onClick={() => fetchYearEndData(yearEndYear)}
                  disabled={yearEndLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-all disabled:opacity-60"
                >
                  {yearEndLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Generate
                </button>
                <button
                  disabled={!yearEndLoaded || yearEndData.length === 0}
                  onClick={downloadYearEndCSV}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:border-emerald-400 hover:text-emerald-600 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Download className="h-3.5 w-3.5" /> Download CSV
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {!yearEndLoaded ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                <p className="text-sm">Select a year and click Generate to load your report.</p>
              </div>
            ) : yearEndLoading ? (
              <div className="flex items-center justify-center py-10 gap-2 text-gray-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : yearEndData.length === 0 ? (
              <p className="text-center text-gray-400 py-10 text-sm">No barter activity found for {yearEndYear}.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-y bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide text-left">Month</th>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Barter Earned</th>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Barter Spent</th>
                      <th className="px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearEndData.map(row => {
                      const net = Number(row.earned) - Number(row.spent);
                      return (
                        <tr key={row.month_num} className="border-b last:border-0 hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-700">{row.month_label}</td>
                          <td className="px-4 py-3 text-sm text-emerald-600 font-medium text-right">${Number(row.earned).toFixed(2)}</td>
                          <td className="px-4 py-3 text-sm text-red-500 text-right">${Number(row.spent).toFixed(2)}</td>
                          <td className={`px-4 py-3 text-sm font-semibold text-right ${net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            {net >= 0 ? '+' : ''}${net.toFixed(2)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-gray-50 font-bold">
                      <td className="px-4 py-3 text-sm text-gray-800">Total {yearEndYear}</td>
                      <td className="px-4 py-3 text-sm text-emerald-600 text-right">${yearEndData.reduce((s, r) => s + Number(r.earned), 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-red-500 text-right">${yearEndData.reduce((s, r) => s + Number(r.spent), 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        {(() => { const n = yearEndData.reduce((s, r) => s + Number(r.earned) - Number(r.spent), 0); return <span className={n >= 0 ? 'text-emerald-600' : 'text-red-500'}>{n >= 0 ? '+' : ''}${n.toFixed(2)}</span>; })()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="w9">
        <W9Form
          onSubmit={handleW9Submit}
          onSkip={() => {}}
          isRequired={false}
          initialData={initialData}
        />
      </TabsContent>
    </Tabs>
  );
};

export default TaxSettingsSection;
