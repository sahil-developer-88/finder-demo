
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import BackButton from '@/components/ui/BackButton';
import CustomerBarcode from '@/components/barter/CustomerBarcode';
import TransactionHistory from '@/components/barter/TransactionHistory';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CreditCard, History } from 'lucide-react';

const BarterCustomer = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Card>
          <CardContent className="p-6">
            <p>Please log in to access your barter account.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-4"><BackButton /></div>
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-center">Barter Customer Portal</CardTitle>
          </CardHeader>
        </Card>

        <Tabs defaultValue="barcode" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="barcode" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              My Barcode
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              History
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="barcode">
            <CustomerBarcode />
          </TabsContent>
          
          <TabsContent value="history">
            <TransactionHistory />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BarterCustomer;
