
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Scan, User, DollarSign, CheckCircle, AlertCircle, Camera, ShieldCheck } from 'lucide-react';
import CameraBarcodeScanner from '@/components/CameraBarcodeScanner';
import PendingApprovalModal from '@/components/ui/PendingApprovalModal';

interface CustomerInfo {
  id: string;
  full_name: string;
  available_credits: number;
}

// Returns true if the code looks like an ephemeral token
const isEphemeralToken = (code: string) => code.startsWith('QRT-');

const MerchantScanner = () => {
  const { user } = useAuth();
  const [scannedCode, setScannedCode]   = useState('');
  const [customer, setCustomer]         = useState<CustomerInfo | null>(null);
  const [totalAmount, setTotalAmount]   = useState('');
  const [barterAmount, setBarterAmount] = useState('');
  const [message, setMessage]           = useState('');
  const [messageType, setMessageType]   = useState<'success' | 'error'>('success');
  const [showScanner, setShowScanner]   = useState(false);
  const [tokenVerified, setTokenVerified] = useState(false);
  const [pendingModalOpen, setPendingModalOpen] = useState(false);

  const { data: userProfile } = useQuery({
    queryKey: ['userProfile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!user?.id,
  });

  // ── Resolve customer from scanned code ───────────────────────────────────
  const fetchCustomer = async (code: string): Promise<CustomerInfo> => {
    const trimmed = code.trim();
    let customerId: string;

    if (isEphemeralToken(trimmed)) {
      // Ephemeral QR path — validate + consume atomically (anti-replay V1)
      const { data, error } = await supabase.rpc('validate_and_consume_qr_token', {
        p_token:       trimmed,
        p_merchant_id: user!.id,
      });

      if (error) {
        // Surface the human-readable exception message from the DB function
        throw new Error(error.message ?? 'Invalid QR code');
      }

      const row = data?.[0];
      if (!row?.customer_id) throw new Error('QR code invalid or already used.');

      customerId = row.customer_id;
      setTokenVerified(true);
    } else {
      // Legacy static barcode path (existing behaviour)
      const { data: barcodeData, error: barcodeError } = await supabase
        .from('customer_barcodes')
        .select('user_id')
        .eq('barcode', trimmed)
        .eq('is_active', true)
        .single();

      if (barcodeError || !barcodeData) {
        throw new Error('Invalid barcode — customer not found.');
      }

      customerId = barcodeData.user_id;
      setTokenVerified(false);

      // Update usage stats
      await supabase.rpc('update_barcode_usage', { p_barcode: trimmed });
    }

    // Fetch profile
    const { data: profileData, error: profileError } = await supabase
      .rpc('get_public_profile_info', { profile_user_id: customerId });

    if (profileError || !profileData?.length) {
      throw new Error('Customer profile not found.');
    }

    // Fetch credits
    const { data: creditsData, error: creditsError } = await supabase
      .from('user_credits')
      .select('available_credits')
      .eq('user_id', customerId)
      .single();

    if (creditsError) throw new Error('Customer credits not found.');

    return {
      id:                profileData[0].id,
      full_name:         profileData[0].full_name || 'Customer',
      available_credits: creditsData.available_credits ?? 0,
    };
  };

  // ── Process payment ───────────────────────────────────────────────────────
  const processTransaction = useMutation({
    mutationFn: async ({
      customerId, total, barter,
    }: { customerId: string; total: number; barter: number }) => {
      // Check merchant approval status
      const { data: biz } = await supabase.from('businesses').select('status').eq('user_id', user!.id).maybeSingle();
      if (biz?.status === 'pending') {
        throw new Error('PENDING_APPROVAL');
      }

      // Re-check balance (server-side guard)
      const { data: creditsData, error: creditsError } = await supabase
        .from('user_credits')
        .select('available_credits')
        .eq('user_id', customerId)
        .single();

      if (creditsError) throw new Error('Customer not found.');
      if ((creditsData.available_credits ?? 0) < barter) {
        throw new Error('Insufficient barter credits.');
      }

      // Debit customer
      const { error: updateError } = await supabase
        .from('user_credits')
        .update({
          available_credits: creditsData.available_credits - barter,
          spent_credits:     (creditsData as any).spent_credits + barter,
        })
        .eq('user_id', customerId);

      if (updateError) throw updateError;

      // Create ledger entry
      const { error: txError } = await supabase
        .from('transactions')
        .insert({
          from_user_id:        customerId,
          to_user_id:          user?.id,
          points_amount:       barter,
          status:              'completed',
          transaction_type:    'purchase',
          service_description: `Barter: $${barter} barter + $${(total - barter).toFixed(2)} cash = $${total} total`,
        });

      if (txError) throw txError;
    },
    onSuccess: () => {
      setMessage('Payment completed successfully!');
      setMessageType('success');
      setCustomer(null);
      setScannedCode('');
      setTotalAmount('');
      setBarterAmount('');
      setTokenVerified(false);
    },
    onError: (error: any) => {
      if (error.message === 'PENDING_APPROVAL') {
        setPendingModalOpen(true);
      } else {
        setMessage(error.message || 'Transaction failed.');
        setMessageType('error');
      }
    },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleScan = async () => {
    if (!scannedCode) return;
    try {
      const customerData = await fetchCustomer(scannedCode);
      setCustomer(customerData);
      setMessage('');
    } catch (error: any) {
      setMessage(error.message);
      setMessageType('error');
      setCustomer(null);
    }
  };

  const handleCameraScan = (barcode: string) => {
    setScannedCode(barcode);
    setShowScanner(false);
    setTimeout(() => {
      fetchCustomer(barcode)
        .then((data) => { setCustomer(data); setMessage(''); })
        .catch((err) => {
          setMessage(err.message);
          setMessageType('error');
          setCustomer(null);
        });
    }, 100);
  };

  const handleTransaction = () => {
    if (!customer || !totalAmount || !barterAmount) return;
    const total  = parseFloat(totalAmount);
    const barter = parseFloat(barterAmount);
    if (barter > customer.available_credits) {
      setMessage('Insufficient barter credits.');
      setMessageType('error');
      return;
    }
    if (barter > total) {
      setMessage('Barter amount cannot exceed the total.');
      setMessageType('error');
      return;
    }
    processTransaction.mutate({ customerId: customer.id, total, barter });
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (!userProfile) {
    return (
      <div className="max-w-md mx-auto p-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Loading merchant profile…</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (showScanner) {
    return (
      <CameraBarcodeScanner
        onClose={() => setShowScanner(false)}
        onScan={handleCameraScan}
      />
    );
  }

  return (
    <>
    <PendingApprovalModal open={pendingModalOpen} onClose={() => setPendingModalOpen(false)} />
    <div className="max-w-md mx-auto p-4 space-y-6">
      {/* Scan card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scan className="w-6 h-6" />
            Scan Customer Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="barcode">Customer QR / Barcode</Label>
            <div className="flex gap-2">
              <Input
                id="barcode"
                value={scannedCode}
                onChange={(e) => setScannedCode(e.target.value)}
                placeholder="Scan or paste code"
              />
              <Button onClick={handleScan}>
                <Scan className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <Button
            onClick={() => setShowScanner(true)}
            variant="outline"
            className="w-full"
          >
            <Camera className="w-4 h-4 mr-2" />
            Use Camera Scanner
          </Button>
        </CardContent>
      </Card>

      {/* Customer info + payment */}
      {customer && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-6 h-6" />
              Customer
              {tokenVerified && (
                <Badge className="ml-auto bg-green-100 text-green-700 border border-green-300 gap-1">
                  <ShieldCheck className="w-3 h-3" /> Verified QR
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-semibold">{customer.full_name}</p>
              <p className="text-lg text-green-600">
                Available: ${customer.available_credits.toFixed(2)}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <Label htmlFor="total">Total Sale Amount ($)</Label>
                <Input
                  id="total"
                  type="number"
                  step="0.01"
                  min="0"
                  value={totalAmount}
                  onChange={(e) => setTotalAmount(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label htmlFor="barter">Barter Amount ($)</Label>
                <Input
                  id="barter"
                  type="number"
                  step="0.01"
                  min="0"
                  value={barterAmount}
                  onChange={(e) => setBarterAmount(e.target.value)}
                  placeholder="0.00"
                  max={Math.min(
                    parseFloat(totalAmount) || 0,
                    customer.available_credits,
                  )}
                />
              </div>

              {totalAmount && barterAmount && (
                <div className="p-3 bg-gray-50 rounded-lg text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Barter payment</span>
                    <span className="font-medium text-green-700">${parseFloat(barterAmount).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Cash payment</span>
                    <span className="font-medium">${(parseFloat(totalAmount) - parseFloat(barterAmount)).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1 mt-1">
                    <span className="font-semibold">Total</span>
                    <span className="font-semibold">${parseFloat(totalAmount).toFixed(2)}</span>
                  </div>
                </div>
              )}

              <Button
                onClick={handleTransaction}
                disabled={!totalAmount || !barterAmount || processTransaction.isPending}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                <DollarSign className="w-4 h-4 mr-2" />
                {processTransaction.isPending ? 'Processing…' : 'Process Payment'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feedback */}
      {message && (
        <Alert
          className={
            messageType === 'success'
              ? 'border-green-200 bg-green-50'
              : 'border-red-200 bg-red-50'
          }
        >
          {messageType === 'success' ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription
            className={messageType === 'success' ? 'text-green-700' : 'text-red-700'}
          >
            {message}
          </AlertDescription>
        </Alert>
      )}
    </div>
    </>
  );
};

export default MerchantScanner;
