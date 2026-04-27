
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, X, Smartphone } from 'lucide-react';
import { usePWA } from '@/hooks/usePWA';

interface PWAInstallPromptProps {
  onDismiss: () => void;
}

const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({ onDismiss }) => {
  const { installApp, isInstallable } = usePWA();

  if (!isInstallable) return null;

  const handleInstall = () => {
    installApp();
    onDismiss();
  };

  return (
    <Card className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-sm">Install App</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <CardDescription className="text-xs">
          Add Swap Shop Finder to your home screen for quick access
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <Button 
          onClick={handleInstall}
          className="w-full h-8 text-sm bg-blue-600 hover:bg-blue-700"
        >
          <Download className="h-3 w-3 mr-2" />
          Install
        </Button>
      </CardContent>
    </Card>
  );
};

export default PWAInstallPrompt;
