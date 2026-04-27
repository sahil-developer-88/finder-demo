
import React, { useState } from 'react';
import BackButton from '@/components/ui/BackButton';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ChatWindow from '@/components/messaging/ChatWindow';
import TradeProposal from '@/components/trading/TradeProposal';
import EscrowSystem from '@/components/escrow/EscrowSystem';
import VerificationModal from '@/components/verification/VerificationModal';
import { MessageSquare, Handshake, Shield, Award } from "lucide-react";

const Trading = () => {
  const [activeTab, setActiveTab] = useState('messages');
  const [showProposal, setShowProposal] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [selectedChat, setSelectedChat] = useState({
    recipientId: 'user-123',
    recipientName: 'Digital Marketing Solutions'
  });

  const handleProposalSubmit = (proposal: any) => {
    setShowProposal(false);
    // In real app, send to backend
  };

  const handleEscrowAction = (action: string) => {
    // In real app, handle escrow actions
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="container mx-auto max-w-7xl">
        <div className="mb-6">
          <BackButton />
          <h1 className="text-3xl font-bold mb-2 mt-3">Trading Center</h1>
          <p className="text-gray-600">Manage your trades, messages, and negotiations</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content Area */}
          <div className="lg:col-span-2">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="messages" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Messages
                </TabsTrigger>
                <TabsTrigger value="proposals" className="flex items-center gap-2">
                  <Handshake className="h-4 w-4" />
                  Proposals
                </TabsTrigger>
                <TabsTrigger value="escrow" className="flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Escrow
                </TabsTrigger>
              </TabsList>

              <TabsContent value="messages">
                {showProposal ? (
                  <TradeProposal
                    recipientName={selectedChat.recipientName}
                    onSubmit={handleProposalSubmit}
                    onCancel={() => setShowProposal(false)}
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-lg font-medium">Active Conversations</h3>
                      <Button onClick={() => setShowProposal(true)}>
                        <Handshake className="h-4 w-4 mr-2" />
                        New Proposal
                      </Button>
                    </div>
                    <ChatWindow
                      recipientId={selectedChat.recipientId}
                      recipientName={selectedChat.recipientName}
                    />
                  </div>
                )}
              </TabsContent>

              <TabsContent value="proposals">
                <Card>
                  <CardHeader>
                    <CardTitle>Trade Proposals</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">Logo Design ↔ SEO Consultation</h4>
                            <p className="text-sm text-gray-600">From: Digital Marketing Solutions</p>
                            <p className="text-sm text-gray-600">Value: $500 ↔ $500</p>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm">Accept</Button>
                            <Button size="sm" variant="outline">Counter</Button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-gray-50 border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-medium">Web Development ↔ Content Writing</h4>
                            <p className="text-sm text-gray-600">To: Creative Content Co.</p>
                            <p className="text-sm text-gray-600">Value: $1200 ↔ $800</p>
                            <p className="text-xs text-orange-600">Pending response</p>
                          </div>
                          <Button size="sm" variant="outline">Edit</Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="escrow">
                <EscrowSystem
                  tradeId="trade-123"
                  escrowAmount={500}
                  currentStep="in-progress"
                  onAction={handleEscrowAction}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Trust & Safety
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button 
                  onClick={() => setShowVerification(true)}
                  className="w-full"
                  variant="outline"
                >
                  Verify Account
                </Button>
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span>Trust Score</span>
                    <span className="font-medium">8.5/10</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Completed Trades</span>
                    <span className="font-medium">12</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Success Rate</span>
                    <span className="font-medium">95%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button className="w-full" variant="outline">
                  Browse Listings
                </Button>
                <Button className="w-full" variant="outline">
                  Create Listing
                </Button>
                <Button className="w-full" variant="outline">
                  Trade History
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <VerificationModal 
          isOpen={showVerification}
          onClose={() => setShowVerification(false)}
        />
      </div>
    </div>
  );
};

export default Trading;
