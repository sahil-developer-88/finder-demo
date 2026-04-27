import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { usePaymentRequests } from "@/hooks/usePaymentRequests";
import { useNavigate } from 'react-router-dom';
import { DollarSign, ArrowUpRight, ArrowDownRight, Clock, CheckCircle2, XCircle, Plus, Download, Coins, Search } from 'lucide-react';
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from 'date-fns';

const PaymentRequestButton = () => {
  const { sentRequests, receivedRequests, pendingReceivedCount, refetch } = usePaymentRequests();
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  const handleOpenChange = (open: boolean) => {
    setPopoverOpen(open);
    if (open) refetch();
    if (!open) setSearch('');
  };

  const filterRequests = (requests: typeof sentRequests) =>
    search.trim()
      ? requests.filter(
          (r) =>
            (r.seller_business_name || r.seller_full_name || r.buyer_business_name || r.buyer_full_name || '')
              .toLowerCase()
              .includes(search.toLowerCase()) ||
            r.service_description.toLowerCase().includes(search.toLowerCase())
        )
      : requests;

  // Calculate pending sent requests count
  const pendingSentCount = sentRequests.filter(
    (req) => req.status === 'pending' && !req.is_expired
  ).length;

  // Total pending count for badge
  const totalPendingCount = pendingReceivedCount + pendingSentCount;

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-3 h-3 text-yellow-600" />;
      case 'accepted':
        return <CheckCircle2 className="w-3 h-3 text-green-600" />;
      case 'rejected':
      case 'cancelled':
        return <XCircle className="w-3 h-3 text-red-600" />;
      case 'paid':
        return <CheckCircle2 className="w-3 h-3 text-blue-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-50 border-yellow-200';
      case 'accepted':
        return 'bg-green-50 border-green-200';
      case 'rejected':
      case 'cancelled':
        return 'bg-red-50 border-red-200';
      case 'paid':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const formatStatus = (status: string) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const handleRequestClick = () => {
    navigate('/payment-requests');
    setPopoverOpen(false);
  };

  return (
    <Popover open={popoverOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all">
          <DollarSign className="w-5 h-5" />
          {totalPendingCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
              {totalPendingCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="end">
        <Tabs defaultValue="received" className="w-full">
          <TabsList className="w-full grid grid-cols-2 rounded-none bg-transparent p-3 gap-2 mb-0">
            <TabsTrigger
              value="received"
              className="relative flex items-center justify-center gap-2 rounded-xl bg-indigo-500 text-white font-semibold data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=inactive]:opacity-70"
            >
              <Download className="w-4 h-4" />
              Trade: Request
              {pendingReceivedCount > 0 && (
                <span className="ml-1 bg-white text-indigo-600 text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {pendingReceivedCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="sent"
              className="relative flex items-center justify-center gap-2 rounded-xl bg-emerald-500 text-white font-semibold data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=inactive]:opacity-70"
            >
              <Plus className="w-4 h-4" />
              Trade: Send
              {pendingSentCount > 0 && (
                <span className="ml-1 bg-white text-emerald-600 text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                  {pendingSentCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="border-t mx-3 mt-1 mb-2" />
          <div className="px-3 pb-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search requests..."
                className="pl-8 h-8 text-xs rounded-lg border-gray-200 focus-visible:ring-indigo-400"
              />
            </div>
          </div>
          <TabsContent value="received" className="m-0">
            <ScrollArea className="h-80">
              {filterRequests(receivedRequests).length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  <ArrowDownRight className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  No payment requests received
                </div>
              ) : (
                <div className="divide-y">
                  {filterRequests(receivedRequests).slice(0, 10).map((request) => (
                    <div
                      key={request.id}
                      className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors border-l-4 ${getStatusColor(request.status)}`}
                      onClick={handleRequestClick}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-sm">
                              {request.seller_business_name || request.seller_full_name || 'Unknown Merchant'}
                            </h4>
                            {getStatusIcon(request.status)}
                          </div>
                          <p className="text-xs text-gray-600 line-clamp-2">
                            {request.service_description}
                          </p>
                        </div>
                        <div className="text-right ml-2 shrink-0">
                          {request.metadata?.barter_percentage != null && request.metadata.barter_percentage > 0 ? (
                            <div className="space-y-0.5">
                              <p className="font-semibold text-sm text-indigo-600 flex items-center justify-end gap-1">
                                <Coins className="w-3.5 h-3.5" />{request.metadata.barter_amount?.toFixed(0)} cr
                              </p>
                              <p className="text-xs text-green-600 font-medium">${request.metadata.cash_amount?.toFixed(2)} cash</p>
                            </div>
                          ) : (
                            <p className="font-semibold text-sm text-green-700">${request.total_amount.toFixed(2)}</p>
                          )}
                          <Badge variant="outline" className="text-xs mt-1">
                            {formatStatus(request.status)}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>
                          {formatDistanceToNow(new Date(request.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                        {request.status === 'pending' && !request.is_expired && (
                          <span className="text-yellow-600 font-medium">Awaiting response</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="sent" className="m-0 mt-0">
            <ScrollArea className="h-80">
              {filterRequests(sentRequests).length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  <ArrowUpRight className="w-8 h-8 mx-auto mb-2 text-gray-400" />
                  No payment requests sent
                </div>
              ) : (
                <div className="divide-y">
                  {filterRequests(sentRequests).slice(0, 10).map((request) => (
                    <div
                      key={request.id}
                      className={`p-3 cursor-pointer hover:bg-gray-50 transition-colors border-l-4 ${getStatusColor(request.status)}`}
                      onClick={handleRequestClick}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-sm">
                              {request.buyer_business_name || request.buyer_full_name || 'Unknown Buyer'}
                            </h4>
                            {getStatusIcon(request.status)}
                          </div>
                          <p className="text-xs text-gray-600 line-clamp-2">
                            {request.service_description}
                          </p>
                        </div>
                        <div className="text-right ml-2 shrink-0">
                          {request.metadata?.barter_percentage != null && request.metadata.barter_percentage > 0 ? (
                            <div className="space-y-0.5">
                              <p className="font-semibold text-sm text-indigo-600 flex items-center justify-end gap-1">
                                <Coins className="w-3.5 h-3.5" />{request.metadata.barter_amount?.toFixed(0)} cr
                              </p>
                              <p className="text-xs text-green-600 font-medium">${request.metadata.cash_amount?.toFixed(2)} cash</p>
                            </div>
                          ) : (
                            <p className="font-semibold text-sm text-green-700">${request.total_amount.toFixed(2)}</p>
                          )}
                          <Badge variant="outline" className="text-xs mt-1">
                            {formatStatus(request.status)}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>
                          {formatDistanceToNow(new Date(request.created_at), {
                            addSuffix: true,
                          })}
                        </span>
                        {request.status === 'pending' && !request.is_expired && (
                          <span className="text-blue-600 font-medium">Awaiting response</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="p-2 border-t text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRequestClick}
            className="text-xs w-full"
          >
            View all in dashboard
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default PaymentRequestButton;
