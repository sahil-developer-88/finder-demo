import React, { useState, useEffect } from 'react';
import PendingApprovalModal from '@/components/ui/PendingApprovalModal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Send, DollarSign, User, Coins } from 'lucide-react';
import { usePaymentRequests } from '@/hooks/usePaymentRequests';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import MerchantSearchCombobox from './MerchantSearchCombobox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface CreatePaymentRequestProps {
  onSuccess?: () => void;
  mode?: 'request' | 'send';
}

const CreatePaymentRequest: React.FC<CreatePaymentRequestProps> = ({ onSuccess, mode = 'request' }) => {
  const { createPaymentRequest, sendPayment } = usePaymentRequests();
  const { user } = useAuth();
  const isSend = mode === 'send';

  const [recipientId, setRecipientId] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [barterPct, setBarterPct] = useState<number>(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingModalOpen, setPendingModalOpen] = useState(false);

  useEffect(() => {
    if (!user || isSend) return;
    supabase
      .from('profiles')
      .select('barter_percentage')
      .eq('user_id', user.id)
      .single()
      .then(({ data }) => {
        if (data?.barter_percentage) setBarterPct(data.barter_percentage);
      });
  }, [user, isSend]);

  const total = parseFloat(amount) || 0;
  const barterAmount = parseFloat(((total * barterPct) / 100).toFixed(2));
  const cashAmount = parseFloat((total - barterAmount).toFixed(2));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientId) return;
    if (!total || total <= 0) return;

    if (isSend) {
      setConfirmOpen(true);
      return;
    }

    await executeSend();
  };

  const executeSend = async () => {
    setSubmitting(true);
    try {
      if (isSend) {
        await sendPayment(recipientId, memo || 'Barter payment', total);
      } else {
        await createPaymentRequest(
          recipientId,
          memo || 'Service request',
          total,
          [],
          memo || undefined,
          { barter_percentage: barterPct, barter_amount: barterAmount, cash_amount: cashAmount }
        );
      }
      setRecipientId('');
      setRecipientName('');
      setAmount('');
      setMemo('');
      if (onSuccess) onSuccess();
    } catch (error: any) {
      if (error?.message === 'PENDING_APPROVAL') {
        setPendingModalOpen(true);
      } else {
        console.error('Error:', error);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <PendingApprovalModal open={pendingModalOpen} onClose={() => setPendingModalOpen(false)} />
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className={`px-6 py-4 ${isSend ? 'bg-gradient-to-r from-emerald-500 to-teal-600' : 'bg-gradient-to-r from-indigo-500 to-violet-600'}`}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <Send className="w-4 h-4 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">
              {isSend ? 'Create Send Barter' : 'Create Request Barter'}
            </h3>
            <p className="text-white/70 text-xs">
              {isSend ? "Send payment for services you've received" : "Request payment for services you've provided"}
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-5">

        {/* Person Search */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <User className="w-3.5 h-3.5" /> Select Merchant
          </Label>
          <MerchantSearchCombobox
            value={recipientId}
            onValueChange={setRecipientId}
            onSelectFull={(id, name) => { setRecipientId(id); setRecipientName(name); }}
          />
        </div>

        {/* Amount */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" /> Amount
          </Label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm">$</span>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              required
              className="pl-7 text-base font-semibold"
            />
          </div>
        </div>

        {/* Barter / Cash breakdown — request mode only */}
        {!isSend && total > 0 && barterPct > 0 && (
          <div className="rounded-xl overflow-hidden border border-indigo-100">
            <div className="bg-indigo-50 px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-indigo-900">Total Amount</span>
              <span className="text-xl font-bold text-indigo-900 flex items-center gap-0.5">
                <DollarSign className="w-4 h-4" />{total.toFixed(2)}
              </span>
            </div>
            <div className="bg-white px-4 py-3 grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 bg-indigo-50 rounded-lg p-2.5">
                <Coins className="w-4 h-4 text-indigo-500 shrink-0" />
                <div>
                  <p className="text-[10px] text-indigo-500 font-medium">Barter Credits ({barterPct}%)</p>
                  <p className="text-sm font-bold text-indigo-700">{barterAmount.toFixed(2)} cr</p>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-green-50 rounded-lg p-2.5">
                <DollarSign className="w-4 h-4 text-green-500 shrink-0" />
                <div>
                  <p className="text-[10px] text-green-500 font-medium">Cash ({100 - barterPct}%)</p>
                  <p className="text-sm font-bold text-green-700">${cashAmount.toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Memo */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Notes (Optional)
          </Label>
          <Input
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="What's it for?"
            className="text-sm"
          />
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={submitting || !recipientId || !amount}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
            isSend
              ? 'bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800'
              : 'bg-gradient-to-r from-violet-700 to-violet-900 hover:from-violet-800 hover:to-violet-950'
          }`}
        >
          <Send className="w-4 h-4" />
          {submitting ? 'Processing...' : isSend ? 'Send Barter' : 'Request Barter'}
        </button>
      </form>

      {isSend && (
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Barter Send</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 pt-1">
                  <p className="text-sm text-gray-600">Are you sure you want to send the following?</p>
                  <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-3 space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">To</span>
                      <span className="font-semibold text-gray-900">{recipientName}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Amount</span>
                      <span className="font-bold text-emerald-700">${total.toFixed(2)} credits</span>
                    </div>
                    {memo && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Note</span>
                        <span className="text-gray-700 text-right max-w-[180px] truncate">{memo}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">This action cannot be undone once confirmed.</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={submitting}
                onClick={executeSend}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {submitting ? 'Sending...' : 'Yes, Send'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
    </>
  );
};

export default CreatePaymentRequest;
