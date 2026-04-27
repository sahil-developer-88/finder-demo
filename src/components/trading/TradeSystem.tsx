
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { Handshake, DollarSign, CreditCard, Clock } from 'lucide-react';
import PendingApprovalModal from '@/components/ui/PendingApprovalModal';

interface Trade {
  id: string;
  from_user_id: string;
  to_user_id: string;
  from_listing_id: string | null;
  to_listing_id: string | null;
  points_amount: number;
  status: 'pending' | 'accepted' | 'rejected' | 'completed';
  notes: string | null;
  created_at: string;
  completed_at: string | null;
}

interface TradeSystemProps {
  listingId?: string;
  recipientId?: string;
}

const TradeSystem: React.FC<TradeSystemProps> = ({ listingId, recipientId }) => {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [credits, setCredits] = useState(0);
  const [offerAmount, setOfferAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    fetchUserCredits();
    fetchTrades();

    const channel = supabase
      .channel(`trade_system_${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_credits', filter: `user_id=eq.${user.id}` },
        () => { fetchUserCredits(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `from_user_id=eq.${user.id}` },
        () => { fetchTrades(); }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions', filter: `to_user_id=eq.${user.id}` },
        () => { fetchTrades(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const fetchUserCredits = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_credits')
        .select('available_credits')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setCredits(data?.available_credits || 0);
    } catch (error: any) {
      console.error('Error fetching credits:', error);
    }
  };

  const fetchTrades = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      // Map database transactions to Trade interface
      const mappedTrades: Trade[] = (data || []).map(t => ({
        id: t.id,
        from_user_id: t.from_user_id,
        to_user_id: t.to_user_id,
        from_listing_id: null,
        to_listing_id: null,
        points_amount: t.points_amount,
        status: t.status as 'pending' | 'accepted' | 'rejected' | 'completed',
        notes: t.service_description,
        created_at: t.created_at,
        completed_at: null
      }));
      setTrades(mappedTrades);
    } catch (error: any) {
      console.error('Error fetching trades:', error);
    }
  };

  const createTrade = async () => {
    if (!user || !recipientId || !offerAmount) return;

    // Check merchant approval status
    const { data: biz } = await supabase.from('businesses').select('status').eq('user_id', user.id).maybeSingle();
    if (biz?.status === 'pending') {
      setPendingModalOpen(true);
      return;
    }

    const amount = parseFloat(offerAmount);
    if (amount <= 0 || amount > credits) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid amount within your available credits",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('transactions')
        .insert({
          from_user_id: user.id,
          to_user_id: recipientId,
          points_amount: amount,
          service_description: notes,
          status: 'pending',
        });

      if (error) throw error;

      toast({
        title: "Trade offer sent",
        description: "Your trade offer has been sent successfully",
      });

      setOfferAmount('');
      setNotes('');
      fetchTrades();
    } catch (error: any) {
      console.error('Error creating trade:', error);
      toast({
        title: "Failed to create trade",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const acceptTrade = async (tradeId: string) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({ status: 'accepted' })
        .eq('id', tradeId)
        .eq('to_user_id', user?.id);

      if (error) throw error;

      toast({
        title: "Trade accepted",
        description: "Trade has been accepted",
      });

      fetchTrades();
    } catch (error: any) {
      console.error('Error accepting trade:', error);
      toast({
        title: "Failed to accept trade",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'accepted': return 'bg-green-100 text-green-800';
      case 'rejected': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <>
    <PendingApprovalModal open={pendingModalOpen} onClose={() => setPendingModalOpen(false)} />
    <div className="space-y-6">
      {/* Credits Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Your Credits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold text-green-600">
            {credits.toLocaleString()} Credits
          </div>
        </CardContent>
      </Card>

      {/* Create Trade Offer */}
      {recipientId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Handshake className="h-5 w-5" />
              Make Trade Offer
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="amount">Credit Amount</Label>
              <Input
                id="amount"
                type="number"
                placeholder="Enter credit amount"
                value={offerAmount}
                onChange={(e) => setOfferAmount(e.target.value)}
                max={credits}
              />
              <p className="text-sm text-gray-600 mt-1">
                Available: {credits.toLocaleString()} credits
              </p>
            </div>
            <div>
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this trade..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <Button 
              onClick={createTrade} 
              disabled={loading || !offerAmount}
              className="w-full"
            >
              {loading ? 'Sending...' : 'Send Trade Offer'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Trade History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Trade History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trades.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No trades yet</p>
          ) : (
            <div className="space-y-4">
              {trades.map((trade) => (
                <div key={trade.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={getStatusColor(trade.status)}>
                      {trade.status.toUpperCase()}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <DollarSign className="h-4 w-4" />
                      <span className="font-semibold">
                        {trade.points_amount.toLocaleString()} credits
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600">
                    {trade.from_user_id === user?.id ? 'Sent to' : 'Received from'} user
                  </div>
                  
                  {trade.notes && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                      {trade.notes}
                    </div>
                  )}
                  
                  <div className="mt-2 text-xs text-gray-500">
                    {new Date(trade.created_at).toLocaleDateString()}
                  </div>

                  {trade.status === 'pending' && trade.to_user_id === user?.id && (
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => acceptTrade(trade.id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          await supabase
                            .from('transactions')
                            .update({ status: 'rejected' })
                            .eq('id', trade.id)
                            .eq('to_user_id', user?.id);
                          fetchTrades();
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </>
  );
};

export default TradeSystem;
