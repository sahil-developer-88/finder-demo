import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MapPin, Star, CheckCircle, MessageSquare, Package, Search, ChevronLeft, Coins, Store, Clock, Send, Smile, CheckCheck, X, Check, ArrowLeft, ShoppingCart, Minus, Plus } from "lucide-react";
import InquiryModal from "@/components/merchant/InquiryModal";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import BusinessReviewSection from "@/components/reviews/BusinessReviewSection";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useMessages } from "@/hooks/useMessages";
import { useAuth } from "@/hooks/useAuth";
import { format } from "date-fns";

// ── Category image map ────────────────────────────────────────────────────────
function getCategoryImage(category: string): string {
  const lower = (category ?? '').toLowerCase();
  const entries: [string, string][] = [
    ['restaurant', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&h=400&fit=crop&q=80'],
    ['cafe',       'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1200&h=400&fit=crop&q=80'],
    ['grocery',    'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&h=400&fit=crop&q=80'],
    ['retail',     'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&h=400&fit=crop&q=80'],
    ['beauty',     'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1200&h=400&fit=crop&q=80'],
    ['mechanic',   'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1200&h=400&fit=crop&q=80'],
    ['health',     'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&h=400&fit=crop&q=80'],
    ['fitness',    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&h=400&fit=crop&q=80'],
    ['lawyer',     'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1200&h=400&fit=crop&q=80'],
    ['tutor',      'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1200&h=400&fit=crop&q=80'],
    ['photo',      'https://images.unsplash.com/photo-1554048612-b6a482bc67e5?w=1200&h=400&fit=crop&q=80'],
  ];
  for (const [key, url] of entries) {
    if (lower.includes(key)) return url;
  }
  return 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=400&fit=crop&q=80';
}

const ListingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { addToCart, merchantInfo, switchMerchant, cartCount, cartTotal } = useCart();

  const { user } = useAuth();
  const { messages, fetchMessages, sendMessage } = useMessages();

  const [isInquiryModalOpen, setIsInquiryModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<string | undefined>(undefined);
  const [drawerService, setDrawerService] = useState<string | null>(null);
  const [switchMerchantPending, setSwitchMerchantPending] = useState<any | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatService, setChatService] = useState<string | null>(null);
  const [chatText, setChatText] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [tradeRequestSent, setTradeRequestSent] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const [business, setBusiness] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [dbServices, setDbServices] = useState<{ id: string; name: string; description: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productSearch, setProductSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeTab, setActiveTab] = useState<'products' | 'services'>('products');
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Fetch business
  useEffect(() => {
    const fetchBusiness = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const { data: businessData, error } = await supabase
          .from('businesses').select('*').eq('id', id).single();
        if (error) throw error;

        const { data: profileData } = await supabase
          .from('profiles').select('business_type').eq('user_id', businessData.user_id).single();

        const btype = profileData?.business_type || 'product';
        setBusiness({ ...businessData, business_type: btype });
        setActiveTab(btype === 'service' ? 'services' : 'products');

        const { data: svcData } = await supabase
          .from('services')
          .select('id, name, description')
          .eq('merchant_id', businessData.user_id)
          .eq('status', 'active')
          .order('created_at');
        setDbServices(svcData ?? []);
      } catch (error: any) {
        toast({ title: "Error", description: "Failed to load business details", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchBusiness();
  }, [id, toast]);

  // Fetch products
  useEffect(() => {
    let isMounted = true;
    const fetchProducts = async () => {
      if (!id) return;
      try {
        setProductsLoading(true);
        let allData: any[] = [];

        const { data: byBusinessId } = await supabase
          .from('products_with_eligibility').select('*')
          .eq('business_id', id).eq('is_active', true).order('name');
        if (byBusinessId) allData = [...allData, ...byBusinessId];

        if (business?.user_id) {
          const { data: byMerchantId } = await supabase
            .from('products_with_eligibility').select('*')
            .eq('merchant_id', business.user_id).eq('is_active', true).order('name');
          if (byMerchantId) allData = [...allData, ...byMerchantId];
        }

        const unique = Array.from(new Map(allData.map(p => [p.id, p])).values());
        if (isMounted) {
          setProducts(unique);
          if (unique.length > 0) setActiveTab('products');
        }
      } catch (error: any) {
        console.error('Error fetching products:', error);
      } finally {
        if (isMounted) setProductsLoading(false);
      }
    };
    fetchProducts();

    const subscription = supabase
      .channel(`products_business_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'products', filter: `business_id=eq.${id}` },
        () => { if (isMounted) fetchProducts(); })
      .subscribe();

    return () => { isMounted = false; subscription.unsubscribe(); };
  }, [id, business?.user_id]);

  const doAddToCart = (product: any) => {
    if (!business) return;
    addToCart({
      id: product.id, name: product.name, price: product.price,
      merchant_id: business.user_id, merchant_name: business.business_name,
      image_url: product.image_url, stock_quantity: product.stock_quantity,
      barcode: product.barcode, sku: product.sku, category_name: product.category_name,
      is_barter_eligible: product.is_barter_eligible, restriction_reason: product.restriction_reason,
      pos_integration_id: product.pos_integration_id, external_product_id: product.external_product_id,
      external_variant_id: product.external_variant_id
    }, { id: business.id, business_name: business.business_name, location: business.location, barter_percentage: business.barter_percentage, tax_rate: business.tax_rate ?? 0.08 });
    toast({ title: "Added to cart", description: `${product.name} added to your cart.` });
  };

  const handleAddToCart = (product: any) => {
    if (!business) return;
    if (merchantInfo && merchantInfo.id !== business.id) {
      setSwitchMerchantPending(product);
      return;
    }
    doAddToCart(product);
  };

  // Derived data
  const categories = ['All', ...Array.from(new Set(products.map(p => p.category_name).filter(Boolean))) as string[]];
  const filteredProducts = products.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(productSearch.toLowerCase());
    const matchCat = activeCategory === 'All' || p.category_name === activeCategory;
    return matchSearch && matchCat;
  });
  const groupedProducts = categories.filter(c => c !== 'All').reduce((acc, cat) => {
    const items = filteredProducts.filter(p => p.category_name === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {} as Record<string, any[]>);
  const uncategorized = filteredProducts.filter(p => !p.category_name);

  const scrollToCategory = (cat: string) => {
    setActiveCategory(cat);
    if (cat === 'All') { window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
    categoryRefs.current[cat]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  // Chat helpers
  const openChat = (service?: string) => {
    if (!user) { navigate('/auth'); return; }
    setChatService(service ?? null);
    setTradeRequestSent(false);
    setChatOpen(true);
    if (business?.user_id) fetchMessages(business.user_id);
    setTimeout(() => chatInputRef.current?.focus(), 150);
  };

  const openTrade = () => {
    if (!user) { navigate('/auth'); return; }
    setChatService(hasServices ? (dbServices[0]?.name ?? null) : null);
    setTradeRequestSent(false);
    setChatOpen(true);
    if (business?.user_id) fetchMessages(business.user_id);
  };

  const handleChatSend = async () => {
    if (!chatText.trim() || !business?.user_id || chatSending) return;
    setChatSending(true);
    await sendMessage(business.user_id, chatText.trim());
    setChatText('');
    setChatSending(false);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const handleSendTradeRequest = async () => {
    if (!business?.user_id || tradeRequestSent) return;
    setTradeRequestSent(true);

    // Save to trade_requests table
    const { data: tradeReq, error } = await supabase.from('trade_requests').insert({
      sender_id: user?.id,
      merchant_id: business.user_id,
      business_id: business.id,
      service_name: chatService,
      barter_percentage: business.barter_percentage,
    }).select().single();

    if (error) {
      setTradeRequestSent(false);
      toast({ title: 'Error', description: 'Failed to send trade request', variant: 'destructive' });
      return;
    }

    // Send chat message
    await sendMessage(business.user_id, `Hi! I've sent a trade request for "${chatService}". Please check your notifications to accept or decline.`);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  const handleTradeResponse = async (msg: any, accepted: boolean) => {
    let parsed: any = {};
    try { parsed = JSON.parse(msg.content); } catch { return; }

    const { error: msgErr } = await supabase.from('messages').update({
      content: JSON.stringify({ ...parsed, status: accepted ? 'accepted' : 'rejected' })
    }).eq('id', msg.id);
    if (msgErr) { toast({ title: 'Failed to update trade status', description: msgErr.message, variant: 'destructive' }); return; }

    if (parsed.senderId) {
      const { error: notifErr } = await supabase.from('notifications').insert({
        user_id: parsed.senderId,
        title: accepted ? 'Trade Request Accepted!' : 'Trade Request Declined',
        message: accepted
          ? `${business.business_name} accepted your request for "${parsed.service}".`
          : `${business.business_name} declined your request for "${parsed.service}".`,
        type: accepted ? 'success' : 'info',
      });
      if (notifErr) console.error('Failed to notify trade requester:', notifErr.message);
    }
  };

  const chatMessages = messages.filter(
    m => (m.sender_id === business?.user_id && m.recipient_id === user?.id) ||
         (m.sender_id === user?.id && m.recipient_id === business?.user_id)
  );

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
    </div>
  );

  if (!business) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Business not found</h2>
        <button onClick={() => navigate('/stores')} className="text-indigo-600 font-semibold hover:underline">Back to Stores</button>
      </div>
    </div>
  );

  const displayServices = dbServices;
  const hasServices = displayServices.length > 0;
  const isProductBusiness = business.business_type !== 'service';
  const showTabs = hasServices && (isProductBusiness || products.length > 0);
  const showServicesSection = showTabs ? activeTab === 'services' : hasServices && !isProductBusiness;
  const showProductsSection = showTabs ? activeTab === 'products' : isProductBusiness;

  return (
    <div className={`min-h-screen bg-gray-50 ${showProductsSection && cartCount > 0 && merchantInfo?.id === business?.id ? 'pb-24' : 'pb-10'}`}>

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <div className="relative w-full h-52 md:h-72 overflow-hidden">
        <img
          src={getCategoryImage(business.category)}
          alt={business.business_name}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-4 left-4 w-9 h-9 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
        >
          <ChevronLeft className="h-5 w-5 text-gray-800" />
        </button>
        {/* Business name overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-4 md:px-8 pb-5">
          <div className="flex items-end justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-white/70 bg-white/20 px-2.5 py-0.5 rounded-full capitalize">{business.category}</span>
                {business.verified && <CheckCircle className="h-4 w-4 text-emerald-400" />}
              </div>
              <h1 className="text-2xl md:text-3xl font-bold text-white leading-tight">{business.business_name}</h1>
              <div className="flex items-center gap-3 mt-1.5 text-white/80 text-sm flex-wrap">
                <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />{Number(business.average_rating || 0).toFixed(1)} ({business.review_count || 0})</span>
                <span>·</span>
                <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{business.location}</span>
                <span>·</span>
                <span className="flex items-center gap-1 text-emerald-400 font-semibold"><Coins className="h-3.5 w-3.5" />{business.barter_percentage}% Barter</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Info strip ────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-4 md:px-8 py-3 flex items-center gap-6 text-sm text-gray-500 overflow-x-auto scrollbar-hide">
        <span className="flex items-center gap-1.5 shrink-0"><Clock className="h-4 w-4" />Member since {new Date(business.created_at).getFullYear()}</span>
        <span className="flex items-center gap-1.5 shrink-0"><Coins className="h-4 w-4 text-emerald-500" />{business.barter_percentage}% barter accepted</span>
        {business.contact_method && <span className="flex items-center gap-1.5 shrink-0"><MessageSquare className="h-4 w-4" />{business.contact_method}</span>}
      </div>

      {/* ── Main layout ───────────────────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 lg:grid lg:grid-cols-3 lg:gap-8">

        {/* ── Left: content ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">

          {/* Description */}
          {business.description && (
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <h2 className="font-bold text-gray-900 mb-2">About</h2>
              <div className="text-gray-600 text-sm leading-relaxed prose prose-sm max-w-none" dangerouslySetInnerHTML={{ __html: business.description }} />
            </div>
          )}

          {/* ── Tabs (only when business has both products and services) ──── */}
          {showTabs && (
            <div className="flex gap-2 border-b border-gray-200 pb-0">
              {(['products', 'services'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-5 py-2.5 text-sm font-semibold capitalize border-b-2 transition-colors -mb-px ${
                    activeTab === tab
                      ? 'border-indigo-600 text-indigo-600'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}

          {/* ── SERVICE: services grid ──────────────────────────────────────── */}
          {showServicesSection && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-bold text-gray-900 text-lg">Services</h2>
                <span className="text-xs text-gray-400">{displayServices.length} available</span>
              </div>
              {displayServices.length === 0 && (
                <div className="text-center py-10 bg-gray-50 rounded-2xl border border-gray-100">
                  <CheckCircle className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-gray-500 font-medium text-sm">No services listed yet</p>
                  <p className="text-xs text-gray-400 mt-1">Contact the business directly for availability</p>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {displayServices.map((service, i) => {
                  const colors = [
                    { bg: 'bg-violet-500', light: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-100' },
                    { bg: 'bg-indigo-500', light: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-100' },
                    { bg: 'bg-pink-500',   light: 'bg-pink-50',   text: 'text-pink-700',   border: 'border-pink-100' },
                    { bg: 'bg-emerald-500',light: 'bg-emerald-50',text: 'text-emerald-700',border: 'border-emerald-100' },
                    { bg: 'bg-amber-500',  light: 'bg-amber-50',  text: 'text-amber-700',  border: 'border-amber-100' },
                    { bg: 'bg-cyan-500',   light: 'bg-cyan-50',   text: 'text-cyan-700',   border: 'border-cyan-100' },
                  ];
                  const c = colors[i % colors.length];
                  return (
                    <button
                      key={service.id}
                      onClick={() => setDrawerService(service.name)}
                      className={`flex flex-col gap-3 p-4 rounded-2xl border ${c.border} ${c.light} hover:shadow-md hover:-translate-y-0.5 transition-all text-left`}
                    >
                      <div className="flex items-start justify-between">
                        <div className={`w-10 h-10 rounded-xl ${c.bg} flex items-center justify-center shrink-0`}>
                          <CheckCircle className="h-5 w-5 text-white" />
                        </div>
                        <span className={`text-[10px] font-bold ${c.text} bg-white px-2 py-0.5 rounded-full border ${c.border}`}>
                          {business.barter_percentage}% Barter
                        </span>
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 text-sm leading-snug">{service.name}</p>
                        {service.description && (
                          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{service.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">
                          {business.barter_percentage}% credits + {100 - (business.barter_percentage ?? 0)}% cash
                        </p>
                      </div>
                      <div className={`w-full py-2 rounded-xl ${c.bg} text-white text-xs font-bold text-center`}>
                        Get Quote →
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Service drawer ─────────────────────────────────────────────────── */}
          <Sheet open={!!drawerService} onOpenChange={open => { if (!open) setDrawerService(null); }}>
            <SheetContent side="right" className="w-full sm:max-w-sm p-0 flex flex-col">

              {/* Header with gradient */}
              <div className="bg-gradient-to-br from-violet-600 to-indigo-600 px-6 pt-8 pb-6">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-4">
                  <CheckCircle className="h-6 w-6 text-white" />
                </div>
                <SheetTitle className="text-xl font-bold text-white leading-tight">{drawerService}</SheetTitle>
                <p className="text-white/70 text-sm mt-1">{business.business_name}</p>
                <div className="flex items-center gap-3 mt-3">
                  <span className="flex items-center gap-1 text-white/80 text-xs">
                    <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" />
                    {Number(business.average_rating || 0).toFixed(1)}
                  </span>
                  {business.location && (
                    <span className="flex items-center gap-1 text-white/80 text-xs">
                      <MapPin className="h-3.5 w-3.5" />
                      {business.location}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">

                {/* Barter breakdown */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-emerald-50 rounded-2xl p-4 text-center border border-emerald-100">
                    <p className="text-2xl font-black text-emerald-600">{business.barter_percentage}%</p>
                    <p className="text-xs text-emerald-600 font-semibold mt-1">Valuehub Exchange Credits</p>
                  </div>
                  <div className="bg-gray-50 rounded-2xl p-4 text-center border border-gray-100">
                    <p className="text-2xl font-black text-gray-700">{100 - (business.barter_percentage ?? 0)}%</p>
                    <p className="text-xs text-gray-500 font-semibold mt-1">Cash Payment</p>
                  </div>
                </div>

                {/* What to expect */}
                <div className="bg-violet-50 rounded-2xl p-4 border border-violet-100">
                  <p className="text-xs font-bold text-violet-700 uppercase tracking-wide mb-2">What to expect</p>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                      Send a quote request with your details
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                      Business responds with pricing & availability
                    </li>
                    <li className="flex items-center gap-2 text-sm text-gray-700">
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-400 shrink-0" />
                      Pay {business.barter_percentage}% with credits + {100 - (business.barter_percentage ?? 0)}% cash
                    </li>
                  </ul>
                </div>

                {/* Service description from DB */}
                {drawerService && dbServices.find(s => s.name === drawerService)?.description && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">About this service</p>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {dbServices.find(s => s.name === drawerService)!.description}
                    </p>
                  </div>
                )}

                {/* About */}
                {business.description && (
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">About the provider</p>
                    <div className="text-sm text-gray-600 leading-relaxed prose prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: business.description }} />
                  </div>
                )}
              </div>

              {/* Sticky CTA */}
              <div className="px-5 py-4 border-t border-gray-100 bg-white">
                <button
                  onClick={() => {
                    const service = drawerService ?? '';
                    setDrawerService(null);
                    openChat(service);
                  }}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all"
                >
                  <MessageSquare className="h-4 w-4" />
                  Chat with Merchant
                </button>
                <p className="text-center text-xs text-gray-400 mt-2">Free to request · No commitment</p>
              </div>
            </SheetContent>
          </Sheet>

          {/* ── PRODUCT: category tabs + product grid ──────────────────────── */}
          {showProductsSection && (
            <div>
              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search products..."
                  value={productSearch}
                  onChange={e => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-gray-200 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
                />
              </div>

              {/* Category tabs */}
              {categories.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-5">
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => scrollToCategory(cat)}
                      className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all ${
                        activeCategory === cat
                          ? 'bg-gray-900 text-white border-gray-900'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              )}

              {productsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 text-center py-16">
                  <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No products found</p>
                  {productSearch && <p className="text-sm text-gray-400 mt-1">Try a different search term</p>}
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Categorized products */}
                  {Object.entries(groupedProducts).map(([cat, items]) => (
                    <div key={cat} ref={el => { categoryRefs.current[cat] = el; }}>
                      <h3 className="font-bold text-gray-900 text-lg mb-3">{cat}</h3>
                      <div className="space-y-3">
                        {items.map(product => (
                          <ProductRow
                            key={product.id}
                            product={product}
                            barterPercentage={business.barter_percentage}
                            onAddToCart={handleAddToCart}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                  {/* Uncategorized */}
                  {uncategorized.length > 0 && (
                    <div>
                      {Object.keys(groupedProducts).length > 0 && <h3 className="font-bold text-gray-900 text-lg mb-3">Other</h3>}
                      <div className="space-y-3">
                        {uncategorized.map(product => (
                          <ProductRow
                            key={product.id}
                            product={product}
                            barterPercentage={business.barter_percentage}
                            onAddToCart={handleAddToCart}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Reviews */}
          <div className="bg-white rounded-2xl p-5 border border-gray-100">
            <BusinessReviewSection businessUserId={business.user_id} businessName={business.business_name} />
          </div>
        </div>

        {/* ── Right: sticky info panel ───────────────────────────────────────── */}
        <div className="hidden lg:block">
          <div className="sticky top-20 space-y-4">
            {/* Barter info */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center">
                  <Store className="h-6 w-6 text-indigo-500" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">{business.business_name}</p>
                  <p className="text-xs text-gray-400">Member since {new Date(business.created_at).getFullYear()}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-emerald-600">{business.barter_percentage}%</p>
                  <p className="text-xs text-emerald-700 font-medium">Barter Rate</p>
                </div>
                <div className="bg-indigo-50 rounded-xl p-3 text-center">
                  <p className="text-xl font-bold text-indigo-600">
                    {showTabs
                      ? (activeTab === 'services' ? displayServices.length : products.length)
                      : (hasServices && !isProductBusiness ? displayServices.length : products.length)}
                  </p>
                  <p className="text-xs text-indigo-700 font-medium">
                    {showTabs
                      ? (activeTab === 'services' ? 'Services' : 'Products')
                      : (hasServices && !isProductBusiness ? 'Services' : 'Products')}
                  </p>
                </div>
              </div>

              <button
                onClick={() => openChat()}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all"
              >
                <MessageSquare className="h-4 w-4" />
                Chat with Merchant
              </button>
              <div className="h-2" />
              <button
                onClick={() => openTrade()}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all"
              >
                <Coins className="h-4 w-4" />
                Start Trade
              </button>
            </div>

            {/* Location */}
            {business.location && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                  {business.location}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile sticky bottom bar ──────────────────────────────────────────── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 px-4 py-3 flex gap-3">
        <button
          onClick={() => openChat()}
          className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all"
        >
          <MessageSquare className="h-4 w-4" />
          Chat
        </button>
        <button
          onClick={() => openTrade()}
          className="flex-1 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all"
        >
          <Coins className="h-4 w-4" />
          Start Trade
        </button>
      </div>

      <InquiryModal
        isOpen={isInquiryModalOpen}
        onClose={() => { setIsInquiryModalOpen(false); setSelectedService(undefined); }}
        merchantName={business.business_name}
        businessName={business.business_name}
        availableServices={business.services_offered || []}
        preselectedService={selectedService}
        pricedItems={[]}
      />

      {/* ── Chat Sheet ──────────────────────────────────────────────────────── */}
      <Sheet open={chatOpen} onOpenChange={open => { if (!open) setChatOpen(false); }}>
        <SheetContent side="right" className="w-full sm:max-w-sm p-0 flex flex-col">

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-[#f0f2f5] border-b border-gray-200 flex-shrink-0">
            <button
              onClick={() => setChatOpen(false)}
              className="p-1 rounded-full hover:bg-gray-200 text-gray-600 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
              style={{ background: '#7C3AED' }}
            >
              {business.business_name.slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-[15px] text-gray-900 truncate">{business.business_name}</p>
              {chatService && <p className="text-[11px] text-violet-600 font-medium truncate">Re: {chatService}</p>}
            </div>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
            style={{ background: '#efeae2' }}
          >
            {chatMessages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="bg-[#fffbeb] text-[#9b7e3c] text-[13px] px-4 py-2 rounded-lg shadow-sm font-medium text-center">
                  🔒 Start a conversation with {business.business_name}
                </div>
              </div>
            ) : (
              <>
                {chatMessages.map((msg) => {
                  const isMine = msg.sender_id === user?.id;

                  // Trade request card
                  if (msg.message_type === 'system') {
                    let parsed: any = {};
                    try { parsed = JSON.parse(msg.content); } catch { /* skip */ }
                    if (parsed.type === 'trade_request') {
                      const status: string | undefined = parsed.status;
                      const isRecipient = msg.recipient_id === user?.id;
                      return (
                        <div key={msg.id} className="flex justify-center my-3">
                          <div className="bg-white rounded-2xl border border-violet-200 shadow-sm p-4 w-64">
                            <div className="flex items-center gap-2 mb-2">
                              <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                                <Coins className="h-3.5 w-3.5 text-violet-600" />
                              </div>
                              <p className="text-xs font-bold text-violet-700 uppercase tracking-wide">Trade Request</p>
                            </div>
                            <p className="text-sm font-semibold text-gray-900 mb-0.5">{parsed.service}</p>
                            <p className="text-xs text-gray-500 mb-3">{parsed.barter}% Credits + {100 - (parsed.barter ?? 0)}% Cash</p>
                            {!status && isRecipient && (
                              <div className="flex gap-2">
                                <button onClick={() => handleTradeResponse(msg, true)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-colors">
                                  <Check className="h-3 w-3" /> Accept
                                </button>
                                <button onClick={() => handleTradeResponse(msg, false)} className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold transition-colors">
                                  <X className="h-3 w-3" /> Decline
                                </button>
                              </div>
                            )}
                            {status === 'accepted' && <div className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold"><Check className="h-3 w-3" /> Accepted</div>}
                            {status === 'rejected' && <div className="flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-gray-50 text-gray-500 text-xs font-bold"><X className="h-3 w-3" /> Declined</div>}
                          </div>
                        </div>
                      );
                    }
                  }

                  return (
                    <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'} mb-1`}>
                      <div
                        className="relative max-w-[80%] px-3 pt-1.5 pb-1 shadow-sm rounded-2xl"
                        style={{ background: isMine ? '#dcf8c6' : '#ffffff' }}
                      >
                        <p className="text-[14px] text-gray-900 leading-snug break-words pr-8">{msg.content}</p>
                        <div className="flex items-center justify-end gap-1 mt-0.5">
                          <span className="text-[10px] text-gray-400">{format(new Date(msg.created_at), 'h:mm a')}</span>
                          {isMine && <CheckCheck className={`h-3.5 w-3.5 ${msg.read ? 'text-[#53bdeb]' : 'text-gray-400'}`} />}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </>
            )}
          </div>

          {/* Trade request banner */}
          {chatService && !tradeRequestSent && (
            <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-violet-50 border-t border-violet-100 flex-shrink-0">
              <div className="min-w-0">
                <p className="text-xs font-bold text-violet-700 truncate">{chatService}</p>
                <p className="text-[11px] text-violet-500">{business.barter_percentage}% credits + {100 - business.barter_percentage}% cash</p>
              </div>
              <button
                onClick={handleSendTradeRequest}
                disabled={chatSending}
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold transition-colors disabled:opacity-60"
              >
                <Coins className="h-3.5 w-3.5" />
                Send Trade Request
              </button>
            </div>
          )}

          {/* Input */}
          <div className="flex items-center gap-2 px-3 py-2 bg-[#f0f2f5] border-t border-gray-200 flex-shrink-0">
            <input
              ref={chatInputRef}
              value={chatText}
              onChange={e => setChatText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
              placeholder="Type a message"
              className="flex-1 rounded-full bg-white border-0 text-[15px] px-5 h-11 outline-none shadow-sm"
              disabled={chatSending}
            />
            <button
              onClick={handleChatSend}
              disabled={!chatText.trim() || chatSending}
              className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40"
              style={{ background: '#059669' }}
            >
              {chatSending ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Send className="h-5 w-5 text-white" style={{ transform: 'translateX(1px)' }} />}
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Switch merchant confirmation dialog (products only) ────────────── */}
      <AlertDialog open={!!switchMerchantPending} onOpenChange={open => { if (!open) setSwitchMerchantPending(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace your cart?</AlertDialogTitle>
            <AlertDialogDescription>
              Your cart has items from <strong>{merchantInfo?.business_name}</strong>. Adding from <strong>{business?.business_name}</strong> will clear your current cart.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSwitchMerchantPending(null)}>Keep current cart</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              switchMerchant(business!.id);
              doAddToCart(switchMerchantPending);
              setSwitchMerchantPending(null);
            }}>
              Start new cart
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Sticky bottom cart bar (products only) ────────────────────────── */}
      {showProductsSection && cartCount > 0 && merchantInfo?.id === business?.id && (
        <div className="fixed bottom-0 left-0 right-0 z-40 px-4 py-3 bg-white border-t border-gray-100 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
          <button
            onClick={() => navigate('/checkout')}
            className="w-full max-w-lg mx-auto flex items-center justify-between bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-2xl px-5 py-3.5 transition-colors"
          >
            <span className="min-w-[26px] h-[26px] bg-indigo-500 rounded-full flex items-center justify-center text-xs font-bold">{cartCount}</span>
            <span className="font-bold flex items-center gap-2"><ShoppingCart className="h-4 w-4" />View Cart</span>
            <span className="font-bold">${cartTotal.toFixed(2)}</span>
          </button>
        </div>
      )}
    </div>
  );
};

// ── Product row (Uber Eats style) ─────────────────────────────────────────────
const ProductRow = ({ product, barterPercentage, onAddToCart }: { product: any; barterPercentage: number; onAddToCart: (p: any) => void }) => {
  const navigate = useNavigate();
  const { cart, updateQuantity, removeFromCart } = useCart();
  const cartItem = cart.find(item => item.id === product.id);
  const qty = cartItem?.quantity ?? 0;
  const barterAmount = product.is_barter_eligible ? (product.price * barterPercentage / 100) : 0;
  const cashAmount = product.price - barterAmount;
  const outOfStock = product.stock_quantity === 0;

  return (
    <div
      onClick={() => navigate(`/product/${product.id}`)}
      className="bg-white rounded-2xl border border-gray-100 p-4 flex gap-4 hover:shadow-md hover:border-indigo-100 transition-all cursor-pointer"
    >
      {/* Image */}
      <div className="w-24 h-24 rounded-xl overflow-hidden bg-gray-100 shrink-0 relative">
        {product.image_url
          ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><Package className="h-8 w-8 text-gray-300" /></div>
        }
        {qty > 0 && (
          <span className="absolute top-1 right-1 w-5 h-5 bg-indigo-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">{qty}</span>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-gray-900 text-sm">{product.name}</h4>
        {product.description && (
          <div className="text-xs text-gray-400 mt-0.5 line-clamp-2 prose prose-xs max-w-none" dangerouslySetInnerHTML={{ __html: product.description }} />
        )}
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <span className="font-bold text-gray-900">${Number(product.price).toFixed(2)}</span>
          {product.is_barter_eligible ? (
            <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">
              ${barterAmount.toFixed(2)} credits + ${cashAmount.toFixed(2)} cash
            </span>
          ) : (
            <span className="text-xs text-red-500 bg-red-50 px-2 py-0.5 rounded-full">Cash only</span>
          )}
        </div>
        {outOfStock && <span className="text-xs text-red-500 mt-1 block">Out of stock</span>}
      </div>

      {/* Quantity controls */}
      <div className="shrink-0 flex items-center" onClick={e => e.stopPropagation()}>
        {qty > 0 ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => qty === 1 ? removeFromCart(product.id) : updateQuantity(product.id, qty - 1)}
              className="w-8 h-8 rounded-full bg-indigo-100 hover:bg-indigo-200 text-indigo-700 flex items-center justify-center transition-colors"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-5 text-center font-bold text-sm text-gray-900">{qty}</span>
            <button
              disabled={outOfStock || (product.stock_quantity !== undefined && qty >= product.stock_quantity)}
              onClick={() => onAddToCart(product)}
              className="w-8 h-8 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center disabled:opacity-40 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            disabled={outOfStock}
            onClick={() => onAddToCart(product)}
            className="w-9 h-9 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center font-bold text-xl disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ListingDetail;
