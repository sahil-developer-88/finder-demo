
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, Mail, Receipt, Calendar, DollarSign, Coins } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface ReceiptItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  barterPoints?: number;
  barcode?: string;
}

interface ReceiptData {
  transactionId: string;
  merchantName: string;
  customerEmail?: string;
  items: ReceiptItem[];
  subtotal: number;
  barterAmount: number;
  cashAmount: number;
  taxAmount: number;
  gratuity: number;
  total: number;
  paymentMethod: string;
  timestamp: Date;
  location?: string;
}

interface ReceiptGeneratorProps {
  receiptData: ReceiptData;
  onEmailSent?: () => void;
}

const ReceiptGenerator = ({ receiptData, onEmailSent }: ReceiptGeneratorProps) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const generatePDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const receiptElement = document.getElementById('receipt-content');
      if (!receiptElement) return;

      const canvas = await html2canvas(receiptElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const imgWidth = 190;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, imgHeight);
      pdf.save(`Receipt-${receiptData.transactionId}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const sendEmailReceipt = async () => {
    setIsSendingEmail(true);
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      alert(`Receipt emailed to ${receiptData.customerEmail || 'customer'}`);
      onEmailSent?.();
    } catch (error) {
      console.error('Error sending email:', error);
      alert('Error sending email. Please try again.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Receipt Content */}
      <Card id="receipt-content" className="bg-white">
        <CardHeader className="text-center pb-4">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Receipt className="w-6 h-6 text-blue-600" />
            <CardTitle className="text-xl">Transaction Receipt</CardTitle>
          </div>
          <div className="text-sm text-gray-600">
            <p className="font-medium">{receiptData.merchantName}</p>
            {receiptData.location && <p>{receiptData.location}</p>}
            <p className="flex items-center justify-center gap-1 mt-1">
              <Calendar className="w-4 h-4" />
              {receiptData.timestamp.toLocaleString()}
            </p>
          </div>
          <Badge variant="outline" className="mt-2">
            Transaction ID: {receiptData.transactionId}
          </Badge>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Items List */}
          <div>
            <h4 className="font-semibold mb-3">Items Purchased</h4>
            <div className="space-y-2">
              {receiptData.items.map((item) => (
                <div key={item.id} className="flex justify-between items-start">
                  <div className="flex-1">
                    <p className="font-medium">{item.name}</p>
                    <div className="text-sm text-gray-600 flex items-center gap-2">
                      <span>${item.price.toFixed(2)} × {item.quantity}</span>
                      {item.barcode && (
                        <Badge variant="secondary" className="text-xs">
                          {item.barcode}
                        </Badge>
                      )}
                      {item.barterPoints && (
                        <Badge variant="outline" className="text-xs bg-green-50">
                          {item.barterPoints} pts
                        </Badge>
                      )}
                    </div>
                  </div>
                  <span className="font-medium">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Payment Summary */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>${receiptData.subtotal.toFixed(2)}</span>
            </div>
            
            {receiptData.barterAmount > 0 && (
              <div className="flex justify-between text-green-600">
                <span className="flex items-center gap-1">
                  <Coins className="w-4 h-4" />
                  Barter Credits Applied:
                </span>
                <span>-${receiptData.barterAmount.toFixed(2)}</span>
              </div>
            )}
            
            {receiptData.cashAmount > 0 && (
              <div className="flex justify-between">
                <span className="flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  Cash Amount:
                </span>
                <span>${receiptData.cashAmount.toFixed(2)}</span>
              </div>
            )}
            
            <div className="flex justify-between">
              <span>Tax:</span>
              <span>${receiptData.taxAmount.toFixed(2)}</span>
            </div>
            
            {receiptData.gratuity > 0 && (
              <div className="flex justify-between">
                <span>Gratuity:</span>
                <span>${receiptData.gratuity.toFixed(2)}</span>
              </div>
            )}
            
            <Separator />
            
            <div className="flex justify-between text-lg font-bold">
              <span>Total Paid:</span>
              <span>${receiptData.total.toFixed(2)}</span>
            </div>
            
            <div className="text-center mt-3">
              <Badge variant="secondary">
                Payment Method: {receiptData.paymentMethod}
              </Badge>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center text-xs text-gray-500 pt-4 border-t">
            <p>Thank you for your business!</p>
            <p>This receipt is for your records.</p>
            {receiptData.barterAmount > 0 && (
              <p className="text-green-600 font-medium mt-1">
                Barter transaction reported for tax purposes
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex gap-2 justify-center">
        <Button
          onClick={generatePDF}
          disabled={isGeneratingPDF}
          className="flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          {isGeneratingPDF ? 'Generating...' : 'Download PDF'}
        </Button>
        
        {receiptData.customerEmail && (
          <Button
            onClick={sendEmailReceipt}
            disabled={isSendingEmail}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Mail className="w-4 h-4" />
            {isSendingEmail ? 'Sending...' : 'Email Receipt'}
          </Button>
        )}
      </div>
    </div>
  );
};

export default ReceiptGenerator;
