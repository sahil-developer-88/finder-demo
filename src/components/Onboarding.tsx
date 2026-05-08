import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useOnboardingForm } from '@/hooks/useOnboardingForm';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import OnboardingProgress from './onboarding/OnboardingProgress';
import StripeWaveCanvas from './onboarding/StripeWaveCanvas';
import BusinessProfileStep from './onboarding/BusinessProfileStep';
import ServicesPricingStep from './onboarding/ServicesPricingStep';
import ContactReviewStep from './onboarding/ContactReviewStep';
import W9Form from './tax/W9Form';
import W9PdfForm from './tax/W9PdfForm';
import { POSSetupStep } from './onboarding/POSSetupStep';
import { z } from 'zod';
import { toast } from '@/hooks/use-toast';

interface OnboardingProps {
  onComplete?: () => void;
}

// Validation schemas
const businessBasicsSchema = z.object({
  businessName: z.string().min(1, "Business name is required").max(100),
  businessType: z.enum(['product', 'service', 'both'], { required_error: "Please select a business type" }),
  category: z.string().min(1, "Category is required"),
  description: z.string().max(500).optional(),
});

const servicesSchema = z.object({
  servicesOffered: z.array(z.string()).min(1, "At least one service is required"),
});

const contactLocationSchema = z.object({
  location: z.string().min(1, "Location is required").max(200),
  contactMethod: z.string().min(1, "Contact method is required").max(200),
});

const stepTitles = [
  "Business Profile",
  "Services & Pricing",
  "Contact & Review",
  "Tax Information",
  "POS Integration"
];

const steps = [
  "Profile",
  "Services",
  "Contact",
  "Tax",
  "POS"
];

