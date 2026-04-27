
import { supabase } from '@/integrations/supabase/client';

export interface CreateResult {
  admin: {
    email: string;
    password: string;
    success: boolean;
    error?: string;
  };
  customer: {
    email: string;
    password: string;
    success: boolean;
    error?: string;
  };
}

const cleanupAuthState = () => {
  // Clear all auth-related storage
  localStorage.clear();
  sessionStorage.clear();
  
  // Remove any supabase auth keys specifically
  Object.keys(localStorage).forEach((key) => {
    if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
      localStorage.removeItem(key);
    }
  });
};

export const createTestAccounts = async (): Promise<CreateResult> => {
  console.log('Starting test account creation...');
  
  // Clean up any existing auth state
  cleanupAuthState();
  await supabase.auth.signOut({ scope: 'global' });
  
  const adminEmail = 'admin@test.com';
  const adminPassword = 'admin123456';
  const customerEmail = 'customer@test.com';
  const customerPassword = 'customer123456';

  const result: CreateResult = {
    admin: {
      email: adminEmail,
      password: adminPassword,
      success: false
    },
    customer: {
      email: customerEmail,
      password: customerPassword,
      success: false
    }
  };

  try {
    // Create admin account
    console.log('Creating admin account...');
    const { data: adminData, error: adminError } = await supabase.auth.signUp({
      email: adminEmail,
      password: adminPassword,
      options: {
        data: { 
          full_name: 'Admin User',
          role: 'admin'
        }
      }
    });

    if (adminError) {
      console.error('Admin signup error:', adminError);
      result.admin.error = adminError.message;
    } else if (adminData.user) {
      console.log('Admin user created:', adminData.user.id);
      result.admin.success = true;
      
      // TODO: admin_users table doesn't exist - skipping role assignment
      
      // Set up admin profile with onboarding completed
      try {
        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({
            user_id: adminData.user.id,
            email: adminEmail,
            full_name: 'Admin User',
            onboarding_completed: true
          });
        
        if (profileError) {
          console.error('Error setting up admin profile:', profileError);
        } else {
          console.log('Admin profile set up successfully');
        }
      } catch (profileError) {
        console.error('Error inserting admin profile:', profileError);
      }

      // Set up user credits for admin
      try {
        const { error: creditError } = await supabase
          .from('user_credits')
          .insert({
            user_id: adminData.user.id,
            available_credits: 1000,
            total_earned: 1000,
            total_spent: 0
          });
        
        if (creditError) {
          console.error('Error setting up admin credits:', creditError);
        } else {
          console.log('Admin credits set up successfully');
        }
      } catch (creditError) {
        console.error('Error inserting admin credits:', creditError);
      }

      // Log admin account creation
      try {
        await supabase
          .from('audit_logs')
          .insert({
            user_id: adminData.user.id,
            action: 'admin_account_created',
            table_name: 'admin_users',
            record_id: adminData.user.id
          });
      } catch (auditError) {
        console.error('Error logging admin creation:', auditError);
      }
    }

    // Sign out after admin creation
    await supabase.auth.signOut({ scope: 'global' });
    cleanupAuthState();

    // Create customer account
    console.log('Creating customer account...');
    const { data: customerData, error: customerError } = await supabase.auth.signUp({
      email: customerEmail,
      password: customerPassword,
      options: {
        data: { 
          full_name: 'Customer User'
        }
      }
    });

    if (customerError) {
      console.error('Customer signup error:', customerError);
      result.customer.error = customerError.message;
    } else if (customerData.user) {
      console.log('Customer user created:', customerData.user.id);
      result.customer.success = true;

      // Set up user credits for customer
      try {
        const { error: creditError } = await supabase
          .from('user_credits')
          .insert({
            user_id: customerData.user.id,
            available_credits: 500,
            total_earned: 500,
            total_spent: 0
          });
        
        if (creditError) {
          console.error('Error setting up customer credits:', creditError);
        } else {
          console.log('Customer credits set up successfully');
        }
      } catch (creditError) {
        console.error('Error inserting customer credits:', creditError);
      }

      // Log customer account creation
      try {
        await supabase
          .from('audit_logs')
          .insert({
            user_id: customerData.user.id,
            action: 'customer_account_created',
            table_name: 'profiles',
            record_id: customerData.user.id
          });
      } catch (auditError) {
        console.error('Error logging customer creation:', auditError);
      }
    }

    // Clean up after customer creation
    await supabase.auth.signOut({ scope: 'global' });
    cleanupAuthState();

  } catch (error: any) {
    console.error('Unexpected error during account creation:', error);
    if (!result.admin.error) {
      result.admin.error = error.message;
    }
    if (!result.customer.error) {
      result.customer.error = error.message;
    }
  }

  console.log('Account creation completed:', result);
  return result;
};
