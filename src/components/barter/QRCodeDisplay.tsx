
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeDisplayProps {
  value: string;
  size?: number;
}

const QRCodeDisplay = ({ value, size = 200 }: QRCodeDisplayProps) => {
  return (
    <div className="flex justify-center p-4 bg-white rounded-lg border">
      <QRCodeSVG
        value={value}
        size={size}
        level="M"
        includeMargin={true}
      />
    </div>
  );
};

export default QRCodeDisplay;
