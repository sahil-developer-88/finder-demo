import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Handshake, Eye, EyeOff, AlertCircle, CheckCircle2, ArrowLeft, Zap, Users, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { z } from "zod";
import { toast } from "@/hooks/use-toast";

const emailSchema = z.string().email("Please enter a valid email address").min(1, "Email is required");

const cleanupSupabaseAuth = async () => {
  try { await supabase.auth.signOut({ scope: 'local' }); } catch {}
};

const ensureProfileExists = async (userId: string, fullName: string, email: string) => {
  const { data: existing } = await supabase.from('profiles').select('id').eq('user_id', userId).maybeSingle();
  if (!existing) {
    const { error } = await supabase.from('profiles').upsert(
      { user_id: userId, full_name: fullName, email, onboarding_completed: false },
      { onConflict: 'user_id' }
    );
    if (error) throw error;
  }
};

type AuthView = 'signin' | 'signup' | 'reset';

const FEATURES = [
  { icon: Zap,         text: 'Trade services with barter credits' },
  { icon: Users,       text: '500+ active businesses' },
  { icon: ShieldCheck, text: 'Verified merchants only' },
];

const Auth = () => {
  const [view, setView] = useState<AuthView>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const navigate = useNavigate();

  const [pendingReferralCode] = useState<string | null>(() => {
    return new URLSearchParams(window.location.search).get('ref');
  });

  useEffect(() => {
    const isInvite = window.location.hash.includes('type=invite');
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !isInvite) {
        navigate('/');
      } else if (session && isInvite) {
        // Invited user: pre-fill email and show signup form to complete registration
        setEmail(session.user.email || '');
        setView('signup');
      }
    });
  }, [navigate]);

  const switchView = (v: AuthView) => {
    setView(v);
    setError('');
    setSuccess('');
    setPassword('');
    setShowPassword(false);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError(''); setSuccess('');
    try {
      // Handle invite completion — user is already authenticated via invite link
      const isInvite = window.location.hash.includes('type=invite');
      if (isInvite) {
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession) {
          if (!fullName.trim()) { setError('Please enter your full name.'); return; }
          // Set name + password for the invited user
          await supabase.auth.updateUser({ password, data: { full_name: fullName } });
          await ensureProfileExists(existingSession.user.id, fullName, existingSession.user.email || '').catch(() => {});
          // Handle referral
          if (pendingReferralCode) localStorage.setItem('barterex_pending_referral', pendingReferralCode);
          const storedCode = localStorage.getItem('barterex_pending_referral');
          if (storedCode) {
            try {
              await supabase.rpc('create_referral_link', { p_referred_user_id: existingSession.user.id, p_referral_code: storedCode });
              await supabase.rpc('award_referral_points', { p_referred_user_id: existingSession.user.id });
            } catch {}
            localStorage.removeItem('barterex_pending_referral');
          }
          toast({ title: "Welcome to BarterEx!", description: "Let's set up your business profile." });
          navigate('/onboarding');
          return;
        }
      }

      const ev = emailSchema.safeParse(email);
      if (!ev.success) { setError(ev.error.errors[0].message); return; }
      const domain = email.split('@')[1]?.toLowerCase();
      if (!domain || !/^[^.]+\.[^.]+/.test(domain)) { setError('Please use a valid email domain.'); return; }
      try {
        const { data: emailCheck, error: checkError } = await supabase.functions.invoke('check-email-exists', { body: { email: email.toLowerCase() } });
        if (checkError) { setError('Unable to verify email. Please try again.'); return; }
        if (emailCheck?.exists) { setError('An account with this email already exists. Please sign in.'); return; }
      } catch { setError('Unable to verify email. Please try again.'); return; }
      await cleanupSupabaseAuth();
      if (pendingReferralCode) localStorage.setItem('barterex_pending_referral', pendingReferralCode);
      const { data, error: signupError } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/onboarding` }
      });
      if (signupError) {
        if (signupError.message.includes('already registered') || signupError.message.includes('already exists')) setError('Account already exists. Please sign in.');
        else if (signupError.message.includes('password')) setError('Password must be at least 6 characters.');
        else setError(`Sign up failed: ${signupError.message}`);
        return;
      }
      if (data.user && !data.session) {
        setSuccess('Account created! Check your email for the verification link.');
        toast({ title: "Check your email", description: "Click the link to activate your account.", duration: 10000 });
      } else if (data.session && data.user) {
        await ensureProfileExists(data.user.id, fullName, email).catch(() => {});
        try { await supabase.from('audit_logs').insert({ user_id: data.user.id, action: 'user_signup', table_name: 'profiles', record_id: data.user.id }); } catch {}
        const storedCode = localStorage.getItem('barterex_pending_referral');
        if (storedCode) {
          try {
            await supabase.rpc('create_referral_link', { p_referred_user_id: data.user.id, p_referral_code: storedCode });
            await supabase.rpc('award_referral_points', { p_referred_user_id: data.user.id });
          } catch {}
          localStorage.removeItem('barterex_pending_referral');
        }
        toast({ title: "Welcome to BarterEx!", description: "Let's set up your business profile." });
        navigate('/onboarding');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally { setLoading(false); }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const ev = emailSchema.safeParse(email);
      if (!ev.success) { setError(ev.error.errors[0].message); return; }
      await cleanupSupabaseAuth();
      const { data, error: signinError } = await supabase.auth.signInWithPassword({ email, password });
      if (signinError) {
        if (signinError.message.includes('Email not confirmed')) setError('Please verify your email before signing in.');
        else if (signinError.message.includes('Invalid login credentials') || signinError.message.includes('invalid')) setError('Invalid email or password.');
        else setError(`Sign in failed: ${signinError.message}`);
        return;
      }
      if (data.session && data.user) {
        try { await supabase.from('audit_logs').insert({ user_id: data.user.id, action: 'user_signin', table_name: 'profiles', record_id: data.user.id }); } catch {}
        const { data: profile } = await supabase.from('profiles').select('onboarding_completed').eq('user_id', data.user.id).maybeSingle();
        if (!profile) { await ensureProfileExists(data.user.id, data.user.user_metadata?.full_name || '', data.user.email || '').catch(() => {}); navigate('/onboarding'); return; }
        toast({ title: "Welcome back!", description: "Redirecting to your dashboard..." });
        const isAdminByMeta = data.user.app_metadata?.role === 'admin';
        let isAdmin = isAdminByMeta;
        if (!isAdminByMeta) {
          const { data: adminRow } = await supabase.from('admin_users').select('user_id').eq('user_id', data.user.id).maybeSingle();
          isAdmin = !!adminRow;
        }
        if (isAdmin) navigate('/admin');
        else if (profile.onboarding_completed) navigate('/account-dashboard');
        else navigate('/onboarding');
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.');
    } finally { setLoading(false); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const ev = emailSchema.safeParse(email);
      if (!ev.success) { setError(ev.error.errors[0].message); return; }
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` });
      if (resetError) { setError(`Failed to send reset email: ${resetError.message}`); return; }
      setResetEmailSent(true);
      toast({ title: "Check your email", description: "We've sent you a password reset link." });
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email.');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex">

      {/* LEFT PANEL */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #020617 0%, #0f0a2e 50%, #020617 100%)' }}>

        {/* Animated gradient orbs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="animate-orb-float-1 absolute rounded-full"
            style={{ top: '-10%', left: '-15%', width: 600, height: 600, opacity: 0.4,
              background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }} />
          <div className="animate-orb-float-2 absolute rounded-full"
            style={{ bottom: '-15%', right: '-15%', width: 500, height: 500, opacity: 0.3,
              background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }} />
          <div className="animate-orb-float-3 absolute rounded-full"
            style={{ top: '35%', right: '-5%', width: 350, height: 350, opacity: 0.25,
              background: 'radial-gradient(circle, #06b6d4 0%, transparent 70%)' }} />
        </div>

        {/* Dot grid overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '28px 28px' }} />

        {/* Top edge glow line */}
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-60" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <Handshake className="h-5 w-5 text-indigo-400" />
          </div>
          <span className="text-white font-bold text-xl">BarterEx</span>
        </div>

        {/* Center content */}
        <div className="relative z-10">
          <h2 className="text-4xl font-black text-white leading-tight mb-4">
            Trade Services,{' '}
            <span className="bg-gradient-to-r from-yellow-300 to-orange-400 bg-clip-text text-transparent">
              Not Just Cash
            </span>
          </h2>
          <p className="text-white/50 text-lg mb-10">
            Join hundreds of businesses exchanging services using our barter credit system.
          </p>
          <div className="space-y-4">
            {FEATURES.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center flex-shrink-0">
                  <Icon className="h-4 w-4 text-indigo-400" />
                </div>
                <span className="text-white/70 text-sm">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-white/20 text-xs relative z-10">
          &copy; {new Date().getFullYear()} BarterEx. All rights reserved.
        </p>
      </div>

      {/* RIGHT PANEL */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 py-12 sm:px-12 bg-white">
        <div className="w-full max-w-md mx-auto">

          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Handshake className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold text-gray-900 text-lg">BarterEx</span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">
              {view === 'signin' && 'Welcome back'}
              {view === 'signup' && 'Create your account'}
              {view === 'reset'  && 'Reset your password'}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {view === 'signin' && 'Sign in to your BarterEx account'}
              {view === 'signup' && 'Start trading services with other businesses'}
              {view === 'reset'  && "We'll send a reset link to your email"}
            </p>
          </div>

          {/* Alerts */}
          {error && (
            <Alert className="mb-5 border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-700">{error}</AlertDescription>
            </Alert>
          )}
          {success && (
            <Alert className="mb-5 border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">{success}</AlertDescription>
            </Alert>
          )}

          {/* SIGN IN */}
          {view === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="signin-email">Email</Label>
                <Input id="signin-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@business.com" required
                  className="h-11 rounded-xl border-gray-200 focus-visible:ring-indigo-400"
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="signin-password">Password</Label>
                  <button type="button" onClick={() => switchView('reset')}
                    className="text-xs text-indigo-600 hover:text-indigo-700 font-medium">
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Input id="signin-password" type={showPassword ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                    className="h-11 rounded-xl border-gray-200 focus-visible:ring-indigo-400 pr-10"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" disabled={loading}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 font-semibold">
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
              <p className="text-center text-sm text-gray-500">
                Don't have an account?{' '}
                <button type="button" onClick={() => switchView('signup')}
                  className="text-indigo-600 hover:text-indigo-700 font-semibold">
                  Sign Up
                </button>
              </p>
            </form>
          )}

          {/* SIGN UP */}
          {view === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="signup-name">Full Name</Label>
                <Input id="signup-name" type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Your full name" required
                  className="h-11 rounded-xl border-gray-200 focus-visible:ring-indigo-400"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-email">Email</Label>
                <Input id="signup-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="you@business.com" required
                  className="h-11 rounded-xl border-gray-200 focus-visible:ring-indigo-400"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signup-password">Password</Label>
                <div className="relative">
                  <Input id="signup-password" type={showPassword ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6}
                    className="h-11 rounded-xl border-gray-200 focus-visible:ring-indigo-400 pr-10"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-400">Minimum 6 characters</p>
              </div>
              <Button type="submit" disabled={loading}
                className="w-full h-11 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 font-semibold">
                {loading ? 'Creating Account...' : 'Create Account'}
              </Button>
              <p className="text-center text-sm text-gray-500">
                Already have an account?{' '}
                <button type="button" onClick={() => switchView('signin')}
                  className="text-indigo-600 hover:text-indigo-700 font-semibold">
                  Sign In
                </button>
              </p>
            </form>
          )}

          {/* RESET */}
          {view === 'reset' && (
            <>
              {resetEmailSent ? (
                <div className="text-center space-y-4">
                  <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-7 w-7 text-green-600" />
                  </div>
                  <p className="text-gray-600 text-sm">
                    Reset link sent to <span className="font-semibold">{email}</span>
                  </p>
                  <button onClick={() => { setResetEmailSent(false); setEmail(''); }}
                    className="text-sm text-indigo-600 hover:text-indigo-700 font-medium">
                    Send another email
                  </button>
                </div>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label htmlFor="reset-email">Email</Label>
                    <Input id="reset-email" type="email" value={email} onChange={e => setEmail(e.target.value)}
                      placeholder="you@business.com" required
                      className="h-11 rounded-xl border-gray-200 focus-visible:ring-indigo-400"
                    />
                  </div>
                  <Button type="submit" disabled={loading}
                    className="w-full h-11 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 font-semibold">
                    {loading ? 'Sending...' : 'Send Reset Link'}
                  </Button>
                </form>
              )}
              <button type="button" onClick={() => switchView('signin')}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mt-6 mx-auto">
                <ArrowLeft className="h-4 w-4" /> Back to Sign In
              </button>
            </>
          )}

          <div className="mt-8 text-center">
            <button onClick={() => navigate('/')}
              className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 mx-auto">
              <ArrowLeft className="h-3 w-3" /> Back to Home
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
