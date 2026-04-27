
import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail } from "lucide-react";

interface PasswordResetFormProps {
  email: string;
  setEmail: (email: string) => void;
  loading: boolean;
  resetEmailSent: boolean;
  setResetEmailSent: (sent: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
}

const PasswordResetForm: React.FC<PasswordResetFormProps> = ({
  email,
  setEmail,
  loading,
  resetEmailSent,
  setResetEmailSent,
  onSubmit
}) => {
  if (resetEmailSent) {
    return (
      <div className="text-center space-y-4">
        <Mail className="h-12 w-12 text-blue-600 mx-auto" />
        <p className="text-sm text-gray-600">
          We've sent a password reset link to {email}
        </p>
        <Button 
          variant="outline" 
          onClick={() => setResetEmailSent(false)}
        >
          Send Another Email
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="reset-email">Email</Label>
        <Input
          id="reset-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@business.com"
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? 'Sending...' : 'Send Reset Email'}
      </Button>
    </form>
  );
};

export default PasswordResetForm;
