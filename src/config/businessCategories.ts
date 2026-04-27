// Business category configuration
// Maps categories to business types: 'product' or 'service'

export type BusinessType = 'product' | 'service';

export interface BusinessCategory {
  value: string;
  label: string;
  type: BusinessType;
  description: string;
}

export const BUSINESS_CATEGORIES: BusinessCategory[] = [
  // Product-based businesses
  {
    value: 'restaurant',
    label: 'Restaurant',
    type: 'product',
    description: 'Food & Dining - Fixed menu prices'
  },
  {
    value: 'cafe',
    label: 'Cafe',
    type: 'product',
    description: 'Coffee shop, bakery - Fixed prices'
  },
  {
    value: 'grocery',
    label: 'Grocery Store',
    type: 'product',
    description: 'Food & groceries - Fixed prices'
  },
  {
    value: 'retail',
    label: 'Retail Store',
    type: 'product',
    description: 'General retail - Fixed product prices'
  },
  {
    value: 'clothing',
    label: 'Clothing Store',
    type: 'product',
    description: 'Apparel & fashion - Fixed prices'
  },
  {
    value: 'electronics',
    label: 'Electronics Store',
    type: 'product',
    description: 'Electronics & gadgets - Fixed prices'
  },
  {
    value: 'bookstore',
    label: 'Bookstore',
    type: 'product',
    description: 'Books & publications - Fixed prices'
  },
  {
    value: 'pharmacy',
    label: 'Pharmacy',
    type: 'product',
    description: 'Pharmacy & health products - Fixed prices'
  },

  // Service-based businesses
  {
    value: 'electrician',
    label: 'Electrician',
    type: 'service',
    description: 'Electrical services - Variable pricing'
  },
  {
    value: 'plumber',
    label: 'Plumber',
    type: 'service',
    description: 'Plumbing services - Variable pricing'
  },
  {
    value: 'carpenter',
    label: 'Carpenter',
    type: 'service',
    description: 'Carpentry & woodwork - Variable pricing'
  },
  {
    value: 'consultant',
    label: 'Consultant',
    type: 'service',
    description: 'Professional consulting - Variable pricing'
  },
  {
    value: 'lawyer',
    label: 'Lawyer',
    type: 'service',
    description: 'Legal services - Variable pricing'
  },
  {
    value: 'accountant',
    label: 'Accountant',
    type: 'service',
    description: 'Accounting & tax services - Variable pricing'
  },
  {
    value: 'photographer',
    label: 'Photographer',
    type: 'service',
    description: 'Photography services - Variable pricing'
  },
  {
    value: 'landscaper',
    label: 'Landscaper',
    type: 'service',
    description: 'Landscaping & lawn care - Variable pricing'
  },
  {
    value: 'cleaner',
    label: 'Cleaning Service',
    type: 'service',
    description: 'Cleaning & maintenance - Variable pricing'
  },
  {
    value: 'handyman',
    label: 'Handyman',
    type: 'service',
    description: 'General repairs & maintenance - Variable pricing'
  },
  {
    value: 'mechanic',
    label: 'Mechanic',
    type: 'service',
    description: 'Auto repair services - Variable pricing'
  },
  {
    value: 'painter',
    label: 'Painter',
    type: 'service',
    description: 'Painting services - Variable pricing'
  },
  {
    value: 'tutor',
    label: 'Tutor',
    type: 'service',
    description: 'Tutoring & education - Variable pricing'
  },
  {
    value: 'designer',
    label: 'Designer',
    type: 'service',
    description: 'Design services - Variable pricing'
  },
  {
    value: 'contractor',
    label: 'Contractor',
    type: 'service',
    description: 'Construction & contracting - Variable pricing'
  },
];

// Helper functions
export const getProductCategories = (): BusinessCategory[] => {
  return BUSINESS_CATEGORIES.filter(cat => cat.type === 'product');
};

export const getServiceCategories = (): BusinessCategory[] => {
  return BUSINESS_CATEGORIES.filter(cat => cat.type === 'service');
};

export const getCategoriesByType = (type: BusinessType): BusinessCategory[] => {
  return BUSINESS_CATEGORIES.filter(cat => cat.type === type);
};

export const getCategoryByValue = (value: string): BusinessCategory | undefined => {
  return BUSINESS_CATEGORIES.find(cat => cat.value === value);
};

export const getBusinessTypeByCategory = (category: string): BusinessType | undefined => {
  return BUSINESS_CATEGORIES.find(cat => cat.value === category)?.type;
};
