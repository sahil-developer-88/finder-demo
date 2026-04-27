import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, CheckCircle, AlertTriangle, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const SetupPIN = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [hasExistingPin, setHasExistingPin] = useState(false);

  // Check if user already has a PIN
  useEffect(() => {
    const checkExistingPin = async () => {
      if (!user?.id) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('pos_pin')
        .eq('user_id', user.id)
        .single();

      if (data && data.pos_pin) {
        setHasExistingPin(true);
      }
    };

    checkExistingPin();
  }, [user?.id]);

  const handleSetupPin = async () => {
    // Validation
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
      toast({
        title: "Invalid PIN",
        description: "PIN must be exactly 4 digits",
        variant: "destructive",
      });
      return;
    }

    if (newPin !== confirmPin) {
      toast({
        title: "PINs don't match",
        description: "Please make sure both PINs are the same",
        variant: "destructive",
      });
      return;
    }

    if (hasExistingPin && !currentPin) {
      toast({
        title: "Current PIN required",
        description: "Please enter your current PIN to change it",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // If updating existing PIN, verify current PIN first
      if (hasExistingPin) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('pos_pin')
          .eq('user_id', user?.id)
          .single();

        if (profile?.pos_pin !== currentPin) {
          toast({
            title: "Incorrect PIN",
            description: "Current PIN is incorrect",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }
      }

      // Update PIN
      const { error } = await supabase
        .from('profiles')
        .update({ pos_pin: newPin })
        .eq('user_id', user?.id);

      if (error) throw error;

      toast({
        title: "Success!",
        description: hasExistingPin ? "PIN updated successfully" : "PIN set successfully",
      });

      // Reset form
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setHasExistingPin(true);

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to setup PIN",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-6 h-6" />
            POS PIN Setup
          </CardTitle>
          <CardDescription>
            Set a 4-digit PIN for POS transactions without barcode
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Info Alert */}
          <Alert>
            <AlertDescription>
              <strong>What is this for?</strong>
              <p className="mt-2 text-sm">
                When making purchases at merchants without your barcode, they can look up your business name
                and you provide this PIN to authenticate and use your barter credits.
              </p>
            </AlertDescription>
          </Alert>

          {/* Current PIN (if user already has one) */}
          {hasExistingPin && (
            <div className="space-y-2">
              <Label htmlFor="currentPin">Current PIN</Label>
              <Input
                id="currentPin"
                type="password"
                inputMode="numeric"
                maxLength={4}
                value={currentPin}
                onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
                placeholder="****"
                disabled={loading}
              />
            </div>
          )}

          {/* New PIN */}
          <div className="space-y-2">
            <Label htmlFor="newPin">{hasExistingPin ? 'New PIN' : 'PIN (4 digits)'}</Label>
            <Input
              id="newPin"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="****"
              disabled={loading}
            />
            <p className="text-xs text-gray-500">
              Choose a memorable 4-digit number
            </p>
          </div>

          {/* Confirm PIN */}
          <div className="space-y-2">
            <Label htmlFor="confirmPin">Confirm PIN</Label>
            <Input
              id="confirmPin"
              type="password"
              inputMode="numeric"
              maxLength={4}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="****"
              disabled={loading}
            />
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSetupPin}
            disabled={loading || !newPin || !confirmPin || newPin !== confirmPin}
            className="w-full"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                {hasExistingPin ? 'Updating...' : 'Setting up...'}
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                {hasExistingPin ? 'Update PIN' : 'Set PIN'}
              </>
            )}
          </Button>

          {/* Security Note */}
          <Alert variant="default" className="bg-yellow-50 border-yellow-200">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <AlertDescription className="text-sm text-yellow-800">
              <strong>Keep your PIN secure!</strong> Don't share it with anyone except when authenticating
              at the point of sale.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
};

export default SetupPIN;
