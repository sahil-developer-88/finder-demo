import React from 'react';
import { useNavigate } from 'react-router-dom';
import ShopifyPOSScanner from '@/components/barter/ShopifyPOSScanner';
import BackButton from '@/components/ui/BackButton';

const ShopifyPOSCheckout = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <BackButton />
          <h1 className="text-3xl font-bold">Shopify POS Checkout</h1>
          <p className="text-gray-600 mt-2">Process split payments with barter credits</p>
        </div>

        {/* Scanner Component */}
        <ShopifyPOSScanner />
      </div>
    </div>
  );
};

export default ShopifyPOSCheckout;
