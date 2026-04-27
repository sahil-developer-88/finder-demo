
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  FileText, 
  Download, 
  Upload,
  AlertCircle,
  CheckCircle2,
  Clock,
  Users,
  DollarSign
} from "lucide-react";

const Form1099Dashboard = () => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  // Mock data for demonstration
  const taxData = {
    totalTransactions: 156,
    totalAmount: 89500,
    w9Required: 45,
    w9Completed: 35,
    form1099Required: 45,
    form1099Generated: 30
  };

  const merchants = [
    {
      id: 1,
      businessName: "Digital Marketing Solutions",
      totalReceived: 12500,
      w9Status: "completed",
      form1099Status: "generated",
      email: "contact@digitalmarketing.com"
    },
    {
      id: 2,
      businessName: "Photography Pro",
      totalReceived: 8900,
      w9Status: "pending",
      form1099Status: "pending",
      email: "info@photographypro.com"
    },
    {
      id: 3,
      businessName: "Legal Advisory",
      totalReceived: 15600,
      w9Status: "completed",
      form1099Status: "ready",
      email: "admin@legaladvisory.com"
    }
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
      case 'generated':
        return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>;
      case 'ready':
        return <Badge className="bg-blue-100 text-blue-800">Ready</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Tax Compliance & 1099 Management</h2>
          <p className="text-gray-600">Manage W-9 forms and 1099 tax reporting for {selectedYear}</p>
        </div>
        <div className="flex items-center gap-4">
          <Label htmlFor="tax-year">Tax Year:</Label>
          <Input
            id="tax-year"
            type="number"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="w-24"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="flex items-center p-6">
            <DollarSign className="h-12 w-12 text-green-600 mr-4" />
            <div>
              <h3 className="text-2xl font-bold">${taxData.totalAmount.toLocaleString()}</h3>
              <p className="text-gray-600">Total Transactions</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <Users className="h-12 w-12 text-blue-600 mr-4" />
            <div>
              <h3 className="text-2xl font-bold">{taxData.w9Completed}/{taxData.w9Required}</h3>
              <p className="text-gray-600">W-9 Forms</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <FileText className="h-12 w-12 text-purple-600 mr-4" />
            <div>
              <h3 className="text-2xl font-bold">{taxData.form1099Generated}/{taxData.form1099Required}</h3>
              <p className="text-gray-600">1099 Forms</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center p-6">
            <CheckCircle2 className="h-12 w-12 text-emerald-600 mr-4" />
            <div>
              <h3 className="text-2xl font-bold">{Math.round((taxData.w9Completed / taxData.w9Required) * 100)}%</h3>
              <p className="text-gray-600">Compliance Rate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Merchant Tax Status */}
      <Card>
        <CardHeader>
          <CardTitle>Merchant Tax Status</CardTitle>
          <CardDescription>Track W-9 forms and 1099 generation for all merchants</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {merchants.map((merchant) => (
              <div key={merchant.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex-1">
                  <h3 className="font-medium">{merchant.businessName}</h3>
                  <p className="text-sm text-gray-600">{merchant.email}</p>
                  <p className="text-sm font-medium text-green-600">
                    Total Received: ${merchant.totalReceived.toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">W-9 Status</p>
                    {getStatusBadge(merchant.w9Status)}
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500 mb-1">1099 Status</p>
                    {getStatusBadge(merchant.form1099Status)}
                  </div>
                  <div className="flex gap-2">
                    {merchant.w9Status === 'pending' && (
                      <Button size="sm" variant="outline">
                        <Upload className="h-4 w-4 mr-1" />
                        Request W-9
                      </Button>
                    )}
                    {merchant.form1099Status === 'ready' && (
                      <Button size="sm">
                        <Download className="h-4 w-4 mr-1" />
                        Generate 1099
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Compliance Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              Required Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-yellow-50 rounded">
              <span className="text-sm">10 merchants need W-9 forms</span>
              <Button size="sm" variant="outline">Send Requests</Button>
            </div>
            <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
              <span className="text-sm">15 merchants ready for 1099</span>
              <Button size="sm">Generate Forms</Button>
            </div>
            <div className="flex justify-between items-center p-3 bg-green-50 rounded">
              <span className="text-sm">Year-end tax summary</span>
              <Button size="sm" variant="outline">
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tax Reporting Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-gray-400" />
              <div>
                <p className="font-medium">W-9 Collection</p>
                <p className="text-sm text-gray-600">Ongoing - Request from new merchants</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium">1099 Generation</p>
                <p className="text-sm text-gray-600">January - Generate and distribute</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Upload className="h-5 w-5 text-purple-600" />
              <div>
                <p className="font-medium">IRS Filing</p>
                <p className="text-sm text-gray-600">January 31 - File with IRS</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Form1099Dashboard;
