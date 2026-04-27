import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * POS PIN Authentication
 *
 * Alternative to barcode scanning - authenticate customer by business name + PIN
 * Returns a temporary barcode that can be used with the existing POS flow
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get authenticated user (merchant)
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Unauthorized');
    }

    const { business_name, pin } = await req.json();

    if (!business_name || !pin) {
      throw new Error('business_name and pin are required');
    }

    console.log('🔐 PIN Authentication Request');
    console.log(`   Business Name: ${business_name}`);
    console.log(`   Merchant (logged in): ${user.id}`);

    // Authenticate with PIN
    const { data: authResult, error: authError } = await supabaseClient
      .rpc('authenticate_with_pin', {
        p_business_name: business_name,
        p_pin: pin
      });

    if (authError) {
      console.error('❌ Auth error:', authError);
      throw new Error('Authentication failed');
    }

    const result = authResult[0];

    if (!result || !result.success) {
      const errorMessage = result?.error_message || 'Authentication failed';
      console.log(`❌ Authentication failed: ${errorMessage}`);
      return new Response(
        JSON.stringify({
          success: false,
          error: errorMessage
        }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`✅ Authentication successful`);
    console.log(`   Customer: ${result.full_name}`);
    console.log(`   User ID: ${result.user_id}`);
    console.log(`   Available Credits: $${result.available_credits}`);

    // Generate a temporary barcode for this authenticated user
    // Format: user_id-timestamp (same as QR code barcode)
    const timestamp = Date.now();
    const tempBarcode = `${result.user_id}-${timestamp}`;

    console.log(`🎫 Generated temporary barcode: ${tempBarcode}`);

    return new Response(
      JSON.stringify({
        success: true,
        barcode: tempBarcode,
        customer: {
          user_id: result.user_id,
          name: result.full_name,
          business_name: result.business_name,
          available_credits: result.available_credits
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('❌ Error in PIN authentication:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Unknown error occurred'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
