import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Store, X } from 'lucide-react';

interface POSSetupReminderProps {
  onConnect: () => void;
  onDismiss: () => void;
}

export function POSSetupReminder({ onConnect, onDismiss }: POSSetupReminderProps) {
  return (
    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200 mb-6">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-4 flex-1">
            <div className="flex-shrink-0">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Store className="w-6 h-6 text-blue-600" />
              </div>
            </div>

            <div className="flex-1">
              <h3 className="font-semibold text-lg text-blue-900 mb-1">
                Connect Your POS System
              </h3>
              <p className="text-sm text-blue-700 mb-4">
                Automatically track barter transactions by connecting your Point of Sale system.
                We support Square, Shopify, Clover, Toast, and Lightspeed.
              </p>

              <div className="flex gap-3">
                <Button
                  onClick={onConnect}
                  size="sm"
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Store className="w-4 h-4 mr-2" />
                  Connect Now
                </Button>
                <Button
                  onClick={onDismiss}
                  variant="outline"
                  size="sm"
                  className="border-blue-300 hover:bg-blue-100"
                >
                  Don't show again
                </Button>
              </div>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="text-blue-600 hover:text-blue-800 hover:bg-blue-100 flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
