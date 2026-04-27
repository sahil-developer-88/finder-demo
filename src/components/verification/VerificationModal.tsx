
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Phone, Mail, Shield, Camera } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const VerificationModal: React.FC<VerificationModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1);
  const [verificationData, setVerificationData] = useState({
    email: '',
    phone: '',
    verificationCode: ''
  });
  const [verifiedItems, setVerifiedItems] = useState({
    email: false,
    phone: false,
    identity: false
  });
  const { toast } = useToast();

  const handleEmailVerification = async () => {
    if (!verificationData.email) return;
    
    // Simulate sending verification email
    toast({
      title: "Verification Email Sent",
      description: "Please check your email and enter the verification code.",
    });
    setStep(2);
  };

  const handleCodeVerification = async () => {
    if (!verificationData.verificationCode) return;
    
    // Simulate code verification
    toast({
      title: "Email Verified",
      description: "Your email has been successfully verified!",
    });
    setVerifiedItems(prev => ({ ...prev, email: true }));
    setStep(3);
  };

  const handlePhoneVerification = async () => {
    if (!verificationData.phone) return;
    
    // Simulate phone verification
    toast({
      title: "Phone Verification Sent",
      description: "We've sent a verification code to your phone.",
    });
    
    // For demo, auto-verify after 2 seconds
    setTimeout(() => {
      setVerifiedItems(prev => ({ ...prev, phone: true }));
      toast({
        title: "Phone Verified",
        description: "Your phone number has been verified!",
      });
      setStep(4);
    }, 2000);
  };

  const handleIdentityVerification = () => {
    // Simulate identity verification process
    toast({
      title: "Identity Verification Started",
      description: "Your identity verification is being processed. This may take 24-48 hours.",
    });
    setVerifiedItems(prev => ({ ...prev, identity: true }));
  };

  const getVerificationLevel = () => {
    const verified = Object.values(verifiedItems).filter(Boolean).length;
    if (verified >= 3) return 'Premium';
    if (verified >= 2) return 'Verified';
    if (verified >= 1) return 'Basic';
    return 'Unverified';
  };

  const getVerificationColor = () => {
    const level = getVerificationLevel();
    switch (level) {
      case 'Premium': return 'bg-green-100 text-green-800';
      case 'Verified': return 'bg-blue-100 text-blue-800';
      case 'Basic': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Account Verification
          </DialogTitle>
          <DialogDescription>
            Verify your account to build trust and unlock more trading opportunities.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="text-center">
            <Badge className={getVerificationColor()}>
              {getVerificationLevel()} Account
            </Badge>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={verificationData.email}
                  onChange={(e) => setVerificationData(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="your@email.com"
                />
              </div>
              <Button onClick={handleEmailVerification} className="w-full">
                <Mail className="h-4 w-4 mr-2" />
                Verify Email
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="code">Verification Code</Label>
                <Input
                  id="code"
                  value={verificationData.verificationCode}
                  onChange={(e) => setVerificationData(prev => ({ ...prev, verificationCode: e.target.value }))}
                  placeholder="Enter 6-digit code"
                  maxLength={6}
                />
              </div>
              <Button onClick={handleCodeVerification} className="w-full">
                Verify Code
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={verificationData.phone}
                  onChange={(e) => setVerificationData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="+1 (555) 123-4567"
                />
              </div>
              <Button onClick={handlePhoneVerification} className="w-full">
                <Phone className="h-4 w-4 mr-2" />
                Verify Phone
              </Button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <div className="text-center">
                <Camera className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <h4 className="font-medium mb-2">Identity Verification</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Upload a government-issued ID to complete your verification
                </p>
              </div>
              <Button onClick={handleIdentityVerification} className="w-full">
                <Camera className="h-4 w-4 mr-2" />
                Upload ID Document
              </Button>
            </div>
          )}

          <div className="space-y-3">
            <h4 className="font-medium">Verification Status</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Email Verification</span>
                {verifiedItems.email ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <div className="h-4 w-4 border-2 border-gray-300 rounded-full" />
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Phone Verification</span>
                {verifiedItems.phone ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <div className="h-4 w-4 border-2 border-gray-300 rounded-full" />
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Identity Verification</span>
                {verifiedItems.identity ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <div className="h-4 w-4 border-2 border-gray-300 rounded-full" />
                )}
              </div>
            </div>
          </div>

          <Button variant="outline" onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VerificationModal;
