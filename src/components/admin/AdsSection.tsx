import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SectionTitle, TH, TD } from './shared/ui';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Image, Bell, Plus, Trash2, CheckCircle, XCircle, Loader2,
  Send, Eye, EyeOff, ExternalLink,
} from 'lucide-react';

type Banner = {
  id: string;
  merchant_name: string;
  image_url: string | null;
  headline: string | null;
  sub_text: string | null;
  link_url: string | null;
  status: string;
  created_at: string;
  expires_at: string | null;
};

type SubTab = 'Banners' | 'Push Messages';

const AdsSection = ({ activeSubTab }: { activeSubTab: string }) => {
  const sub = (activeSubTab as SubTab) || 'Banners';
  const { user } = useAuth();

  // ── Banners state ──────────────────────────────────────────────────────────
  const [banners, setBanners]       = useState<Banner[]>([]);
  const [bLoading, setBLoading]     = useState(true);
  const [bSaving, setBSaving]       = useState(false);
  const [bError, setBError]         = useState('');
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm] = useState({
    merchant_name: '',
    image_url: '',
    headline: '',
    sub_text: '',
    link_url: '',
    expires_at: '',
  });

  // ── Push state ─────────────────────────────────────────────────────────────
  const [pushTitle, setPushTitle]   = useState('');
  const [pushBody, setPushBody]     = useState('');
  const [pushType, setPushType]     = useState('announcement');
  const [pSending, setPSending]     = useState(false);
  const [pSuccess, setPSuccess]     = useState('');
  const [pError, setPError]         = useState('');

  // ── Fetch banners ──────────────────────────────────────────────────────────
  const fetchBanners = async () => {
    setBLoading(true);
    const { data, error } = await supabase
      .from('ad_banners')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error) setBanners(data ?? []);
    setBLoading(false);
  };

  useEffect(() => { fetchBanners(); }, []);

  // ── Create banner ──────────────────────────────────────────────────────────
  const handleCreateBanner = async () => {
    if (!form.merchant_name.trim()) { setBError('Merchant name is required.'); return; }
    setBSaving(true);
    setBError('');
    const { error } = await supabase.from('ad_banners').insert({
      merchant_name: form.merchant_name.trim(),
      image_url:     form.image_url.trim() || null,
      headline:      form.headline.trim() || null,
      sub_text:      form.sub_text.trim() || null,
      link_url:      form.link_url.trim() || null,
      expires_at:    form.expires_at || null,
      status:        'active',
      created_by:    user?.id,
    });
    if (error) { setBError(error.message); }
    else {
      setForm({ merchant_name: '', image_url: '', headline: '', sub_text: '', link_url: '', expires_at: '' });
      setShowForm(false);
      fetchBanners();
    }
    setBSaving(false);
  };

  // ── Toggle banner status ───────────────────────────────────────────────────
  const toggleStatus = async (b: Banner) => {
    const next = b.status === 'active' ? 'inactive' : 'active';
    await supabase.from('ad_banners').update({ status: next }).eq('id', b.id);
    fetchBanners();
  };

  // ── Delete banner ──────────────────────────────────────────────────────────
  const deleteBanner = async (id: string) => {
    if (!confirm('Delete this banner?')) return;
    await supabase.from('ad_banners').delete().eq('id', id);
    fetchBanners();
  };

  // ── Send push message ──────────────────────────────────────────────────────
  const handleSendPush = async () => {
    if (!pushTitle.trim() || !pushBody.trim()) { setPError('Title and message are required.'); return; }
    setPSending(true);
    setPError('');
    setPSuccess('');

    // Fetch all user IDs
    const { data: profiles } = await supabase.from('profiles').select('user_id');
    const userIds = (profiles ?? []).map((p: any) => p.user_id).filter(Boolean);

    if (userIds.length === 0) {
      setPError('No users found.');
      setPSending(false);
      return;
    }

    // Insert a notification row per user
    const rows = userIds.map((uid: string) => ({
      user_id:    uid,
      title:      pushTitle.trim(),
      message:    pushBody.trim(),
      type:       pushType,
      read:       false,
    }));

    const { error } = await supabase.from('notifications').insert(rows);
    if (error) {
      setPError(error.message);
    } else {
      setPSuccess(`Sent to ${userIds.length} users.`);
      setPushTitle('');
      setPushBody('');
      setPushType('announcement');
    }
    setPSending(false);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div>
      <SectionTitle title="Ads & Banners" sub="Manage rotating merchant banners and broadcast push messages" />

      {/* ── BANNERS TAB ── */}
      {sub === 'Banners' && (
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center justify-between">
                <span className="flex items-center gap-2"><Image className="h-4 w-4 text-indigo-500" /> Rotating Banners</span>
                <Button size="sm" onClick={() => setShowForm(v => !v)}>
                  <Plus className="h-4 w-4 mr-1" />{showForm ? 'Cancel' : 'Add Banner'}
                </Button>
              </CardTitle>
            </CardHeader>

            {showForm && (
              <CardContent className="pt-0 border-t">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Merchant Name *</label>
                    <Input value={form.merchant_name} onChange={e => setForm(f => ({ ...f, merchant_name: e.target.value }))} placeholder="e.g. Top USA Flooring" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Image URL</label>
                    <Input value={form.image_url} onChange={e => setForm(f => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Headline</label>
                    <Input value={form.headline} onChange={e => setForm(f => ({ ...f, headline: e.target.value }))} placeholder="Click Floor Installation" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Sub Text</label>
                    <Input value={form.sub_text} onChange={e => setForm(f => ({ ...f, sub_text: e.target.value }))} placeholder="(732) 508-7280" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Link URL</label>
                    <Input value={form.link_url} onChange={e => setForm(f => ({ ...f, link_url: e.target.value }))} placeholder="https://merchant.com" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Expires At</label>
                    <Input type="date" value={form.expires_at} onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))} />
                  </div>
                </div>
                {bError && <p className="text-xs text-red-500 mt-2">{bError}</p>}
                <div className="mt-3 flex justify-end">
                  <Button onClick={handleCreateBanner} disabled={bSaving}>
                    {bSaving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Plus className="h-4 w-4 mr-1" />}
                    Create Banner
                  </Button>
                </div>
              </CardContent>
            )}

            <CardContent className="p-0 overflow-x-auto">
              {bLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
                </div>
              ) : (
                <table className="w-full min-w-[600px]">
                  <thead className="border-y bg-gray-50">
                    <tr>
                      <TH>Merchant</TH>
                      <TH>Preview</TH>
                      <TH>Headline</TH>
                      <TH>Expires</TH>
                      <TH>Status</TH>
                      <TH>Actions</TH>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {banners.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">No banners yet. Add one above.</td></tr>
                    ) : banners.map(b => (
                      <tr key={b.id} className="hover:bg-gray-50">
                        <TD><p className="text-sm font-medium">{b.merchant_name}</p></TD>
                        <TD>
                          {b.image_url
                            ? <img src={b.image_url} alt="" className="h-10 w-24 object-cover rounded-lg border" />
                            : <span className="text-xs text-gray-400">No image</span>}
                        </TD>
                        <TD>
                          <p className="text-sm">{b.headline || <span className="text-gray-400">—</span>}</p>
                          <p className="text-xs text-gray-400">{b.sub_text || ''}</p>
                        </TD>
                        <TD>
                          <p className="text-xs text-gray-400">
                            {b.expires_at ? new Date(b.expires_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : 'No expiry'}
                          </p>
                        </TD>
                        <TD>
                          {b.status === 'active'
                            ? <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium"><CheckCircle className="h-3 w-3" />Active</span>
                            : <span className="inline-flex items-center gap-1 text-xs text-gray-400 font-medium"><XCircle className="h-3 w-3" />Inactive</span>}
                        </TD>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => toggleStatus(b)}
                              className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1"
                              title={b.status === 'active' ? 'Deactivate' : 'Activate'}
                            >
                              {b.status === 'active' ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                            {b.link_url && (
                              <a href={b.link_url} target="_blank" rel="noreferrer" className="text-gray-400 hover:text-indigo-600">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                            <button onClick={() => deleteBanner(b.id)} className="text-gray-400 hover:text-red-500">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── PUSH MESSAGES TAB ── */}
      {sub === 'Push Messages' && (
        <div className="space-y-4 max-w-xl">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Bell className="h-4 w-4 text-indigo-500" /> Broadcast Push Message
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Title</label>
                <Input value={pushTitle} onChange={e => setPushTitle(e.target.value)} placeholder="e.g. Flash Sale — 50% off today!" />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Message</label>
                <textarea
                  value={pushBody}
                  onChange={e => setPushBody(e.target.value)}
                  placeholder="e.g. Smith's Bakery has 200 croissants they need to move by 5pm — grab them with barter credits now."
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400 h-28 resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Type</label>
                <select
                  value={pushType}
                  onChange={e => setPushType(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-400"
                >
                  <option value="announcement">Announcement</option>
                  <option value="sale">Sale / Promotion</option>
                  <option value="clearance">Inventory Clearance</option>
                  <option value="alert">Platform Alert</option>
                </select>
              </div>

              {pError && <p className="text-xs text-red-500">{pError}</p>}
              {pSuccess && <p className="text-xs text-emerald-600 font-medium">{pSuccess}</p>}

              <div className="pt-1">
                <Button onClick={handleSendPush} disabled={pSending} className="w-full">
                  {pSending
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Sending…</>
                    : <><Send className="h-4 w-4 mr-2" />Send to All Users</>}
                </Button>
                <p className="text-xs text-gray-400 mt-2 text-center">
                  This will appear in every user's notification bell immediately.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default AdsSection;
