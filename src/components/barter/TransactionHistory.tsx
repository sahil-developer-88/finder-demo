
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { History, DollarSign } from 'lucide-react';

const TransactionHistory = () => {
  const { user } = useAuth();

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['barterTransactions', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      // Fetch transactions
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profile info for each unique user using secure function
      if (!data || data.length === 0) return [];

      const userIds = new Set<string>();
      data.forEach(t => {
        userIds.add(t.from_user_id);
        userIds.add(t.to_user_id);
      });

      const profilesMap = new Map();
      for (const userId of Array.from(userIds)) {
        const { data: profileData } = await supabase.rpc('get_public_profile_info', {
          profile_user_id: userId
        });
        if (profileData && profileData.length > 0) {
          profilesMap.set(userId, profileData[0]);
        }
      }

      // Attach profile data to transactions
      return data.map(t => ({
        ...t,
        from_profile: profilesMap.get(t.from_user_id),
        to_profile: profilesMap.get(t.to_user_id)
      }));
    },
    enabled: !!user?.id
  });

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading transactions...</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-6 h-6" />
            Barter Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {transactions?.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No barter transactions found</p>
          ) : (
            <div className="space-y-4">
              {transactions?.map((transaction) => (
                <div key={transaction.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-semibold">
                        {transaction.from_user_id === user?.id ?
                          `Payment to ${transaction.to_profile?.full_name || 'Merchant'}` :
                          `Payment from ${transaction.from_profile?.full_name || 'Customer'}`
                        }
                      </p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(transaction.created_at), 'PPpp')}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">${transaction.points_amount}</p>
                      <p className="text-sm text-gray-600 capitalize">{transaction.status}</p>
                    </div>
                  </div>

                  {transaction.service_description && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-sm">
                      {transaction.service_description}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-2 text-sm mt-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-600" />
                      <span>Barter Credits: ${transaction.points_amount}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default TransactionHistory;
