import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ShoppingCart, X, Plus, Minus, Package, Trash2, Store } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

const CartDrawer = () => {
  const navigate = useNavigate();
  const { cart, merchantInfo, cartCount, cartTotal, updateQuantity, removeFromCart, clearCart, deliveryFee, serviceFee } = useCart();
  const [open, setOpen] = useState(false);

  // Calculate payment breakdown
  const eligibleSubtotal = cart.reduce((total, item) => {
    return total + (item.is_barter_eligible ? item.price * item.quantity : 0);
  }, 0);

  const restrictedSubtotal = cart.reduce((total, item) => {
    return total + (!item.is_barter_eligible ? item.price * item.quantity : 0);
  }, 0);

  const barterPercentage = merchantInfo?.barter_percentage || 0;
  const barterAmount = (eligibleSubtotal * barterPercentage) / 100;
  const cashSubtotal = cartTotal - barterAmount;
  const taxRate = merchantInfo?.tax_rate ?? 0.08;
  const taxAmount = cashSubtotal * taxRate;
  const totalAmount = cashSubtotal + taxAmount + deliveryFee + serviceFee;

  const handleProceedToCheckout = () => {
    setOpen(false);
    navigate('/checkout');
  };

  const handleClearCart = () => {
    if (window.confirm('Are you sure you want to clear your cart?')) {
      clearCart();
    }
  };

  return (
    <>
      {/* Floating Cart Button */}
      <div className="fixed bottom-20 right-4 z-50">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              className="rounded-full w-14 h-14 shadow-lg relative"
              size="lg"
            >
              <ShoppingCart className="h-6 w-6" />
              {cartCount > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -top-2 -right-2 rounded-full w-6 h-6 flex items-center justify-center p-0"
                >
                  {cartCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>

          <SheetContent className="w-full sm:max-w-lg flex flex-col">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Shopping Cart
                {cartCount > 0 && (
                  <Badge variant="secondary">{cartCount} {cartCount === 1 ? 'item' : 'items'}</Badge>
                )}
              </SheetTitle>
              {merchantInfo && (
                <SheetDescription className="flex items-center gap-2">
                  <Store className="h-4 w-4" />
                  {merchantInfo.business_name}
                </SheetDescription>
              )}
            </SheetHeader>

            {cart.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
                <ShoppingCart className="h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Your cart is empty</h3>
                <p className="text-sm text-gray-600 mb-4">Add some products to get started!</p>
                <Button onClick={() => setOpen(false)}>
                  Continue Shopping
                </Button>
              </div>
            ) : (
              <>
                {/* Cart Items */}
                <ScrollArea className="flex-1 -mx-6 px-6">
                  <div className="space-y-4 py-4">
                    {cart.map((item) => (
                      <div key={item.id} className="flex gap-3 border-b pb-4">
                        {/* Product Image */}
                        <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <Package className="h-6 w-6 text-gray-400" />
                          )}
                        </div>

                        {/* Product Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <h4 className="font-medium text-sm truncate">{item.name}</h4>
                            <button
                              onClick={() => removeFromCart(item.id)}
                              className="text-gray-400 hover:text-red-600 flex-shrink-0"
                              title="Remove from cart"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-semibold text-green-600">
                              ${Number(item.price).toFixed(2)}
                            </span>
                            {item.is_barter_eligible ? (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                                Barter OK
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-xs bg-red-50 text-red-700 border-red-300">
                                Cash Only
                              </Badge>
                            )}
                          </div>

                          {/* Quantity Controls */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                disabled={item.quantity <= 1}
                              >
                                <Minus className="h-3 w-3" />
                              </Button>
                              <span className="text-sm font-medium w-8 text-center">{item.quantity}</span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                disabled={item.stock_quantity !== undefined && item.quantity >= item.stock_quantity}
                              >
                                <Plus className="h-3 w-3" />
                              </Button>
                            </div>
                            <span className="text-sm font-semibold">
                              ${(item.price * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {/* Payment Summary */}
                <div className="border-t pt-4 space-y-3">
                  <h3 className="font-semibold">Payment Summary</h3>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span className="font-medium">${cartTotal.toFixed(2)}</span>
                    </div>

                    {eligibleSubtotal > 0 && (
                      <>
                        <div className="flex justify-between text-green-700">
                          <span>Barter credits ({barterPercentage}%):</span>
                          <span className="font-medium">-${barterAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Cash subtotal:</span>
                          <span className="font-medium">${cashSubtotal.toFixed(2)}</span>
                        </div>
                      </>
                    )}

                    {restrictedSubtotal > 0 && (
                      <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                        ${restrictedSubtotal.toFixed(2)} in cash-only items
                      </div>
                    )}

                    <div className="flex justify-between text-gray-600">
                      <span>Tax ({(taxRate * 100).toFixed(0)}% on cash):</span>
                      <span className="font-medium">${taxAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Delivery fee:</span>
                      <span className="font-medium">${deliveryFee.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-gray-600">
                      <span>Service fee:</span>
                      <span className="font-medium">${serviceFee.toFixed(2)}</span>
                    </div>

                    <Separator />

                    <div className="flex justify-between font-bold text-base">
                      <span>Total to pay:</span>
                      <span className="text-green-600">${totalAmount.toFixed(2)}</span>
                    </div>

                    {barterAmount > 0 && (
                      <div className="text-xs text-gray-600 bg-blue-50 p-2 rounded">
                        You'll use ${barterAmount.toFixed(2)} in barter credits
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-2 pt-2">
                    <Button
                      className="w-full"
                      size="lg"
                      onClick={handleProceedToCheckout}
                    >
                      Proceed to Checkout
                    </Button>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setOpen(false)}
                      >
                        Continue Shopping
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleClearCart}
                        title="Clear cart"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
};

export default CartDrawer;
