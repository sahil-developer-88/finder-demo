import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useQuery } from '@tanstack/react-query';

const QR_SIZE = 224;
const LOGO_SIZE = 44;

const CustomerBarcode = () => {
  const { user } = useAuth();

  const { data: credits } = useQuery({
    queryKey: ['userCredits', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('user_credits')
        .select('available_credits')
        .eq('user_id', user.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  if (!user) return null;

  const merchantQR = `MERCHANT-${user.id}`;

  return (
    <div className="max-w-sm mx-auto p-4 space-y-4">

      {/* Balance */}
      <div className="text-center">
        <p className="text-3xl font-bold text-green-600">
          ${(credits?.available_credits ?? 0).toFixed(2)}
        </p>
        <p className="text-xs text-gray-400">available barter credits</p>
      </div>

      {/* QR card */}
      <Card className="border-2 border-gray-100">
        <CardHeader className="pb-2 pt-4 text-center">
          <CardTitle className="flex items-center justify-center gap-2 text-base">
            <QrCode className="w-4 h-4 text-green-600" />
            Payment QR Code
          </CardTitle>
          <p className="text-xs text-gray-400">Customers scan this to pay you with barter credits</p>
        </CardHeader>

        <CardContent className="flex flex-col items-center gap-4 pb-5">
          <div className="relative p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
            <QRCodeSVG
              value={merchantQR}
              size={QR_SIZE}
              level="H"
              includeMargin={false}
              fgColor="#1a1a2e"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className="bg-white rounded-lg shadow flex items-center justify-center"
                style={{ width: LOGO_SIZE, height: LOGO_SIZE }}
              >
                <QrCode className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <p className="text-xs text-center text-gray-400 max-w-[220px] leading-relaxed">
            Static QR — no expiry. Safe to print and display at your location.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default CustomerBarcode;
