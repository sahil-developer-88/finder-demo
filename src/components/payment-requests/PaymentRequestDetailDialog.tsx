import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { Separator } from '@/components/ui/separator';
import {
  CheckCircle,
  XCircle,
  DollarSign,
  Calendar,
  FileText,
  CreditCard,
  Coins,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import { usePaymentRequests, PaymentRequest } from '@/hooks/usePaymentRequests';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

interface PaymentRequestDetailDialogProps {
  request: PaymentRequest;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  pending:   { label: 'Pending',   className: 'bg-amber-100 text-amber-700 border border-amber-200' },
  accepted:  { label: 'Accepted',  className: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  rejected:  { label: 'Rejected',  className: 'bg-red-100 text-red-700 border border-red-200' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-700 border border-red-200' },
  paid:      { label: 'Paid',      className: 'bg-indigo-100 text-indigo-700 border border-indigo-200' },
  expired:   { label: 'Expired',   className: 'bg-gray-100 text-gray-600 border border-gray-200' },
};

const PaymentRequestDetailDialog: React.FC<PaymentRequestDetailDialogProps> = ({
  request,
  open,
  onOpenChange,
}) => {
  const { acceptPaymentRequest, acceptSendRequest, processPaymentRequest, rejectPaymentRequest, declineAfterAccept, cancelPaymentRequest } = usePaymentRequests();
  const { user } = useAuth();
  const [processing, setProcessing] = useState(false);
  const [localStatus, setLocalStatus] = useState(request.status);
  const [userCredits, setUserCredits] = useState<number | null>(null);

  const isBuyer = user?.id === request.buyer_id;
  const isSendType = request.metadata?.type === 'send';

  // Fetch buyer's balance when dialog opens
  useEffect(() => {
    if (!open || !isBuyer || !user) return;
    supabase
      .from('user_credits')
      .select('available_credits')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => setUserCredits(data?.available_credits ?? 0));
  }, [open, isBuyer, user]);
  const isSeller = user?.id === request.seller_id;
  const canRespond = isBuyer && localStatus === 'pending' && !request.is_expired;
  const canCancel = isSeller && localStatus === 'pending';
  const canPay = isBuyer && localStatus === 'accepted';

  const handleAccept = async () => {
    setProcessing(true);
    try {
      await acceptPaymentRequest(request.id);
      setLocalStatus('accepted'); // stay open, show Pay Now + Decline
    } finally {
      setProcessing(false);
    }
  };

  const handleAcceptSend = async () => {
    setProcessing(true);
    try {
      await acceptSendRequest(
        request.id,
        request.seller_id,
        request.total_amount,
        request.service_description
      );
      onOpenChange(false);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    setProcessing(true);
    try {
      await rejectPaymentRequest(request.id);
      onOpenChange(false);
    } finally {
      setProcessing(false);
    }
  };

  const handleCancel = async () => {
    setProcessing(true);
    try {
      await cancelPaymentRequest(request.id);
      onOpenChange(false);
    } finally {
      setProcessing(false);
    }
  };

  const handlePayNow = async () => {
    const barterAmount = request.metadata?.barter_amount ?? request.total_amount;
    setProcessing(true);
    try {
      await processPaymentRequest(
        request.id,
        request.seller_id,
        request.total_amount,
        barterAmount,
        request.service_description
      );
      onOpenChange(false);
    } finally {
      setProcessing(false);
    }
  };

  const handleDecline = async () => {
    setProcessing(true);
    try {
      await declineAfterAccept(request.id);
      onOpenChange(false);
    } finally {
      setProcessing(false);
    }
  };

  const barterAmountNeeded = request.metadata?.barter_amount ?? request.total_amount;
  const hasInsufficientBalance = isBuyer && userCredits !== null && userCredits < barterAmountNeeded;

  const merchantName = isBuyer
    ? request.seller_business_name || request.seller_full_name || 'Unknown'
    : request.buyer_business_name || request.buyer_full_name || 'Unknown';

  const initials = merchantName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();
  const status = statusConfig[localStatus] || statusConfig.pending;
  const hasBarter = request.metadata?.barter_percentage != null && request.metadata.barter_percentage > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 overflow-hidden rounded-2xl">

        {/* Header */}
        <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 px-6 py-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center text-white font-bold text-base shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white/60 text-xs mb-0.5">
                {isSendType
                  ? (isBuyer ? 'Barter send from' : 'Barter sent to')
                  : (isBuyer ? 'Request from' : 'Request sent to')
                }
              </p>
              <h3 className="text-white font-bold text-base truncate">{merchantName}</h3>
            </div>
            <span className={`text-xs font-semibold px-3 py-1 rounded-full ${status.className}`}>
              {status.label}
            </span>
          </div>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">

          {/* Amount Card */}
          <div className="bg-indigo-50 rounded-xl p-4">
            <p className="text-xs text-indigo-500 font-medium mb-1">Total Amount</p>
            <div className="flex items-end justify-between">
              <div className="text-3xl font-bold text-indigo-900 flex items-center gap-1">
                <DollarSign className="h-6 w-6" />
                {request.total_amount.toFixed(2)}
              </div>
            </div>

            {isBuyer && userCredits !== null && (
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-indigo-400">Your balance</span>
                <span className={`font-semibold ${hasInsufficientBalance ? 'text-red-500' : 'text-indigo-700'}`}>
                  {userCredits.toFixed(2)} credits
                </span>
              </div>
            )}

            {hasBarter && (
              <div className="mt-3 pt-3 border-t border-indigo-200 grid grid-cols-3 gap-2">
                <div className="bg-white rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-gray-400 mb-1">Barter %</p>
                  <p className="font-bold text-indigo-600 text-sm">{request.metadata!.barter_percentage}%</p>
                </div>
                <div className="bg-white rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-gray-400 mb-1 flex items-center justify-center gap-0.5">
                    <Coins className="h-2.5 w-2.5" /> Credits
                  </p>
                  <p className="font-bold text-violet-700 text-sm">{request.metadata!.barter_amount?.toFixed(2)}</p>
                </div>
                <div className="bg-white rounded-lg p-2.5 text-center">
                  <p className="text-[10px] text-gray-400 mb-1 flex items-center justify-center gap-0.5">
                    <DollarSign className="h-2.5 w-2.5" /> Cash
                  </p>
                  <p className="font-bold text-emerald-600 text-sm">${request.metadata!.cash_amount?.toFixed(2)}</p>
                </div>
              </div>
            )}
          </div>

          {/* Service Description */}
          <div className="border-l-4 border-indigo-400 pl-3">
            <p className="text-xs text-gray-400 font-medium mb-1 flex items-center gap-1">
              <FileText className="h-3 w-3" /> Service Description
            </p>
            <p className="text-sm text-gray-800">{request.service_description}</p>
          </div>

          {/* Notes */}
          {request.notes && (
            <div className="border-l-4 border-violet-300 pl-3">
              <p className="text-xs text-gray-400 font-medium mb-1">Notes</p>
              <p className="text-sm text-gray-700 italic">{request.notes}</p>
            </div>
          )}

          <Separator />

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex items-start gap-2">
              <Calendar className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-gray-400">Created</p>
                <p className="font-medium text-gray-700">{format(new Date(request.created_at), 'MMM d, yyyy · h:mm a')}</p>
              </div>
            </div>
            {request.responded_at && (
              <div className="flex items-start gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-gray-400 mt-0.5 shrink-0" />
                <div>
                  <p className="text-gray-400">Responded</p>
                  <p className="font-medium text-gray-700">{format(new Date(request.responded_at), 'MMM d, yyyy · h:mm a')}</p>
                </div>
              </div>
            )}
            {localStatus === 'pending' && !request.is_expired && (
              <div className="flex items-start gap-2">
                <Clock className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                <div>
                  <p className="text-gray-400">Expires</p>
                  <p className="font-medium text-amber-600">{format(new Date(request.expires_at), 'MMM d, yyyy')}</p>
                </div>
              </div>
            )}
          </div>

          {/* Insufficient balance warning */}
          {hasInsufficientBalance && canPay && (
            <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-semibold text-red-700">Insufficient barter credits</p>
                <p className="text-red-600 text-xs mt-0.5">
                  You need {barterAmountNeeded.toFixed(2)} credits but only have {userCredits!.toFixed(2)}.
                  You're short by {(barterAmountNeeded - userCredits!).toFixed(2)} credits.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-1">
            {canRespond && isSendType && (
              <>
                <button
                  onClick={handleAcceptSend}
                  disabled={processing}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold text-sm transition-all disabled:opacity-50"
                >
                  <CheckCircle className="h-4 w-4" />
                  {processing ? 'Processing...' : 'Accept & Receive'}
                </button>
                <button
                  onClick={handleReject}
                  disabled={processing}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-red-200 text-red-500 hover:bg-red-50 font-semibold text-sm transition-all disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
              </>
            )}

            {canRespond && !isSendType && (
              <>
                <button
                  onClick={handleAccept}
                  disabled={processing}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-semibold text-sm transition-all disabled:opacity-50"
                >
                  <CheckCircle className="h-4 w-4" />
                  Accept
                </button>
                <button
                  onClick={handleReject}
                  disabled={processing}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-red-200 text-red-500 hover:bg-red-50 font-semibold text-sm transition-all disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
              </>
            )}

            {canPay && (
              <>
                <button
                  onClick={handlePayNow}
                  disabled={processing || hasInsufficientBalance}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <CreditCard className="h-4 w-4" />
                  {processing ? 'Processing...' : 'Pay Now'}
                </button>
                <button
                  onClick={handleDecline}
                  disabled={processing}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-red-200 text-red-500 hover:bg-red-50 font-semibold text-sm transition-all disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  Decline
                </button>
              </>
            )}

            {canCancel && (
              <button
                onClick={handleCancel}
                disabled={processing}
                className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white font-semibold text-sm transition-all disabled:opacity-50"
              >
                <XCircle className="h-4 w-4" />
                Cancel
              </button>
            )}

            {!canRespond && !canCancel && !canPay && (
              <button
                onClick={() => onOpenChange(false)}
                className="w-full py-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 font-semibold text-sm transition-all"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PaymentRequestDetailDialog;
