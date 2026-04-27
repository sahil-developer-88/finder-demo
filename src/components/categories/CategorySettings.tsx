import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, Lock, Settings, Loader2 } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  slug: string;
  is_restricted: boolean;
  barter_enabled: boolean;
  restriction_reason?: string;
  description?: string;
}

const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={`px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide ${right ? 'text-right' : 'text-left'}`}>
    {children}
  </th>
);
const TD = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <td className={`px-4 py-3 text-sm text-gray-700 ${right ? 'text-right' : ''}`}>{children}</td>
);

export default function CategorySettings() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from('product_categories')
      .select('*')
      .order('is_restricted', { ascending: false })
      .order('name')
      .then(({ data, error }) => {
        if (error) {
          toast({ title: 'Error', description: 'Failed to load categories', variant: 'destructive' });
        } else {
          setCategories(data || []);
        }
        setLoading(false);
      });
  }, []);

  const toggleBarterEnabled = async (categoryId: string, currentValue: boolean, isRestricted: boolean) => {
    if (isRestricted && !currentValue) {
      toast({
        title: 'Cannot Enable',
        description: 'Restricted categories (alcohol, tobacco, etc.) cannot accept barter for legal compliance.',
        variant: 'destructive',
      });
      return;
    }

    setUpdating(categoryId);
    const newValue = !currentValue;

    const { error } = await supabase
      .from('product_categories')
      .update({ barter_enabled: newValue })
      .eq('id', categoryId);

    if (error) {
      toast({ title: 'Update Failed', description: error.message, variant: 'destructive' });
    } else {
      setCategories(prev => prev.map(c => c.id === categoryId ? { ...c, barter_enabled: newValue } : c));
      toast({ title: 'Category Updated', description: `Barter ${newValue ? 'enabled' : 'disabled'}` });
    }

    setUpdating(null);
  };

  const restricted    = categories.filter(c => c.is_restricted);
  const nonRestricted = categories.filter(c => !c.is_restricted);

  return (
    <div className="space-y-6">

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Settings className="h-5 w-5 text-gray-400" />
          Category Barter Settings
        </h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Control which product categories can accept barter payments
        </p>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-800">
          <strong>How it works:</strong> Disabling barter for a category automatically blocks barter payments for ALL products in that category, regardless of individual product settings.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 gap-2 text-gray-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading categories…
        </div>
      ) : (
        <>
          {/* Restricted Categories */}
          {restricted.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-0 px-6 pt-5">
                <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-red-500" />
                  Restricted Categories
                  <span className="text-sm font-normal text-gray-400 ml-1">— always disabled for legal compliance</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <table className="w-full">
                  <thead className="border-y bg-gray-50">
                    <tr>
                      <TH>Category</TH>
                      <TH>Reason</TH>
                      <TH right>Barter</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {restricted.map(cat => (
                      <tr key={cat.id} className="border-b last:border-0 bg-red-50/40 hover:bg-red-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Lock className="h-3.5 w-3.5 text-red-400 shrink-0" />
                            <span className="text-sm font-medium text-gray-900">{cat.name}</span>
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                              Locked
                            </span>
                          </div>
                          {cat.description && (
                            <p className="text-xs text-gray-400 mt-0.5 ml-5">{cat.description}</p>
                          )}
                        </td>
                        <TD>
                          <span className="text-xs text-red-600">{cat.restriction_reason || '—'}</span>
                        </TD>
                        <td className="px-4 py-3 text-right">
                          <Switch checked={false} disabled className="opacity-40" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Standard Categories */}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-0 px-6 pt-5">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-gray-900">
                  Standard Categories
                  <span className="text-sm font-normal text-gray-400 ml-2">— toggle barter on/off</span>
                </CardTitle>
                <div className="flex items-center gap-4 text-xs text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
                    {nonRestricted.filter(c => c.barter_enabled).length} enabled
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-gray-300" />
                    {nonRestricted.filter(c => !c.barter_enabled).length} disabled
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <table className="w-full">
                <thead className="border-y bg-gray-50">
                  <tr>
                    <TH>Category</TH>
                    <TH>Description</TH>
                    <TH right>Status</TH>
                    <TH right>Barter</TH>
                  </tr>
                </thead>
                <tbody>
                  {nonRestricted.map(cat => (
                    <tr
                      key={cat.id}
                      className={`border-b last:border-0 hover:bg-gray-50 transition-colors ${
                        updating === cat.id ? 'opacity-60' : ''
                      }`}
                    >
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-gray-900">{cat.name}</span>
                      </td>
                      <TD>
                        <span className="text-xs text-gray-400">{cat.description || '—'}</span>
                      </TD>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          cat.barter_enabled
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {cat.barter_enabled ? 'Accepts Barter' : 'Cash Only'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {updating === cat.id ? (
                          <Loader2 className="h-4 w-4 animate-spin text-gray-400 inline" />
                        ) : (
                          <Switch
                            checked={cat.barter_enabled}
                            onCheckedChange={() => toggleBarterEnabled(cat.id, cat.barter_enabled, cat.is_restricted)}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
