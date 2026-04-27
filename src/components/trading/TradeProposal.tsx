
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Calendar, DollarSign, Clock, CheckCircle, XCircle } from "lucide-react";

interface TradeProposalProps {
  recipientName: string;
  onSubmit: (proposal: any) => void;
  onCancel: () => void;
}

const TradeProposal: React.FC<TradeProposalProps> = ({ recipientName, onSubmit, onCancel }) => {
  const [proposal, setProposal] = useState({
    offeringService: '',
    offeringValue: '',
    requestingService: '',
    requestingValue: '',
    timeline: '',
    terms: '',
    escrowRequired: false
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(proposal);
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Create Trade Proposal for {recipientName}
        </CardTitle>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* What you're offering */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium text-green-700">What You're Offering</Label>
                <div className="mt-2 space-y-3">
                  <div>
                    <Label htmlFor="offeringService">Service/Product</Label>
                    <Input
                      id="offeringService"
                      value={proposal.offeringService}
                      onChange={(e) => setProposal(prev => ({ ...prev, offeringService: e.target.value }))}
                      placeholder="e.g., Logo Design Package"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="offeringValue">Estimated Value ($)</Label>
                    <Input
                      id="offeringValue"
                      type="number"
                      value={proposal.offeringValue}
                      onChange={(e) => setProposal(prev => ({ ...prev, offeringValue: e.target.value }))}
                      placeholder="500"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* What you're requesting */}
            <div className="space-y-4">
              <div>
                <Label className="text-base font-medium text-blue-700">What You're Requesting</Label>
                <div className="mt-2 space-y-3">
                  <div>
                    <Label htmlFor="requestingService">Service/Product</Label>
                    <Input
                      id="requestingService"
                      value={proposal.requestingService}
                      onChange={(e) => setProposal(prev => ({ ...prev, requestingService: e.target.value }))}
                      placeholder="e.g., SEO Consultation"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="requestingValue">Estimated Value ($)</Label>
                    <Input
                      id="requestingValue"
                      type="number"
                      value={proposal.requestingValue}
                      onChange={(e) => setProposal(prev => ({ ...prev, requestingValue: e.target.value }))}
                      placeholder="500"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <Label htmlFor="timeline">Timeline for Completion</Label>
              <Select value={proposal.timeline} onValueChange={(value) => setProposal(prev => ({ ...prev, timeline: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select timeline" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-week">Within 1 week</SelectItem>
                  <SelectItem value="2-weeks">Within 2 weeks</SelectItem>
                  <SelectItem value="1-month">Within 1 month</SelectItem>
                  <SelectItem value="flexible">Flexible timeline</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="terms">Additional Terms & Conditions</Label>
              <Textarea
                id="terms"
                value={proposal.terms}
                onChange={(e) => setProposal(prev => ({ ...prev, terms: e.target.value }))}
                placeholder="Any specific requirements, deliverables, or conditions..."
                rows={4}
              />
            </div>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg">
            <h4 className="font-medium mb-2">Trade Summary</h4>
            <div className="text-sm space-y-1">
              <p><strong>You give:</strong> {proposal.offeringService || 'Not specified'} (${proposal.offeringValue || '0'})</p>
              <p><strong>You receive:</strong> {proposal.requestingService || 'Not specified'} (${proposal.requestingValue || '0'})</p>
              <p><strong>Timeline:</strong> {proposal.timeline || 'Not specified'}</p>
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">
              Send Proposal
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default TradeProposal;
