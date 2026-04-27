
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Shield, Clock, CheckCircle, AlertTriangle, DollarSign } from "lucide-react";

interface EscrowSystemProps {
  tradeId: string;
  escrowAmount: number;
  currentStep: 'pending' | 'funded' | 'in-progress' | 'dispute' | 'completed';
  onAction: (action: string) => void;
}

const EscrowSystem: React.FC<EscrowSystemProps> = ({ 
  tradeId, 
  escrowAmount, 
  currentStep, 
  onAction 
}) => {
  const [disputeReason, setDisputeReason] = useState('');

  const getStepProgress = () => {
    switch (currentStep) {
      case 'pending': return 10;
      case 'funded': return 30;
      case 'in-progress': return 60;
      case 'dispute': return 40;
      case 'completed': return 100;
      default: return 0;
    }
  };

  const getStatusColor = () => {
    switch (currentStep) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'funded': return 'bg-blue-100 text-blue-800';
      case 'in-progress': return 'bg-purple-100 text-purple-800';
      case 'dispute': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = () => {
    switch (currentStep) {
      case 'pending': return 'Pending Setup';
      case 'funded': return 'Escrow Funded';
      case 'in-progress': return 'Trade in Progress';
      case 'dispute': return 'Under Dispute';
      case 'completed': return 'Completed';
      default: return 'Unknown';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Escrow Protection
          </div>
          <Badge className={getStatusColor()}>
            {getStatusText()}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Trade Progress</span>
            <span>{getStepProgress()}%</span>
          </div>
          <Progress value={getStepProgress()} className="h-2" />
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Escrow Amount</span>
            <span className="text-lg font-bold">${escrowAmount}</span>
          </div>
          <p className="text-xs text-gray-600">
            This amount is held securely until both parties complete their trade obligations.
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="font-medium">Trade Milestones</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <CheckCircle className={`h-4 w-4 ${
                ['funded', 'in-progress', 'completed'].includes(currentStep) 
                  ? 'text-green-600' 
                  : 'text-gray-300'
              }`} />
              <span className="text-sm">Escrow funded by both parties</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className={`h-4 w-4 ${
                ['in-progress', 'completed'].includes(currentStep) 
                  ? 'text-green-600' 
                  : 'text-gray-300'
              }`} />
              <span className="text-sm">Services/products delivered</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className={`h-4 w-4 ${
                currentStep === 'completed' 
                  ? 'text-green-600' 
                  : 'text-gray-300'
              }`} />
              <span className="text-sm">Both parties confirm completion</span>
            </div>
            <div className="flex items-center gap-3">
              <CheckCircle className={`h-4 w-4 ${
                currentStep === 'completed' 
                  ? 'text-green-600' 
                  : 'text-gray-300'
              }`} />
              <span className="text-sm">Funds released automatically</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          {currentStep === 'pending' && (
            <Button onClick={() => onAction('fund')} className="flex-1">
              <DollarSign className="h-4 w-4 mr-2" />
              Fund Escrow
            </Button>
          )}
          
          {currentStep === 'funded' && (
            <Button onClick={() => onAction('start')} className="flex-1">
              Start Trade
            </Button>
          )}
          
          {currentStep === 'in-progress' && (
            <>
              <Button onClick={() => onAction('complete')} className="flex-1">
                <CheckCircle className="h-4 w-4 mr-2" />
                Mark Complete
              </Button>
              <Button 
                variant="outline" 
                onClick={() => onAction('dispute')}
                className="flex-1"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Report Issue
              </Button>
            </>
          )}
          
          {currentStep === 'dispute' && (
            <div className="w-full text-center">
              <div className="flex items-center justify-center gap-2 text-orange-600 mb-2">
                <Clock className="h-4 w-4" />
                <span className="text-sm">Dispute under review</span>
              </div>
              <p className="text-xs text-gray-600">
                Our team will review this case within 48 hours
              </p>
            </div>
          )}
          
          {currentStep === 'completed' && (
            <div className="w-full text-center">
              <div className="flex items-center justify-center gap-2 text-green-600 mb-2">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">Trade completed successfully!</span>
              </div>
              <p className="text-xs text-gray-600">
                Funds have been released to both parties
              </p>
            </div>
          )}
        </div>

        <div className="text-xs text-gray-500 bg-blue-50 p-3 rounded">
          <strong>Escrow Protection:</strong> Your funds are held securely by our platform until both parties fulfill their trade obligations. This protects against fraud and ensures fair trading.
        </div>
      </CardContent>
    </Card>
  );
};

export default EscrowSystem;
