import React, { useState, useEffect } from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OnboardingFormData } from '@/hooks/useOnboardingForm';
import { MapPin, Mail, Globe, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';
import AddressAutocomplete, { AddressDetails } from '@/components/AddressAutocomplete';

interface ContactReviewStepProps {
  formData: OnboardingFormData;
  setFormData: React.Dispatch<React.SetStateAction<OnboardingFormData>>;
}

// US States list
const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
  'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
  'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
  'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
  'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
  'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];

const COMMON_TYPOS: Record<string, string> = {
  'gmai.com': 'gmail.com', 'gmial.com': 'gmail.com', 'gmail.vom': 'gmail.com',
  'gmail.con': 'gmail.com', 'gmail.cim': 'gmail.com', 'gmail.co': 'gmail.com',
  'yahooo.com': 'yahoo.com', 'yaho.com': 'yahoo.com', 'yahoo.vom': 'yahoo.com',
  'yahoo.con': 'yahoo.com', 'hotmai.com': 'hotmail.com', 'hotmail.vom': 'hotmail.com',
  'hotmail.con': 'hotmail.com', 'outlok.com': 'outlook.com', 'outlook.vom': 'outlook.com',
  'outloo.com': 'outlook.com', 'iclod.com': 'icloud.com', 'icloud.vom': 'icloud.com',
};

const validateEmail = (email: string): string => {
  if (!email) return '';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) return 'Please enter a valid email address';
  const domain = email.split('@')[1]?.toLowerCase();
  if (domain && COMMON_TYPOS[domain]) {
    return `Did you mean @${COMMON_TYPOS[domain]}?`;
  }
  return '';
};

