import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  DollarSign,
  AlertCircle,
  Eye,
  Coins,
  Plus,
  Download,
  Search
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { usePaymentRequests, PaymentRequest } from '@/hooks/usePaymentRequests';
import { format } from 'date-fns';
import PaymentRequestDetailDialog from './PaymentRequestDetailDialog';

const PaymentRequestList: React.FC = () => {
  const { sentRequests, receivedRequests, pendingReceivedCount, loading } = usePaymentRequests();
  const [selectedRequest, setSelectedRequest] = useState<PaymentRequest | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [search, setSearch] = useState('');

  const filterRequests = (requests: PaymentRequest[]) =>
    search.trim()
      ? requests.filter(
          (r) =>
            (r.seller_business_name || r.seller_full_name || r.buyer_business_name || r.buyer_full_name || '')
              .toLowerCase()
              .includes(search.toLowerCase()) ||
            r.service_description.toLowerCase().includes(search.toLowerCase())
        )
      : requests;

  const getStatusBadge = (status: string, isExpired: boolean | null) => {
    if (isExpired && status === 'pending') {
      return <Badge variant="destructive">Expired</Badge>;
    }

    const variants: Record<string, any> = {
      pending: { variant: 'default', icon: Clock },
      accepted: { variant: 'outline', icon: CheckCircle },
      rejected: { variant: 'secondary', icon: XCircle },
      paid: { variant: 'default', icon: CheckCircle },
      cancelled: { variant: 'secondary', icon: XCircle },
      expired: { variant: 'destructive', icon: AlertCircle },
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const openRequestDetail = (request: PaymentRequest) => {
    setSelectedRequest(request);
    setDetailOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'border-l-yellow-400 bg-yellow-50/40';
      case 'accepted': return 'border-l-green-400 bg-green-50/40';
      case 'rejected':
      case 'cancelled': return 'border-l-red-400 bg-red-50/40';
      case 'paid': return 'border-l-blue-400 bg-blue-50/40';
      default: return 'border-l-gray-300 bg-gray-50/40';
    }
  };

  const RequestCard = ({ request, isSent }: { request: PaymentRequest; isSent: boolean }) => {
    const merchantName = isSent
      ? request.buyer_business_name || request.buyer_full_name || 'Unknown'
      : request.seller_business_name || request.seller_full_name || 'Unknown';

    const initials = merchantName.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase();

    return (
      <div
        className={`flex items-center gap-3 p-4 border-l-4 rounded-lg cursor-pointer hover:brightness-95 transition-all ${getStatusColor(request.status)}`}
        onClick={() => openRequestDetail(request)}
      >
        {/* Avatar */}
        <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-600 font-bold text-sm flex items-center justify-center shrink-0">
          {initials}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-sm text-gray-900 truncate">{merchantName}</span>
            {getStatusBadge(request.status, request.is_expired)}
          </div>
          <p className="text-xs text-gray-500 truncate">{request.service_description}</p>
          <p className="text-[11px] text-gray-400 mt-1">{format(new Date(request.created_at), 'MMM d, yyyy · h:mm a')}</p>
        </div>

        {/* Amount */}
        <div className="text-right shrink-0">
          {request.metadata?.barter_percentage != null && request.metadata.barter_percentage > 0 ? (
            <div className="space-y-0.5">
              <div className="font-bold text-sm text-indigo-600 flex items-center justify-end gap-1">
                <Coins className="h-3.5 w-3.5" />{request.metadata.barter_amount?.toFixed(0)} cr
              </div>
              <div className="text-xs font-semibold text-green-600">${request.metadata.cash_amount?.toFixed(2)} cash</div>
            </div>
          ) : (
            <div className="font-bold text-sm text-blue-600 flex items-center gap-0.5">
              <DollarSign className="h-3.5 w-3.5" />{request.total_amount.toFixed(2)}
            </div>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-gray-500">Loading payment requests...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Payment Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="received">
            <TabsList className="grid w-full grid-cols-2 bg-transparent p-1 gap-2">
              <TabsTrigger
                value="received"
                className="flex items-center justify-center gap-2 rounded-xl bg-indigo-500 text-white font-semibold data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=inactive]:opacity-70"
              >
                <Download className="w-4 h-4" />
                Receive
                {pendingReceivedCount > 0 && (
                  <span className="ml-1 bg-white text-indigo-600 text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                    {pendingReceivedCount}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="sent"
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 text-white font-semibold data-[state=active]:bg-emerald-600 data-[state=active]:text-white data-[state=inactive]:opacity-70"
              >
                <Plus className="w-4 h-4" />
                Send
              </TabsTrigger>
            </TabsList>

            <div className="relative mt-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or service..."
                className="pl-8 h-8 text-xs rounded-lg border-gray-200 focus-visible:ring-indigo-400"
              />
            </div>

            <TabsContent value="received" className="space-y-4 mt-4">
              {filterRequests(receivedRequests).length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No payment requests received</p>
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {filterRequests(receivedRequests).map((request) => (
                      <RequestCard key={request.id} request={request} isSent={false} />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="sent" className="space-y-4 mt-4">
              {filterRequests(sentRequests).length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No payment requests sent</p>
                </div>
              ) : (
                <ScrollArea className="h-96">
                  <div className="space-y-3">
                    {filterRequests(sentRequests).map((request) => (
                      <RequestCard key={request.id} request={request} isSent={true} />
                    ))}
                  </div>
                </ScrollArea>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {selectedRequest && (
        <PaymentRequestDetailDialog
          request={selectedRequest}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        />
      )}
    </>
  );
};

export default PaymentRequestList;
