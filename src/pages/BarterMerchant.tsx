
import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import BackButton from '@/components/ui/BackButton';
import MerchantScanner from '@/components/barter/MerchantScanner';
import TransactionHistory from '@/components/barter/TransactionHistory';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Scan, History } from 'lucide-react';

const BarterMerchant = () => {
  const { user } = useAuth();

  if (!user) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Card>
          <CardContent className="p-6">
            <p>Please log in to access the merchant portal.</p>
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
            <CardTitle className="text-center">Barter Merchant Portal</CardTitle>
          </CardHeader>
        </Card>

        <Tabs defaultValue="scanner" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scanner" className="flex items-center gap-2">
              <Scan className="w-4 h-4" />
              Scanner
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="w-4 h-4" />
              History
            </TabsTrigger>
          </TabsList>

          <TabsContent value="scanner">
            <MerchantScanner />
          </TabsContent>

          <TabsContent value="history">
            <TransactionHistory />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default BarterMerchant;
