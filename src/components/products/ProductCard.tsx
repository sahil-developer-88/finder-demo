import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, ShoppingCart } from 'lucide-react';

interface ProductCardProps {
  product: {
    id: string;
    name: string;
    price: number;
    category_name?: string;
    is_barter_eligible: boolean;
    restriction_reason?: string;
    stock_quantity?: number;
    image_url?: string;
  };
  merchantBarterPercentage: number;
  onAddToCart: (product: any) => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
  product,
  merchantBarterPercentage,
  onAddToCart
}) => {
  const navigate = useNavigate();

  const barterAmount = product.is_barter_eligible
    ? (product.price * merchantBarterPercentage / 100).toFixed(2)
    : '0.00';
  const cashAmount = product.is_barter_eligible
    ? (product.price * (100 - merchantBarterPercentage) / 100).toFixed(2)
    : product.price.toFixed(2);

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/product/${product.id}`)}>
      <CardContent className="p-4">
        <div className="flex gap-3">
          {/* Product Image */}
          <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Package className="h-8 w-8 text-gray-400" />
            )}
          </div>

          {/* Product Info */}
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm mb-1 truncate">{product.name}</h4>

            {product.category_name && (
              <Badge variant="secondary" className="text-xs mb-2">
                {product.category_name}
              </Badge>
            )}

            {/* Price and Eligibility */}
            <div className="flex items-center gap-2 text-sm mb-1">
              <span className="font-semibold text-green-600">
                ${Number(product.price).toFixed(2)}
              </span>
              {product.is_barter_eligible ? (
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-300">
                  Barter OK
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="text-xs bg-red-50 text-red-700 border-red-300"
                  title={product.restriction_reason || 'Cash only'}
                >
                  Cash Only
                </Badge>
              )}
            </div>

            {/* Barter Breakdown */}
            {product.is_barter_eligible && (
              <div className="text-xs text-gray-600 mb-1">
                ${barterAmount} credits + ${cashAmount} cash
              </div>
            )}

            {/* Stock Status */}
            {product.stock_quantity !== undefined && (
              <p className={`text-xs ${product.stock_quantity === 0 ? 'text-red-600' : 'text-gray-500'}`}>
                {product.stock_quantity === 0
                  ? 'Out of stock'
                  : `Stock: ${product.stock_quantity} available`}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-3">
          <Button
            size="sm"
            className="w-full"
            disabled={product.stock_quantity === 0}
            onClick={(e) => { e.stopPropagation(); onAddToCart(product); }}
          >
            <ShoppingCart className="h-3 w-3 mr-1" />
            Add to Cart
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductCard;
