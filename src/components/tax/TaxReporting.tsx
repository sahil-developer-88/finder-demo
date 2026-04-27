
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FileText, Calendar, AlertTriangle, DollarSign } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import TransactionTracker from './TransactionTracker';
import BarterTaxEstimator from './BarterTaxEstimator';

const TaxReporting = () => {
  const [selectedYear, setSelectedYear] = useState('2024');
  const [isGenerating, setIsGenerating] = useState(false);
  const [taxData, setTaxData] = useState({
    totalBarterIncome: 0,
    totalTransactions: 0,
    totalExpenses: 0,
    netIncome: 0,
    requires1099: false
  });
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchTaxData = async () => {
      if (!user) return;
      
      try {
        setLoading(true);
        
        // Fetch transactions for the year
        const startOfYear = new Date(parseInt(selectedYear), 0, 1);
        const endOfYear = new Date(parseInt(selectedYear), 11, 31, 23, 59, 59);
        
        const { data: transactions, error } = await supabase
          .from('transactions')
          .select('*')
          .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
          .gte('created_at', startOfYear.toISOString())
          .lte('created_at', endOfYear.toISOString());

        if (error) return;

        // Calculate tax data from transactions
        const income = transactions
          ?.filter(t => t.to_user_id === user.id)
          .reduce((sum, t) => sum + (t.points_amount || 0), 0) || 0;
          
        const expenses = transactions
          ?.filter(t => t.from_user_id === user.id)
          .reduce((sum, t) => sum + (t.points_amount || 0), 0) || 0;

        const transactionCount = transactions?.length || 0;
        const netIncome = income - expenses;
        const requires1099 = income >= 600;

        setTaxData({
          totalBarterIncome: income,
          totalTransactions: transactionCount,
          totalExpenses: expenses,
          netIncome,
          requires1099
        });

      } catch (error) {
        // silent
      } finally {
        setLoading(false);
      }
    };

    fetchTaxData();
  }, [user, selectedYear]);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    
    try {
      // Log the report generation
      await supabase
        .from('audit_logs')
        .insert({
          user_id: user?.id,
          action: 'tax_report_generated',
          table_name: 'transactions',
          record_id: 'tax_report',
          new_data: { year: selectedYear, ...taxData }
        });

      // Simulate report generation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // In real implementation, this would generate and download a PDF
    } catch (error) {
      // silent
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownload1099 = async () => {
    try {
      // Log the 1099 download
      await supabase
        .from('audit_logs')
        .insert({
          user_id: user?.id,
          action: '1099_downloaded',
          table_name: 'w9_tax_info',
          record_id: '1099_form',
          new_data: { year: selectedYear }
        });

      // In real implementation, download the actual 1099-B form
    } catch (error) {
      // silent
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="text-center">Loading tax data...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Tax Reporting & 1099-B Management
          </CardTitle>
          {taxData.requires1099 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Your barter income for {selectedYear} exceeds $600. You will receive a 1099-B form by January 31st.
                This income must be reported on your tax return.
              </AlertDescription>
            </Alert>
          )}
        </CardHeader>
        
        <CardContent>
          <Tabs defaultValue="summary" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="summary">Summary</TabsTrigger>
              <TabsTrigger value="estimate">Tax Estimate</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
              <TabsTrigger value="forms">Tax Forms</TabsTrigger>
            </TabsList>

            <TabsContent value="summary" className="space-y-4">
              <div className="flex items-center gap-4">
                <Calendar className="h-4 w-4" />
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2024">2024</SelectItem>
                    <SelectItem value="2023">2023</SelectItem>
                    <SelectItem value="2022">2022</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-green-800">Total Barter Income</h4>
                  <p className="text-2xl font-bold text-green-900">${taxData.totalBarterIncome}</p>
                  <p className="text-sm text-green-600">Reportable to IRS</p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-medium text-blue-800">Total Transactions</h4>
                  <p className="text-2xl font-bold text-blue-900">{taxData.totalTransactions}</p>
                  <p className="text-sm text-blue-600">Completed trades</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <h4 className="font-medium text-red-800">Business Expenses</h4>
                  <p className="text-2xl font-bold text-red-900">${taxData.totalExpenses}</p>
                  <p className="text-sm text-red-600">Deductible expenses</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <h4 className="font-medium text-purple-800">Net Taxable Income</h4>
                  <p className="text-2xl font-bold text-purple-900">${taxData.netIncome}</p>
                  <p className="text-sm text-purple-600">Income minus expenses</p>
                </div>
              </div>

              <div className="space-y-2">
                <Button 
                  onClick={handleGenerateReport}
                  disabled={isGenerating}
                  className="w-full"
                >
                  <Download className="h-4 w-4 mr-2" />
                  {isGenerating ? 'Generating Report...' : 'Download Tax Summary Report'}
                </Button>
                
                {taxData.requires1099 && (
                  <Button 
                    onClick={handleDownload1099}
                    variant="outline"
                    className="w-full"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Download 1099-B Form
                  </Button>
                )}
              </div>

              {/* Tax Information */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <h4 className="font-medium">Important Tax Information</h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• All barter income is taxable and must be reported at fair market value</li>
                  <li>• Form 1099-B will be issued if your barter income exceeds $600</li>
                  <li>• Keep detailed records of all barter transactions</li>
                  <li>• Business expenses related to bartering may be deductible</li>
                  <li>• Consult a tax professional for specific advice</li>
                </ul>
              </div>
            </TabsContent>

            <TabsContent value="estimate">
              <BarterTaxEstimator
                prefillGrossIncome={taxData.totalBarterIncome}
                prefillExpenses={taxData.totalExpenses}
              />
            </TabsContent>

            <TabsContent value="transactions">
              <TransactionTracker />
            </TabsContent>

            <TabsContent value="forms" className="space-y-4">
              <div className="grid gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Form 1099-B</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-600">
                      This form reports your total barter income for the tax year. 
                      You will receive this form by January 31st if your income exceeds $600.
                    </p>
                    <div className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">1099-B for {selectedYear}</p>
                        <p className="text-sm text-gray-500">
                          Status: {taxData.requires1099 ? 'Will be issued' : 'Not required'}
                        </p>
                      </div>
                      {taxData.requires1099 && (
                        <Button size="sm" variant="outline" onClick={handleDownload1099}>
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Schedule C (Business)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-600">
                      If you operate as a business, report barter income and related expenses on Schedule C.
                    </p>
                    <div className="bg-blue-50 p-3 rounded">
                      <p className="text-sm text-blue-800">
                        <strong>Tip:</strong> Track all business expenses related to your barter activities 
                        for potential deductions.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default TaxReporting;
