import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Clock } from 'lucide-react';

interface PendingApprovalModalProps {
  open: boolean;
  onClose: () => void;
}

const PendingApprovalModal: React.FC<PendingApprovalModalProps> = ({ open, onClose }) => (
  <Dialog open={open} onOpenChange={onClose}>
    <DialogContent className="sm:max-w-sm text-center p-8">
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center">
          <Clock className="h-8 w-8 text-amber-500" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-900">Account Under Review</h2>
          <p className="text-sm text-gray-500 mt-2 leading-relaxed">
            Your account is pending admin approval. Once approved, you'll have full access to messaging, trading, payments, and orders.
          </p>
        </div>
        <Button onClick={onClose} className="w-full mt-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl">
          Got it
        </Button>
      </div>
    </DialogContent>
  </Dialog>
);

export default PendingApprovalModal;
