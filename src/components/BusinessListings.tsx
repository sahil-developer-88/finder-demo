
import React from 'react';
import BusinessCard from '@/components/BusinessCard';
import { Store } from 'lucide-react';

interface Business {
  id: number;
  businessName: string;
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
}

interface BusinessListingsProps {
  businesses: Business[];
}

const BusinessListings: React.FC<BusinessListingsProps> = ({ businesses }) => {
  if (businesses.length === 0) {
    return (
      <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
        <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Store className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-700 mb-1">No businesses found</h3>
        <p className="text-sm text-gray-400">Try adjusting your search or filters</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {businesses.map((business) => (
        <BusinessCard key={business.id} business={business} />
      ))}
    </div>
  );
};

export default BusinessListings;
