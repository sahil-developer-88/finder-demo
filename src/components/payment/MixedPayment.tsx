
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { DollarSign, Coins, CreditCard } from "lucide-react";

interface MixedPaymentProps {
  totalAmount: number;
  availablePoints: number;
  onPaymentSubmit: (payment: { barterPoints: number; cashAmount: number }) => void;
}

const MixedPayment: React.FC<MixedPaymentProps> = ({ 
  totalAmount, 
  availablePoints, 
  onPaymentSubmit 
}) => {
  const [barterPercentage, setBarterPercentage] = useState([50]);
  
  const barterAmount = Math.min((totalAmount * barterPercentage[0]) / 100, availablePoints);
  const cashAmount = totalAmount - barterAmount;

  const handleSubmit = () => {
    onPaymentSubmit({
      barterPoints: barterAmount,
      cashAmount: cashAmount
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Coins className="h-5 w-5" />
          Mixed Payment Options
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <span className="font-medium">Total Amount:</span>
            <span className="text-lg font-bold">${totalAmount}</span>
          </div>
          <div className="flex justify-between items-center text-sm text-gray-600">
            <span>Available Barter Points:</span>
            <span>{availablePoints} points</span>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium mb-2 block">
              Payment Split: {barterPercentage[0]}% Barter / {100 - barterPercentage[0]}% Cash
            </Label>
            <Slider
              value={barterPercentage}
              onValueChange={setBarterPercentage}
              max={100}
              step={5}
              className="w-full"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Coins className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800">Barter Points</span>
              </div>
              <div className="text-2xl font-bold text-blue-900">
                {Math.round(barterAmount)} pts
              </div>
              <div className="text-sm text-blue-700">
                ${Math.round(barterAmount)} value
              </div>
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-800">Cash Payment</span>
              </div>
              <div className="text-2xl font-bold text-green-900">
                ${Math.round(cashAmount)}
              </div>
              <div className="text-sm text-green-700">
                Credit/Debit Card
              </div>
            </div>
          </div>

          {cashAmount > 0 && (
            <div className="space-y-3 p-4 border rounded-lg">
              <Label>Credit Card Information</Label>
              <Input placeholder="Card Number" />
              <div className="grid grid-cols-2 gap-2">
                <Input placeholder="MM/YY" />
                <Input placeholder="CVC" />
              </div>
            </div>
          )}

          <Button 
            onClick={handleSubmit} 
            className="w-full"
            disabled={barterAmount > availablePoints}
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Complete Payment ({Math.round(barterAmount)} pts + ${Math.round(cashAmount)})
          </Button>

          {barterAmount > availablePoints && (
            <p className="text-sm text-red-600 text-center">
              Insufficient barter points. Adjust the payment split.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default MixedPayment;