const getOnboardingBackupKey = (userId: string) => `barterex_onboarding_backup_${userId}`;

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [profileChecked, setProfileChecked] = useState(false);
  const [w9Submitted, setW9Submitted] = useState(false);
  const [showW9SuccessModal, setShowW9SuccessModal] = useState(false);
  const [existingTaxInfo, setExistingTaxInfo] = useState<any>(null);
  const [taxInfoLoading, setTaxInfoLoading] = useState(false);
  const { formData, setFormData } = useOnboardingForm();
  const { user, loading: authLoading, refreshOnboardingStatus } = useAuth();
  const navigate = useNavigate();

  // Warn user if they try to close/refresh the tab during onboarding
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    // Push extra history entry so back button stays on onboarding
    window.history.pushState(null, '', '/onboarding');
    const handlePopState = () => {
      window.history.pushState(null, '', '/onboarding');
      navigate('/onboarding', { replace: true });
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Check auth state and profile on mount
  useEffect(() => {
    const checkAuthAndProfile = async () => {
      if (authLoading) return;

      if (!user) {
        toast({
          title: "Authentication required",
          description: "Please sign in to continue",
          variant: "destructive"
        });
        navigate('/auth');
        return;
      }

      // Check if profile exists
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('id, onboarding_completed')
          .eq('user_id', user.id)
          .maybeSingle();

        if (profileError) {
          console.error('Profile check error:', profileError);
          setError('Failed to load profile. Please refresh the page.');
          return;
        }

        if (!profile) {
          console.error('Profile not found for user:', user.id);
          setError('Profile not found. Please sign out and sign in again.');
          return;
        }

        if (profile.onboarding_completed) {
          navigate('/account-dashboard');
          return;
        }

        setProfileChecked(true);

        // Try to restore from backup for THIS user only
        const backupKey = getOnboardingBackupKey(user.id);
        const backup = localStorage.getItem(backupKey);
        if (backup) {
          try {
            const backupData = JSON.parse(backup);
            // Validate that backup belongs to current user
            if (backupData.userId === user.id) {
              setFormData(prev => ({ ...prev, ...backupData }));
              toast({
                title: "Progress restored",
                description: "We've restored your previous onboarding data.",
              });
            } else {
              // Clear invalid backup
              console.warn('Backup belongs to different user, clearing...');
              localStorage.removeItem(backupKey);
            }
          } catch (e) {
            console.error('Failed to restore backup:', e);
            localStorage.removeItem(backupKey);
          }
        }

        // Clean up old global backup key if it exists
        const oldBackupKey = 'barterex_onboarding_backup';
        if (localStorage.getItem(oldBackupKey)) {
          localStorage.removeItem(oldBackupKey);
        }
      } catch (error) {
        console.error('Error checking profile:', error);
        setError('Failed to verify profile. Please try again.');
      }
    };

    checkAuthAndProfile();
  }, [user, authLoading, navigate, setFormData]);

  // Fetch existing tax info when reaching step 4
  useEffect(() => {
    if (step === 4 && user) {
      setTaxInfoLoading(true);
      supabase
        .from('tax_info')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setExistingTaxInfo(data);
            setW9Submitted(true);
          }
          setTaxInfoLoading(false);
        });
    }
  }, [step, user]);

  // Auto-save form data to localStorage with user ID
  useEffect(() => {
    if (profileChecked && user) {
      try {
        const backupKey = getOnboardingBackupKey(user.id);
        const backupData = { ...formData, userId: user.id };
        localStorage.setItem(backupKey, JSON.stringify(backupData));
      } catch (e) {
        console.error('Failed to backup form data:', e);
      }
    }
  }, [formData, profileChecked, user]);

  const nextStep = () => {
    if (step < 5) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const validateStep = (stepNum: number): { valid: boolean; error?: string } => {
    try {
      switch (stepNum) {
        case 1:
          businessBasicsSchema.parse(formData);
          return { valid: true };
        case 2:
          servicesSchema.parse(formData);
          return { valid: true };
        case 3:
          // Location-specific validation with clear messaging
          if (!formData.location) {
            return {
              valid: false,
              error: formData.isOnlineOnly
                ? 'Please select your state of incorporation'
                : 'Please enter your business address'
            };
          }
          contactLocationSchema.parse(formData);

          // Additional validation for contact methods
          if (!formData.contactMethods?.phone && !formData.contactMethods?.email) {
            return { valid: false, error: 'Please select at least Phone or Email as a contact method' };
          }

          // Validate phone number if phone is selected
          if (formData.contactMethods?.phone) {
            if (!formData.phoneNumber || formData.phoneNumber.trim() === '') {
              return { valid: false, error: 'Phone number is required when phone contact method is selected' };
            }
            // Validate phone number format (US phone numbers)
            const phoneRegex = /^[\+]?[(]?[0-9]{1,4}[)]?[-\s\.]?[(]?[0-9]{1,4}[)]?[-\s\.]?[0-9]{1,4}[-\s\.]?[0-9]{1,9}$/;
            if (!phoneRegex.test(formData.phoneNumber.trim())) {
              return { valid: false, error: 'Please enter a valid phone number' };
            }
          }

          // Validate email address if email is selected
          if (formData.contactMethods?.email) {
            if (!formData.emailAddress || formData.emailAddress.trim() === '') {
              return { valid: false, error: 'Email address is required when email contact method is selected' };
            }
            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(formData.emailAddress.trim())) {
              return { valid: false, error: 'Please enter a valid email address' };
            }
          }

          return { valid: true };
        case 4:
          return { valid: true }; // W9 is optional
        case 5:
          return { valid: true }; // POS setup is optional
        default:
          return { valid: false, error: 'Invalid step' };
      }
    } catch (validationError) {
      if (validationError instanceof z.ZodError) {
        return { valid: false, error: validationError.errors[0].message };
      }
      return { valid: false, error: 'Validation failed' };
    }
  };

  const handleW9Submit = async (w9Data: any) => {
    if (!user) return;

    try {
      const { error: w9Error } = await supabase
        .from('tax_info')
        .upsert({
          user_id: user.id,
          legal_name: w9Data.legalName,
          business_name: w9Data.businessName,
          business_type: w9Data.businessType,
          llc_classification: w9Data.llcClassification,
          tax_id: w9Data.taxId,
          tax_id_type: w9Data.taxIdType,
          address: w9Data.address,
          city: w9Data.city,
          state: w9Data.state,
          zip_code: w9Data.zipCode,
          account_number: w9Data.accountNumber,
          exempt_from_backup_withholding: w9Data.exemptFromBackupWithholding,
          certification_agreed: w9Data.certificationAgreed,
          signature: w9Data.signature,
          signature_date: w9Data.signatureDate
        }, { onConflict: 'user_id' });

      if (w9Error) {
        console.error('W-9 save error:', w9Error);
        throw new Error(`Failed to save W-9 information: ${w9Error.message}`);
      }

      setW9Submitted(true);
      setShowW9SuccessModal(true);
    } catch (error: any) {
      console.error('Error saving W-9:', error);
      setError(error.message || 'Failed to save W-9 information');
      toast({
        title: "Error saving W-9",
        description: error.message || 'Failed to save W-9 information',
        variant: "destructive"
      });
    }
  };

  const handlePOSSetupComplete = async (preference: string) => {
    if (!user) return;

    try {
      // Update profile with POS setup preference
      const { error: prefError } = await supabase
        .from('profiles')
        .update({ pos_setup_preference: preference })
        .eq('user_id', user.id);

      if (prefError) {
        // Non-fatal: column may not exist in all environments
        console.error('Could not save POS preference (non-fatal):', prefError.message);
      }

      // Complete onboarding
      await completeOnboarding();
    } catch (error: any) {
      console.error('Error saving POS preference:', error);
      setError(error.message || 'Failed to save POS preference');
      toast({
        title: "Error",
        description: error.message || 'Failed to save POS preference',
        variant: "destructive"
      });
    }
  };

  const completeOnboarding = async (skipNavigation = false) => {
    if (!user) {
      setError('User not authenticated');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Ensure session is still valid before writing
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        const { data: refreshed } = await supabase.auth.refreshSession();
        if (!refreshed.session) {
          throw new Error('Your session has expired. Please sign in again.');
        }
      }

      // Final validation
      const validation = validateStep(3); // Validate up to contact step
      if (!validation.valid) {
        throw new Error(validation.error || 'Please complete all required fields');
      }

      // Guard against double-completion (e.g. POS OAuth redirect + return)
      const { data: existingBusiness } = await supabase
        .from('businesses')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      let newBusiness = existingBusiness;

      if (!existingBusiness) {
        // Create business listing
        const listingData = {
          user_id: user.id,
          business_name: formData.businessName,
          category: formData.category,
          description: formData.description || '',
          services_offered: formData.servicesOffered,
          location: formData.location,
          contact_method: formData.contactMethod,
          barter_percentage: formData.barterPercentage || 20,
          status: 'pending'
        };

        const { data: inserted, error: listingError } = await supabase
          .from('businesses')
          .insert(listingData)
          .select('id')
          .single();

        if (listingError) {
          console.error('Business listing error:', listingError);
          throw new Error(`Failed to create business listing: ${listingError.message}`);
        }

        newBusiness = inserted;
      }

      // Update profile to mark onboarding as complete
      const profileData = {
        onboarding_completed: true,
        business_name: formData.businessName,
        business_type: formData.businessType || 'product',
        location: formData.location,
        website: formData.website || null,
        barter_percentage: formData.barterPercentage || 20,
        business_verified: formData.businessVerificationStatus === 'verified',
        phone: formData.phoneNumber || null,
        email: formData.emailAddress || null
      };

      const { error: profileError } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('user_id', user.id);

      if (profileError) {
        console.error('Profile update error:', profileError);
        // Rollback: only delete if we just inserted it (not a pre-existing business)
        if (newBusiness && !existingBusiness) {
          await supabase.from('businesses').delete().eq('id', newBusiness.id);
        }
        throw new Error(`Failed to update profile: ${profileError.message}`);
      }

      // Log the onboarding completion
      try {
        await supabase
          .from('audit_logs')
          .insert({
            user_id: user.id,
            action: 'onboarding_completed',
            table_name: 'profiles',
            record_id: user.id,
            new_data: profileData
          });
      } catch (logError) {
        console.error('Audit log failed:', logError);
        // Don't fail onboarding if logging fails
      }

      // Handle referral — try localStorage code first, then always award points
      // in case the user verified email on a different device (localStorage lost)
      const pendingReferralCode = localStorage.getItem('barterex_pending_referral')?.trim();
      try {
        if (pendingReferralCode && pendingReferralCode.length >= 4) {
          await supabase.rpc('create_referral_link', {
            p_referred_user_id: user.id,
            p_referral_code: pendingReferralCode,
          });
          localStorage.removeItem('barterex_pending_referral');
        }
      } catch (refLinkError) {
        console.error('Referral link (onboarding path) failed (non-fatal):', refLinkError);
      }

      // Clear backup for this user
      const backupKey = getOnboardingBackupKey(user.id);
      localStorage.removeItem(backupKey);

      // Update cached onboarding status so ProtectedRoute doesn't redirect back
      await refreshOnboardingStatus();

      if (!skipNavigation) {
        toast({
          title: "Profile submitted!",
          description: "Your business is under review. You'll be able to list once an admin approves it.",
        });

        if (onComplete) {
          onComplete();
        } else {
          navigate('/account-dashboard');
        }
      }
    } catch (error: any) {
      console.error('Error completing onboarding:', error);
      setError(error.message || 'Failed to complete onboarding. Please try again.');
      
      toast({
        title: "Onboarding failed",
        description: error.message || 'Please try again or contact support if the issue persists.',
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const isStepValid = () => {
    const validation = validateStep(step);
    return validation.valid;
  };

  const handleNextStep = () => {
    const validation = validateStep(step);
    if (!validation.valid) {
      setError(validation.error || 'Please complete all required fields');
      toast({
        title: "Validation error",
        description: validation.error || 'Please complete all required fields',
        variant: "destructive"
      });
      return;
    }
    setError('');
    nextStep();
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return <BusinessProfileStep formData={formData} setFormData={setFormData} />;
      case 2:
        return <ServicesPricingStep formData={formData} setFormData={setFormData} />;
      case 3:
        return <ContactReviewStep formData={formData} setFormData={setFormData} />;
      case 4:
        // Feature flag: Use PDF W-9 form (set to false to use HTML form)
        const USE_PDF_W9 = false;
        const W9Component = USE_PDF_W9 ? W9PdfForm : W9Form;

        return (
          <div className="space-y-6">
            <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
              <p className="text-amber-800 text-sm">
                <strong>Required:</strong> W-9 tax information must be completed to join the platform. This is required for IRS tax reporting.
              </p>
            </div>

            {taxInfoLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="w-7 h-7 rounded-full border-[3px] border-indigo-100 border-t-indigo-600 animate-spin" />
              </div>
            ) : <W9Component
              onSubmit={handleW9Submit}
              onSkip={nextStep}
              isRequired={true}
              initialAddress={{
                street: formData.street,
                city: formData.city,
                state: formData.state,
                zipCode: formData.zipCode
              }}
              initialData={existingTaxInfo ? (() => {
                const parts = (existingTaxInfo.legal_name || '').trim().split(/\s+/);
                const firstName = parts[0] || '';
                const lastName = parts.length > 1 ? parts[parts.length - 1] : '';
                const middleName = parts.length > 2 ? parts.slice(1, -1).join(' ') : '';
                return {
                  firstName,
                  middleName,
                  lastName,
                  legalName: existingTaxInfo.legal_name || '',
                  businessName: existingTaxInfo.business_name || '',
                  businessType: existingTaxInfo.business_type || '',
                  llcClassification: existingTaxInfo.llc_classification,
                  taxId: existingTaxInfo.tax_id || '',
                  taxIdType: existingTaxInfo.tax_id_type || '',
                  address: existingTaxInfo.address || '',
                  city: existingTaxInfo.city || '',
                  state: existingTaxInfo.state || '',
                  zipCode: existingTaxInfo.zip_code || '',
                  accountNumber: existingTaxInfo.account_number || '',
                  exemptFromBackupWithholding: existingTaxInfo.exempt_from_backup_withholding || false,
                  certificationAgreed: existingTaxInfo.certification_agreed || false,
                  signature: existingTaxInfo.signature || '',
                  signatureDate: existingTaxInfo.signature_date || '',
                };
              })() : undefined}
            />
            }

            <div className="flex justify-between pt-6">
              <button
                onClick={prevStep}
                disabled={loading}
                className="h-10 px-5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>

              <button
                onClick={nextStep}
                disabled={!w9Submitted}
                className="h-10 px-6 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-[0_4px_14px_rgba(99,102,241,0.4)] disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                Continue
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

          </div>
        );
      case 5:
        return (
          <POSSetupStep
            onComplete={handlePOSSetupComplete}
            onBack={prevStep}
            onSaveBeforePOS={async () => {
              // Save onboarding data before OAuth redirect
              await completeOnboarding(true);
            }}
          />
        );
      default:
        return null;
    }
  };

  const stepIcons = [
    <svg key="1" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
    <svg key="2" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" /></svg>,
    <svg key="3" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
    <svg key="4" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    <svg key="5" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>,
  ];

  const LoadingScreen = ({ message }: { message: string }) => (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center space-y-3">
        <div className="w-9 h-9 rounded-full border-[3px] border-indigo-100 border-t-indigo-600 animate-spin mx-auto" />
        <p className="text-sm text-gray-400">{message}</p>
      </div>
    </div>
  );

  if (authLoading) return <LoadingScreen message="Loading…" />;
  if (!profileChecked) return <LoadingScreen message="Checking profile…" />;

  return (
    <>
    <div className="min-h-screen flex flex-col md:flex-row">

      {/* ── LEFT SIDEBAR ── */}
      <aside className="hidden md:flex flex-col w-72 lg:w-80 bg-[#0f172a] flex-shrink-0 min-h-screen">

        {/* Logo */}
        <div className="px-8 pt-8 pb-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-900/50">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-white font-bold text-base tracking-tight">BarterEx</span>
          </div>
        </div>

        {/* Step list */}
        <nav className="px-4 flex-1 space-y-1">
          {stepTitles.map((title, i) => {
            const num = i + 1;
            const isCompleted = num < step;
            const isActive = num === step;
            return (
              <div
                key={i}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                  isActive ? 'bg-white/10 border border-white/10' : 'border border-transparent'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all duration-200 ${
                  isCompleted ? 'bg-emerald-500/20 text-emerald-400'
                  : isActive  ? 'bg-indigo-500/30 text-indigo-300'
                  :              'bg-white/5 text-white/30'
                }`}>
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : stepIcons[i]}
                </div>
                <div>
                  <p className={`text-sm font-medium leading-none transition-colors duration-200 ${
                    isActive ? 'text-white' : isCompleted ? 'text-white/50' : 'text-white/30'
                  }`}>{title}</p>
                  {isActive    && <p className="text-xs text-indigo-300/70 mt-1">In progress</p>}
                  {isCompleted && <p className="text-xs text-emerald-400/60 mt-1">Completed</p>}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Sidebar progress bar */}
        <div className="px-8 pb-8 pt-4">
          <div className="border-t border-white/10 pt-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs text-white/40">Overall progress</span>
              <span className="text-xs font-semibold text-indigo-400">{Math.round(((step - 1) / 4) * 100)}%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-500 ease-in-out"
                style={{ width: `${((step - 1) / 4) * 100}%` }}
              />
            </div>
            <p className="text-xs text-white/20 leading-relaxed pt-1">Progress is saved automatically.</p>
          </div>
        </div>
      </aside>

      {/* ── RIGHT CONTENT ── */}
      <main className="flex-1 min-h-screen relative overflow-hidden flex flex-col">

        {/* ── Stripe-style canvas wave animation ── */}
        <StripeWaveCanvas />
        {/* White overlay so form text stays readable */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0.82) 100%)' }} />

        {/* Scrollable form area */}
        <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12">
          <div className="w-full max-w-[560px]">

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3.5 mb-5">
                <svg className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            {/* Form card */}
            <div className="bg-white/80 backdrop-blur-sm border border-white/60 rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] overflow-hidden">

              {/* Progress bar + heading inside card */}
              <div className="px-8 pt-7 pb-5 border-b border-gray-100">
                <OnboardingProgress currentStep={step} totalSteps={5} steps={steps} />
                <div className="mt-6">
                  <h1 className="text-2xl font-bold text-gray-900 leading-tight">{stepTitles[step - 1]}</h1>
                  <p className="text-gray-400 mt-1 text-sm">Join thousands of businesses trading smarter.</p>
                </div>
              </div>

              <div className="p-8">
                {renderStepContent()}
              </div>

              {step < 4 && (
                <div className="px-8 py-4 bg-white/50 border-t border-gray-100 flex items-center justify-between">
                  <button
                    onClick={prevStep}
                    disabled={step === 1 || loading}
                    className="h-10 px-5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600
                      hover:bg-gray-50 hover:border-gray-300
                      disabled:opacity-40 disabled:cursor-not-allowed
                      transition-all flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                    </svg>
                    Back
                  </button>

                  <button
                    onClick={handleNextStep}
                    disabled={!isStepValid() || loading}
                    className="h-10 px-6 rounded-xl text-sm font-semibold text-white
                      bg-indigo-600 hover:bg-indigo-700
                      shadow-[0_4px_14px_rgba(99,102,241,0.4)]
                      disabled:opacity-40 disabled:cursor-not-allowed
                      transition-all flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving…
                      </>
                    ) : (
                      <>
                        Continue
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>

          </div>
        </div>
      </main>
    </div>
    {/* W-9 Success Modal */}
    {showW9SuccessModal && createPortal(
      <div className="fixed inset-0 z-[9999] flex items-center justify-center px-4"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
        <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-sm w-full text-center"
          style={{ animation: 'w9ModalIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both' }}>

          {/* Pulsing rings + checkmark */}
          <div className="relative flex items-center justify-center mx-auto mb-6" style={{ width: 96, height: 96 }}>
            {/* Outer pulse ring */}
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-20"
              style={{ animation: 'w9Ping 1.4s cubic-bezier(0,0,0.2,1) infinite' }} />
            {/* Middle ring */}
            <span className="absolute inline-flex rounded-full bg-emerald-100"
              style={{ width: 80, height: 80, animation: 'w9Ping 1.4s cubic-bezier(0,0,0.2,1) 0.2s infinite', opacity: 0.4 }} />
            {/* Icon circle */}
            <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 shadow-lg shadow-emerald-200">
              <svg className="w-9 h-9 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <h3 className="text-xl font-bold text-gray-900 mb-2">W-9 Submitted!</h3>
          <p className="text-sm text-gray-500 leading-relaxed mb-1">Your tax information has been securely saved.</p>
          <p className="text-sm text-gray-400 mb-8">You're all set to continue.</p>

          <button
            onClick={() => setShowW9SuccessModal(false)}
            className="w-full h-11 rounded-xl text-sm font-semibold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', boxShadow: '0 4px 14px rgba(16,185,129,0.4)' }}
          >
            Continue
          </button>
        </div>

        <style>{`
          @keyframes w9ModalIn {
            from { opacity: 0; transform: scale(0.85) translateY(20px); }
            to   { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes w9Ping {
            0%   { transform: scale(1); opacity: 0.4; }
            75%, 100% { transform: scale(1.6); opacity: 0; }
          }
        `}</style>
      </div>,
      document.body
    )}
    </>
  );
};

export default Onboarding;
