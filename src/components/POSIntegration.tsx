
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Link2, Store, Percent, CreditCard, Receipt } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface POSTransaction {
  id: string;
  items: Array<{
    barcode: string;
    name: string;
    price: number;
    quantity: number;
    category?: string;
  }>;
  subtotal: number;
  tax: number;
  taxRate: number;
  timestamp: string;
  storeId?: string;
  cashierInfo?: string;
}

interface POSIntegrationProps {
  onTransactionImport: (transaction: POSTransaction) => void;
  customerBarterBalance: number;
}

const POSIntegration = ({ onTransactionImport, customerBarterBalance }: POSIntegrationProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [barterPercentage, setBarterPercentage] = useState([0]);
  const [autoImport, setAutoImport] = useState(true);
  const [shopifyShopName, setShopifyShopName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Check for OAuth callback status on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthSuccess = params.get('oauth_success');
    const oauthError = params.get('oauth_error');
    const provider = params.get('provider');

    if (oauthSuccess === 'true' && provider === 'shopify') {
      toast.success('Successfully connected to Shopify!');
      setIsConnected(true);
      setConnectionStatus('connected');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
      checkExistingIntegrations();
    } else if (oauthError) {
      toast.error(`Connection failed: ${decodeURIComponent(oauthError)}`);
      setConnectionStatus('disconnected');
      // Clean up URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Check if user already has a Shopify integration
  const checkExistingIntegrations = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('pos_integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('provider', 'shopify')
        .eq('status', 'active')
        .maybeSingle();

      if (data && !error) {
        setIsConnected(true);
        setConnectionStatus('connected');
        setShopifyShopName(data.store_id || '');
      }
    } catch (error) {
      console.error('Error checking integrations:', error);
    }
  };

  useEffect(() => {
    checkExistingIntegrations();
  }, []);

  // Connect to Shopify via OAuth
  const connectToShopify = async () => {
    if (!shopifyShopName.trim()) {
      toast.error('Please enter your Shopify store name');
      return;
    }

    setIsLoading(true);
    setConnectionStatus('connecting');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You must be logged in to connect');
      }

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Call the OAuth initiate function
      const response = await fetch(
        `https://etzwoyyhxvwpdejckpaq.supabase.co/functions/v1/pos-oauth-initiate`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            provider: 'shopify',
            shopName: shopifyShopName.trim().replace('.myshopify.com', ''),
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to initiate OAuth');
      }

      const { authorizationUrl } = await response.json();

      // Redirect to Shopify OAuth page
      window.location.href = authorizationUrl;
    } catch (error: any) {
      console.error('Error connecting to Shopify:', error);
      toast.error(error.message || 'Failed to connect to Shopify');
      setConnectionStatus('disconnected');
      setIsLoading(false);
    }
  };

  const simulateIncomingTransaction = () => {
    const mockTransaction: POSTransaction = {
      id: `pos_${Date.now()}`,
      items: [
        { barcode: '789123456789', name: 'Organic Bananas (1 lb)', price: 2.99, quantity: 2 },
        { barcode: '012345678901', name: 'Whole Milk (1 gallon)', price: 4.49, quantity: 1 },
        { barcode: '234567890123', name: 'Artisan Bread', price: 5.99, quantity: 1 },
      ],
      subtotal: 16.46,
      tax: 1.32,
      taxRate: 8.25,
      timestamp: new Date().toISOString(),
      storeId: 'STORE001',
      cashierInfo: 'Register 3 - Cashier: John D.'
    };
    
    onTransactionImport(mockTransaction);
  };

  const maxBarterAmount = Math.min(customerBarterBalance, 16.46); // Using mock subtotal
  const barterAmount = (maxBarterAmount * barterPercentage[0]) / 100;

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-purple-50 border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-800">
          <Link2 className="w-5 h-5" />
          POS System Integration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Connection Setup */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shopifyShopName">Shopify Store Name</Label>
            <div className="flex gap-2">
              <Input
                id="shopifyShopName"
                placeholder="your-store-name"
                value={shopifyShopName}
                onChange={(e) => setShopifyShopName(e.target.value)}
                disabled={isConnected}
              />
              <span className="flex items-center text-sm text-gray-600">.myshopify.com</span>
            </div>
            <p className="text-xs text-gray-500">
              Enter your Shopify store name (e.g., "my-store" for my-store.myshopify.com)
            </p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Store className="w-5 h-5 text-gray-600" />
              <span className="font-medium">Connection Status:</span>
              <Badge
                variant={connectionStatus === 'connected' ? 'default' : 'secondary'}
                className={connectionStatus === 'connected' ? 'bg-green-600' : ''}
              >
                {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
              </Badge>
            </div>

            {!isConnected && (
              <Button
                onClick={connectToShopify}
                disabled={isLoading || !shopifyShopName.trim()}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isLoading ? 'Connecting...' : 'Connect to Shopify'}
              </Button>
            )}
          </div>
        </div>

        <Separator />

        {/* Barter Configuration */}
        <div className="space-y-4">
          <h4 className="font-semibold flex items-center gap-2">
            <Percent className="w-4 h-4" />
            Barter Payment Configuration
          </h4>
          
          <div className="bg-white p-4 rounded-lg border">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Auto-import transactions</span>
              <Switch
                checked={autoImport}
                onCheckedChange={setAutoImport}
              />
            </div>

            <div className="space-y-4">
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Barter Credit Usage (%)</Label>
                  <span className="text-sm text-gray-600">
                    {barterPercentage[0]}% (${barterAmount.toFixed(2)})
                  </span>
                </div>
                <Slider
                  value={barterPercentage}
                  onValueChange={setBarterPercentage}
                  max={100}
                  step={5}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>0%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 p-3 rounded">
                  <div className="font-medium text-gray-700">Available Balance</div>
                  <div className="text-lg font-bold text-green-600">
                    ${customerBarterBalance.toFixed(2)}
                  </div>
                </div>
                <div className="bg-gray-50 p-3 rounded">
                  <div className="font-medium text-gray-700">Using for Payment</div>
                  <div className="text-lg font-bold text-blue-600">
                    ${barterAmount.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Integration Instructions */}
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <h5 className="font-semibold text-blue-800 mb-2">How Shopify Integration Works:</h5>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• <strong>OAuth Connection:</strong> Securely connect your Shopify store</li>
            <li>• <strong>Auto Webhook:</strong> Automatically receives new orders in real-time</li>
            <li>• <strong>Permissions:</strong> Read orders and products from your store</li>
            <li>• <strong>Barter Payments:</strong> Apply barter credits to transactions automatically</li>
          </ul>
        </div>

        {isConnected && (
          <div className="bg-green-50 p-4 rounded-lg border border-green-200">
            <div className="flex items-center gap-2 mb-2">
              <Receipt className="w-4 h-4 text-green-600" />
              <span className="font-semibold text-green-800">Shopify Connected Successfully!</span>
            </div>
            <p className="text-sm text-green-700">
              Your Shopify store "{shopifyShopName}" is now connected. New orders will automatically
              sync with your barter system. Webhooks have been configured to receive real-time order updates.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default POSIntegration;
