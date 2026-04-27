import { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { POSConnectionWizard } from '@/components/merchant/POSConnectionWizard';
import { Store, Clock, XCircle } from 'lucide-react';

type POSOption = 'connect_now' | 'later' | 'not_needed' | null;

interface POSSetupStepProps {
  onComplete: (preference: string) => void;
  onBack: () => void;
  onSaveBeforePOS?: () => Promise<void>;
}

export function POSSetupStep({ onComplete, onBack, onSaveBeforePOS }: POSSetupStepProps) {
  const [selectedOption, setSelectedOption] = useState<POSOption>(null);
  const [showWizard, setShowWizard] = useState(false);

  const handleContinue = () => {
    if (selectedOption === 'connect_now') {
      setShowWizard(true);
    } else if (selectedOption === 'later') {
      onComplete('later');
    } else if (selectedOption === 'not_needed') {
      onComplete('not_needed');
    }
  };

  const handleWizardSuccess = () => {
    setShowWizard(false);
    // After successful OAuth, redirect to merchant dashboard will happen
    // Onboarding is already completed by onSaveBeforePOS callback
  };

  return (
    <>
      <div className="space-y-6">
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <p className="text-blue-800 text-sm">
            <strong>Optional:</strong> Connect your Point of Sale system to automatically track barter transactions in real-time.
            You can also set this up later from your dashboard.
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">
              What's your POS situation?
            </label>

            <Select
              value={selectedOption || ''}
              onValueChange={(value) => setSelectedOption(value as POSOption)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an option..." />
              </SelectTrigger>

              <SelectContent>
                <SelectItem value="connect_now">
                  <div className="flex items-center gap-2">
                    <Store className="w-4 h-4 text-green-600" />
                    <span>I want to connect my POS now</span>
                  </div>
                </SelectItem>
                <SelectItem value="later">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-600" />
                    <span>I'll connect later</span>
                  </div>
                </SelectItem>
                <SelectItem value="not_needed">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-gray-600" />
                    <span>I don't have a POS system</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {selectedOption === 'connect_now' && (
            <div className="bg-green-50 border border-green-200 rounded-md p-4">
              <p className="text-sm text-green-800">
                <strong>Great!</strong> We support Square, Shopify, Clover, Toast, and Lightspeed.
                Click Continue to choose your provider and connect via secure OAuth.
              </p>
            </div>
          )}

          {selectedOption === 'later' && (
            <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
              <p className="text-sm text-amber-800">
                <strong>No problem!</strong> You can connect your POS anytime from your merchant dashboard.
                We'll remind you after setup is complete.
              </p>
            </div>
          )}

          {selectedOption === 'not_needed' && (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
              <p className="text-sm text-gray-700">
                <strong>That's okay!</strong> You can still manually track barter transactions in the app.
                If you get a POS system later, you can connect it anytime.
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-between pt-6">
          <Button
            variant="outline"
            onClick={onBack}
            size="lg"
          >
            Previous
          </Button>

          <Button
            onClick={handleContinue}
            disabled={!selectedOption}
            size="lg"
          >
            {selectedOption === 'connect_now' ? 'Connect POS' : 'Complete Setup'}
          </Button>
        </div>
      </div>

      {/* POS Connection Wizard Modal */}
      <POSConnectionWizard
        open={showWizard}
        onOpenChange={setShowWizard}
        onSuccess={handleWizardSuccess}
        onBeforeOAuth={onSaveBeforePOS}
      />
    </>
  );
}