const ContactReviewStep: React.FC<ContactReviewStepProps> = ({ formData, setFormData }) => {
  const [showOnlinePresence, setShowOnlinePresence] = useState(false);
  const [emailError, setEmailError] = useState('');

  // Initialize contactMethod field on mount if not set
  useEffect(() => {
    if (!formData.contactMethod) {
      const methods = [];
      if (formData.contactMethods?.phone) methods.push('Phone');
      if (formData.contactMethods?.email) methods.push('Email');
      methods.push('Messenger'); // Always available

      setFormData(prev => ({
        ...prev,
        contactMethod: methods.join(', ')
      }));
    }
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center pb-4 border-b">
        <Mail className="h-12 w-12 mx-auto mb-3 text-primary" />
        <h3 className="text-lg font-semibold">How can people reach you?</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Provide your contact details and review your profile
        </p>
      </div>

      {/* Contact Information */}
      <div className="space-y-4">
        {/* Online Only Toggle */}
        <div className="flex items-center space-x-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <Checkbox
            id="isOnlineOnly"
            checked={formData.isOnlineOnly}
            onCheckedChange={(checked) => {
              setFormData(prev => ({
                ...prev,
                isOnlineOnly: !!checked,
                // Clear address fields when toggling
                fullAddress: undefined,
                street: undefined,
                city: undefined,
                state: undefined,
                zipCode: undefined,
                latitude: undefined,
                longitude: undefined,
                stateOfIncorporation: undefined
              }));
            }}
          />
          <div>
            <Label htmlFor="isOnlineOnly" className="text-base font-medium cursor-pointer">
              My business is online only (no physical location)
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              Check this if your business operates entirely online without a physical address
            </p>
          </div>
        </div>

        {/* Conditional: Physical Address or State of Incorporation */}
        {!formData.isOnlineOnly ? (
          // Physical Business Address
          <AddressAutocomplete
            value={formData.fullAddress || ''}
            onChange={(addressDetails: AddressDetails) => {
              setFormData(prev => ({
                ...prev,
                fullAddress: addressDetails.fullAddress,
                street: addressDetails.street,
                city: addressDetails.city,
                state: addressDetails.state,
                zipCode: addressDetails.zipCode,
                location: `${addressDetails.city}, ${addressDetails.state}`, // Backward compatibility
                latitude: addressDetails.lat,
                longitude: addressDetails.lng
              }));
            }}
            label="Business Address"
            placeholder="Start typing your business address..."
            required={true}
          />
        ) : (
          // Online Only: State of Incorporation
          <div className="space-y-2">
            <Label htmlFor="stateOfIncorporation" className="text-base font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              State of Incorporation *
            </Label>
            <Select
              value={formData.stateOfIncorporation || ''}
              onValueChange={(value) => {
                setFormData(prev => ({
                  ...prev,
                  stateOfIncorporation: value,
                  state: value, // Also set state field
                  location: value // Backward compatibility
                }));
              }}
            >
              <SelectTrigger className="text-base">
                <SelectValue placeholder="Select state" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((state) => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Select the state where your business is legally incorporated
            </p>
          </div>
        )}

        <div className="space-y-3">
          <Label className="text-base font-medium flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Contact Methods *
          </Label>
          <p className="text-xs text-muted-foreground mb-3">
            Choose how customers can reach you. Messenger is always available for all businesses.
          </p>

          <div className="space-y-3 bg-gray-50 p-4 rounded-lg border">
            {/* Phone Option */}
            <div className="space-y-2">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="contactPhone"
                  checked={formData.contactMethods?.phone || false}
                  onCheckedChange={(checked) => {
                    setFormData(prev => {
                      const newContactMethods = {
                        ...prev.contactMethods,
                        phone: !!checked
                      };
                      // Build contactMethod string for backward compatibility
                      const methods = [];
                      if (newContactMethods.phone) methods.push('Phone');
                      if (newContactMethods.email) methods.push('Email');
                      methods.push('Messenger'); // Always available

                      return {
                        ...prev,
                        contactMethods: newContactMethods,
                        contactMethod: methods.join(', ')
                      };
                    });
                  }}
                />
                <div className="flex-1">
                  <Label htmlFor="contactPhone" className="font-medium cursor-pointer">
                    Phone
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Customers can call or text you
                  </p>
                </div>
              </div>
              {/* Phone Number Input - Show when checked */}
              {formData.contactMethods?.phone && (
                <div className="ml-7 mt-2">
                  <Input
                    type="tel"
                    placeholder="555-123-4567"
                    value={formData.phoneNumberDisplay || formData.phoneNumber || ''}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '').slice(0, 10);
                      let formatted = digits;
                      if (digits.length >= 7) {
                        formatted = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
                      } else if (digits.length >= 4) {
                        formatted = `${digits.slice(0, 3)}-${digits.slice(3)}`;
                      }
                      setFormData(prev => ({ ...prev, phoneNumber: digits, phoneNumberDisplay: formatted }));
                    }}
                    className="text-base"
                    required
                  />
                </div>
              )}
            </div>

            {/* Email Option */}
            <div className="space-y-2">
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="contactEmail"
                  checked={formData.contactMethods?.email || false}
                  onCheckedChange={(checked) => {
                    setFormData(prev => {
                      const newContactMethods = {
                        ...prev.contactMethods,
                        email: !!checked
                      };
                      // Build contactMethod string for backward compatibility
                      const methods = [];
                      if (newContactMethods.phone) methods.push('Phone');
                      if (newContactMethods.email) methods.push('Email');
                      methods.push('Messenger'); // Always available

                      return {
                        ...prev,
                        contactMethods: newContactMethods,
                        contactMethod: methods.join(', ')
                      };
                    });
                  }}
                />
                <div className="flex-1">
                  <Label htmlFor="contactEmail" className="font-medium cursor-pointer">
                    Email
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Customers can email you directly
                  </p>
                </div>
              </div>
              {/* Email Input - Show when checked */}
              {formData.contactMethods?.email && (
                <div className="ml-7 mt-2 space-y-1">
                  <Input
                    type="text"
                    placeholder="your@email.com"
                    value={formData.emailAddress || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({ ...prev, emailAddress: val }));
                      setEmailError(validateEmail(val));
                    }}
                    onBlur={(e) => setEmailError(validateEmail(e.target.value))}
                    className={`text-base ${emailError ? 'border-red-400 focus-visible:ring-red-400' : ''}`}
                    required
                  />
                  {emailError && (
                    <p className="text-xs text-red-500 flex items-center gap-1">
                      <span>⚠</span> {emailError}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Messenger Option - Always Enabled */}
            <div className="flex items-start space-x-3 bg-blue-50 p-3 rounded border border-blue-200">
              <Checkbox
                id="contactMessenger"
                checked={true}
                disabled={true}
                className="cursor-not-allowed"
              />
              <div className="flex-1">
                <Label htmlFor="contactMessenger" className="font-medium flex items-center gap-2">
                  Messenger
                  <Badge variant="secondary" className="text-xs">Always Available</Badge>
                </Label>
                <p className="text-xs text-blue-700 mt-1">
                  Built-in private messaging like Instagram DMs. All businesses have this automatically.
                </p>
              </div>
            </div>
          </div>

          {!formData.contactMethods?.phone && !formData.contactMethods?.email && (
            <p className="text-xs text-orange-600 mt-2">
              ⚠️ Please select at least Phone or Email (Messenger is included by default)
            </p>
          )}
          {formData.contactMethods?.phone && (!formData.phoneNumber || formData.phoneNumber.trim() === '') && (
            <p className="text-xs text-red-600 mt-2">
              ⚠️ Phone number is required when phone contact method is selected
            </p>
          )}
          {formData.contactMethods?.email && (!formData.emailAddress || formData.emailAddress.trim() === '') && (
            <p className="text-xs text-red-600 mt-2">
              ⚠️ Email address is required when email contact method is selected
            </p>
          )}
        </div>
      </div>

      {/* Optional Online Presence */}
      <div className="space-y-3 pt-2">
        <Button
          variant="outline"
          onClick={() => setShowOnlinePresence(!showOnlinePresence)}
          className="w-full justify-between"
          type="button"
        >
          <span className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Online Presence (Optional)
          </span>
          {showOnlinePresence ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>

        {showOnlinePresence && (
          <div className="space-y-4 pl-4 border-l-2 border-border">
            <div className="space-y-2">
              <Label htmlFor="website" className="text-sm">Website</Label>
              <Input
                id="website"
                value={formData.website}
                onChange={(e) => setFormData(prev => ({ ...prev, website: e.target.value }))}
                placeholder="https://yourwebsite.com"
                type="url"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="instagram" className="text-sm">Instagram</Label>
                <Input
                  id="instagram"
                  value={formData.socialMedia.instagram}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    socialMedia: { ...prev.socialMedia, instagram: e.target.value }
                  }))}
                  placeholder="@username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="facebook" className="text-sm">Facebook</Label>
                <Input
                  id="facebook"
                  value={formData.socialMedia.facebook}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    socialMedia: { ...prev.socialMedia, facebook: e.target.value }
                  }))}
                  placeholder="@username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="twitter" className="text-sm">Twitter/X</Label>
                <Input
                  id="twitter"
                  value={formData.socialMedia.twitter}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    socialMedia: { ...prev.socialMedia, twitter: e.target.value }
                  }))}
                  placeholder="@username"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="linkedin" className="text-sm">LinkedIn</Label>
                <Input
                  id="linkedin"
                  value={formData.socialMedia.linkedin}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    socialMedia: { ...prev.socialMedia, linkedin: e.target.value }
                  }))}
                  placeholder="@username"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <Separator className="my-6" />

      {/* Review Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <h4 className="font-semibold text-base">Review Your Profile</h4>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Business Info */}
            <div>
              <p className="text-sm font-medium text-muted-foreground">Business Name</p>
              <p className="text-base font-semibold">{formData.businessName || '—'}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Category</p>
              <p className="text-base">{formData.category || '—'}</p>
            </div>

            {formData.description && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Description</p>
                <p className="text-sm text-foreground/80">{formData.description}</p>
              </div>
            )}

            <Separator />

            {/* Services */}
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Services Offered</p>
              <div className="flex flex-wrap gap-2">
                {formData.servicesOffered.length > 0 ? (
                  formData.servicesOffered.map((service) => (
                    <span key={service} className="px-2 py-1 bg-secondary text-xs rounded-md">
                      {service}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">—</span>
                )}
              </div>
            </div>

            <Separator />

            {/* Contact */}
            <div>
              <p className="text-sm font-medium text-muted-foreground">Location</p>
              <p className="text-base">{formData.location || '—'}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">Contact Methods</p>
              <div className="space-y-2">
                {formData.contactMethods?.phone && (
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Phone</Badge>
                    <span className="text-sm">{formData.phoneNumber || '—'}</span>
                  </div>
                )}
                {formData.contactMethods?.email && (
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Email</Badge>
                    <span className="text-sm">{formData.emailAddress || '—'}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-200">
                    Messenger
                  </Badge>
                  <span className="text-xs text-blue-600">Built-in messaging (auto-enabled)</span>
                </div>
              </div>
            </div>

            {formData.website && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Website</p>
                <p className="text-sm text-blue-600 hover:underline">
                  <a href={formData.website} target="_blank" rel="noopener noreferrer">
                    {formData.website}
                  </a>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800">
            <strong>✓ Looking good!</strong> Review your information above. You can go back to edit any section if needed.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ContactReviewStep;
