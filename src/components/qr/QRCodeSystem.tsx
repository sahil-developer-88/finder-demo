
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrCode, Scan, Download, Share2 } from "lucide-react";

const QRCodeSystem = () => {
  const [qrData, setQrData] = useState("MERCHANT_ID_12345");
  const [isScanning, setIsScanning] = useState(false);
  
  // Mock QR code - in real app, use a QR library like qrcode
  const generateQRCode = () => {
    return `data:image/svg+xml;base64,${btoa(`
      <svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">
        <rect width="200" height="200" fill="white"/>
        <rect x="20" y="20" width="20" height="20" fill="black"/>
        <rect x="60" y="20" width="20" height="20" fill="black"/>
        <rect x="100" y="20" width="20" height="20" fill="black"/>
        <rect x="140" y="20" width="20" height="20" fill="black"/>
        <rect x="20" y="60" width="20" height="20" fill="black"/>
        <rect x="100" y="60" width="20" height="20" fill="black"/>
        <rect x="160" y="60" width="20" height="20" fill="black"/>
        <rect x="20" y="100" width="20" height="20" fill="black"/>
        <rect x="60" y="100" width="20" height="20" fill="black"/>
        <rect x="140" y="100" width="20" height="20" fill="black"/>
        <rect x="20" y="140" width="20" height="20" fill="black"/>
        <rect x="80" y="140" width="20" height="20" fill="black"/>
        <rect x="120" y="140" width="20" height="20" fill="black"/>
        <rect x="160" y="140" width="20" height="20" fill="black"/>
        <text x="100" y="190" text-anchor="middle" font-size="12" fill="black">Merchant QR</text>
      </svg>
    `)}`;
  };

  const handleScan = () => {
    setIsScanning(true);
    // Mock scanning process
    setTimeout(() => {
      setIsScanning(false);
    }, 2000);
  };

  const downloadQR = () => {
    // In real app, generate and download QR code
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            Merchant QR Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <div className="bg-white p-4 rounded-lg border-2 border-dashed border-gray-300 inline-block">
              <img 
                src={generateQRCode()} 
                alt="Merchant QR Code" 
                className="w-48 h-48"
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">
              Your unique merchant verification QR code
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Merchant ID</label>
            <Input value={qrData} readOnly />
          </div>

          <div className="flex gap-2">
            <Button onClick={downloadQR} variant="outline" className="flex-1">
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
            <Button variant="outline" className="flex-1">
              <Share2 className="h-4 w-4 mr-2" />
              Share
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scan className="h-5 w-5" />
            QR Scanner
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <div className="bg-gray-100 p-8 rounded-lg border-2 border-dashed border-gray-300">
              {isScanning ? (
                <div className="space-y-2">
                  <div className="animate-pulse w-16 h-16 bg-blue-400 rounded-full mx-auto"></div>
                  <p className="text-sm">Scanning...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Scan className="h-16 w-16 text-gray-400 mx-auto" />
                  <p className="text-sm text-gray-600">
                    Scan another merchant's QR code to verify or connect
                  </p>
                </div>
              )}
            </div>
          </div>

          <Button 
            onClick={handleScan} 
            disabled={isScanning}
            className="w-full"
          >
            {isScanning ? 'Scanning...' : 'Start QR Scanner'}
          </Button>

          <div className="text-xs text-gray-500 text-center">
            Use this to verify other merchants or establish quick connections for trades
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default QRCodeSystem;
