import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import BackButton from '@/components/ui/BackButton';
import { supabase } from '@/integrations/supabase/client';
import { useProducts } from '@/hooks/useProducts';
import { useProductSync } from '@/hooks/useProductSync';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  RefreshCw, Package, Search, Filter, AlertCircle, ShoppingCart,
  Plus, Loader2, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight,
  TrendingUp, BarChart2, Ban,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useCart } from '@/contexts/CartContext';
import CategorySettings from '@/components/categories/CategorySettings';
import { Progress } from '@/components/ui/progress';

const PAGE_SIZE = 20;

// ─── Helper Components ────────────────────────────────────────────────────────
const StatCard = ({
  icon: Icon, label, value, sub, color = 'emerald',
}: {
  icon: any; label: string; value: string | number; sub?: string; color?: string;
}) => {
  const colors: Record<string, string> = {
    emerald: 'text-emerald-500 bg-emerald-50',
    blue:    'text-blue-500 bg-blue-50',
    amber:   'text-amber-500 bg-amber-50',
    red:     'text-red-500 bg-red-50',
    purple:  'text-purple-500 bg-purple-50',
  };
  const cls = colors[color] || colors.emerald;
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-5">
        <div className={`p-2.5 rounded-xl ${cls} w-fit`}>
          <Icon className={`h-5 w-5 ${cls.split(' ')[0]}`} />
        </div>
        <div className="mt-3">
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-sm text-gray-500 mt-0.5">{label}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
};

