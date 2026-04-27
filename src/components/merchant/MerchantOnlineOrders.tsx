import React, { useState, useEffect } from 'react';
import type { Database } from '@/integrations/supabase/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Package,
  Clock,
  CheckCircle,
  XCircle,
  ExternalLink,
  Phone,
  Mail,
  RefreshCw,
  AlertCircle,
  DollarSign
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from 'date-fns';

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_notes: string | null;
  subtotal: number;
  barter_amount: number;
  cash_amount: number;
  tax_amount: number;
  total_amount: number;
  created_at: string;
  estimated_pickup_time: string | null;
  pos_draft_order_id: string | null;
  pos_provider: string | null;
  metadata: any;
  order_items: OrderItem[];
}

interface MerchantOnlineOrdersProps {
  statusFilter?: Database['public']['Enums']['order_status'][];
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending_pos_payment: { label: 'Pending Pickup', color: 'bg-amber-100 text-amber-800', icon: Clock },
  confirmed: { label: 'Confirmed', color: 'bg-blue-100 text-blue-800', icon: CheckCircle },
  preparing: { label: 'Preparing', color: 'bg-purple-100 text-purple-800', icon: Package },
  ready_for_pickup: { label: 'Ready', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  completed: { label: 'Completed', color: 'bg-gray-100 text-gray-800', icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-800', icon: XCircle },
};

export const MerchantOnlineOrders: React.FC<MerchantOnlineOrdersProps> = ({
  statusFilter = ['pending_pos_payment', 'confirmed', 'preparing', 'ready_for_pickup'] as Database['public']['Enums']['order_status'][]
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchOrders = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`*, order_items (*)`)
        .eq('merchant_id', user.id)
        .in('status', statusFilter)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error: any) {
      console.error('Error fetching orders:', error);
      toast({
        title: "Error loading orders",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();

    const channel = supabase
      .channel('merchant-orders')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `merchant_id=eq.${user?.id}` },
        () => fetchOrders()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id, statusFilter.join(',')]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchOrders();
  };

  const updateOrderStatus = async (orderId: string, newStatus: Database['public']['Enums']['order_status']) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: "Order updated",
        description: `Order status changed to ${statusConfig[newStatus]?.label || newStatus}`
      });

      fetchOrders();
    } catch (error: any) {
      toast({
        title: "Error updating order",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Package className="h-12 w-12 text-gray-300 mb-4" />
          <p className="text-gray-500 text-lg">No orders yet</p>
          <p className="text-gray-400 text-sm">Orders from customers will appear here</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">{orders.length} order{orders.length !== 1 ? 's' : ''}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {orders.map((order) => {
        const status = statusConfig[order.status] || statusConfig.confirmed;
        const StatusIcon = status.icon;
        const shopifyAdminUrl = order.metadata?.shopify_admin_url;

        return (
          <Card key={order.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    Order #{order.order_number}
                    <Badge className={status.color}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {status.label}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
                    {order.estimated_pickup_time && (
                      <span className="ml-2">
                        · Pickup: {new Date(order.estimated_pickup_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </CardDescription>
                </div>

                {shopifyAdminUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(shopifyAdminUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    View in Shopify
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Customer Info */}
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-medium">{order.customer_name}</p>
                <div className="flex flex-wrap gap-3 mt-1 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {order.customer_email}
                  </span>
                  {order.customer_phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {order.customer_phone}
                    </span>
                  )}
                </div>
                {order.customer_notes && (
                  <p className="text-sm text-gray-600 mt-2 italic">
                    Note: {order.customer_notes}
                  </p>
                )}
              </div>

              {/* Order Items */}
              <div>
                <h4 className="font-medium mb-2">Items</h4>
                <div className="space-y-2">
                  {order.order_items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span>
                        {item.quantity}x {item.product_name}
                      </span>
                      <span className="font-medium">${item.subtotal.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator />

              {/* Payment Summary */}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${order.subtotal.toFixed(2)}</span>
                </div>
                {order.barter_amount > 0 && (
                  <div className="flex justify-between text-green-700">
                    <span>Barter Credits Applied</span>
                    <span>-${order.barter_amount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>${order.tax_amount.toFixed(2)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-lg pt-1">
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    Cash to Collect
                  </span>
                  <span className="text-green-600">
                    ${(order.cash_amount + order.tax_amount).toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              {order.status === 'pending_pos_payment' && (
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => updateOrderStatus(order.id, 'preparing')}
                  >
                    Start Preparing
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => updateOrderStatus(order.id, 'completed')}
                  >
                    Mark Complete
                  </Button>
                </div>
              )}

              {order.status === 'confirmed' && (
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => updateOrderStatus(order.id, 'preparing')}
                  >
                    Start Preparing
                  </Button>
                </div>
              )}

              {order.status === 'preparing' && (
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => updateOrderStatus(order.id, 'ready_for_pickup')}
                  >
                    Mark Ready
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => updateOrderStatus(order.id, 'completed')}
                  >
                    Complete
                  </Button>
                </div>
              )}

              {order.status === 'ready_for_pickup' && (
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => updateOrderStatus(order.id, 'completed')}
                  >
                    Mark as Picked Up
                  </Button>
                </div>
              )}

              {/* POS Sync Info */}
              {order.pos_provider && (
                <div className="flex items-center gap-2 text-xs text-gray-500 pt-2">
                  <AlertCircle className="h-3 w-3" />
                  Synced to {order.pos_provider}
                  {order.metadata?.shopify_draft_order_name && (
                    <span>({order.metadata.shopify_draft_order_name})</span>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

    </div>
  );
};

export default MerchantOnlineOrders;
