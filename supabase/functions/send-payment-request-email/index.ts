import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailPayload {
  payment_request_id: string;
  buyer_email: string;
  seller_name: string;
  amount: number;
  service_description: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      payment_request_id,
      buyer_email,
      seller_name,
      amount,
      service_description
    }: EmailPayload = await req.json();

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const appUrl = Deno.env.get("APP_URL") || Deno.env.get("FRONTEND_URL") || "https://yourapp.com";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const dashboardUrl = `${appUrl}/merchant/dashboard?tab=requests&request=${payment_request_id}`;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3b82f6; color: white; padding: 20px; text-align: center; }
          .content { background: #f9fafb; padding: 30px; margin: 20px 0; }
          .amount { font-size: 32px; font-weight: bold; color: #3b82f6; margin: 20px 0; }
          .button {
            display: inline-block;
            padding: 12px 30px;
            background: #3b82f6;
            color: white;
            text-decoration: none;
            border-radius: 6px;
            margin: 20px 0;
          }
          .details { background: white; padding: 15px; border-left: 4px solid #3b82f6; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Payment Request Received</h1>
          </div>
          <div class="content">
            <p>Hello,</p>
            <p><strong>${seller_name}</strong> has sent you a payment request.</p>

            <div class="amount">$${amount.toFixed(2)}</div>

            <div class="details">
              <h3>Service Description:</h3>
              <p>${service_description}</p>
            </div>

            <p>Please review and respond to this request in your merchant dashboard.</p>

            <center>
              <a href="${dashboardUrl}" class="button">View Payment Request</a>
            </center>

            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              This request will expire in 7 days if not responded to.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Use Supabase Auth's built-in email sending
    const { error: emailError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: buyer_email,
      options: {
        redirectTo: dashboardUrl,
      }
    });

    // Since Supabase Auth email is limited for auth only, we'll use a workaround
    // by inserting into a custom email queue table that can be processed
    // OR we can use the existing send-email function if you have one configured

    // Better approach: Use your existing send-email function
    const { error } = await supabase.functions.invoke('send-email', {
      body: {
        to: buyer_email,
        subject: `Payment Request from ${seller_name} - $${amount.toFixed(2)}`,
        html: htmlContent,
      },
    });

    if (error) {
      console.error('Email sending error:', error);
      throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Email sending error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
