import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, Clock, Package, Loader2, ShoppingBag, MapPin, CreditCard, ChevronRight } from "lucide-react";

const PAGE_SIZE = 10;
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow, format } from 'date-fns';

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  barter_amount: number;
  cash_amount: number;
  pickup_location: string;
  estimated_pickup_time: string | null;
  customer_notes: string | null;
  merchant_notes: string | null;
  created_at: string;
  confirmed_at: string | null;
  completed_at: string | null;
}

const STATUS_PROGRESS: Record<string, number> = {
  pending_payment: 10,
  confirmed: 30,
  preparing: 55,
  ready_for_pickup: 80,
  completed: 100,
  cancelled: 0,
  refunded: 0,
  payment_failed: 0,
};

const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Pending Payment',
  payment_failed: 'Payment Failed',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready_for_pickup: 'Ready for Pickup',
  completed: 'Completed',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
};

const STATUS_COLOR: Record<string, string> = {
  pending_payment: 'bg-yellow-100 text-yellow-800',
  payment_failed: 'bg-red-100 text-red-800',
  confirmed: 'bg-blue-100 text-blue-800',
  preparing: 'bg-purple-100 text-purple-800',
  ready_for_pickup: 'bg-green-100 text-green-800',
  completed: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
  refunded: 'bg-orange-100 text-orange-800',
};

const getStatusIcon = (status: string) => {
  if (status === 'completed') return <CheckCircle className="h-4 w-4 text-green-600" />;
  if (status === 'cancelled' || status === 'payment_failed' || status === 'refunded')
    return <Package className="h-4 w-4 text-red-500" />;
  return <Clock className="h-4 w-4 text-blue-600" />;
};

const OrderTracking = () => {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const totalPages = Math.ceil(orders.length / PAGE_SIZE);
  const pagedOrders = orders.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    const fetchOrders = async () => {
      if (!user) return;
      setLoading(true);

      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, status, total_amount, barter_amount, cash_amount, pickup_location, estimated_pickup_time, customer_notes, merchant_notes, created_at, confirmed_at, completed_at')
        .eq('customer_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) setOrders(data as Order[]);
      setLoading(false);
    };

    fetchOrders();
  }, [user]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-400">
        <ShoppingBag className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-base font-medium">No orders yet</p>
        <p className="text-sm mt-1">Your orders will appear here once you checkout</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Order Tracking</h2>

      {pagedOrders.map((order) => {
        const progress = STATUS_PROGRESS[order.status] ?? 0;
        const isActive = !['completed', 'cancelled', 'refunded', 'payment_failed'].includes(order.status);

        return (
          <Card key={order.id}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  {getStatusIcon(order.status)}
                  <CardTitle className="text-base">Order #{order.order_number}</CardTitle>
                </div>
                <Badge className={`shrink-0 whitespace-nowrap ${STATUS_COLOR[order.status] || 'bg-gray-100 text-gray-800'}`}>
                  {STATUS_LABEL[order.status] || order.status}
                </Badge>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                Placed {formatDistanceToNow(new Date(order.created_at), { addSuffix: true })}
              </p>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Progress Bar */}
              {isActive && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                  {/* Step labels */}
                  <div className="flex justify-between text-xs text-gray-400 mt-1">
                    <span>Confirmed</span>
                    <span>Preparing</span>
                    <span>Ready</span>
                    <span>Done</span>
                  </div>
                </div>
              )}

              {/* Payment Breakdown */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <p className="text-xs text-gray-500">Total</p>
                  <p className="text-sm font-bold">${Number(order.total_amount).toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Barter</p>
                  <p className="text-sm font-bold text-green-600">${Number(order.barter_amount).toFixed(2)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-gray-500">Cash</p>
                  <p className="text-sm font-bold text-blue-600">${Number(order.cash_amount).toFixed(2)}</p>
                </div>
              </div>

              {/* Pickup Info */}
              <div className="flex items-start gap-2 text-sm text-gray-600">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-gray-400" />
                <div>
                  <p>{order.pickup_location}</p>
                  {order.estimated_pickup_time && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Est. pickup: {format(new Date(order.estimated_pickup_time), 'MMM d, h:mm a')}
                    </p>
                  )}
                </div>
              </div>

              {/* Merchant Notes */}
              {order.merchant_notes && (
                <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                  <p className="font-medium text-xs mb-1">Merchant Note:</p>
                  <p>{order.merchant_notes}</p>
                </div>
              )}

              {/* Completed / Cancelled info */}
              {order.completed_at && (
                <p className="text-xs text-green-600">
                  Completed on {format(new Date(order.completed_at), 'MMM d, yyyy h:mm a')}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })}

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1 py-3 border-t">
          <p className="text-xs text-gray-500">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, orders.length)} of {orders.length}
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
              <ChevronRight className="h-3.5 w-3.5 rotate-180" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`h-7 w-7 rounded text-xs font-medium transition-colors ${p === page ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
              >
                {p}
              </button>
            ))}
            <Button variant="outline" size="sm" className="h-7 w-7 p-0" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderTracking;
