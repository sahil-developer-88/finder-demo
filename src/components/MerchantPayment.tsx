
import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import BackButton from '@/components/ui/BackButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calculator, CreditCard, DollarSign, Gift, Plus, Minus, X, ScanBarcode, Link2, Store, Camera, Settings, Zap } from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import CameraBarcodeScanner from './CameraBarcodeScanner';
import POSIntegration from './POSIntegration';
import MixedPayment from './payment/MixedPayment';
import ReceiptGenerator from './ReceiptGenerator';
import { calculateBarterPayment, formatReceiptData, lookupProductByUPC, type POSTransaction } from '@/utils/posIntegration';
import { usePaymentRequests } from '@/hooks/usePaymentRequests';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface PaymentItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  barcode?: string;
}

// Enhanced product database with UPC lookup integration
const productDatabase: Record<string, { name: string; price: number }> = {
  '789123456789': { name: 'Organic Bananas (1 lb)', price: 2.99 },
  '012345678901': { name: 'Whole Milk (1 gallon)', price: 4.49 },
  '234567890123': { name: 'Artisan Bread', price: 5.99 },
  '345678901234': { name: 'Free Range Eggs (12 ct)', price: 6.99 },
  '456789012345': { name: 'Local Honey (16 oz)', price: 8.99 },
  '567890123456': { name: 'Organic Coffee Beans (1 lb)', price: 12.99 },
  '678901234567': { name: 'Fresh Strawberries (1 pint)', price: 4.99 },
  '789012345678': { name: 'Greek Yogurt (32 oz)', price: 5.49 },
};

