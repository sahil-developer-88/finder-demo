
import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Star, Mail, CheckCircle, Globe, ShoppingBag, Wrench, ExternalLink, Heart } from "lucide-react";

interface Business {
  id: number;
  businessName: string;
  businessType?: 'product' | 'service';
  category: string;
  servicesOffered: string[];
  wantingInReturn: string[];
  estimatedValue: number;
  location: string;
  contactMethod: string;
  rating: number;
  reviews: number;
  verified: boolean;
  points: number;
  image: string;
  description: string;
  website?: string;
  socialMedia?: {
    instagram?: string;
    twitter?: string;
    facebook?: string;
    linkedin?: string;
  };
  pricedItems?: Array<{ name: string; price: number; points: number }>;
  barterPercentage?: number;
}

interface BusinessCardProps {
  business: Business;
  onToggleFavorite?: (id: string) => void;
  isFavorite?: (id: string) => boolean;
}

const AVATAR_GRADIENTS = [
  'from-indigo-400 to-violet-500',
  'from-emerald-400 to-teal-500',
  'from-orange-400 to-pink-500',
  'from-blue-400 to-cyan-500',
  'from-rose-400 to-red-500',
];

const ACCENT_GRADIENTS = [
  'from-indigo-500 to-violet-500',
  'from-emerald-500 to-teal-500',
  'from-orange-500 to-pink-500',
  'from-blue-500 to-cyan-500',
  'from-rose-500 to-red-500',
];

