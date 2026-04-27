
import { useState } from 'react';
import { X, Camera, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface BarcodeScannerProps {
  onClose: () => void;
  onScan?: (barcode: string) => void;
}

const BarcodeScanner = ({ onClose, onScan }: BarcodeScannerProps) => {
  const [scannedCode, setScannedCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);

  const handleStartScan = () => {
    setIsScanning(true);
    // Simulate scanning process
    setTimeout(() => {
      const mockBarcodes = [
        '789123456789',
        '012345678901', 
        '234567890123',
        '345678901234',
        '456789012345'
      ];
      const randomBarcode = mockBarcodes[Math.floor(Math.random() * mockBarcodes.length)];
      setScannedCode(randomBarcode);
      setIsScanning(false);
    }, 2000);
  };

  const handleManualEntry = (code: string) => {
    setScannedCode(code);
  };

  const handleUseBarcode = () => {
    if (scannedCode && onScan) {
      onScan(scannedCode);
    }
  };

  const handleSearchMerchants = () => {
    // This would search for merchants that accept this product
    alert(`Searching for merchants that accept products with barcode: ${scannedCode}`);
    onClose();
  };

  return (
    <Card className="animate-fade-in bg-white/90 backdrop-blur-md border-0 shadow-2xl">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="flex items-center gap-2">
          <Package className="w-6 h-6 text-blue-600" />
          Barcode Scanner
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0 hover:bg-gray-100"
        >
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Scanner Interface */}
        <div className="relative">
          <div className="aspect-video bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center relative overflow-hidden">
            {isScanning ? (
              <div className="absolute inset-0 bg-blue-600/10 flex items-center justify-center">
                <div className="w-48 h-32 border-2 border-blue-600 rounded-lg relative">
                  <div className="absolute inset-0 bg-gradient-to-b from-blue-600/20 to-transparent animate-pulse"></div>
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500 animate-pulse"></div>
                </div>
                <div className="absolute bottom-4 left-4 right-4 text-center">
                  <p className="text-blue-600 font-medium">Scanning...</p>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <Camera className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">Position barcode in the frame</p>
                <Button
                  onClick={handleStartScan}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                >
                  Start Scanning
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Manual Entry */}
        <div className="space-y-4">
          <Label htmlFor="manual-code">Or enter barcode manually:</Label>
          <Input
            id="manual-code"
            placeholder="Enter UPC barcode number..."
            value={scannedCode}
            onChange={(e) => handleManualEntry(e.target.value)}
            className="font-mono"
          />
        </div>

        {/* Scanned Result */}
        {scannedCode && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg animate-fade-in">
            <h4 className="font-semibold text-green-800 mb-2">Barcode Detected!</h4>
            <p className="text-green-700 font-mono">{scannedCode}</p>
            <div className="mt-4 flex gap-2 flex-wrap">
              {onScan && (
                <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={handleUseBarcode}>
                  Add to Payment
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleSearchMerchants}>
                Search Merchants
              </Button>
            </div>
          </div>
        )}

        {/* Tips */}
        <div className="text-sm text-gray-600 space-y-1">
          <p>• Ensure good lighting for best scanning results</p>
          <p>• Hold device steady and align barcode in frame</p>
          <p>• UPC barcodes are automatically recognized for inventory tracking</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default BarcodeScanner;