const MerchantPayment = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { markAsPaid } = usePaymentRequests();
  const { user } = useAuth();
  const { toast } = useToast();

  const [items, setItems] = useState<PaymentItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [barterCredits, setBarterCredits] = useState('');
  const [taxRate, setTaxRate] = useState('8.25');
  const [gratuity, setGratuity] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mixed'>('card');
  const [showScanner, setShowScanner] = useState(false);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [showMixedPayment, setShowMixedPayment] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<any>(null);

  // Enhanced state for POS integration
  const [customerBarterBalance] = useState(150.75);
  const [importedTransaction, setImportedTransaction] = useState<POSTransaction | null>(null);
  const [showPOSIntegration, setShowPOSIntegration] = useState(false);
  const [isLookingUpProduct, setIsLookingUpProduct] = useState(false);

  // Payment request integration
  const [paymentRequestId, setPaymentRequestId] = useState<string | null>(null);
  const [paymentRequestData, setPaymentRequestData] = useState<any>(null);

  // Fetch payment request details if requestId is in URL
  useEffect(() => {
    const requestId = searchParams.get('requestId');
    if (requestId) {
      fetchPaymentRequest(requestId);
    }
  }, [searchParams]);

  const fetchPaymentRequest = async (requestId: string) => {
    try {
      const { data, error } = await supabase
        .from('payment_requests_with_details')
        .select('*')
        .eq('id', requestId)
        .single();

      if (error) throw error;

      if (data) {
        setPaymentRequestId(requestId);
        setPaymentRequestData(data);

        // Pre-populate form with request details
        const requestItems: PaymentItem[] = (data.line_items as any[] || []).map((item: any, index: number) => ({
          id: `request_${index}`,
          name: item.description,
          price: item.amount,
          quantity: item.quantity
        }));

        setItems(requestItems);
        setNewItemName(data.service_description);
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load payment request details',
        variant: 'destructive'
      });
    }
  };

  const addItem = () => {
    if (newItemName && newItemPrice) {
      const newItem: PaymentItem = {
        id: Date.now().toString(),
        name: newItemName,
        price: parseFloat(newItemPrice),
        quantity: 1
      };
      setItems([...items, newItem]);
      setNewItemName('');
      setNewItemPrice('');
    }
  };

  // Enhanced barcode scanning with UPC lookup
  const addScannedItem = async (barcode: string) => {
    setIsLookingUpProduct(true);
    
    try {
      // First check local database
      let product = productDatabase[barcode];
      let productName = product?.name;
      let productPrice = product?.price;

      // If not found locally, try UPC lookup
      if (!product) {
        const upcData = await lookupProductByUPC(barcode);
        if (upcData) {
          productName = upcData.name;
          productPrice = 0; // Price would need to be set manually or from store pricing
        }
      }

      if (productName) {
        // Check if item already exists
        const existingItemIndex = items.findIndex(item => item.barcode === barcode);
        if (existingItemIndex >= 0) {
          updateQuantity(items[existingItemIndex].id, items[existingItemIndex].quantity + 1);
        } else {
          // Add new item
          const newItem: PaymentItem = {
            id: Date.now().toString(),
            name: productName,
            price: productPrice || 0,
            quantity: 1,
            barcode: barcode
          };
          setItems([...items, newItem]);
        }
        setShowScanner(false);
        setShowCameraScanner(false);
      } else {
        alert(`Product with barcode ${barcode} not found. Please add manually.`);
      }
    } catch (error) {
      alert(`Could not lookup product ${barcode}. Please add manually.`);
    } finally {
      setIsLookingUpProduct(false);
    }
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const updateQuantity = (id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(id);
      return;
    }
    setItems(items.map(item => 
      item.id === id ? { ...item, quantity } : item
    ));
  };

  const handleTransactionImport = (transaction: POSTransaction) => {
    // Clear existing items and import from POS
    setItems(transaction.items.map(item => ({
      id: `imported_${item.barcode}_${Date.now()}`,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      barcode: item.barcode
    })));
    
    // Set tax rate from POS system
    setTaxRate(transaction.taxRate.toString());
    
    // Store the imported transaction for receipt generation
    setImportedTransaction(transaction);
    
    // Close POS integration panel
    setShowPOSIntegration(false);
    
    alert(`Transaction imported successfully!\n${transaction.items.length} items imported from ${transaction.storeId || 'POS system'}`);
  };

  const handleMixedPayment = (payment: { barterPoints: number; cashAmount: number }) => {
    setBarterCredits(payment.barterPoints.toString());
    setPaymentMethod('mixed');
    setShowMixedPayment(false);
    
    // Process the mixed payment
    processPayment();
  };

  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const barterAmount = parseFloat(barterCredits) || 0;
  const cashSubtotal = Math.max(0, subtotal - barterAmount);
  const taxAmount = cashSubtotal * (parseFloat(taxRate) / 100);
  const gratuityAmount = parseFloat(gratuity) || 0;
  const total = cashSubtotal + taxAmount + gratuityAmount;

  const processPayment = async () => {
    try {
      const receiptData = {
        transactionId: `TXN-${Date.now()}`,
        merchantName: "Demo Merchant",
        customerEmail: "customer@example.com",
        items: items.map(item => ({
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          barcode: item.barcode
        })),
        subtotal,
        barterAmount,
        cashAmount: cashSubtotal,
        taxAmount,
        gratuity: gratuityAmount,
        total,
        paymentMethod,
        timestamp: new Date(),
        location: "123 Main St, Anytown USA"
      };

      // If this is a payment request, handle it specially
      if (paymentRequestId && paymentRequestData && user) {
        // Create transaction record
        const { data: transaction, error: txError } = await supabase
          .from('transactions')
          .insert({
            from_user_id: user.id, // buyer
            to_user_id: paymentRequestData.seller_id, // seller
            points_amount: barterAmount,
            service_description: paymentRequestData.service_description,
            status: 'completed',
            transaction_type: 'payment_request'
          })
          .select()
          .single();

        if (txError) throw txError;

        // Mark payment request as paid
        if (transaction) {
          await markAsPaid(paymentRequestId, transaction.id);
        }

        toast({
          title: 'Payment Successful',
          description: 'Payment request has been completed',
        });

        // Redirect to merchant dashboard
        navigate('/merchant/dashboard?tab=requests');
        return;
      }

      setLastReceipt(receiptData);
      setShowReceipt(true);

      // Reset form after successful payment
      setItems([]);
      setBarterCredits('');
      setGratuity('');
      setImportedTransaction(null);
    } catch (error) {
      toast({
        title: 'Payment Error',
        description: 'Failed to process payment. Please try again.',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-4"><BackButton /></div>
      {/* Camera Scanner Modal */}
      {showCameraScanner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md">
            <CameraBarcodeScanner 
              onClose={() => setShowCameraScanner(false)}
              onScan={addScannedItem}
            />
          </div>
        </div>
      )}

      {/* Existing scanner modal */}
      {showScanner && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md">
            <BarcodeScanner 
              onClose={() => setShowScanner(false)}
              onScan={addScannedItem}
            />
          </div>
        </div>
      )}

      {/* Mixed Payment Modal */}
      {showMixedPayment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md">
            <MixedPayment
              totalAmount={total}
              availablePoints={150}
              onPaymentSubmit={handleMixedPayment}
            />
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {showReceipt && lastReceipt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <Card className="bg-white">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Transaction Complete</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReceipt(false)}
                >
                  ×
                </Button>
              </CardHeader>
              <CardContent>
                <ReceiptGenerator 
                  receiptData={lastReceipt}
                  onEmailSent={() => {}}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* POS Integration Section */}
      {showPOSIntegration && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <Card className="bg-white">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>POS System Integration</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPOSIntegration(false)}
                >
                  ×
                </Button>
              </CardHeader>
              <CardContent>
                <POSIntegration
                  onTransactionImport={handleTransactionImport}
                  customerBarterBalance={customerBarterBalance}
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <Card className="bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <Calculator className="w-6 h-6 text-blue-600" />
            Enhanced Merchant Payment Terminal
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Enhanced POS Integration Section */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-blue-800">Advanced POS System Integration</h3>
                <p className="text-sm text-blue-600">Real-time transaction import with UPC lookup and automatic pricing</p>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => setShowPOSIntegration(true)}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  Connect POS
                </Button>
                <Button
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={() => window.open('/merchant/dashboard', '_blank')}
                >
                  <Settings className="w-4 h-4" />
                  Dashboard
                </Button>
              </div>
            </div>
            
            {importedTransaction && (
              <div className="bg-white p-3 rounded border border-blue-200">
                <div className="flex items-center gap-2 mb-2">
                  <Store className="w-4 h-4 text-green-600" />
                  <span className="font-medium text-green-800">Transaction Imported</span>
                  <Badge variant="secondary">{importedTransaction.storeId}</Badge>
                </div>
                <p className="text-sm text-gray-600">
                  {importedTransaction.items.length} items • ${importedTransaction.subtotal.toFixed(2)} subtotal
                </p>
              </div>
            )}
          </div>

          {/* Enhanced Add Items Section */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Add Items</h3>
            
            {/* Enhanced Barcode Scanner Buttons */}
            <div className="mb-4 flex gap-2">
              <Button 
                onClick={() => setShowCameraScanner(true)}
                className="bg-blue-600 hover:bg-blue-700 flex items-center gap-2"
                disabled={isLookingUpProduct}
              >
                <Camera className="w-4 h-4" />
                {isLookingUpProduct ? 'Looking up...' : 'Camera Scanner'}
              </Button>
              <Button 
                onClick={() => setShowScanner(true)}
                variant="outline"
                className="flex items-center gap-2"
                disabled={isLookingUpProduct}
              >
                <ScanBarcode className="w-4 h-4" />
                Manual Scanner
              </Button>
              <Button
                onClick={() => window.open('/checkout', '_blank')}
                className="bg-green-600 hover:bg-green-700 flex items-center gap-2"
              >
                <Zap className="w-4 h-4" />
                Quick Checkout
              </Button>
            </div>

            {/* Manual Entry */}
            <div className="flex gap-3 mb-4">
              <div className="flex-1">
                <Label htmlFor="itemName">Item Name</Label>
                <Input
                  id="itemName"
                  placeholder="Enter item name or scan barcode for auto-lookup"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                />
              </div>
              <div className="w-32">
                <Label htmlFor="itemPrice">Price ($)</Label>
                <Input
                  id="itemPrice"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={newItemPrice}
                  onChange={(e) => setNewItemPrice(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={addItem} className="bg-blue-600 hover:bg-blue-700">
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Items List */}
          {items.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">Order Items</h3>
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <span className="font-medium">{item.name}</span>
                      <span className="text-gray-600 ml-2">${item.price.toFixed(2)} each</span>
                      {item.barcode && (
                        <Badge variant="secondary" className="ml-2 text-xs">
                          UPC: {item.barcode}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus className="w-3 h-3" />
                      </Button>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                      >
                        <Plus className="w-3 h-3" />
                      </Button>
                      <span className="w-16 text-right font-medium">
                        ${(item.price * item.quantity).toFixed(2)}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeItem(item.id)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Payment Calculations */}
          {items.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Payment Details */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Payment Details</h3>
                
                <div>
                  <Label htmlFor="barterCredits">Barter Credits ($)</Label>
                  <div className="relative">
                    <Gift className="absolute left-3 top-1/2 transform -translate-y-1/2 text-green-600 w-4 h-4" />
                    <Input
                      id="barterCredits"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={barterCredits}
                      onChange={(e) => setBarterCredits(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="taxRate">Tax Rate (%)</Label>
                  <Input
                    id="taxRate"
                    type="number"
                    step="0.01"
                    value={taxRate}
                    onChange={(e) => setTaxRate(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="gratuity">Gratuity ($)</Label>
                  <Input
                    id="gratuity"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={gratuity}
                    onChange={(e) => setGratuity(e.target.value)}
                  />
                </div>

                <div>
                  <Label>Payment Method</Label>
                  <div className="flex gap-2 mt-2">
                    <Button
                      variant={paymentMethod === 'card' ? 'default' : 'outline'}
                      onClick={() => setPaymentMethod('card')}
                      className="flex-1"
                    >
                      <CreditCard className="w-4 h-4 mr-2" />
                      Card
                    </Button>
                    <Button
                      variant={paymentMethod === 'cash' ? 'default' : 'outline'}
                      onClick={() => setPaymentMethod('cash')}
                      className="flex-1"
                    >
                      <DollarSign className="w-4 h-4 mr-2" />
                      Cash
                    </Button>
                    <Button
                      variant={paymentMethod === 'mixed' ? 'default' : 'outline'}
                      onClick={() => setShowMixedPayment(true)}
                      className="flex-1"
                    >
                      Mixed
                    </Button>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Payment Summary</h3>
                <Card className="bg-gray-50">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-medium">${subtotal.toFixed(2)}</span>
                    </div>
                    
                    {barterAmount > 0 && (
                      <>
                        <div className="flex justify-between text-green-600">
                          <span>Barter Credits:</span>
                          <span className="font-medium">-${barterAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cash Subtotal:</span>
                          <span className="font-medium">${cashSubtotal.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                    
                    <div className="flex justify-between">
                      <span>Tax ({taxRate}%):</span>
                      <span className="font-medium">${taxAmount.toFixed(2)}</span>
                    </div>
                    
                    {gratuityAmount > 0 && (
                      <div className="flex justify-between">
                        <span>Gratuity:</span>
                        <span className="font-medium">${gratuityAmount.toFixed(2)}</span>
                      </div>
                    )}
                    
                    <Separator />
                    
                    <div className="flex justify-between text-lg font-bold">
                      <span>Total Due:</span>
                      <span>${total.toFixed(2)}</span>
                    </div>
                    
                    {barterAmount > 0 && (
                      <div className="text-sm text-gray-600 mt-2">
                        <Badge variant="secondary" className="bg-green-100 text-green-800">
                          ${barterAmount.toFixed(2)} paid with barter credits
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Button 
                  onClick={processPayment}
                  className="w-full mt-4 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700 text-white font-semibold py-3"
                  size="lg"
                  disabled={total <= 0}
                >
                  Process Payment - ${total.toFixed(2)}
                </Button>

                <p className="text-xs text-gray-500 mt-2 text-center">
                  * Enhanced with real-time UPC lookup and POS integration
                </p>
              </div>
            </div>
          )}

          {items.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Calculator className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Scan barcodes, import from POS, or add items manually</p>
              <p className="text-sm mt-1">Enhanced with UPC database lookup for unknown products</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MerchantPayment;
