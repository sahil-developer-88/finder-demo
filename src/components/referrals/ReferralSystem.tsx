import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Gift, Users, CheckCircle, Clock, Loader2, Send, Award } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useReferrals } from "@/hooks/useReferrals";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// ── helpers ────────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, sub }: { label: string; value: string | number; sub?: string }) => (
  <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4">
    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1">{label}</p>
    <p className="text-2xl font-bold text-gray-900">{value}</p>
    {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
  </div>
);

const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={`px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wide ${right ? 'text-right' : 'text-left'}`}>
    {children}
  </th>
);
const TD = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <td className={`px-4 py-3 text-sm text-gray-700 ${right ? 'text-right' : ''}`}>{children}</td>
);

// ── component ──────────────────────────────────────────────────────────────────
const ReferralSystem = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sending, setSending] = useState(false);
  const { referrals, referralCode, stats, loading } = useReferrals();

  const displayCode = referralCode ?? '...';
  const referralLink = `${window.location.origin}/join?ref=${displayCode}`;

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke('send-email', {
        body: {
          to: inviteEmail.trim(),
          type: 'referral_invite',
          redirectTo: referralLink,
        },
      });

      if (error) throw error;
      toast({ title: 'Invite sent!', description: `Invitation sent to ${inviteEmail.trim()}` });
      setInviteEmail('');
    } catch (err: any) {
      toast({ title: 'Failed to send', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    toast({ title: "Copied!", description: "Referral link copied to clipboard." });
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Referrals" value={stats.total} />
        <StatCard label="Points Earned"   value={stats.totalEarned} sub="barter points" />
        <StatCard label="Pending"         value={stats.pending} sub="awaiting onboarding" />
        <StatCard label="Success Rate"    value={stats.successRate} />
      </div>

      {/* How it works banner */}
      <div className="bg-emerald-50 border border-emerald-100 rounded-xl px-5 py-4">
        <div className="flex items-center gap-2 mb-1">
          <Gift className="h-4 w-4 text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-800">Earn 50 barter points for every referral</span>
        </div>
        <p className="text-sm text-emerald-700">
          Share your link — when a friend joins and completes their first trade, you both earn barter points.
        </p>
      </div>

      {/* Referral link */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-5 space-y-3">
        <p className="text-sm font-semibold text-gray-800">Your Referral Link</p>
        <div className="flex gap-2">
          <Input
            value={referralLink}
            readOnly
            className="font-mono text-sm bg-gray-50 border-gray-200 text-gray-600"
          />
          <Button
            variant="outline"
            onClick={copyLink}
            className={`shrink-0 ${copied ? 'border-emerald-200 text-emerald-600 bg-emerald-50' : 'border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100'}`}
          >
            <Copy className="h-4 w-4 mr-1.5" />
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
        <p className="text-xs text-gray-400">
          Code: <span className="font-mono font-medium text-gray-600">{displayCode}</span>
        </p>
      </div>

      {/* Invite by Email */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-5 space-y-3">
        <p className="text-sm font-semibold text-gray-800">Invite a Friend by Email</p>
        <div className="flex gap-2">
          <Input
            type="email"
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendInvite()}
            placeholder="friend@example.com"
            className="text-sm"
          />
          <Button
            onClick={sendInvite}
            disabled={sending || !inviteEmail.trim()}
            className="shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
            {sending ? 'Sending...' : 'Send Invite'}
          </Button>
        </div>
      </div>

      {/* Recent referrals table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
          <Users className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-800">Your Referrals</span>
        </div>
        {referrals.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">No referrals yet — share your link to get started!</div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full min-w-[420px]">
            <thead className="border-b bg-gray-50">
              <tr>
                <TH>Friend</TH>
                <TH>Date</TH>
                <TH right>Points</TH>
                <TH right>Status</TH>
              </tr>
            </thead>
            <tbody>
              {referrals.map(r => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                  <TD>
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs font-bold">
                        {(r.referred_full_name?.[0] ?? r.referred_email?.[0] ?? '?').toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">
                        {r.referred_full_name ?? r.referred_email ?? 'Anonymous'}
                      </span>
                    </div>
                  </TD>
                  <TD><span className="text-gray-400">{new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></TD>
                  <TD right>
                    <span className="font-semibold text-gray-900">
                      {r.points_awarded > 0 ? `+${r.points_awarded} pts` : '—'}
                    </span>
                  </TD>
                  <TD right>
                    {r.status === 'completed' ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                        <CheckCircle className="h-3 w-3" /> Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                        <Clock className="h-3 w-3" /> Pending
                      </span>
                    )}
                  </TD>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

    </div>
  );
};

export default ReferralSystem;
