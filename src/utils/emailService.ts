
import { supabase } from '@/integrations/supabase/client';

interface EmailData {
  to: string;
  subject: string;
  html: string;
  type: 'verification' | 'reset_password' | 'notification' | 'welcome' | 'business_approved';
  userId?: string;
}

export const sendEmail = async (emailData: EmailData): Promise<boolean> => {
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: emailData,
    });

    if (error) throw error;

    return data.success;
  } catch (error: any) {
    console.error('Email service error:', error);
    return false;
  }
};

export const emailTemplates = {
  welcome: (userName: string) => ({
    subject: 'Welcome to BarterEx!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #2563eb;">Welcome to BarterEx, ${userName}!</h1>
        <p>Thank you for joining our business barter community. You're now part of a network where businesses can trade services using our credit system.</p>
        <p>Here's what you can do next:</p>
        <ul>
          <li>Complete your business profile</li>
          <li>Create your first service listing</li>
          <li>Browse available services from other businesses</li>
          <li>Start trading with your initial credits</li>
        </ul>
        <p>If you have any questions, feel free to reach out to our support team.</p>
        <p>Happy trading!</p>
        <p>The BarterEx Team</p>
      </div>
    `,
  }),

  businessApproved: (userName: string, businessName: string) => ({
    subject: 'Your Business Has Been Approved!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #16a34a;">Congratulations, ${userName}!</h1>
        <p>Your business "${businessName}" has been approved and is now live on BarterEx!</p>
        <p>You've been awarded 500 bonus credits to get started. Here's what you can do now:</p>
        <ul>
          <li>Your listings are now visible to all users</li>
          <li>You can start accepting trade requests</li>
          <li>Browse and trade with other verified businesses</li>
          <li>Access advanced merchant features</li>
        </ul>
        <p>Start trading today and grow your business network!</p>
        <p>The BarterEx Team</p>
      </div>
    `,
  }),

  verificationReminder: (userName: string) => ({
    subject: 'Please Verify Your Email Address',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #f59e0b;">Email Verification Required</h1>
        <p>Hi ${userName},</p>
        <p>Please verify your email address to complete your BarterEx registration and start trading.</p>
        <p>Check your inbox for the verification email we sent when you signed up.</p>
        <p>If you can't find it, check your spam folder or contact support.</p>
        <p>The BarterEx Team</p>
      </div>
    `,
  }),
};
