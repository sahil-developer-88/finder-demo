import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export interface LineItem {
  description: string;
  amount: number;
  quantity: number;
}

export interface PaymentRequest {
  id: string;
  seller_id: string;
  buyer_id: string;
  service_description: string;
  total_amount: number;
  line_items: LineItem[];
  notes: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'paid' | 'expired' | 'cancelled';
  transaction_id: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
  responded_at: string | null;
  paid_at: string | null;
  seller_business_name: string | null;
  seller_full_name: string | null;
  seller_email: string | null;
  buyer_business_name: string | null;
  buyer_full_name: string | null;
  buyer_email: string | null;
  is_expired: boolean | null;
  metadata: {
    barter_percentage?: number;
    barter_amount?: number;
    cash_amount?: number;
  } | null;
}

export const usePaymentRequests = () => {
  const [sentRequests, setSentRequests] = useState<PaymentRequest[]>([]);
  const [receivedRequests, setReceivedRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();
  const channelId = useRef(`payment_requests_${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    if (!user) return;

    fetchPaymentRequests();
    const cleanup = setupRealtimeSubscription();

    return cleanup;
  }, [user]);

  const fetchPaymentRequests = async () => {
    if (!user) return;

    try {
      // Fetch sent requests
      const { data: sent, error: sentError } = await supabase
        .from('payment_requests_with_details')
        .select('*')
        .eq('seller_id', user.id)
        .order('created_at', { ascending: false });

      if (sentError) throw sentError;

      // Fetch received requests
      const { data: received, error: receivedError } = await supabase
        .from('payment_requests_with_details')
        .select('*')
        .eq('buyer_id', user.id)
        .order('created_at', { ascending: false });

      if (receivedError) throw receivedError;

      setSentRequests((sent || []) as unknown as PaymentRequest[]);
      setReceivedRequests((received || []) as unknown as PaymentRequest[]);
    } catch (error: any) {
      console.error('Error fetching payment requests:', error);
      toast({
        title: 'Error',
        description: 'Failed to load payment requests',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeSubscription = () => {
    if (!user) return () => {};

    const channel = supabase
      .channel(channelId.current)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_requests',
          filter: `seller_id=eq.${user.id}`,
        },
        () => {
          fetchPaymentRequests();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'payment_requests',
          filter: `buyer_id=eq.${user.id}`,
        },
        () => {
          fetchPaymentRequests();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const createPaymentRequest = async (
    buyerId: string,
    serviceDescription: string,
    totalAmount: number,
    lineItems: LineItem[],
    notes?: string,
    metadata?: { barter_percentage?: number; barter_amount?: number; cash_amount?: number }
  ) => {
    if (!user) throw new Error('User not authenticated');

    const { data: biz } = await supabase.from('businesses').select('status').eq('user_id', user.id);
    if (biz?.some((b: any) => b.status === 'pending')) {
      throw new Error('PENDING_APPROVAL');
    }
    if (biz?.some((b: any) => b.status === 'suspended')) {
      toast({ title: 'Account Suspended', description: 'Your account is suspended. Please contact support@swapshop.com.', variant: 'destructive' });
      throw new Error('Account suspended');
    }

    try {
      const { data, error } = await supabase
        .from('payment_requests')
        .insert({
          seller_id: user.id,
          buyer_id: buyerId,
          service_description: serviceDescription,
          total_amount: totalAmount,
          line_items: lineItems as any,
          notes: notes || null,
          metadata: metadata || {},
        })
        .select()
        .single();

      if (error) throw error;

      // TODO: Uncomment to enable email notifications (requires RESEND_API_KEY)
      // sendPaymentRequestEmail(data.id, buyerId, serviceDescription, totalAmount).catch((emailError) => {
      //   console.error('Failed to send email notification:', emailError);
      //   // Don't throw - email failure shouldn't fail the request creation
      // });

      toast({
        title: 'Success',
        description: 'Payment request sent successfully',
      });

      fetchPaymentRequests();
      return data;
    } catch (error: any) {
      console.error('Error creating payment request:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create payment request',
        variant: 'destructive',
      });
      throw error;
    }
  };

  // TODO: Uncomment to enable email notifications
  // const sendPaymentRequestEmail = async (
  //   paymentRequestId: string,
  //   buyerId: string,
  //   serviceDescription: string,
  //   amount: number
  // ) => {
  //   try {
  //     // Get buyer and seller details
  //     const { data: buyerProfile } = await supabase
  //       .from('profiles')
  //       .select('email')
  //       .eq('user_id', buyerId)
  //       .single();

  //     const { data: sellerProfile } = await supabase
  //       .from('profiles')
  //       .select('business_name, full_name')
  //       .eq('user_id', user?.id)
  //       .single();

  //     if (!buyerProfile?.email) {
  //       throw new Error('Buyer email not found');
  //     }

  //     const sellerName = sellerProfile?.business_name || sellerProfile?.full_name || 'A merchant';

  //     // Call the edge function
  //     const { error } = await supabase.functions.invoke('send-payment-request-email', {
  //       body: {
  //         payment_request_id: paymentRequestId,
  //         buyer_email: buyerProfile.email,
  //         seller_name: sellerName,
  //         amount: amount,
  //         service_description: serviceDescription,
  //       },
  //     });

  //     if (error) throw error;
  //   } catch (error) {
  //     console.error('Error sending payment request email:', error);
  //     throw error;
  //   }
  // };

  const acceptPaymentRequest = async (requestId: string) => {
    if (!user) throw new Error('User not authenticated');

    try {
      const { error } = await supabase
        .from('payment_requests')
        .update({
          status: 'accepted',
          responded_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('buyer_id', user.id);

      if (error) throw error;

      toast({
        title: 'Request Accepted',
        description: 'Click Pay Now to complete the transfer',
      });

      fetchPaymentRequests();
    } catch (error: any) {
      console.error('Error accepting payment request:', error);
      toast({
        title: 'Error',
        description: 'Failed to accept payment request',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const processPaymentRequest = async (
    requestId: string,
    sellerId: string,
    totalAmount: number,
    barterAmount: number,
    serviceDescription: string
  ) => {
    if (!user) throw new Error('User not authenticated');

    try {
      // 1. Deduct credits from buyer
      if (barterAmount > 0) {
        const { error: debitError } = await supabase.rpc('debit_user_credits', {
          p_user_id: user.id,
          p_amount: barterAmount,
        });
        if (debitError) throw debitError;

        // 2. Credit seller
        const { error: creditError } = await supabase.rpc('credit_merchant_balance', {
          p_merchant_id: sellerId,
          p_amount: barterAmount,
        });
        if (creditError) throw creditError;
      }

      // 3. Create transaction record
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert({
          from_user_id: user.id,
          to_user_id: sellerId,
          points_amount: barterAmount,
          service_description: serviceDescription,
          status: 'completed',
          transaction_type: 'payment_request',
        })
        .select()
        .single();

      if (txError) throw txError;

      // 4. Mark request as paid
      const { error: updateError } = await supabase
        .from('payment_requests')
        .update({
          status: 'paid',
          paid_at: new Date().toISOString(),
          transaction_id: transaction.id,
        })
        .eq('id', requestId)
        .eq('buyer_id', user.id);

      if (updateError) throw updateError;

      // Notifications are created by the DB trigger notify_payment_request_paid
      // (SECURITY DEFINER) so they fire live via Supabase Realtime for both parties.

      toast({
        title: 'Payment Complete',
        description: `${barterAmount > 0 ? `${barterAmount.toFixed(2)} barter credits transferred` : 'Payment marked as complete'}`,
      });

      fetchPaymentRequests();
    } catch (error: any) {
      console.error('Error processing payment:', error);
      toast({
        title: 'Payment Failed',
        description: error.message || 'Failed to process payment',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const rejectPaymentRequest = async (requestId: string) => {
    if (!user) throw new Error('User not authenticated');

    try {
      const { error } = await supabase
        .from('payment_requests')
        .update({
          status: 'rejected',
          responded_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('buyer_id', user.id);

      if (error) throw error;

      toast({
        title: 'Request Rejected',
        description: 'The seller has been notified',
      });

      fetchPaymentRequests();
    } catch (error: any) {
      console.error('Error rejecting payment request:', error);
      toast({
        title: 'Error',
        description: 'Failed to reject payment request',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const declineAfterAccept = async (requestId: string) => {
    if (!user) throw new Error('User not authenticated');

    try {
      const { error } = await supabase
        .from('payment_requests')
        .update({
          status: 'rejected',
          responded_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .eq('buyer_id', user.id);

      if (error) throw error;

      toast({
        title: 'Request Declined',
        description: 'No payment was made',
      });

      fetchPaymentRequests();
    } catch (error: any) {
      console.error('Error declining payment request:', error);
      toast({
        title: 'Error',
        description: 'Failed to decline request',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const cancelPaymentRequest = async (requestId: string) => {
    if (!user) throw new Error('User not authenticated');

    try {
      const { error } = await supabase
        .from('payment_requests')
        .update({ status: 'cancelled' })
        .eq('id', requestId)
        .eq('seller_id', user.id)
        .eq('status', 'pending');

      if (error) throw error;

      toast({
        title: 'Request Cancelled',
        description: 'Payment request has been cancelled',
      });

      fetchPaymentRequests();
    } catch (error: any) {
      console.error('Error cancelling payment request:', error);
      toast({
        title: 'Error',
        description: 'Failed to cancel payment request',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const sendPayment = async (recipientId: string, memo: string, amount: number) => {
    if (!user) throw new Error('User not authenticated');

    const { data: biz } = await supabase.from('businesses').select('status').eq('user_id', user.id);
    if (biz?.some((b: any) => b.status === 'pending')) {
      throw new Error('PENDING_APPROVAL');
    }
    if (biz?.some((b: any) => b.status === 'suspended')) {
      toast({ title: 'Account Suspended', description: 'Your account is suspended. Please contact support@swapshop.com.', variant: 'destructive' });
      throw new Error('Account suspended');
    }

    try {
      // 1. Deduct credits from sender (updates available_credits + spent_credits)
      const { error: debitError } = await supabase.rpc('debit_user_credits', {
        p_user_id: user.id,
        p_amount: amount,
      });
      if (debitError) throw debitError;

      // 2. Credit recipient (updates available_credits + earned_credits)
      const { error: creditError } = await supabase.rpc('credit_merchant_balance', {
        p_merchant_id: recipientId,
        p_amount: amount,
      });
      if (creditError) throw creditError;

      // 3. Create transaction record
      const { data: transaction, error: txError } = await supabase
        .from('transactions')
        .insert({
          from_user_id: user.id,
          to_user_id: recipientId,
          points_amount: amount,
          service_description: memo || 'Barter payment',
          status: 'completed',
          transaction_type: 'send',
        })
        .select()
        .single();

      if (txError) throw txError;

      // 4. Insert payment_request record as paid
      const { data, error } = await supabase
        .from('payment_requests')
        .insert({
          seller_id: user.id,
          buyer_id: recipientId,
          service_description: memo || 'Barter payment',
          total_amount: amount,
          line_items: [],
          notes: null,
          status: 'paid',
          responded_at: new Date().toISOString(),
          paid_at: new Date().toISOString(),
          transaction_id: transaction.id,
          metadata: { type: 'send' },
        })
        .select()
        .single();

      if (error) throw error;

      // 5. Notify recipient (CR) and sender (DR)
      await supabase.from('notifications').insert({
        user_id: recipientId,
        title: 'Barter Credits Received',
        message: `CR: ${amount.toFixed(2)} barter credits received for "${memo || 'Barter payment'}"`,
        type: 'success',
      });

      await supabase.from('notifications').insert({
        user_id: user.id,
        title: 'Barter Credits Debited',
        message: `DR: ${amount.toFixed(2)} barter credits debited for "${memo || 'Barter payment'}"`,
        type: 'info',
      });

      toast({
        title: 'Barter Sent!',
        description: `${amount.toFixed(2)} credits transferred successfully`,
      });

      fetchPaymentRequests();
      return data;
    } catch (error: any) {
      console.error('Error sending payment:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send payment',
        variant: 'destructive',
      });
      throw error;
    }
  };

  const markAsPaid = async (requestId: string, transactionId: string) => {
    try {
      const { error } = await supabase
        .from('payment_requests')
        .update({
          status: 'paid',
          transaction_id: transactionId,
          paid_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;

      fetchPaymentRequests();
    } catch (error: any) {
      console.error('Error marking payment request as paid:', error);
      throw error;
    }
  };

  const pendingReceivedCount = receivedRequests.filter(
    (req) => req.status === 'pending' && !req.is_expired
  ).length;

  return {
    sentRequests,
    receivedRequests,
    pendingReceivedCount,
    loading,
    createPaymentRequest,
    sendPayment,
    acceptPaymentRequest,
    processPaymentRequest,
    rejectPaymentRequest,
    declineAfterAccept,
    cancelPaymentRequest,
    markAsPaid,
    refetch: fetchPaymentRequests,
  };
};
