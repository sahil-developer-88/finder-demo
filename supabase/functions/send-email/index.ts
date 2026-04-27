import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, type, redirectTo } = await req.json();

    if (!to) throw new Error("Recipient email is required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Use Supabase's own email infrastructure (same as forgot password)
    const { error } = await supabase.auth.admin.inviteUserByEmail(to, {
      redirectTo: redirectTo ?? `${Deno.env.get("FRONTEND_URL") ?? ""}/join`,
    });

    // If user already exists Supabase returns an error — treat as success
    // so we don't leak whether an email is registered
    if (error && !error.message.toLowerCase().includes("already registered")) {
      throw error;
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("send-email error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
