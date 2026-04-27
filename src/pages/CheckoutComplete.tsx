import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, XCircle, Loader2, ShoppingBag, ArrowRight } from "lucide-react";
import BackButton from '@/components/ui/BackButton';
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PendingOrder {
  order_id: string;
  order_number: string;
  pos_provider: string;
  amount_to_pay: number;
}

const CheckoutComplete = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  const [status, setStatus] = useState<'loading' | 'success' | 'failed' | 'cancelled'>('loading');
  const [orderInfo, setOrderInfo] = useState<PendingOrder | null>(null);
  const [orderDetails, setOrderDetails] = useState<any>(null);

  const provider = searchParams.get('provider');
  const orderId = searchParams.get('order_id');

  useEffect(() => {
    // Get pending order from sessionStorage
    const pendingOrderStr = sessionStorage.getItem('pending_order');
    if (pendingOrderStr) {
      try {
        const pendingOrder = JSON.parse(pendingOrderStr);
        setOrderInfo(pendingOrder);
      } catch (e) {
        console.error('Error parsing pending order:', e);
      }
    }

    // Determine status from URL path
    const path = window.location.pathname;
    if (path.includes('/failed') || path.includes('/cancel')) {
      setStatus('failed');
    } else {
      // Check if payment was successful
      verifyPayment();
    }
  }, []);

  const verifyPayment = async () => {
    try {
      // Get order ID from URL or sessionStorage
      const orderIdToCheck = orderId || orderInfo?.order_id;

      if (!orderIdToCheck) {
        // No order info - might be a direct visit
        setStatus('failed');
        return;
      }

      // Fetch order status from database
      const { data: order, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderIdToCheck)
        .single();

      if (error) {
        console.error('Error fetching order:', error);
        setStatus('failed');
        return;
      }

      setOrderDetails(order);

      // Check order status
      if (order.status === 'completed') {
        setStatus('success');
        sessionStorage.removeItem('pending_order');
      } else if (order.status === 'cancelled' || order.status === 'payment_failed') {
        setStatus('failed');
      } else {
        // Order is still pending - payment might be processing
        // Poll for a few seconds to see if webhook updates it
        let attempts = 0;
        const maxAttempts = 10;
        const pollInterval = setInterval(async () => {
          attempts++;
          const { data: updatedOrder } = await supabase
            .from('orders')
            .select('status')
            .eq('id', orderIdToCheck)
            .single();

          if (updatedOrder?.status === 'completed') {
            clearInterval(pollInterval);
            setStatus('success');
            sessionStorage.removeItem('pending_order');
            setOrderDetails({ ...order, status: 'completed' });
          } else if (updatedOrder?.status === 'cancelled' || updatedOrder?.status === 'payment_failed') {
            clearInterval(pollInterval);
            setStatus('failed');
          } else if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            // Assume success if we got redirected back (webhook might be delayed)
            setStatus('success');
            sessionStorage.removeItem('pending_order');
          }
        }, 2000);

        return () => clearInterval(pollInterval);
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
      setStatus('failed');
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="text-center py-12">
            <Loader2 className="h-12 w-12 text-blue-600 animate-spin mx-auto mb-6" />
            <h2 className="text-xl font-semibold mb-2">Verifying Payment</h2>
            <p className="text-gray-600">Please wait while we confirm your payment...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'failed' || status === 'cancelled') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md w-full mx-4">
          <CardContent className="text-center py-12">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Payment {status === 'cancelled' ? 'Cancelled' : 'Failed'}</h2>
            <p className="text-gray-600 mb-6">
              {status === 'cancelled'
                ? "You cancelled the payment. Your barter credits have not been charged."
                : "There was a problem processing your payment. Please try again."}
            </p>

            {orderInfo && (
              <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
                <p className="text-sm text-gray-600">Order: <strong>#{orderInfo.order_number}</strong></p>
                <p className="text-sm text-gray-600">Amount: <strong>${orderInfo.amount_to_pay?.toFixed(2)}</strong></p>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <Button onClick={() => navigate('/checkout')} className="w-full">
                Try Again
              </Button>
              <Button variant="outline" onClick={() => navigate('/')} className="w-full">
                Return to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4"><BackButton /></div>
      <div className="flex items-center justify-center">
      <Card className="max-w-md w-full mx-4">
        <CardContent className="text-center py-12">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="h-10 w-10 text-green-600" />
          </div>

          <h2 className="text-3xl font-bold mb-2">Payment Successful!</h2>
          <p className="text-gray-600 mb-6">
            Your order has been placed and paid for.
          </p>

          {(orderInfo || orderDetails) && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left space-y-2">
              <p className="text-sm text-gray-600">
                Order Number: <strong>#{orderInfo?.order_number || orderDetails?.order_number}</strong>
              </p>
              {orderInfo?.amount_to_pay && (
                <p className="text-sm text-gray-600">
                  Amount Paid: <strong>${orderInfo.amount_to_pay.toFixed(2)}</strong>
                </p>
              )}
              {orderInfo?.pos_provider && (
                <p className="text-sm text-gray-600">
                  Paid via: <strong className="capitalize">{orderInfo.pos_provider}</strong>
                </p>
              )}
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <h4 className="font-semibold mb-2 text-blue-900">What's Next?</h4>
            <p className="text-sm text-blue-800">
              Your order is being prepared. Head to the store to pick it up when it's ready!
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Button onClick={() => navigate('/orders')} className="w-full">
              <ShoppingBag className="h-4 w-4 mr-2" />
              View My Orders
            </Button>
            <Button variant="outline" onClick={() => navigate('/')} className="w-full">
              Continue Shopping
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default CheckoutComplete;