const Pill = ({ status }: { status: string }) => {
  const map: Record<string, string> = {
    enabled:  'bg-emerald-100 text-emerald-700',
    disabled: 'bg-red-100 text-red-700',
    instock:  'bg-emerald-100 text-emerald-700',
    low:      'bg-amber-100 text-amber-700',
    outofstock:'bg-red-100 text-red-700',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${map[status] || 'bg-gray-100 text-gray-600'}`}>
      {status.charAt(0).toUpperCase() + status.slice(1).replace(/([a-z])([A-Z])/g, '$1 $2')}
    </span>
  );
};

const TH = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <th className={`px-4 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wide ${right ? 'text-right' : 'text-left'}`}>
    {children}
  </th>
);
const TD = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
  <td className={`px-4 py-3 text-sm text-gray-700 ${right ? 'text-right' : ''}`}>{children}</td>
);

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ProductDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addToCart, cartCount } = useCart();
  const [user, setUser] = useState<any>(null);
  const [posIntegrations, setPosIntegrations] = useState<any[]>([]);
  const [selectedIntegration, setSelectedIntegration] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [barterFilter, setBarterFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const { products, isLoading, refetch, subscribeToProducts } = useProducts(
    selectedIntegration === 'all' ? undefined : selectedIntegration
  );
  const { syncProducts, isSyncing, progress, subscribeToProgress } = useProductSync();

  useEffect(() => {
    if (selectedIntegration && selectedIntegration !== 'all') {
      return subscribeToProgress(selectedIntegration);
    }
  }, [selectedIntegration, subscribeToProgress]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { navigate('/auth'); return; }
      setUser(user);
    });
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('pos_integrations')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setPosIntegrations(data || []);
        if (data && data.length === 1) setSelectedIntegration(data[0].id);
      });
  }, [user]);

  useEffect(() => {
    return subscribeToProducts();
  }, [subscribeToProducts]);

  // Reset to page 1 when filters change
  useEffect(() => { setCurrentPage(1); }, [searchQuery, barterFilter, selectedIntegration]);

  const handleSync = async () => {
    if (selectedIntegration === 'all') {
      toast({ title: 'Select POS System', description: 'Please select a specific POS integration to sync products', variant: 'destructive' });
      return;
    }
    const result = await syncProducts(selectedIntegration);
    if (result.success) refetch();
  };

  // Filter
  const filteredProducts = products.filter(product => {
    const matchesSearch = searchQuery === '' ||
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesBarter = barterFilter === 'all' ||
      (barterFilter === 'enabled' && product.barter_enabled) ||
      (barterFilter === 'disabled' && !product.barter_enabled);
    return matchesSearch && matchesBarter;
  });

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const paginated  = filteredProducts.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Stats
  const stats = {
    total:        products.length,
    barterEnabled: products.filter(p => p.barter_enabled).length,
    restricted:   products.filter(p => !p.barter_enabled && p.category_is_restricted).length,
    outOfStock:   products.filter(p => p.stock_quantity === 0).length,
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        <BackButton />

        {/* ── Header ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Product Inventory</h1>
            <p className="text-sm text-gray-500 mt-1">Manage products synced from your POS systems</p>
          </div>
          {cartCount > 0 && (
            <Button onClick={() => navigate('/checkout')} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shrink-0">
              <ShoppingCart className="h-4 w-4" />
              Checkout ({cartCount} items)
            </Button>
          )}
        </div>

        {/* ── Stat Cards ───────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={Package}    label="Total Products"  value={stats.total}         color="blue"    />
          <StatCard icon={TrendingUp} label="Barter Enabled"  value={stats.barterEnabled} color="emerald" />
          <StatCard icon={Ban}        label="Restricted"      value={stats.restricted}    color="amber"   />
          <StatCard icon={BarChart2}  label="Out of Stock"    value={stats.outOfStock}    color="red"     />
        </div>

        {/* ── No POS Warning ───────────────────────────────────────────────── */}
        {posIntegrations.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-900">No POS Integration Found</p>
              <p className="text-sm text-amber-700 mt-0.5">Connect a POS system (Square, Shopify, etc.) to sync products.</p>
              <Button variant="outline" size="sm" className="mt-3 border-amber-300 text-amber-700 hover:bg-amber-100" onClick={() => navigate('/account-dashboard')}>
                Go to Dashboard
              </Button>
            </div>
          </div>
        )}

        {/* ── Filters & Actions ────────────────────────────────────────────── */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 space-y-4">

            {selectedIntegration === 'all' && posIntegrations.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center gap-2 text-sm text-blue-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Select a specific POS system to sync products
              </div>
            )}

            <div className="flex flex-col md:flex-row gap-3">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 w-full bg-white"
                  placeholder="Search products or SKU…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Barter filter */}
              <Select value={barterFilter} onValueChange={setBarterFilter}>
                <SelectTrigger className="w-full md:w-[160px] bg-white border-gray-200">
                  <Filter className="h-4 w-4 mr-2 text-gray-400" />
                  <SelectValue placeholder="Barter Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  <SelectItem value="enabled">Barter Enabled</SelectItem>
                  <SelectItem value="disabled">Barter Disabled</SelectItem>
                </SelectContent>
              </Select>

              {/* POS selector */}
              <Select value={selectedIntegration} onValueChange={setSelectedIntegration}>
                <SelectTrigger className="w-full md:w-[180px] bg-white border-gray-200">
                  <SelectValue placeholder="Select POS" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All POS Systems</SelectItem>
                  {posIntegrations.map(i => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.provider.charAt(0).toUpperCase() + i.provider.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Sync button */}
              <Button
                onClick={handleSync}
                disabled={isSyncing || selectedIntegration === 'all' || posIntegrations.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shrink-0"
              >
                <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing…' : 'Sync Products'}
              </Button>
            </div>

            {/* Sync progress */}
            {isSyncing && progress && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                    <span className="text-sm font-medium text-blue-900">
                      {progress.status === 'in_progress' ? 'Syncing Products…' : 'Sync Complete'}
                    </span>
                  </div>
                  <span className="text-sm text-blue-700 font-semibold">
                    {progress.total_items > 0 ? `${progress.processed_items}/${progress.total_items}` : 'Initializing…'}
                  </span>
                </div>
                {progress.total_items > 0 && (
                  <Progress value={(progress.processed_items / progress.total_items) * 100} className="h-1.5" />
                )}
                {progress.current_step && <p className="text-xs text-blue-700">{progress.current_step}</p>}
                <div className="flex gap-4 text-xs">
                  <span className="text-emerald-700">Synced: <strong>{progress.synced_items || 0}</strong></span>
                  <span className="text-amber-700">Skipped: <strong>{progress.skipped_items || 0}</strong></span>
                  {progress.error_items > 0 && <span className="text-red-700">Errors: <strong>{progress.error_items}</strong></span>}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Products Table ───────────────────────────────────────────────── */}
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-0 px-6 pt-5">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold text-gray-900">
                Products
                <span className="ml-2 text-sm font-normal text-gray-400">
                  {filteredProducts.length} result{filteredProducts.length !== 1 ? 's' : ''}
                </span>
              </CardTitle>
              {totalPages > 1 && (
                <span className="text-xs text-gray-400">
                  Page {currentPage} of {totalPages}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-16 gap-2 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading products…
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-16">
                <Package className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="font-medium text-gray-500">No products found</p>
                <p className="text-sm text-gray-400 mt-1">
                  {products.length === 0 ? 'Sync products from your POS to get started' : 'Try adjusting your search or filters'}
                </p>
                {products.length === 0 && posIntegrations.length > 0 && (
                  <Button onClick={handleSync} disabled={selectedIntegration === 'all'} className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white">
                    <RefreshCw className="h-4 w-4 mr-2" /> Sync Products
                  </Button>
                )}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[750px]">
                    <thead className="border-y bg-gray-50">
                      <tr>
                        <TH>Product</TH>
                        <TH right>Price</TH>
                        <TH right>Stock</TH>
                        <TH>SKU</TH>
                        <TH>Category</TH>
                        <TH>Barter</TH>
                        <TH>POS</TH>
                        <TH>Last Sync</TH>
                        <TH right>Action</TH>
                      </tr>
                    </thead>
                    <tbody>
                      {paginated.map(product => {
                        const stockStatus = product.stock_quantity === 0 ? 'outofstock'
                          : product.stock_quantity <= 5 ? 'low' : 'instock';
                        return (
                          <tr key={product.id} className="border-b last:border-0 hover:bg-gray-50">
                            {/* Product name + image */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                                  {product.image_url
                                    ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                                    : <Package className="h-4 w-4 text-gray-400" />
                                  }
                                </div>
                                <span className="text-sm font-medium text-gray-900 max-w-[200px] truncate">{product.name}</span>
                              </div>
                            </td>
                            <TD right><span className="font-semibold">${product.price.toFixed(2)}</span></TD>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <span className={`text-sm font-medium ${product.stock_quantity === 0 ? 'text-red-600' : 'text-gray-700'}`}>
                                  {product.stock_quantity}
                                </span>
                                <Pill status={stockStatus} />
                              </div>
                            </td>
                            <TD><span className="font-mono text-xs text-gray-500">{product.sku || '—'}</span></TD>
                            <TD>{product.category_name || 'Uncategorized'}</TD>
                            <td className="px-4 py-3">
                              {product.barter_enabled ? (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                                  {product.effective_barter_percentage}% barter
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                                  <AlertCircle className="h-3 w-3" /> Disabled
                                </span>
                              )}
                            </td>
                            <TD><span className="capitalize text-gray-500">{product.pos_provider || '—'}</span></TD>
                            <TD>
                              <span className="text-xs text-gray-400">
                                {product.last_synced_at ? new Date(product.last_synced_at).toLocaleDateString() : '—'}
                              </span>
                            </TD>
                            <td className="px-4 py-3 text-right">
                              <Button
                                size="sm"
                                disabled={product.stock_quantity === 0}
                                onClick={() => {
                                  addToCart({
                                    id: product.id!,
                                    name: product.name!,
                                    price: product.price!,
                                    barcode: product.barcode || undefined,
                                    sku: product.sku || undefined,
                                    category_name: product.category_name || undefined,
                                    is_barter_eligible: product.barter_enabled ?? true,
                                    restriction_reason: product.category_is_restricted
                                      ? `Restricted category: ${product.category_name}` : undefined,
                                    pos_integration_id: product.pos_integration_id || undefined,
                                    external_product_id: product.external_product_id || undefined,
                                    external_variant_id: product.external_variant_id || undefined,
                                    merchant_id: product.merchant_id!,
                                    merchant_name: product.business_name || 'Unknown',
                                  }, {
                                    id: product.merchant_id!,
                                    business_name: product.business_name || 'Unknown',
                                    location: product.business_location || '',
                                    barter_percentage: product.effective_barter_percentage || 20,
                                  });
                                  toast({ title: 'Added to Cart', description: `${product.name} added to cart` });
                                }}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1"
                              >
                                <Plus className="h-3.5 w-3.5" /> Add
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ── Pagination ─────────────────────────────────────────── */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-gray-500">
                      Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredProducts.length)} of {filteredProducts.length} products
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>

                      {/* Page numbers */}
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                        .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
                          if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((item, idx) =>
                          item === 'ellipsis' ? (
                            <span key={`e-${idx}`} className="px-1 text-gray-400 text-sm">…</span>
                          ) : (
                            <Button
                              key={item}
                              variant={currentPage === item ? 'default' : 'outline'}
                              size="sm"
                              onClick={() => setCurrentPage(item as number)}
                              className={`h-8 w-8 p-0 ${currentPage === item ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600' : ''}`}
                            >
                              {item}
                            </Button>
                          )
                        )}

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="h-8 w-8 p-0"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* ── Category Settings ────────────────────────────────────────────── */}
        <CategorySettings />

      </div>
    </div>
  );
}
