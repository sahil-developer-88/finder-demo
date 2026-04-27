
import React from 'react';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, Shield } from "lucide-react";

interface AuthAlertsProps {
  error: string;
  success: string;
}

const AuthAlerts: React.FC<AuthAlertsProps> = ({
  error,
  success
}) => {
  return (
    <>
      {error && (
        <Alert className="mb-4 border-red-200 bg-red-50">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-4 border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-700">{success}</AlertDescription>
        </Alert>
      )}
    </>
  );
};

export default AuthAlerts;
