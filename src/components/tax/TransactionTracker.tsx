
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar, Download, FileText, DollarSign, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface TaxableTransaction {
  id: string;
  sellerName: string;
  buyerName: string;
  description: string;
  date: string;
  pointsValue: number;
  dollarValue: number;
  category: string;
  status: 'completed' | 'pending' | 'cancelled';
  taxYear: number;
}

interface TransactionTrackerProps {
  userId?: string;
  isAdmin?: boolean;
}

const TransactionTracker: React.FC<TransactionTrackerProps> = ({ userId, isAdmin = false }) => {
  const [transactions, setTransactions] = useState<TaxableTransaction[]>([]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Mock data - in real app, fetch from Supabase
  useEffect(() => {
    const mockTransactions: TaxableTransaction[] = [
      {
        id: '1',
        sellerName: 'Digital Marketing Solutions',
        buyerName: 'Legal Advisory Group',
        description: 'Social Media Management Package',
        date: '2024-11-15',
        pointsValue: 500,
        dollarValue: 500,
        category: 'Marketing Services',
        status: 'completed',
        taxYear: 2024
      },
      {
        id: '2',
        sellerName: 'Creative Design Studio',
        buyerName: 'Tech Repair Solutions',
        description: 'Logo Design and Branding',
        date: '2024-11-10',
        pointsValue: 300,
        dollarValue: 300,
        category: 'Design Services',
        status: 'completed',
        taxYear: 2024
      },
      {
        id: '3',
        sellerName: 'Professional Photography',
        buyerName: 'Digital Marketing Solutions',
        description: 'Product Photography Session',
        date: '2024-11-05',
        pointsValue: 400,
        dollarValue: 400,
        category: 'Photography Services',
        status: 'completed',
        taxYear: 2024
      }
    ];
    setTransactions(mockTransactions);
  }, []);

  const filteredTransactions = transactions.filter(transaction => {
    const matchesYear = transaction.taxYear === selectedYear;
    const matchesSearch = transaction.sellerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.buyerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || transaction.category === selectedCategory;
    const matchesUser = !userId || transaction.sellerName.includes('Digital Marketing'); // Mock user filter
    
    return matchesYear && matchesSearch && matchesCategory && matchesUser;
  });

  const totalIncome = filteredTransactions
    .filter(t => t.status === 'completed')
    .reduce((sum, t) => sum + t.dollarValue, 0);

  const needs1099 = totalIncome >= 600;

  const categories = Array.from(new Set(transactions.map(t => t.category)));

  const exportToCSV = () => {
    const headers = ['Date', 'Seller', 'Buyer', 'Description', 'Dollar Value', 'Category', 'Status'];
    const csvContent = [
      headers.join(','),
      ...filteredTransactions.map(t => [
        t.date,
        `"${t.sellerName}"`,
        `"${t.buyerName}"`,
        `"${t.description}"`,
        t.dollarValue,
        `"${t.category}"`,
        t.status
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `barter_transactions_${selectedYear}.csv`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  const exportFor1099Services = () => {
    // Format data for 1099 filing services like Track1099, Tax1099, etc.
    const format1099Data = filteredTransactions
      .filter(t => t.status === 'completed')
      .map(t => ({
        payerName: t.buyerName,
        payeeName: t.sellerName,
        amount: t.dollarValue,
        date: t.date,
        description: t.description,
        formType: '1099-B'
      }));

    const jsonContent = JSON.stringify(format1099Data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `1099_filing_data_${selectedYear}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Tax Transaction Tracking
          </CardTitle>
          {needs1099 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Your barter income for {selectedYear} exceeds $600. You will receive a 1099-B form for tax reporting.
              </AlertDescription>
            </Alert>
          )}
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(parseInt(value))}>
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

            <div>
              <Input
                placeholder="Search transactions..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-64"
              />
            </div>

            <div>
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Filter by category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-green-50 p-4 rounded-lg">
              <h4 className="font-medium text-green-800">Total Barter Income</h4>
              <p className="text-2xl font-bold text-green-900">${totalIncome.toLocaleString()}</p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-800">Total Transactions</h4>
              <p className="text-2xl font-bold text-blue-900">{filteredTransactions.length}</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <h4 className="font-medium text-purple-800">1099-B Required</h4>
              <p className="text-2xl font-bold text-purple-900">{needs1099 ? 'Yes' : 'No'}</p>
            </div>
          </div>

          {/* Export Buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button onClick={exportToCSV} variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={exportFor1099Services} variant="outline">
              <FileText className="h-4 w-4 mr-2" />
              Export for 1099 Filing
            </Button>
          </div>

          {/* Transactions Table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Seller</TableHead>
                  <TableHead>Buyer</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Dollar Value</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{transaction.sellerName}</TableCell>
                    <TableCell>{transaction.buyerName}</TableCell>
                    <TableCell>{transaction.description}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        {transaction.dollarValue.toLocaleString()}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{transaction.category}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={transaction.status === 'completed' ? 'default' : 'secondary'}>
                        {transaction.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {filteredTransactions.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No transactions found for the selected criteria.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TransactionTracker;
