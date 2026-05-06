import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Package, ShoppingCart, MapPin, Store, Coins, AlertCircle, CheckCircle, ChevronLeft, Minus, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { addToCart, removeFromCart, updateQuantity, cart, merchantInfo, switchMerchant } = useCart();

  const [product, setProduct] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      try {
        setLoading(true);
        const { data: productData, error: productError } = await supabase
          .from('products_with_eligibility')
          .select('*')
          .eq('id', id)
          .single();
        if (productError) throw productError;
        setProduct(productData);

        // Build business object from joined view data (business_id may be null for POS-synced products)
        if (productData.merchant_id) {
          // Try fetching from businesses table first for full data including tax_rate
          const { data: businessData } = await supabase
            .from('businesses')
            .select('*')
            .eq('user_id', productData.merchant_id)
            .maybeSingle();

          if (businessData) {
            setBusiness(businessData);
          } else if (productData.business_name) {
            // Fallback: build business object from view joined data
            setBusiness({
              id: productData.business_id || productData.merchant_id,
              user_id: productData.merchant_id,
              business_name: productData.business_name,
              location: productData.business_location || '',
              barter_percentage: productData.business_barter_percentage ?? productData.effective_barter_percentage ?? 0,
              tax_rate: 0.08,
            });
          }
        }
      } catch (error: any) {
        console.error('Error fetching product:', error);
        toast({ title: "Error", description: "Failed to load product details", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id, toast]);


  const handleAddToCart = () => {
    if (!product || !business) {
      toast({ title: "Error", description: "Could not load merchant info. Please refresh the page.", variant: "destructive" });
      return;
    }

    if (merchantInfo && merchantInfo.id !== business.id) {
      if (window.confirm(
        `Your cart contains items from ${merchantInfo.business_name}. Adding items from ${business.business_name} will clear your current cart. Continue?`
      )) {
        switchMerchant(business.id);
        // switchMerchant is async state update — add item on next tick after cart is cleared
        setTimeout(() => doAddToCart(), 0);
        return;
      } else {
        return;
      }
    }

    doAddToCart();
  };

  const doAddToCart = () => {
    if (!product || !business) return;

    const currentMerchantInfo = {
      id: business.id,
      business_name: business.business_name,
      location: business.location,
      barter_percentage: business.barter_percentage,
      tax_rate: business.tax_rate ?? 0.08
    };

    const cartItem = {
      id: product.id,
      name: product.name,
      price: product.price,
      merchant_id: business.user_id,
      merchant_name: business.business_name,
      image_url: product.image_url,
      stock_quantity: product.stock_quantity,
      barcode: product.barcode,
      sku: product.sku,
      category_name: product.category_name,
      is_barter_eligible: product.is_barter_eligible,
      restriction_reason: product.restriction_reason,
      pos_integration_id: product.pos_integration_id,
      external_product_id: product.external_product_id,
      external_variant_id: product.external_variant_id
    };

    for (let i = 0; i < quantity; i++) {
      addToCart(cartItem, currentMerchantInfo);
    }

    toast({ title: "Added to cart", description: `${quantity}x ${product.name} added to your cart.` });
    setQuantity(1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-2">Product not found</h2>
          <button onClick={() => navigate(-1)} className="text-indigo-600 font-semibold hover:underline">Go Back</button>
        </div>
      </div>
    );
  }

  const cartEntry = cart.find(i => i.id === product.id);
  const inCartQty = cartEntry?.quantity ?? 0;
  const totalPrice = product.price * quantity;
  const barterPct = product.effective_barter_percentage ?? business?.barter_percentage ?? 0;
  const barterAmount = product.is_barter_eligible ? (totalPrice * barterPct / 100) : 0;
  const cashAmount = totalPrice - barterAmount;
  const outOfStock = product.stock_quantity === 0;

  return (
    <div className="min-h-screen bg-white pb-24 lg:pb-0">

      {/* ── Desktop: two-column layout ────────────────────────────────────────── */}
      <div className="lg:flex lg:h-[calc(100vh-64px)]">

        {/* ── LEFT: image (sticky, full height) ─────────────────────────────── */}
        <div className="lg:w-1/2 lg:sticky lg:top-16 lg:h-[calc(100vh-64px)] bg-gray-100 flex items-center justify-center relative">
          {/* Back button */}
          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 w-9 h-9 bg-white rounded-full flex items-center justify-center shadow-md hover:bg-gray-50 transition-colors z-10"
          >
            <ChevronLeft className="h-5 w-5 text-gray-800" />
          </button>

          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name}
              className="w-full h-full object-contain p-8"
            />
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Package className="h-24 w-24 text-gray-300" />
              <p className="text-gray-400 text-sm">No image available</p>
            </div>
          )}

          {product.is_barter_eligible && (
            <span className="absolute top-4 right-4 bg-emerald-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
              {business?.barter_percentage || 0}% Barter
            </span>
          )}
        </div>

        {/* ── RIGHT: product details + add to cart ──────────────────────────── */}
        <div className="lg:w-1/2 lg:overflow-y-auto lg:h-[calc(100vh-64px)] bg-white">

          {/* Mobile: back button */}
          <div className="lg:hidden px-4 py-3 border-b border-gray-100">
            <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
              <ChevronLeft className="h-4 w-4" /> Back
            </button>
          </div>

          {/* Mobile: image */}
          <div className="lg:hidden w-full h-64 bg-gray-100 flex items-center justify-center">
            {product.image_url ? (
              <img src={product.image_url} alt={product.name} className="w-full h-full object-contain p-6" />
            ) : (
              <Package className="h-16 w-16 text-gray-300" />
            )}
          </div>

          <div className="px-6 py-6 space-y-6">

            {/* Name + price */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900 leading-tight">{product.name}</h1>
              <p className="text-2xl font-bold text-gray-900 mt-1">${Number(product.price).toFixed(2)}</p>
              {product.category_name && (
                <span className="inline-block mt-2 text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                  {product.category_name}
                </span>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <div className="text-gray-500 text-sm leading-relaxed prose prose-sm max-w-none border-t border-gray-100 pt-4"
                dangerouslySetInnerHTML={{ __html: product.description }} />
            )}

            {/* Barter eligibility */}
            <div className={`flex items-center gap-2 text-sm font-medium px-3 py-2.5 rounded-xl border ${
              product.is_barter_eligible
                ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                : 'bg-red-50 text-red-700 border-red-100'
            }`}>
              {product.is_barter_eligible
                ? <><CheckCircle className="h-4 w-4 shrink-0" /> Barter eligible — pay partly with Valuehub Exchange credits</>
                : <><AlertCircle className="h-4 w-4 shrink-0" /> Cash only — {product.restriction_reason || 'Not eligible for barter'}</>
              }
            </div>

            {/* Stock */}
            {product.stock_quantity !== undefined && (
              <div className={`text-xs font-semibold px-3 py-1.5 rounded-lg w-fit ${
                outOfStock ? 'bg-red-50 text-red-600' :
                product.stock_quantity < 10 ? 'bg-amber-50 text-amber-700' :
                'bg-green-50 text-green-700'
              }`}>
                {outOfStock ? 'Out of stock' : product.stock_quantity < 10 ? `Only ${product.stock_quantity} left` : `${product.stock_quantity} in stock`}
              </div>
            )}

            {/* Payment breakdown */}
            {product.is_barter_eligible && (
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm border border-gray-100">
                <div className="flex justify-between text-gray-600">
                  <span>Subtotal ({quantity}x)</span>
                  <span>${totalPrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-medium">
                  <span>Barter credits ({barterPct}%)</span>
                  <span>-${barterAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 border-t border-gray-200 pt-2">
                  <span>Cash due</span>
                  <span>${cashAmount.toFixed(2)}</span>
                </div>
              </div>
            )}

            {/* SKU */}
            {product.sku && <p className="text-xs text-gray-400">SKU: {product.sku}</p>}

            {/* Quantity + Add to cart */}
            {inCartQty > 0 ? (
              <div className="flex items-center gap-3 pt-2">
                <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2.5 flex-1">
                  <button
                    onClick={() => inCartQty === 1 ? removeFromCart(product.id) : updateQuantity(product.id, inCartQty - 1)}
                    className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-sm font-bold border border-emerald-100"
                  >
                    <Minus className="h-3 w-3 text-emerald-700" />
                  </button>
                  <span className="flex-1 text-center font-bold text-emerald-800">{inCartQty} in cart</span>
                  <button
                    onClick={() => updateQuantity(product.id, inCartQty + 1)}
                    disabled={inCartQty >= (product.stock_quantity || 999)}
                    className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-sm border border-emerald-100 disabled:opacity-40"
                  >
                    <Plus className="h-3 w-3 text-emerald-700" />
                  </button>
                </div>
                <button
                  onClick={() => navigate('/checkout')}
                  className="py-3 px-5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white font-bold text-sm flex items-center justify-center gap-2 transition-all"
                >
                  <ShoppingCart className="h-4 w-4" />
                  View Cart
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 pt-2">
                <div className="flex items-center gap-3 bg-gray-100 rounded-xl px-4 py-2.5">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} disabled={quantity <= 1}
                    className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-sm disabled:opacity-40 font-bold">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-5 text-center font-bold">{quantity}</span>
                  <button onClick={() => setQuantity(Math.min(product.stock_quantity || 999, quantity + 1))} disabled={quantity >= (product.stock_quantity || 999)}
                    className="w-7 h-7 rounded-full bg-white flex items-center justify-center shadow-sm disabled:opacity-40">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <button
                  onClick={handleAddToCart}
                  disabled={outOfStock}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition-all"
                >
                  <ShoppingCart className="h-4 w-4" />
                  {outOfStock ? 'Out of Stock' : `Add to Cart · $${totalPrice.toFixed(2)}`}
                </button>
              </div>
            )}

            {/* Sold by */}
            {business && (
              <button onClick={() => navigate(`/listing/${business.id}`)}
                className="w-full border border-gray-100 rounded-xl p-4 flex items-center gap-3 hover:border-indigo-200 transition-colors text-left">
                <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                  <Store className="h-5 w-5 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-400">Sold by</p>
                  <p className="font-semibold text-gray-900 text-sm truncate">{business.business_name}</p>
                  <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5"><MapPin className="h-3 w-3" />{business.location}</p>
                </div>
                <ChevronLeft className="h-4 w-4 text-gray-300 rotate-180 shrink-0" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
