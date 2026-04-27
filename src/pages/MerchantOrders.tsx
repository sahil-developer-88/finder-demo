import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingBag, Clock, CheckCircle, XCircle, Package } from "lucide-react";
import BackButton from '@/components/ui/BackButton';
import { MerchantOnlineOrders } from "@/components/merchant/MerchantOnlineOrders";

const MerchantOrders = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('pending');

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <BackButton />
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 rounded-lg">
              <ShoppingBag className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Online Orders</h1>
              <p className="text-gray-600">Manage orders from the Barter app</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="pending" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Pending</span>
            </TabsTrigger>
            <TabsTrigger value="preparing" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Preparing</span>
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Completed</span>
            </TabsTrigger>
            <TabsTrigger value="all" className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              <span className="hidden sm:inline">All</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-500" />
                  Pending Orders
                </CardTitle>
                <CardDescription>
                  Orders waiting for pickup and payment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MerchantOnlineOrders
                  statusFilter={['pending_pos_payment', 'confirmed']}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preparing">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-purple-500" />
                  In Progress
                </CardTitle>
                <CardDescription>
                  Orders being prepared or ready for pickup
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MerchantOnlineOrders
                  statusFilter={['preparing', 'ready_for_pickup']}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="completed">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Completed Orders
                </CardTitle>
                <CardDescription>
                  Successfully fulfilled orders
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MerchantOnlineOrders
                  statusFilter={['completed']}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="all">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingBag className="h-5 w-5 text-blue-500" />
                  All Orders
                </CardTitle>
                <CardDescription>
                  View all orders including cancelled
                </CardDescription>
              </CardHeader>
              <CardContent>
                <MerchantOnlineOrders
                  statusFilter={[
                    'pending_pos_payment',
                    'confirmed',
                    'preparing',
                    'ready_for_pickup',
                    'completed',
                    'cancelled'
                  ]}
                />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Help Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">How Online Orders Work</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-gray-600">
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                1
              </div>
              <div>
                <p className="font-medium text-gray-900">Customer places order</p>
                <p>Customer orders through the Barter app and their barter credits are deducted immediately.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                2
              </div>
              <div>
                <p className="font-medium text-gray-900">Order appears here</p>
                <p>You'll see the order with the cash amount to collect. If you have Shopify, a draft order is also created.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold">
                3
              </div>
              <div>
                <p className="font-medium text-gray-900">Customer picks up</p>
                <p>When the customer arrives, collect the cash payment and mark the order as complete.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default MerchantOrders;
