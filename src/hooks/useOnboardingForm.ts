
import { useState } from 'react';

export interface OnboardingFormData {
  businessName: string;
  businessType?: 'product' | 'service' | 'both'; // Type of business
  category: string;
  servicesOffered: string[];
  wantingInReturn?: string[]; // Optional - removed from form
  estimatedValue?: string; // Optional - removed from form
  location: string; // Kept for backward compatibility
  isOnlineOnly: boolean; // New: Is business online-only?
  fullAddress?: string; // New: Complete formatted address from Google
  street?: string; // New: Street address
  city?: string; // New: City
  state?: string; // New: State (for both physical and online-only)
  zipCode?: string; // New: ZIP code
  stateOfIncorporation?: string; // New: For online-only businesses
  latitude?: number; // New: GPS coordinates
  longitude?: number; // New: GPS coordinates
  contactMethod: string; // Kept for backward compatibility
  contactMethods?: {
    phone: boolean;
    email: boolean;
    messenger: boolean; // Always true
  };
  phoneNumber?: string; // Phone number digits only (no formatting)
  phoneNumberDisplay?: string; // Formatted display value (e.g. 555-123-4567)
  emailAddress?: string; // Email address if email contact enabled
  description: string;
  website: string;
  socialMedia: {
    instagram: string;
    twitter: string;
    facebook: string;
    linkedin: string;
  };
  pricedItems?: Array<{ name: string; price: number; points: number }>; // Optional - removed from form
  barterPercentage: number;
  businessEIN?: string;
  businessLicense?: string;
  businessVerificationStatus?: 'pending' | 'verified' | 'rejected';
}

export const useOnboardingForm = () => {
  const [formData, setFormData] = useState<OnboardingFormData>({
    businessName: '',
    category: '',
    servicesOffered: [],
    wantingInReturn: [],
    estimatedValue: '',
    location: '',
    isOnlineOnly: false,
    contactMethod: '',
    contactMethods: {
      phone: false,
      email: false,
      messenger: true // Always enabled
    },
    description: '',
    website: '',
    socialMedia: {
      instagram: '',
      twitter: '',
      facebook: '',
      linkedin: ''
    },
    pricedItems: [],
    barterPercentage: 100,
    businessVerificationStatus: 'pending'
  });

  return { formData, setFormData };
};
