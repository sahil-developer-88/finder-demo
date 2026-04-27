import React, { useState, useEffect } from 'react';
import { X, Plus, Loader2, Store, Tag, MapPin, Phone, FileText, Percent, Package, DollarSign, Image, Zap, ArrowRight, ShoppingBag, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { BUSINESS_CATEGORIES } from '@/config/businessCategories';

interface Props {
  onClose: () => void;
  onCreated: () => void;
  defaultBusinessType?: string | null;
  defaultTab?: 'product' | 'service';
}

const CONTACT_METHODS = ['Phone', 'Email', 'WhatsApp', 'In-Person', 'Website'];

const NewListingModal = ({ onClose, onCreated, defaultBusinessType, defaultTab }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isBoth = defaultBusinessType === 'both';

  // If no type is pre-determined, show a type selector first
  const needsTypeSelection = !defaultBusinessType || defaultBusinessType === 'both';
  const [selectedType, setSelectedType] = useState<'product' | 'service' | null>(
    defaultTab ?? (defaultBusinessType === 'product' ? 'product' : defaultBusinessType === 'service' ? 'service' : null)
  );
  const [showTypeSelector, setShowTypeSelector] = useState(needsTypeSelection && !selectedType);

  const [activeTab, setActiveTab] = useState<'product' | 'service'>(
    defaultTab ?? (defaultBusinessType === 'product' ? 'product' : 'service')
  );
  const isProduct = selectedType ? selectedType === 'product' : (isBoth ? activeTab === 'product' : defaultBusinessType === 'product');

  const categories = BUSINESS_CATEGORIES.filter(c =>
    defaultBusinessType && !isBoth ? c.type === defaultBusinessType : true
  );

  // ── POS integrations (for product businesses) ─────────────────────────────────
  const [posIntegrations, setPosIntegrations] = useState<{ id: string; provider: string }[]>([]);
  const [posLoading, setPosLoading] = useState(false);

  useEffect(() => {
    if (!isProduct || !user) return;
    setPosLoading(true);
    supabase.from('pos_integrations')
      .select('id, provider')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .then(({ data }) => { setPosIntegrations(data ?? []); setPosLoading(false); });
  }, [isProduct, user]);

  // ── Service form state ────────────────────────────────────────────────────────
  const [serviceForm, setServiceForm] = useState({
    business_name: '',
    category: '',
    description: '',
    location: '',
    contact_method: '',
    barter_percentage: '',
    services_offered: [] as string[],
  });
  const [serviceInput, setServiceInput] = useState('');

  // ── Product form state ────────────────────────────────────────────────────────
  const [productForm, setProductForm] = useState({
    name: '',
    category_label: '',
    description: '',
    price: '',
    stock: '',
    image_url: '',
    barter_percentage: '',
    pos_integration_id: '',
    product_type: 'REGULAR',
  });

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setS = (key: string, value: string) => {
    setServiceForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: '' }));
  };
  const setP = (key: string, value: string) => {
    setProductForm(f => ({ ...f, [key]: value }));
    setErrors(e => ({ ...e, [key]: '' }));
  };

  const addService = () => {
    const val = serviceInput.trim();
    if (!val || serviceForm.services_offered.includes(val)) return;
    setServiceForm(f => ({ ...f, services_offered: [...f.services_offered, val] }));
    setServiceInput('');
  };
  const removeService = (s: string) =>
    setServiceForm(f => ({ ...f, services_offered: f.services_offered.filter(x => x !== s) }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (isProduct) {
      if (!productForm.name.trim()) e.name = 'Required';
      if (!productForm.description.trim()) e.description = 'Required';
      if (!productForm.price) e.price = 'Required';
      if (!productForm.pos_integration_id) e.pos_integration_id = 'Select a POS system';
    } else {
      if (!serviceForm.business_name.trim()) e.business_name = 'Required';
      if (!serviceForm.category) e.category = 'Required';
      if (!serviceForm.description.trim()) e.description = 'Required';
      if (!serviceForm.location.trim()) e.location = 'Required';
      if (!serviceForm.contact_method) e.contact_method = 'Required';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !user) return;
    setSubmitting(true);

    if (isProduct) {
      // Call edge function — creates product in POS AND saves locally
      const res = await supabase.functions.invoke('pos-create-product', {
        body: {
          pos_integration_id: productForm.pos_integration_id,
          name: productForm.name.trim(),
          description: productForm.description.trim() || null,
          price: Number(productForm.price),
          stock_quantity: productForm.stock ? Number(productForm.stock) : null,
          image_url: productForm.image_url.trim() || null,
          barter_percentage: productForm.barter_percentage ? Number(productForm.barter_percentage) : null,
          product_type: productForm.product_type,
        },
      });

      setSubmitting(false);
      if (res.error || res.data?.error) {
        toast({ title: 'Failed to add product', description: res.error?.message || res.data?.error, variant: 'destructive' });
        return;
      }
      toast({ title: 'Product added!', description: 'Your product has been created in your POS and listed here.' });
    } else {
      // Insert into businesses table
      const { error } = await supabase.from('businesses').insert({
        user_id: user.id,
        business_name: serviceForm.business_name.trim(),
        category: serviceForm.category,
        description: serviceForm.description.trim(),
        location: serviceForm.location.trim(),
        contact_method: serviceForm.contact_method,
        barter_percentage: serviceForm.barter_percentage ? Number(serviceForm.barter_percentage) : null,
        services_offered: serviceForm.services_offered,
        business_type: 'service',
        status: 'pending',
      });

      setSubmitting(false);
      if (error) { toast({ title: 'Failed to create listing', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Service listed!', description: 'Your listing will appear once approved by admin.' });
    }

    onCreated();
    onClose();
  };

  // Type selector screen
  if (showTypeSelector) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-indigo-950 to-violet-950">
            <div>
              <p className="text-base font-bold text-white">Create a New Listing</p>
              <p className="text-xs text-indigo-300 mt-0.5">What would you like to list?</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-indigo-300 hover:text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Type cards */}
          <div className="p-6 space-y-3">
            <button
              onClick={() => { setSelectedType('service'); setShowTypeSelector(false); setActiveTab('service'); }}
              className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-gray-100 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group text-left"
            >
              <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center shrink-0 group-hover:bg-indigo-200 transition-colors">
                <Wrench className="h-7 w-7 text-indigo-600" />
              </div>
              <div className="flex-1">
                <p className="text-base font-bold text-gray-900">I offer a Service</p>
                <p className="text-sm text-gray-500 mt-0.5">List a skill, trade, or professional service you provide</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {['Plumbing', 'Design', 'Tutoring', 'Consulting'].map(tag => (
                    <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">{tag}</span>
                  ))}
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-indigo-500 transition-colors shrink-0" />
            </button>

            <button
              onClick={() => { setSelectedType('product'); setShowTypeSelector(false); setActiveTab('product'); }}
              className="w-full flex items-center gap-4 p-5 rounded-2xl border-2 border-gray-100 hover:border-emerald-300 hover:bg-emerald-50/30 transition-all group text-left"
            >
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center shrink-0 group-hover:bg-emerald-200 transition-colors">
                <ShoppingBag className="h-7 w-7 text-emerald-600" />
              </div>
              <div className="flex-1">
                <p className="text-base font-bold text-gray-900">I sell a Product</p>
                <p className="text-sm text-gray-500 mt-0.5">Add a physical or digital product via your POS system</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {['Handmade', 'Clothing', 'Electronics', 'Food'].map(tag => (
                    <span key={tag} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">{tag}</span>
                  ))}
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-emerald-500 transition-colors shrink-0" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 bg-gradient-to-r from-indigo-950 to-violet-950 shrink-0">
          <div className="flex items-center gap-3">
            {needsTypeSelection && (
              <button
                onClick={() => setShowTypeSelector(true)}
                className="p-1.5 rounded-lg hover:bg-white/10 text-indigo-300 hover:text-white transition-colors mr-1"
                title="Back to type selection"
              >
                <ArrowRight className="h-4 w-4 rotate-180" />
              </button>
            )}
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              {isProduct ? <ShoppingBag className="h-4 w-4 text-indigo-300" /> : <Wrench className="h-4 w-4 text-indigo-300" />}
            </div>
            <div>
              <p className="text-sm font-bold text-white">{isProduct ? 'Add Product' : 'Add Service'}</p>
              <p className="text-xs text-indigo-300">{isProduct ? 'Add a product to your connected POS' : 'List a service you offer'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/10 text-indigo-300 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab switcher for 'both' type */}
        {isBoth && !selectedType && (
          <div className="flex gap-1 px-6 py-3 bg-gray-50 border-b border-gray-100 shrink-0">
            <button
              onClick={() => { setActiveTab('service'); setErrors({}); }}
              className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold transition-all ${activeTab === 'service' ? 'bg-white text-indigo-700 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Store className="h-3.5 w-3.5" /> Add Service
            </button>
            <button
              onClick={() => { setActiveTab('product'); setErrors({}); }}
              className={`flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold transition-all ${activeTab === 'product' ? 'bg-white text-indigo-700 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Package className="h-3.5 w-3.5" /> Add Product
            </button>
          </div>
        )}

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* ── PRODUCT FORM ── */}
          {isProduct && (
            <>
              {/* POS selector */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
                  <Zap className="h-3.5 w-3.5 text-emerald-500" /> POS System <span className="text-red-400">*</span>
                </label>
                {posLoading ? (
                  <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading connected systems...
                  </div>
                ) : posIntegrations.length === 0 ? (
                  <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                    <Zap className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-amber-800">No POS connected</p>
                      <p className="text-xs text-amber-600 mt-0.5">Connect a POS system in Profile → Integrations to add products.</p>
                      {(isBoth || needsTypeSelection) && (
                        <button
                          onClick={() => { setSelectedType('service'); setActiveTab('service'); setErrors({}); }}
                          className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 underline"
                        >
                          Add a service listing instead →
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {posIntegrations.map(pos => (
                      <button key={pos.id}
                        onClick={() => setP('pos_integration_id', pos.id)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                          productForm.pos_integration_id === pos.id
                            ? 'border-emerald-400 bg-emerald-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}>
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                          productForm.pos_integration_id === pos.id ? 'bg-emerald-500' : 'bg-gray-100'
                        }`}>
                          <Zap className={`h-4 w-4 ${productForm.pos_integration_id === pos.id ? 'text-white' : 'text-gray-400'}`} />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 capitalize">{pos.provider}</p>
                          <p className="text-xs text-gray-400">Connected</p>
                        </div>
                        {productForm.pos_integration_id === pos.id && (
                          <span className="ml-auto text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">Selected</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {errors.pos_integration_id && <p className="text-xs text-red-500 mt-1">{errors.pos_integration_id}</p>}
              </div>

              {/* Product Type */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
                  <Tag className="h-3.5 w-3.5 text-indigo-400" /> Product Type <span className="text-red-400">*</span>
                </label>
                <select
                  value={productForm.product_type}
                  onChange={e => setP('product_type', e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30"
                >
                  <option value="REGULAR">Regular</option>
                  <option value="APPOINTMENTS_SERVICE">Appointments Service</option>
                  <option value="GIFT_CARD">Gift Card</option>
                </select>
              </div>

              {/* Product Name */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
                  <Package className="h-3.5 w-3.5 text-indigo-400" /> Product Name <span className="text-red-400">*</span>
                </label>
                <Input value={productForm.name} onChange={e => setP('name', e.target.value)}
                  placeholder="e.g. Handmade Leather Bag"
                  className={`h-10 text-sm ${errors.name ? 'border-red-400' : 'border-gray-200'}`} />
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
                  <FileText className="h-3.5 w-3.5 text-indigo-400" /> Description <span className="text-red-400">*</span>
                </label>
                <Textarea value={productForm.description} onChange={e => setP('description', e.target.value)}
                  placeholder="Describe your product — material, size, condition..."
                  rows={3} className={`text-sm resize-none ${errors.description ? 'border-red-400' : 'border-gray-200'}`} />
                {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
              </div>

              {/* Price + Stock */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-indigo-400" /> Price <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                    <Input value={productForm.price} onChange={e => setP('price', e.target.value)}
                      placeholder="0.00" type="number" min="0" step="0.01"
                      className={`h-10 text-sm pl-7 ${errors.price ? 'border-red-400' : 'border-gray-200'}`} />
                  </div>
                  {errors.price && <p className="text-xs text-red-500 mt-1">{errors.price}</p>}
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
                    <Package className="h-3.5 w-3.5 text-indigo-400" /> Stock Qty
                  </label>
                  <Input value={productForm.stock} onChange={e => setP('stock', e.target.value)}
                    placeholder="e.g. 10" type="number" min="0"
                    className="h-10 text-sm border-gray-200" />
                </div>
              </div>

              {/* Image URL */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
                  <Image className="h-3.5 w-3.5 text-indigo-400" /> Image URL <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <Input value={productForm.image_url} onChange={e => setP('image_url', e.target.value)}
                  placeholder="https://..." className="h-10 text-sm border-gray-200" />
              </div>

              {/* Barter % */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
                  <Percent className="h-3.5 w-3.5 text-indigo-400" /> Barter Percentage <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="flex gap-2">
                  {['25', '50', '75', '100'].map(v => (
                    <button key={v}
                      onClick={() => setP('barter_percentage', productForm.barter_percentage === v ? '' : v)}
                      className={`flex-1 h-10 rounded-lg text-sm font-semibold border transition-all ${
                        productForm.barter_percentage === v
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                      }`}>
                      {v}%
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ── SERVICE FORM ── */}
          {!isProduct && (
            <>
              {/* Name */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
                  <Store className="h-3.5 w-3.5 text-indigo-400" /> Listing Name <span className="text-red-400">*</span>
                </label>
                <Input value={serviceForm.business_name} onChange={e => setS('business_name', e.target.value)}
                  placeholder="e.g. John's Plumbing Services"
                  className={`h-10 text-sm ${errors.business_name ? 'border-red-400' : 'border-gray-200'}`} />
                {errors.business_name && <p className="text-xs text-red-500 mt-1">{errors.business_name}</p>}
              </div>

              {/* Category */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
                  <Tag className="h-3.5 w-3.5 text-indigo-400" /> Category <span className="text-red-400">*</span>
                </label>
                <select value={serviceForm.category} onChange={e => setS('category', e.target.value)}
                  className={`w-full h-10 px-3 rounded-lg border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30 ${errors.category ? 'border-red-400' : 'border-gray-200'}`}>
                  <option value="">Select a category...</option>
                  {categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                {errors.category && <p className="text-xs text-red-500 mt-1">{errors.category}</p>}
              </div>

              {/* Description */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
                  <FileText className="h-3.5 w-3.5 text-indigo-400" /> Description <span className="text-red-400">*</span>
                </label>
                <Textarea value={serviceForm.description} onChange={e => setS('description', e.target.value)}
                  placeholder="Describe what you offer, your experience, pricing..."
                  rows={3} className={`text-sm resize-none ${errors.description ? 'border-red-400' : 'border-gray-200'}`} />
                {errors.description && <p className="text-xs text-red-500 mt-1">{errors.description}</p>}
              </div>

              {/* Services tags */}
              <div>
                <label className="text-xs font-semibold text-gray-700 mb-1.5 block">Services Offered</label>
                <div className="flex gap-2">
                  <Input value={serviceInput} onChange={e => setServiceInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addService())}
                    placeholder="e.g. Pipe repair, Installation..."
                    className="h-10 text-sm border-gray-200 flex-1" />
                  <button onClick={addService}
                    className="px-3 h-10 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 transition-colors text-xs font-semibold shrink-0">
                    Add
                  </button>
                </div>
                {serviceForm.services_offered.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {serviceForm.services_offered.map(s => (
                      <span key={s} className="flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-full">
                        {s}
                        <button onClick={() => removeService(s)} className="hover:text-red-500 transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Location + Contact */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
                    <MapPin className="h-3.5 w-3.5 text-indigo-400" /> Location <span className="text-red-400">*</span>
                  </label>
                  <Input value={serviceForm.location} onChange={e => setS('location', e.target.value)}
                    placeholder="City, State"
                    className={`h-10 text-sm ${errors.location ? 'border-red-400' : 'border-gray-200'}`} />
                  {errors.location && <p className="text-xs text-red-500 mt-1">{errors.location}</p>}
                </div>
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
                    <Phone className="h-3.5 w-3.5 text-indigo-400" /> Contact <span className="text-red-400">*</span>
                  </label>
                  <select value={serviceForm.contact_method} onChange={e => setS('contact_method', e.target.value)}
                    className={`w-full h-10 px-3 rounded-lg border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400/30 ${errors.contact_method ? 'border-red-400' : 'border-gray-200'}`}>
                    <option value="">Select...</option>
                    {CONTACT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                  {errors.contact_method && <p className="text-xs text-red-500 mt-1">{errors.contact_method}</p>}
                </div>
              </div>

              {/* Barter % */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 mb-1.5">
                  <Percent className="h-3.5 w-3.5 text-indigo-400" /> Barter Percentage <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="flex gap-2">
                  {['25', '50', '75', '100'].map(v => (
                    <button key={v}
                      onClick={() => setS('barter_percentage', serviceForm.barter_percentage === v ? '' : v)}
                      className={`flex-1 h-10 rounded-lg text-sm font-semibold border transition-all ${
                        serviceForm.barter_percentage === v
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                      }`}>
                      {v}%
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 shrink-0 bg-gray-50">
          <button onClick={onClose}
            className="flex-1 h-10 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <Button onClick={handleSubmit}
            disabled={submitting || (isProduct && posIntegrations.length === 0)}
            className="flex-1 h-10 bg-gradient-to-r from-indigo-600 to-violet-700 hover:from-indigo-700 hover:to-violet-800 text-white font-semibold rounded-xl disabled:opacity-50">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            {submitting ? 'Creating...' : isProduct ? 'Add Product' : 'Add Service'}
          </Button>
        </div>

      </div>
    </div>
  );
};

export default NewListingModal;
