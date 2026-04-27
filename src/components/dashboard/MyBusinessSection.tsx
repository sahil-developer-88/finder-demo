import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, X, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Props {
  user: any;
}

const MyBusinessSection: React.FC<Props> = ({ user }) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [services, setServices] = useState<string[]>([]);
  const [newService, setNewService] = useState('');

  useEffect(() => {
    if (!user) return;
    supabase
      .from('businesses')
      .select('id, services_offered, barter_percentage')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setBusinessId(data.id);
          setServices(data.services_offered || []);
        }
        setLoading(false);
      });
  }, [user]);

  const addService = () => {
    const s = newService.trim();
    if (s && !services.includes(s)) {
      setServices(prev => [...prev, s]);
      setNewService('');
    }
  };

  const removeService = (s: string) => setServices(prev => prev.filter(x => x !== s));

  const save = async () => {
    if (!user) return;
    setSaving(true);

    if (businessId) {
      const { error } = await supabase
        .from('businesses')
        .update({ services_offered: services })
        .eq('id', businessId);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        setSaving(false);
        return;
      }
    } else {
      // No business record yet — create one
      const { data, error } = await supabase
        .from('businesses')
        .insert({ user_id: user.id, services_offered: services, status: 'active' })
        .select('id')
        .single();
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        setSaving(false);
        return;
      }
      setBusinessId(data.id);
    }

    setSaving(false);
    toast({ title: 'Saved', description: 'Your business details have been updated.' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-lg">
      {/* Services Offered */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2 px-6 pt-5">
          <CardTitle className="text-base font-semibold text-gray-700">Services Offered</CardTitle>
        </CardHeader>
        <CardContent className="px-6 pb-5 space-y-3">
          <div className="flex gap-2">
            <Input
              value={newService}
              onChange={e => setNewService(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addService())}
              placeholder="e.g., Logo Design, SEO, Consulting"
            />
            <Button type="button" size="sm" onClick={addService}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {services.length === 0 && (
              <p className="text-sm text-gray-400">No services added yet.</p>
            )}
            {services.map(s => (
              <Badge key={s} variant="secondary" className="pr-1 text-sm py-1">
                {s}
                <button
                  type="button"
                  onClick={() => removeService(s)}
                  className="ml-2 hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700 text-white w-full">
        {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
        Save Changes
      </Button>
    </div>
  );
};

export default MyBusinessSection;
