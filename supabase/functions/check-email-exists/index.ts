import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      throw new Error('Email is required');
    }

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Check if email exists in auth.users using admin API
    const { data: users, error: authError } = await supabaseAdmin.auth.admin.listUsers();

    if (authError) {
      console.error('Error checking auth users:', authError);
      throw new Error('Failed to check email availability');
    }

    // Check if email exists (case-insensitive)
    const emailExists = users.users.some(
      user => user.email?.toLowerCase() === email.toLowerCase()
    );

    // Also check profiles table
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('email', email.toLowerCase())
      .maybeSingle();

    if (profileError && profileError.code !== 'PGRST116') {
      console.error('Error checking profiles:', profileError);
    }

    const profileExists = !!profile;

    return new Response(
      JSON.stringify({
        exists: emailExists || profileExists,
        inAuth: emailExists,
        inProfiles: profileExists
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Error in check-email-exists:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
