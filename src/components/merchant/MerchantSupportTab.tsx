import { useState, useEffect } from 'react';
import { Loader2, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import InboxSection from '@/components/messaging/InboxSection';

const MerchantSupportTab = () => {
  const [adminId,   setAdminId]   = useState<string | null>(null);
  const [adminName, setAdminName] = useState<string>('Support');
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState<string | null>(null);

  useEffect(() => {
    supabase.rpc('get_support_contact').then(({ data, error }) => {
      if (error || !data || data.length === 0) {
        setError('Support contact not available. Please try again later.');
      } else {
        setAdminId(data[0].user_id);
        setAdminName(data[0].display_name || 'Support');
      }
      setLoading(false);
    });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
    </div>
  );

  if (error || !adminId) return (
    <div className="flex flex-col items-center justify-center py-24 text-center gap-3">
      <MessageSquare className="h-10 w-10 text-gray-300" />
      <p className="text-sm text-gray-500">{error || 'Support unavailable.'}</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">Contact Support</h2>
        <p className="text-sm text-gray-500 mt-0.5">Send a message to the Valuehub Exchange support team</p>
      </div>
      <InboxSection
        variant="embedded"
        initialRecipientId={adminId}
        initialRecipientName={adminName}
      />
    </div>
  );
};

export default MerchantSupportTab;
