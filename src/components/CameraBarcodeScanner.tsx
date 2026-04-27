
import { useState, useRef, useEffect } from 'react';
import { X, Camera, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Import Quagga for barcode scanning
declare global {
  interface Window {
    Quagga: any;
  }
}

interface CameraBarcodeScannerProps {
  onClose: () => void;
  onScan?: (barcode: string) => void;
}

const CameraBarcodeScanner = ({ onClose, onScan }: CameraBarcodeScannerProps) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scannedCode, setScannedCode] = useState('');
  const [error, setError] = useState('');
  const scannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Load Quagga library
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/quagga@0.12.1/dist/quagga.min.js';
    script.onload = () => {};
    document.head.appendChild(script);

    return () => {
      if (window.Quagga) {
        window.Quagga.stop();
      }
    };
  }, []);

  const startScanning = async () => {
    if (!window.Quagga) {
      setError('Barcode scanning library not loaded. Please refresh and try again.');
      return;
    }

    setIsScanning(true);
    setError('');

    try {
      window.Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: scannerRef.current,
          constraints: {
            width: 640,
            height: 480,
            facingMode: "environment"
          },
        },
        locator: {
          patchSize: "medium",
          halfSample: true
        },
        numOfWorkers: 2,
        decoder: {
          readers: [
            "code_128_reader",
            "ean_reader",
            "ean_8_reader",
            "code_39_reader",
            "code_39_vin_reader",
            "codabar_reader",
            "upc_reader",
            "upc_e_reader"
          ]
        },
        locate: true
      }, (err: any) => {
        if (err) {
          setError('Camera access denied or not available');
          setIsScanning(false);
          return;
        }
        window.Quagga.start();
      });

      window.Quagga.onDetected((data: any) => {
        const code = data.codeResult.code;
        setScannedCode(code);
        window.Quagga.stop();
        setIsScanning(false);
      });

    } catch (error) {
      setError('Failed to start camera. Please ensure camera permissions are granted.');
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (window.Quagga) {
      window.Quagga.stop();
    }
    setIsScanning(false);
  };

  const handleUseBarcode = () => {
    if (scannedCode && onScan) {
      onScan(scannedCode);
    }
    onClose();
  };

  return (
    <Card className="animate-fade-in bg-white/90 backdrop-blur-md border-0 shadow-2xl max-w-lg mx-auto">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="flex items-center gap-2">
          <Package className="w-6 h-6 text-blue-600" />
          Camera Barcode Scanner
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
        {/* Camera Scanner Interface */}
        <div className="relative">
          <div 
            ref={scannerRef}
            className="aspect-video bg-black rounded-lg flex items-center justify-center relative overflow-hidden"
            style={{ minHeight: '300px' }}
          >
            {!isScanning && !error && (
              <div className="text-center text-white">
                <Camera className="w-12 h-12 mx-auto mb-4 opacity-70" />
                <p className="mb-4">Point camera at barcode</p>
                <Button
                  onClick={startScanning}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Start Camera Scanner
                </Button>
              </div>
            )}
            
            {isScanning && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-64 h-32 border-2 border-red-500 rounded-lg relative">
                  <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-red-500 animate-pulse"></div>
                </div>
                <div className="absolute bottom-4 left-4 right-4 text-center">
                  <p className="text-white font-medium mb-2">Scanning for barcodes...</p>
                  <Button
                    onClick={stopScanning}
                    variant="outline"
                    size="sm"
                    className="bg-white/20 backdrop-blur text-white border-white/50"
                  >
                    Stop Scanner
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
            <Button
              onClick={() => setError('')}
              size="sm"
              variant="outline"
              className="mt-2"
            >
              Try Again
            </Button>
          </div>
        )}

        {/* Scanned Result */}
        {scannedCode && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg animate-fade-in">
            <h4 className="font-semibold text-green-800 mb-2">Barcode Scanned Successfully!</h4>
            <p className="text-green-700 font-mono text-lg">{scannedCode}</p>
            <div className="mt-4 flex gap-2">
              <Button 
                size="sm" 
                className="bg-green-600 hover:bg-green-700" 
                onClick={handleUseBarcode}
              >
                Use This Barcode
              </Button>
              <Button 
                size="sm" 
                variant="outline" 
                onClick={startScanning}
              >
                Scan Another
              </Button>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="text-sm text-gray-600 space-y-1">
          <p>• Ensure good lighting for best scanning results</p>
          <p>• Hold device steady and align barcode in red frame</p>
          <p>• Camera permission required for scanning</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default CameraBarcodeScanner;
