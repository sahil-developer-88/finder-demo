import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  Scan,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Camera,
  ShoppingCart,
  DollarSign,
  Info
} from 'lucide-react';
import CameraBarcodeScanner from '@/components/CameraBarcodeScanner';

interface DiscountResult {
  success: boolean;
  session_id: string;
  draft_order_id: string;
  customer: {
    name: string;
    credits_before: number;
    credits_after: number;
  };
  payment: {
    total: number;
    barter_amount: number;
    barter_percentage: number;
    cash_amount: number;
  };
  next_steps: string[];
  error?: string;
  message?: string;
  instructions?: string[];
}

const ShopifyPOSScanner = () => {
  const { user } = useAuth();
  const [authMode, setAuthMode] = useState<'barcode' | 'pin'>('barcode'); // Toggle between modes
  const [showScanner, setShowScanner] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [businessName, setBusinessName] = useState(''); // For PIN auth
  const [pin, setPin] = useState(''); // For PIN auth
  const [draftOrderId, setDraftOrderId] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [result, setResult] = useState<DiscountResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [completing, setCompleting] = useState(false);

  const handleBarcodeScan = async (barcode: string) => {
    setScannedBarcode(barcode);
    setShowScanner(false);
  };

  const authenticateWithPIN = async () => {
    if (!businessName || !pin) {
      setError('Please enter business name and PIN');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: functionError } = await supabase.functions.invoke(
        'pos-pin-auth',
        {
          body: {
            business_name: businessName,
            pin: pin
          }
        }
      );

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (!data.success) {
        setError(data.error || 'Authentication failed');
        return;
      }

      // Set the generated barcode
      setScannedBarcode(data.barcode);
      setError(null);

      // Show success toast/message
      alert(`✅ Authenticated!\n\nCustomer: ${data.customer.name}\nBusiness: ${data.customer.business_name}\nAvailable Credits: $${data.customer.available_credits.toFixed(2)}`);

    } catch (err: any) {
      setError(err.message || 'Failed to authenticate');
    } finally {
      setLoading(false);
    }
  };

  const applyDiscount = async () => {
    if (!scannedBarcode) {
      setError(authMode === 'pin' ? 'Please authenticate with PIN first' : 'Please enter customer barcode');
      return;
    }

    if (!draftOrderId && !totalAmount) {
      setError('Please enter either Draft Order ID or Total Amount');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      // Call the shopify-apply-barter Edge Function
      const requestBody: any = {
        barcode: scannedBarcode
      };

      if (draftOrderId) {
        requestBody.draft_order_id = draftOrderId;
      }

      if (totalAmount) {
        requestBody.total_amount = parseFloat(totalAmount);
      }

      const { data, error: functionError } = await supabase.functions.invoke(
        'shopify-apply-barter',
        {
          body: requestBody
        }
      );

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (!data.success) {
        setError(data.message || data.error || 'Failed to apply discount');

        // Show instructions if draft order is required
        if (data.instructions) {
          setResult(data as DiscountResult);
        }
        return;
      }

      setResult(data);

      // Clear inputs for next transaction
      setTimeout(() => {
        setScannedBarcode('');
        setDraftOrderId('');
        setTotalAmount('');
      }, 500);

    } catch (err: any) {
      setError(err.message || 'Failed to process barcode');
    } finally {
      setLoading(false);
    }
  };

  const completeTransaction = async () => {
    if (!result?.session_id || !result?.draft_order_id) {
      setError('Missing session or draft order information');
      return;
    }

    setCompleting(true);
    setError(null);

    try {
      const { data, error: functionError } = await supabase.functions.invoke(
        'shopify-complete-order',
        {
          body: {
            session_id: result.session_id,
            draft_order_id: result.draft_order_id
          }
        }
      );

      if (functionError) {
        throw new Error(functionError.message);
      }

      if (!data.success) {
        throw new Error(data.error || 'Failed to complete transaction');
      }

      // Show success message
      alert(`✅ Transaction Completed!\n\nOrder ${data.order_name || data.order_id} created.\nCredits will transfer automatically.`);

      // Reset for next transaction
      reset();

    } catch (err: any) {
      setError(err.message || 'Failed to complete transaction');
    } finally {
      setCompleting(false);
    }
  };

  const reset = () => {
    setResult(null);
    setError(null);
    setScannedBarcode('');
    setBusinessName('');
    setPin('');
    setDraftOrderId('');
    setTotalAmount('');
  };

  if (showScanner) {
    return (
      <CameraBarcodeScanner
        onClose={() => setShowScanner(false)}
        onScan={handleBarcodeScan}
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="w-6 h-6" />
            Shopify POS - Split Payment
          </CardTitle>
          <CardDescription>
            Apply barter credits to Shopify draft orders
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Instructions */}
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>How to use:</strong>
              <ol className="list-decimal list-inside mt-2 space-y-1 text-sm">
                <li>Create draft order in Shopify POS (add items, note the total)</li>
                <li>Authenticate customer (scan barcode OR use PIN)</li>
                <li>Enter EITHER draft order ID OR total amount manually</li>
                <li>Apply discount - system will calculate barter amount</li>
                <li>Click "Complete Transaction" to auto-process payment</li>
                <li>Credits transfer automatically!</li>
              </ol>
            </AlertDescription>
          </Alert>

          {/* Auth Mode Tabs */}
          <div className="flex gap-2 border-b">
            <button
              onClick={() => setAuthMode('barcode')}
              className={`px-4 py-2 font-medium transition-colors ${
                authMode === 'barcode'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              <Scan className="w-4 h-4 inline mr-2" />
              Scan Barcode
            </button>
            <button
              onClick={() => setAuthMode('pin')}
              className={`px-4 py-2 font-medium transition-colors ${
                authMode === 'pin'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              🔐 Use PIN
            </button>
          </div>

          {/* Barcode Input (shown when authMode === 'barcode') */}
          {authMode === 'barcode' && (
            <div className="space-y-2">
              <Label htmlFor="barcode">Customer Barcode</Label>
              <div className="flex gap-2">
                <Input
                  id="barcode"
                  value={scannedBarcode}
                  onChange={(e) => setScannedBarcode(e.target.value)}
                  placeholder="Scan or enter customer barcode"
                  disabled={loading}
                />
                <Button
                  onClick={() => setShowScanner(true)}
                  variant="outline"
                  disabled={loading}
                >
                  <Camera className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* PIN Input (shown when authMode === 'pin') */}
          {authMode === 'pin' && (
            <div className="space-y-4 bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="space-y-2">
                <Label htmlFor="businessName">Customer's Business Name</Label>
                <Input
                  id="businessName"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  placeholder="e.g., Joe's Coffee Shop"
                  disabled={loading || !!scannedBarcode}
                />
                <p className="text-xs text-gray-600">
                  Enter the customer's business name exactly as registered
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pin">4-Digit PIN</Label>
                <Input
                  id="pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))} // Only digits
                  placeholder="****"
                  disabled={loading || !!scannedBarcode}
                />
                <p className="text-xs text-gray-600">
                  Ask customer for their 4-digit PIN code
                </p>
              </div>

              <Button
                onClick={authenticateWithPIN}
                disabled={loading || !businessName || !pin || pin.length !== 4 || !!scannedBarcode}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Authenticating...
                  </>
                ) : scannedBarcode ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Authenticated
                  </>
                ) : (
                  <>
                    🔐 Authenticate with PIN
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Draft Order ID Input */}
          <div className="space-y-2">
            <Label htmlFor="draftOrder">Shopify Draft Order ID (Optional)</Label>
            <Input
              id="draftOrder"
              value={draftOrderId}
              onChange={(e) => setDraftOrderId(e.target.value)}
              placeholder="e.g., 123456789"
              disabled={loading}
            />
            <p className="text-xs text-gray-500">
              Find this in Shopify POS after saving the order
            </p>
          </div>

          {/* Total Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="totalAmount">Total Amount (Optional)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <Input
                id="totalAmount"
                type="number"
                step="0.01"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0.00"
                className="pl-7"
                disabled={loading}
              />
            </div>
            <p className="text-xs text-gray-500">
              Enter manually if draft order cannot be accessed automatically
            </p>
          </div>

          {/* Apply Button */}
          <Button
            onClick={applyDiscount}
            disabled={loading || !scannedBarcode || (!draftOrderId && !totalAmount)}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Applying Discount...
              </>
            ) : (
              <>
                <DollarSign className="w-5 h-5 mr-2" />
                Apply Barter Discount
              </>
            )}
          </Button>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Success Result */}
          {result && result.success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <div className="space-y-3">
                  <p className="font-semibold text-green-900 text-lg">
                    ✅ Barter Discount Applied!
                  </p>

                  <div className="bg-white rounded-lg p-3 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Customer:</span>
                      <span className="font-semibold">{result.customer.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Original Total:</span>
                      <span className="font-semibold">${result.payment.total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-green-700">
                      <span>Barter Discount ({result.payment.barter_percentage}%):</span>
                      <span className="font-semibold">-${result.payment.barter_amount.toFixed(2)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between text-lg font-bold">
                      <span>Customer Pays:</span>
                      <span className="text-green-600">${result.payment.cash_amount.toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="bg-blue-50 rounded p-3">
                    <p className="font-semibold text-blue-900 mb-2">Next Steps:</p>
                    <ul className="space-y-1 text-sm text-blue-800">
                      {result.next_steps.map((step, index) => (
                        <li key={index}>{step}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="text-xs text-gray-600">
                    <p>Credits Before: ${result.customer.credits_before.toFixed(2)}</p>
                    <p>Credits After Payment: ${result.customer.credits_after.toFixed(2)}</p>
                  </div>

                  {/* Complete Transaction Button - Auto-completes the draft order */}
                  {result.draft_order_id && (
                    <Button
                      onClick={completeTransaction}
                      disabled={completing}
                      className="w-full bg-green-600 hover:bg-green-700"
                      size="lg"
                    >
                      {completing ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                          Completing Transaction...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5 mr-2" />
                          Complete Transaction (Auto-process Payment)
                        </>
                      )}
                    </Button>
                  )}

                  <Button onClick={reset} variant="outline" className="w-full">
                    Process Next Transaction
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Instructions for Draft Order Required */}
          {result && !result.success && result.instructions && (
            <Alert className="border-yellow-200 bg-yellow-50">
              <Info className="h-4 w-4 text-yellow-600" />
              <AlertDescription>
                <p className="font-semibold text-yellow-900 mb-2">{result.message}</p>
                <ul className="space-y-1 text-sm text-yellow-800">
                  {result.instructions.map((instruction, index) => (
                    <li key={index}>{instruction}</li>
                  ))}
                </ul>
                {result.customer && (
                  <div className="mt-3 p-2 bg-white rounded text-sm">
                    <p><strong>Customer:</strong> {result.customer.name}</p>
                    <p><strong>Available Credits:</strong> ${result.customer.credits_before?.toFixed(2) || '0.00'}</p>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Help Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Troubleshooting</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div>
            <strong>Customer has insufficient credits:</strong>
            <p className="text-gray-600">
              System will show error. Customer can pay full amount in cash/card, or use partial barter if enabled.
            </p>
          </div>
          <div>
            <strong>Draft order not found:</strong>
            <p className="text-gray-600">
              Make sure you copied the correct draft order ID from Shopify POS.
            </p>
          </div>
          <div>
            <strong>Barcode expired:</strong>
            <p className="text-gray-600">
              Ask customer to refresh their barcode in the app (barcodes expire after 10 minutes).
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ShopifyPOSScanner;
