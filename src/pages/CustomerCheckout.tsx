import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Package, CreditCard, Store, ChevronDown, ChevronUp, Zap, Clock, Calendar, Pencil, Check } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import PendingApprovalModal from '@/components/ui/PendingApprovalModal';

const PICKUP_OPTIONS = [
  { id: 'asap',     label: 'ASAP',     sublabel: 'Ready in ~15 min · Fastest',  icon: Zap,      minutes: 15,  extra: '' },
  { id: 'standard', label: 'Standard', sublabel: 'Ready in ~30 min',             icon: Clock,    minutes: 30,  extra: '' },
  { id: 'schedule', label: 'Schedule', sublabel: 'Choose a time',                icon: Calendar, minutes: 60,  extra: 'Up to $2.00 off' },
];

const CustomerCheckout = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { cart, merchantInfo, cartTotal, clearCart, deliveryFee, serviceFee } = useCart();

  const [loading, setLoading] = useState(false);
  const [redirectingToPOS, setRedirectingToPOS] = useState(false);
  const [pendingModalOpen, setPendingModalOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [editingInfo, setEditingInfo] = useState(false);
  const [selectedPickup, setSelectedPickup] = useState('standard');

  const [fulfillmentMethod, setFulfillmentMethod] = useState<'pickup' | 'delivery'>('pickup');
  const [customerDetails, setCustomerDetails] = useState({ name: '', email: '', phone: '', notes: '' });
  const [deliveryAddress, setDeliveryAddress] = useState({ address: '', city: '', state: '', zip: '' });

  // ── Fetch profile + credits ──────────────────────────────────────────────
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const [{ data: profile }, { data: credits }] = await Promise.all([
        supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('user_credits').select('available_credits').eq('user_id', user.id).maybeSingle(),
      ]);
      setUserProfile({ ...(profile || {}), barter_credits: credits?.available_credits || 0 });
      setCustomerDetails({
        name: profile?.full_name || '',
        email: user.email || '',
        phone: profile?.phone || '',
        notes: '',
      });
      setDeliveryAddress({
        address: profile?.delivery_address || '',
        city:    profile?.delivery_city    || '',
        state:   profile?.delivery_state   || '',
        zip:     profile?.delivery_zip     || '',
      });
    };
    fetchProfile();
  }, [user]);

  // ── Redirect if cart empty ───────────────────────────────────────────────
  useEffect(() => {
    if (cart.length === 0 && !loading && !redirectingToPOS) {
      navigate('/');
    }
  }, [cart, loading, redirectingToPOS, navigate]);

  // ── Calculations ─────────────────────────────────────────────────────────
  const eligibleSubtotal = cart.reduce((s, i) => s + (i.is_barter_eligible ? i.price * i.quantity : 0), 0);
  const restrictedSubtotal = cart.reduce((s, i) => s + (!i.is_barter_eligible ? i.price * i.quantity : 0), 0);
  const barterPercentage = merchantInfo?.barter_percentage || 0;
  const maxBarter = (eligibleSubtotal * barterPercentage) / 100;
  const userCredits = userProfile?.barter_credits || 0;
  const barterAmount = Math.min(maxBarter, userCredits);
  const cashSubtotal = cartTotal - barterAmount;
  const taxRate = merchantInfo?.tax_rate ?? 0.08;
  const taxAmount = cashSubtotal * taxRate;
  const totalAmount = cashSubtotal + taxAmount + (fulfillmentMethod === 'delivery' ? deliveryFee : 0) + serviceFee;
  const pickupMinutes = PICKUP_OPTIONS.find(o => o.id === selectedPickup)?.minutes ?? 30;

  // ── Place order ──────────────────────────────────────────────────────────
  const handlePlaceOrder = async () => {
    if (!user || !merchantInfo) return;

    // Block pending accounts from placing orders
    const { data: biz } = await supabase.from('businesses').select('status').eq('user_id', user.id).maybeSingle();
    if (biz?.status === 'pending') {
      setPendingModalOpen(true);
      return;
    }

    if (!customerDetails.name || !customerDetails.email) {
      toast({ title: 'Missing info', description: 'Please fill in your name and email.', variant: 'destructive' });
      setEditingInfo(true);
      return;
    }
    if (fulfillmentMethod === 'delivery' && (!deliveryAddress.address || !deliveryAddress.city || !deliveryAddress.state || !deliveryAddress.zip)) {
      toast({ title: 'Missing delivery address', description: 'Please fill in your full delivery address.', variant: 'destructive' });
      setEditingInfo(true);
      return;
    }

    setLoading(true);
    try {
      const { data: business, error: bErr } = await supabase
        .from('businesses').select('user_id').eq('id', merchantInfo.id).single();
      if (bErr) throw bErr;

      // Save delivery address to profile for next time
      await supabase.from('profiles').update({
        delivery_address: deliveryAddress.address,
        delivery_city:    deliveryAddress.city,
        delivery_state:   deliveryAddress.state,
        delivery_zip:     deliveryAddress.zip,
      }).eq('user_id', user.id);

      const orderData = {
        fulfillment_method: fulfillmentMethod,
        subtotal: cartTotal,
        eligible_subtotal: eligibleSubtotal,
        restricted_subtotal: restrictedSubtotal,
        barter_amount: barterAmount,
        barter_percentage: barterPercentage,
        cash_amount: cashSubtotal,
        delivery_fee: deliveryFee,
        service_fee: serviceFee,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        customer_name: customerDetails.name,
        customer_email: customerDetails.email,
        customer_phone: customerDetails.phone,
        pickup_location: merchantInfo.location,
        estimated_pickup_time: new Date(Date.now() + pickupMinutes * 60000).toISOString(),
        customer_notes: customerDetails.notes,
        delivery_address: deliveryAddress.address,
        delivery_city:    deliveryAddress.city,
        delivery_state:   deliveryAddress.state,
        delivery_zip:     deliveryAddress.zip,
      };

      const orderItems = cart.map(item => ({
        product_id: item.id,
        product_name: item.name,
        product_sku: item.sku,
        product_barcode: item.barcode,
        unit_price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity,
        is_barter_eligible: item.is_barter_eligible,
        restriction_reason: item.restriction_reason,
        category_name: item.category_name,
        external_product_id: item.external_product_id || null,
        external_variant_id: item.external_variant_id || null,
      }));

      const { data: allIntegrations } = await supabase
        .from('pos_integrations').select('id, provider, status, config')
        .eq('user_id', business.user_id).eq('status', 'active');

      let posIntegration: any = null;
      if (allIntegrations?.length) {
        const cartIntegrationId = cart.find(i => i.pos_integration_id)?.pos_integration_id;
        if (cartIntegrationId) {
          posIntegration = allIntegrations.find(i => i.id === cartIntegrationId);
          if (!posIntegration) {
            const { data: oldRow } = await supabase.from('pos_integrations')
              .select('provider, config').eq('id', cartIntegrationId).maybeSingle();
            if (oldRow?.provider) {
              const oldMode = (oldRow.config as any)?.lightspeed_mode || null;
              posIntegration = allIntegrations.find(i => {
                if (i.provider !== oldRow.provider) return false;
                if (oldRow.provider === 'lightspeed') return ((i.config as any)?.lightspeed_mode || null) === oldMode;
                return true;
              }) || null;
            }
          }
        }
        if (!posIntegration) posIntegration = allIntegrations[0];
      }

      if (!posIntegration) {
        toast({ title: 'Ordering not available', description: 'This merchant has not set up online ordering yet.', variant: 'destructive' });
        return;
      }

      const { data: orderId, error: oErr } = await supabase.rpc('create_pending_order', {
        p_customer_id: user.id, p_merchant_id: business.user_id,
        p_order_data: orderData, p_items: orderItems,
      });
      if (oErr) throw oErr;

      const { data: order, error: fErr } = await supabase
        .from('orders').select('order_number').eq('id', orderId).single();
      if (fErr) throw fErr;

      const posResponse = await supabase.functions.invoke(`create-${posIntegration.provider}-order`, {
        body: {
          order_id: orderId,
          pos_integration_id: posIntegration.id,
          customer_name: customerDetails.name,
          customer_email: customerDetails.email,
          customer_phone: customerDetails.phone,
          delivery_address: deliveryAddress.address,
          delivery_city: deliveryAddress.city,
          delivery_state: deliveryAddress.state,
          delivery_zip: deliveryAddress.zip,
        },
      });

      if (posResponse.error) {
        await supabase.rpc('cancel_pending_order', { p_order_id: orderId, p_reason: 'POS function error' });
        throw new Error(posResponse.error.message || 'Payment service unavailable.');
      }
      if (posResponse.data?.success === false) {
        await supabase.rpc('cancel_pending_order', { p_order_id: orderId, p_reason: posResponse.data.error || 'POS checkout failed' });
        throw new Error(posResponse.data.error || 'Failed to create checkout.');
      }

      if (posResponse.data?.checkout_url && posResponse.data?.success) {
        setRedirectingToPOS(true);
        sessionStorage.setItem('pending_order', JSON.stringify({
          order_id: orderId, order_number: order.order_number,
          pos_provider: posResponse.data.pos_provider,
          amount_to_pay: posResponse.data.amount_to_pay,
          barter_amount: barterAmount,
        }));
        setTimeout(() => { clearCart(); window.location.href = posResponse.data.checkout_url; }, 1000);
        return;
      }

      if (posResponse.data?.success) {
        clearCart();
        navigate(`/checkout/complete?provider=${posIntegration.provider}&order_id=${orderId}&payment=store`);
        return;
      }

      await supabase.rpc('cancel_pending_order', { p_order_id: orderId, p_reason: 'Unexpected POS response' });
      throw new Error(posResponse.data?.error || 'Failed to create checkout.');

    } catch (err: any) {
      toast({ title: 'Error placing order', description: err.message || 'Something went wrong.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  // ── Redirecting screen ───────────────────────────────────────────────────
  if (redirectingToPOS) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center px-6">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <Store className="h-8 w-8 text-gray-700 animate-pulse" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Redirecting to payment</h2>
          <p className="text-gray-500 mb-6">Complete your payment securely.</p>
          <p className="text-xl font-bold mb-1">${totalAmount.toFixed(2)}</p>
          {barterAmount > 0 && <p className="text-sm text-emerald-600">${barterAmount.toFixed(2)} barter discount applied</p>}
          <div className="flex items-center justify-center gap-2 text-sm text-gray-400 mt-6">
            <Loader2 className="h-4 w-4 animate-spin" /> Please wait...
          </div>
        </div>
      </div>
    );
  }

  // ── Main checkout layout ─────────────────────────────────────────────────
  return (
    <>
    <PendingApprovalModal open={pendingModalOpen} onClose={() => setPendingModalOpen(false)} />
    <div className="min-h-screen bg-white">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-100 px-6 py-4 flex items-center">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          ← Back to store
        </button>
        <h1 className="text-lg font-bold text-gray-900 mx-auto">Valuehub Exchange</h1>
        <div className="w-24" /> {/* spacer */}
      </div>

      {/* ── Two-column layout ────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 py-8 lg:grid lg:grid-cols-[1fr_380px] lg:gap-10 lg:items-start">

        {/* ════════════════════════════════════════════════════════════════
            LEFT COLUMN
        ════════════════════════════════════════════════════════════════ */}
        <div className="space-y-5 mb-8 lg:mb-0">

            {/* ── Fulfillment toggle ──────────────────────────────────────── */}
          <div className="border border-gray-200 rounded-2xl px-5 py-5">
            <h2 className="text-base font-bold text-gray-900 mb-4">How do you want to get it?</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setFulfillmentMethod('pickup')}
                className={`flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all font-semibold text-sm ${
                  fulfillmentMethod === 'pickup'
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 text-gray-600 hover:border-gray-400'
                }`}
              >
                <Store className="h-5 w-5" />
                Pickup
              </button>
              <button
                onClick={() => setFulfillmentMethod('delivery')}
                className={`flex flex-col items-center gap-2 py-4 rounded-xl border-2 transition-all font-semibold text-sm ${
                  fulfillmentMethod === 'delivery'
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 text-gray-600 hover:border-gray-400'
                }`}
              >
                <MapPin className="h-5 w-5" />
                Delivery
              </button>
            </div>
          </div>

          {/* ── Delivery address (delivery only) ────────────────────────── */}
          {fulfillmentMethod === 'delivery' && (
          <div className="border border-gray-200 rounded-2xl overflow-hidden">
            <div className="px-5 pt-5 pb-3">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-gray-900">Delivery details</h2>
                <button
                  onClick={() => setEditingInfo(!editingInfo)}
                  className="text-sm text-indigo-600 font-semibold hover:text-indigo-800"
                >
                  {editingInfo ? 'Done' : 'Edit'}
                </button>
              </div>

              {editingInfo ? (
                <div className="space-y-3 pb-2">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Street address *</label>
                    <input
                      value={deliveryAddress.address}
                      onChange={e => setDeliveryAddress(d => ({ ...d, address: e.target.value }))}
                      placeholder="123 Main St"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-1">
                      <label className="text-xs font-medium text-gray-500 mb-1 block">City *</label>
                      <input
                        value={deliveryAddress.city}
                        onChange={e => setDeliveryAddress(d => ({ ...d, city: e.target.value }))}
                        placeholder="New York"
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">State *</label>
                      <input
                        value={deliveryAddress.state}
                        onChange={e => setDeliveryAddress(d => ({ ...d, state: e.target.value }))}
                        placeholder="NY"
                        maxLength={2}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all uppercase"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1 block">ZIP *</label>
                      <input
                        value={deliveryAddress.zip}
                        onChange={e => setDeliveryAddress(d => ({ ...d, zip: e.target.value }))}
                        placeholder="10001"
                        maxLength={10}
                        className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3 py-2 pb-4">
                  <MapPin className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    {deliveryAddress.address ? (
                      <>
                        <p className="text-sm font-medium text-gray-900">{deliveryAddress.address}</p>
                        <p className="text-sm text-gray-500">{deliveryAddress.city}, {deliveryAddress.state} {deliveryAddress.zip}</p>
                      </>
                    ) : (
                      <p className="text-sm text-indigo-600 font-medium">Add delivery address</p>
                    )}
                  </div>
                </div>
              )}

              {/* Delivery notes */}
              {!editingInfo && (
                <div className="flex items-start justify-between gap-3 py-3 border-t border-gray-100">
                  <div className="flex items-start gap-3">
                    <Pencil className="h-5 w-5 text-gray-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Delivery instructions</p>
                      {customerDetails.notes
                        ? <p className="text-sm text-gray-500 mt-0.5">{customerDetails.notes}</p>
                        : <p className="text-sm text-indigo-600 mt-0.5">Add instructions (optional)</p>
                      }
                    </div>
                  </div>
                  <button onClick={() => setEditingInfo(true)} className="text-sm text-indigo-600 font-semibold shrink-0 hover:text-indigo-800">
                    Edit
                  </button>
                </div>
              )}
            </div>
          </div>
          )}

          {fulfillmentMethod === 'pickup' && (
          <div className="border border-gray-200 rounded-2xl px-5 py-5">
            <h2 className="text-base font-bold text-gray-900 mb-4">Pickup options</h2>
            <div className="space-y-3">
              {PICKUP_OPTIONS.map(opt => {
                const Icon = opt.icon;
                const selected = selectedPickup === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedPickup(opt.id)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left ${
                      selected ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <Icon className="h-5 w-5 text-gray-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{opt.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{opt.sublabel}</p>
                    </div>
                    {opt.extra && (
                      <span className="text-xs text-emerald-600 font-semibold">{opt.extra}</span>
                    )}
                    {selected && <Check className="h-4 w-4 text-gray-900 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
          )}

          {/* ── Your info ───────────────────────────────────────────────── */}
          <div className="border border-gray-200 rounded-2xl px-5 py-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">Your info</h2>
              <button
                onClick={() => setEditingInfo(!editingInfo)}
                className="text-sm text-indigo-600 font-semibold hover:text-indigo-800"
              >
                {editingInfo ? 'Done' : 'Edit'}
              </button>
            </div>

            {editingInfo ? (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Full name *</label>
                    <input
                      value={customerDetails.name}
                      onChange={e => setCustomerDetails(d => ({ ...d, name: e.target.value }))}
                      placeholder="John Doe"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500 mb-1 block">Email *</label>
                    <input
                      type="email"
                      value={customerDetails.email}
                      onChange={e => setCustomerDetails(d => ({ ...d, email: e.target.value }))}
                      placeholder="john@example.com"
                      className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Phone</label>
                  <input
                    type="tel"
                    value={customerDetails.phone}
                    onChange={e => setCustomerDetails(d => ({ ...d, phone: e.target.value }))}
                    placeholder="(555) 123-4567"
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">Delivery instructions (optional)</label>
                  <textarea
                    value={customerDetails.notes}
                    onChange={e => setCustomerDetails(d => ({ ...d, notes: e.target.value }))}
                    placeholder="e.g. Leave at door, ring bell..."
                    rows={2}
                    className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-gray-900 focus:ring-1 focus:ring-gray-900 transition-all resize-none"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2 text-sm text-gray-700">
                <p><span className="text-gray-400">Name: </span>{customerDetails.name || <span className="text-red-500">Required</span>}</p>
                <p><span className="text-gray-400">Email: </span>{customerDetails.email || <span className="text-red-500">Required</span>}</p>
                {customerDetails.phone && <p><span className="text-gray-400">Phone: </span>{customerDetails.phone}</p>}
              </div>
            )}
          </div>

          {/* ── Payment ─────────────────────────────────────────────────── */}
          <div className="border border-gray-200 rounded-2xl px-5 py-5">
            <h2 className="text-base font-bold text-gray-900 mb-4">Payment</h2>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <CreditCard className="h-5 w-5 text-gray-400 shrink-0" />
              <span>You'll be redirected to pay securely via the store's POS system.</span>
            </div>
          </div>

        </div>

        {/* ════════════════════════════════════════════════════════════════
            RIGHT COLUMN (sticky)
        ════════════════════════════════════════════════════════════════ */}
        <div className="lg:sticky lg:top-6 space-y-4">

          {/* Store card */}
          {merchantInfo && (
            <button
              onClick={() => navigate(`/listing/${merchantInfo.id}`)}
              className="w-full flex items-center gap-3 border border-gray-200 rounded-2xl px-4 py-3 hover:border-gray-400 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <Store className="h-5 w-5 text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">{merchantInfo.business_name}</p>
                <p className="text-xs text-gray-400 truncate">{merchantInfo.location}</p>
              </div>
              <span className="text-gray-300 text-lg">›</span>
            </button>
          )}

          {/* CTA button */}
          <button
            onClick={handlePlaceOrder}
            disabled={loading}
            className="w-full py-4 rounded-2xl bg-gray-900 hover:bg-gray-800 active:bg-gray-950 text-white font-bold text-base transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : `Continue to payment`}
          </button>

          {/* Cart summary (collapsible) */}
          <div className="border border-gray-200 rounded-2xl overflow-hidden">
            <button
              onClick={() => setCartOpen(o => !o)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
            >
              <span className="text-sm font-semibold text-gray-900">
                Cart summary ({cart.reduce((s, i) => s + i.quantity, 0)} {cart.reduce((s, i) => s + i.quantity, 0) === 1 ? 'item' : 'items'})
              </span>
              {cartOpen ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
            </button>

            {cartOpen && (
              <div className="px-5 pb-4 space-y-3 border-t border-gray-100 pt-3">
                {cart.map(item => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-gray-100 shrink-0 overflow-hidden">
                      {item.image_url
                        ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                        : <div className="w-full h-full flex items-center justify-center"><Package className="h-5 w-5 text-gray-300" /></div>
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      <p className="text-xs text-gray-400">× {item.quantity}</p>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">${(item.price * item.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Promo code */}
          <div className="border border-gray-200 rounded-2xl px-5 py-4 flex items-center justify-between">
            <span className="text-sm text-gray-500">Add promo code</span>
            <span className="text-gray-300 text-lg">›</span>
          </div>

          {/* Order total */}
          <div className="border border-gray-200 rounded-2xl px-5 py-5 space-y-2.5">
            <h3 className="text-sm font-bold text-gray-900 mb-3">Order total</h3>

            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span>
              <span>${cartTotal.toFixed(2)}</span>
            </div>

            {barterAmount > 0 && (
              <div className="flex justify-between text-sm text-emerald-600 font-medium">
                <span>Barter credits ({barterPercentage}%)</span>
                <span>-${barterAmount.toFixed(2)}</span>
              </div>
            )}

            {fulfillmentMethod === 'delivery' && (
            <div className="flex justify-between text-sm text-gray-600">
              <span>Delivery Fee</span>
              <span>${deliveryFee.toFixed(2)}</span>
            </div>
            )}

            <div className="flex justify-between text-sm text-gray-600">
              <span>Taxes & Other Fees ({(taxRate * 100).toFixed(0)}%)</span>
              <span>${(taxAmount + serviceFee).toFixed(2)}</span>
            </div>

            <Separator />

            <div className="flex justify-between text-base font-bold text-gray-900">
              <span>Total</span>
              <span>${totalAmount.toFixed(2)}</span>
            </div>

            {barterAmount > 0 && (
              <div className="flex items-center gap-2 bg-emerald-50 rounded-xl px-3 py-2 mt-1">
                <span className="text-xs text-emerald-700 font-medium">
                  🎉 Saving ${barterAmount.toFixed(2)} with barter credits
                </span>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
    </>
  );
};

export default CustomerCheckout;