// keyword → image: matched by partial case-insensitive search
const CATEGORY_IMAGES: Array<{ keywords: string[]; url: string }> = [
  { keywords: ['restaurant', 'food', 'cafe', 'coffee', 'dining', 'catering', 'bakery', 'bar', 'pizza'],
    url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=300&fit=crop&q=80' },
  { keywords: ['fitness', 'gym', 'sport', 'yoga', 'personal train', 'crossfit', 'pilates', 'health club'],
    url: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=600&h=300&fit=crop&q=80' },
  { keywords: ['market', 'marketing', 'advertis', 'seo', 'social media', 'branding', 'media'],
    url: 'https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=600&h=300&fit=crop&q=80' },
  { keywords: ['legal', 'law', 'attorney', 'lawyer', 'compliance'],
    url: 'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&h=300&fit=crop&q=80' },
  { keywords: ['design', 'graphic', 'creative', 'branding', 'ui', 'ux', 'art'],
    url: 'https://images.unsplash.com/photo-1561736778-92e52a7769ef?w=600&h=300&fit=crop&q=80' },
  { keywords: ['tech', 'software', 'it ', 'web', 'app', 'develop', 'digital', 'computer', 'coding'],
    url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=300&fit=crop&q=80' },
  { keywords: ['health', 'wellness', 'medical', 'clinic', 'dental', 'doctor', 'therapy', 'spa', 'massage'],
    url: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=300&fit=crop&q=80' },
  { keywords: ['consult', 'business', 'strateg', 'coach', 'advisory', 'management'],
    url: 'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?w=600&h=300&fit=crop&q=80' },
  { keywords: ['photo', 'video', 'film', 'media production', 'cinemat'],
    url: 'https://images.unsplash.com/photo-1554048612-b6a482bc67e5?w=600&h=300&fit=crop&q=80' },
  { keywords: ['writ', 'content', 'copy', 'blog', 'editorial', 'journalism'],
    url: 'https://images.unsplash.com/photo-1455390582262-044cdead277a?w=600&h=300&fit=crop&q=80' },
  { keywords: ['financ', 'account', 'tax', 'bookkeep', 'audit', 'invest', 'insurance'],
    url: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&h=300&fit=crop&q=80' },
  { keywords: ['retail', 'shop', 'store', 'product', 'ecommerce', 'boutique', 'merch'],
    url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=300&fit=crop&q=80' },
  { keywords: ['beauty', 'salon', 'hair', 'nail', 'barber', 'skin', 'cosmetic', 'makeup'],
    url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&h=300&fit=crop&q=80' },
  { keywords: ['auto', 'car', 'vehicle', 'mechanic', 'repair', 'garage', 'tyre', 'tire'],
    url: 'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=600&h=300&fit=crop&q=80' },
  { keywords: ['home', 'clean', 'plumb', 'electr', 'handyman', 'landscap', 'paint', 'construction', 'contractor'],
    url: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600&h=300&fit=crop&q=80' },
  { keywords: ['event', 'wedding', 'party', 'catering', 'entertain', 'dj', 'music'],
    url: 'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=600&h=300&fit=crop&q=80' },
  { keywords: ['educat', 'tutor', 'train', 'school', 'course', 'learn', 'teach'],
    url: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=600&h=300&fit=crop&q=80' },
  { keywords: ['print', 'sign', 'label', 'packaging', 'banner', 'merchandise'],
    url: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=300&fit=crop&q=80' },
];
const DEFAULT_IMG = 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=300&fit=crop&q=80';

function getCategoryImage(category: string): string {
  const lower = (category ?? '').toLowerCase();
  for (const entry of CATEGORY_IMAGES) {
    if (entry.keywords.some(kw => lower.includes(kw))) return entry.url;
  }
  return DEFAULT_IMG;
}

function getBadgeBg(pct: number) {
  if (pct >= 25) return '#16a34a';
  if (pct >= 15) return '#ea580c';
  return '#2563eb';
}

const getSocialUrl = (platform: string, handle: string) => {
  const baseUrls: Record<string, string> = {
    instagram: 'https://instagram.com/',
    twitter: 'https://twitter.com/',
    facebook: 'https://facebook.com/',
    linkedin: 'https://linkedin.com/in/',
  };
  return `${baseUrls[platform] ?? '#'}${handle.replace('@', '')}`;
};

const BusinessCard: React.FC<BusinessCardProps> = ({ business, onToggleFavorite, isFavorite }) => {
  const barterPercentage = business.barterPercentage ?? 20;
  const isProductBusiness = business.businessType === 'product' || business.businessType === 'both';
  const isServiceBusiness = business.businessType === 'service' || business.businessType === 'both';
  const isBothType = business.businessType === 'both';

  const colorIndex = business.businessName.charCodeAt(0) % AVATAR_GRADIENTS.length;
  const initial = business.businessName.charAt(0).toUpperCase();

  const categoryImg = getCategoryImage(business.category);

  return (
    <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col">

      {/* Cover image with barter % badge */}
      <div className="relative h-36 overflow-hidden">
        <img
          src={categoryImg}
          alt={business.category}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />
        {/* Dark gradient at bottom for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        {/* Service / Product type badge */}
        <span className={`absolute top-3 left-3 text-white text-xs font-bold px-2.5 py-1 rounded-full shadow-lg flex items-center gap-1 ${isServiceBusiness ? 'bg-violet-600' : 'bg-blue-600'}`}>
          {isServiceBusiness ? <Wrench className="h-3 w-3" /> : <ShoppingBag className="h-3 w-3" />}
          {isServiceBusiness ? 'Service' : 'Product'}
        </span>
        {/* Heart / Favorite button */}
        {onToggleFavorite && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleFavorite(String(business.id)); }}
            className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-white/80 hover:bg-white shadow-sm transition-colors"
          >
            <Heart className={`h-4 w-4 ${isFavorite?.(String(business.id)) ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} />
          </button>
        )}
        {/* Barter % badge bottom-right */}
        <span
          className="absolute bottom-2 right-3 text-white text-xs font-black px-2.5 py-1 rounded-full shadow-lg"
          style={{ background: getBadgeBg(barterPercentage) }}
        >
          {barterPercentage}%
        </span>
        {/* Category label bottom-left */}
        <span className="absolute bottom-2 left-3 text-white text-xs font-semibold drop-shadow">
          {business.category}
        </span>
      </div>

      <div className="p-5 flex flex-col flex-1">
        {/* Header row */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className={`w-11 h-11 rounded-xl bg-gradient-to-br ${AVATAR_GRADIENTS[colorIndex]} flex items-center justify-center flex-shrink-0 shadow-sm`}
          >
            <span className="text-white font-bold text-lg">{initial}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Link to={`/listing/${business.id}`}>
                <span className="font-bold text-gray-900 hover:text-indigo-600 transition-colors text-sm leading-tight">
                  {business.businessName}
                </span>
              </Link>
              {business.verified && (
                <CheckCircle className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{business.location || 'Location not set'}</span>
            </div>
          </div>

          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold shrink-0 rounded-lg hover:bg-emerald-50">
            {barterPercentage}% Barter
          </Badge>
        </div>

        {/* Category + type chips */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <Badge variant="secondary" className="text-xs rounded-lg flex items-center gap-1 py-0.5">
            {isBothType ? <><ShoppingBag className="h-3 w-3" /><Wrench className="h-3 w-3" /></> : isProductBusiness ? <ShoppingBag className="h-3 w-3" /> : <Wrench className="h-3 w-3" />}
            {business.category}
          </Badge>
          {isBothType && (
            <Badge variant="outline" className="text-xs rounded-lg text-indigo-600 border-indigo-200 py-0.5">
              Product + Service
            </Badge>
          )}
          {isServiceBusiness && !isBothType && (
            <Badge variant="outline" className="text-xs rounded-lg text-orange-600 border-orange-200 py-0.5">
              Variable Pricing
            </Badge>
          )}
        </div>

        {/* Description */}
        <p className="text-xs text-gray-500 mb-4 line-clamp-2 leading-relaxed">
          {business.description}
        </p>

        {/* Social links */}
        {(business.website || business.socialMedia) && (
          <div className="flex gap-1 mb-3">
            {business.website && (
              <a
                href={business.website}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors"
              >
                <Globe className="h-4 w-4" />
              </a>
            )}
            {business.socialMedia &&
              Object.entries(business.socialMedia).map(([platform, handle]) =>
                handle ? (
                  <a
                    key={platform}
                    href={getSocialUrl(platform, handle)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 text-gray-400 hover:text-indigo-600 transition-colors"
                    title={`${platform}: ${handle}`}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                ) : null
              )}
          </div>
        )}

        {/* Product list */}
        {isProductBusiness && business.pricedItems && business.pricedItems.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <ShoppingBag className="h-3 w-3" /> Products
            </p>
            <div className="space-y-1">
              {business.pricedItems.slice(0, 2).map((item, i) => (
                <div
                  key={i}
                  className="flex justify-between items-center text-xs bg-indigo-50 px-3 py-1.5 rounded-lg"
                >
                  <span className="font-medium text-gray-700">{item.name}</span>
                  <span className="text-indigo-600 font-semibold">{item.points} pts</span>
                </div>
              ))}
              {business.pricedItems.length > 2 && (
                <p className="text-xs text-gray-400 text-center">
                  +{business.pricedItems.length - 2} more
                </p>
              )}
            </div>
          </div>
        )}

        {/* Services list */}
        {isServiceBusiness && business.servicesOffered.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Wrench className="h-3 w-3" /> Services
            </p>
            <div className="flex flex-wrap gap-1">
              {business.servicesOffered.slice(0, 3).map((s, i) => (
                <span
                  key={i}
                  className="text-xs bg-violet-50 text-violet-700 px-2 py-0.5 rounded-md"
                >
                  {s}
                </span>
              ))}
              {business.servicesOffered.length > 3 && (
                <span className="text-xs text-gray-400 self-center">
                  +{business.servicesOffered.length - 3} more
                </span>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-50 mt-auto">
          <div className="flex items-center gap-1 text-xs">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-gray-700">{business.rating}</span>
            <span className="text-gray-400">({business.reviews})</span>
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs rounded-xl border-gray-200 hover:border-indigo-300 hover:text-indigo-600 px-3"
            >
              <Mail className="h-3 w-3 mr-1" />
              {isServiceBusiness ? 'Get Quote' : 'Contact'}
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 px-3"
              asChild
            >
              <Link to={`/listing/${business.id}`}>
                {isServiceBusiness ? 'View Services' : 'View Store'}
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BusinessCard;
