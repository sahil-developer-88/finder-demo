import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Pencil, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getCategoriesByType, BusinessType } from '@/config/businessCategories';

interface Props {
  user: any;
  profile: any;
  onSaved: (updated: any) => void;
}

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-start justify-between py-2.5 border-b border-gray-100 last:border-0 gap-4">
    <span className="text-sm text-gray-500 shrink-0 w-36">{label}</span>
    <span className="text-sm text-gray-900 text-right">{value || '—'}</span>
  </div>
);

const AccountSettingsSection: React.FC<Props> = ({ user, profile, onSaved }) => {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [businessData, setBusinessData] = useState<{ category: string; description: string } | null>(null);
  const [loadingBusiness, setLoadingBusiness] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('businesses')
      .select('category, description')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setBusinessData({ category: data?.category || '', description: data?.description || '' });
        setLoadingBusiness(false);
      });
  }, [user]);

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    business_name: '',
    business_type: 'service' as BusinessType,
    category: '',
    description: '',
    location: '',
    website: '',
  });

  const categories = getCategoriesByType(form.business_type as BusinessType);

  const startEdit = () => {
    setForm({
      full_name: profile?.full_name || '',
      phone: profile?.phone || '',
      business_name: profile?.business_name || '',
      business_type: (profile?.business_type as BusinessType) || 'service',
      category: businessData?.category || '',
      description: businessData?.description || '',
      location: profile?.location || '',
      website: profile?.website || '',
    });
    setEditing(true);
  };

  const cancel = () => setEditing(false);

  const save = async () => {
    if (!user) return;
    setSaving(true);

    const profileUpdate = {
      full_name: form.full_name,
      phone: form.phone,
      business_name: form.business_name,
      business_type: form.business_type,
      location: form.location,
      website: form.website || null,
    };

    const { error: profileErr } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('user_id', user.id);

    if (profileErr) {
      toast({ title: 'Error', description: profileErr.message, variant: 'destructive' });
      setSaving(false);
      return;
    }

    const { error: bizErr } = await supabase
      .from('businesses')
      .update({
        business_name: form.business_name,
        category: form.category,
        description: form.description,
        location: form.location,
      })
      .eq('user_id', user.id);

    if (bizErr) {
      toast({ title: 'Error saving business info', description: bizErr.message, variant: 'destructive' });
      setSaving(false);
      return;
    }

    setBusinessData({ category: form.category, description: form.description });
    setSaving(false);
    setEditing(false);
    onSaved({ ...profile, ...profileUpdate });
    toast({ title: 'Saved', description: 'Your profile has been updated.' });
  };

  if (editing) {
    return (
      <Card className="border-0 shadow-sm w-full max-w-lg">
        <CardHeader className="pb-2 px-6 pt-5 flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-gray-700">Edit Account</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={cancel} disabled={saving}>
              <X className="h-4 w-4 mr-1" /> Cancel
            </Button>
            <Button size="sm" onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
              Save
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-6 pb-6">
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))} placeholder="Your full name" />
          </div>
          <div className="space-y-1.5">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+1 (555) 000-0000" />
          </div>
          <div className="space-y-1.5">
            <Label>Business Name</Label>
            <Input value={form.business_name} onChange={e => setForm(p => ({ ...p, business_name: e.target.value }))} placeholder="Your business name" maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <Label>Business Type</Label>
            <Select value={form.business_type} onValueChange={v => setForm(p => ({ ...p, business_type: v as BusinessType, category: '' }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="product">Product Business</SelectItem>
                <SelectItem value="service">Service Business</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Business Category</Label>
            <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
              <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Business Description</Label>
            <Textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Describe your business..." rows={3} maxLength={500} />
          </div>
          <div className="space-y-1.5">
            <Label>Location</Label>
            <Input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="City, State" />
          </div>
          <div className="space-y-1.5">
            <Label>Website</Label>
            <Input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder="https://yourwebsite.com" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm max-w-lg">
      <CardHeader className="pb-2 px-6 pt-5 flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold text-gray-700">Account Info</CardTitle>
        <Button size="sm" variant="outline" onClick={startEdit} disabled={loadingBusiness}>
          <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
        </Button>
      </CardHeader>
      <CardContent className="px-6 pb-4">
        <Field label="Full Name" value={profile?.full_name} />
        <Field label="Email" value={profile?.email || user?.email} />
        <Field label="Phone" value={profile?.phone} />
        <Field label="Business Name" value={profile?.business_name} />
        <Field label="Business Type" value={profile?.business_type ? profile.business_type.charAt(0).toUpperCase() + profile.business_type.slice(1) : null} />
        <Field label="Category" value={loadingBusiness ? '...' : businessData?.category} />
        <Field label="Description" value={loadingBusiness ? '...' : businessData?.description} />
        <Field label="Location" value={profile?.location} />
        <Field label="Website" value={profile?.website} />
        <Field label="Member Since" value={profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : null} />
        <Field label="Barter %" value={profile?.barter_percentage ? <span className="text-emerald-600 font-semibold">{profile.barter_percentage}%</span> : <span className="text-red-500 font-semibold">Not set ⚠️</span>} />
      </CardContent>
    </Card>
  );
};

export default AccountSettingsSection;
