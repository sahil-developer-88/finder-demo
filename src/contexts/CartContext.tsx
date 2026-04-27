import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

export const DELIVERY_FEE = 4.00;
export const SERVICE_FEE  = 2.33;

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  merchant_id: string;
  merchant_name: string;
  image_url?: string;
  stock_quantity?: number;
  barcode?: string;
  sku?: string;
  category_name?: string;
  is_barter_eligible: boolean;
  restriction_reason?: string;
  pos_integration_id?: string;
  external_product_id?: string;
  external_variant_id?: string;
}

export interface MerchantInfo {
  id: string;
  business_name: string;
  location: string;
  barter_percentage: number;
  tax_rate: number;
}

interface CartContextType {
  cart: CartItem[];
  merchantInfo: MerchantInfo | null;
  addToCart: (product: Omit<CartItem, 'quantity'>, merchantInfo: MerchantInfo) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  switchMerchant: (merchantId: string) => void;
  cartCount: number;
  cartTotal: number;
  deliveryFee: number;
  serviceFee: number;
  cartLoading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [merchantInfo, setMerchantInfo] = useState<MerchantInfo | null>(null);
  const [cartLoading, setCartLoading] = useState(false);

  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isInitialLoad = useRef(true);

  // ── Load cart from Supabase when user changes ──────────────────────────────
  useEffect(() => {
    if (!user) {
      setCart([]);
      setMerchantInfo(null);
      return;
    }

    const loadCart = async () => {
      setCartLoading(true);
      isInitialLoad.current = true;
      try {
        const { data, error } = await supabase
          .from('carts')
          .select('items, merchant_info')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setCart((data.items as CartItem[]) || []);
          setMerchantInfo((data.merchant_info as MerchantInfo) || null);
        } else {
          setCart([]);
          setMerchantInfo(null);
        }
      } catch (err) {
        console.error('Error loading cart:', err);
      } finally {
        setCartLoading(false);
        // Small delay so the initial load doesn't trigger a sync write
        setTimeout(() => { isInitialLoad.current = false; }, 100);
      }
    };

    loadCart();
  }, [user?.id]);

  // ── Debounced sync to Supabase on every cart change ────────────────────────
  useEffect(() => {
    if (!user || isInitialLoad.current) return;

    if (syncTimer.current) clearTimeout(syncTimer.current);

    syncTimer.current = setTimeout(async () => {
      try {
        await supabase.from('carts').upsert(
          { user_id: user.id, items: cart, merchant_info: merchantInfo, updated_at: new Date().toISOString() },
          { onConflict: 'user_id' }
        );
      } catch (err) {
        console.error('Error syncing cart:', err);
      }
    }, 500);

    return () => { if (syncTimer.current) clearTimeout(syncTimer.current); };
  }, [cart, merchantInfo, user]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const addToCart = (product: Omit<CartItem, 'quantity'>, newMerchantInfo: MerchantInfo) => {
    if (merchantInfo && merchantInfo.id !== newMerchantInfo.id) {
      console.warn('Cannot add products from different merchants');
      return;
    }
    if (product.stock_quantity !== undefined && product.stock_quantity <= 0) return;
    if (!merchantInfo) setMerchantInfo(newMerchantInfo);

    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        if (product.stock_quantity !== undefined && existing.quantity + 1 > product.stock_quantity) return prev;
        return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const next = prev.filter(i => i.id !== productId);
      if (next.length === 0) setMerchantInfo(null);
      return next;
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity === 0) { removeFromCart(productId); return; }
    setCart(prev => prev.map(i => i.id === productId ? { ...i, quantity } : i));
  };

  const clearCart = async () => {
    setCart([]);
    setMerchantInfo(null);
    if (user) {
      await supabase.from('carts').delete().eq('user_id', user.id);
    }
  };

  const switchMerchant = (_merchantId: string) => {
    setCart([]);
    setMerchantInfo(null);
  };

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);
  const cartTotal = cart.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{
      cart, merchantInfo,
      addToCart, removeFromCart, updateQuantity, clearCart, switchMerchant,
      cartCount, cartTotal,
      deliveryFee: DELIVERY_FEE,
      serviceFee: SERVICE_FEE,
      cartLoading,
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
