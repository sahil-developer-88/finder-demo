import React, { useState, useEffect } from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Plus, Briefcase, Handshake } from 'lucide-react';
import { OnboardingFormData } from '@/hooks/useOnboardingForm';

interface ServicesPricingStepProps {
  formData: OnboardingFormData;
  setFormData: React.Dispatch<React.SetStateAction<OnboardingFormData>>;
}

// Suggested services keyed by category VALUE (matches businessCategories.ts)
const suggestedServices: Record<string, string[]> = {
  restaurant: [
    'Dine-in Service', 'Takeout', 'Catering', 'Private Dining', 'Food Delivery',
    'Event Hosting', 'Meal Prep', 'Cooking Classes', 'Bartending Services'
  ],
  cafe: [
    'Coffee & Espresso', 'Pastries & Baked Goods', 'Breakfast & Brunch',
    'Sandwiches & Wraps', 'Smoothies & Juices', 'Catering', 'Study Space Rental'
  ],
  grocery: [
    'Fresh Produce', 'Organic Products', 'Specialty Foods', 'Grocery Delivery',
    'Bulk Items', 'Local Produce', 'Meal Kits'
  ],
  retail: [
    'Product Sales', 'Gift Wrapping', 'Custom Orders', 'In-Store Pickup',
    'Product Bundling', 'Loyalty Program', 'Special Orders'
  ],
  clothing: [
    "Women's Clothing", "Men's Clothing", "Kids Clothing", 'Activewear',
    'Formal Wear', 'Vintage Clothing', 'Accessories', 'Custom Tailoring',
    'Alterations & Repairs', 'Shoe Sales'
  ],
  electronics: [
    'Electronics Sales', 'Device Repair', 'Tech Support', 'Accessories',
    'Trade-In Program', 'Installation Services', 'Extended Warranty'
  ],
  bookstore: [
    'Book Sales', 'Textbooks', 'Rare & Collectible Books', 'Book Club',
    'Author Events', 'Gift Cards', 'E-books'
  ],
  pharmacy: [
    'Prescription Filling', 'OTC Medications', 'Health Supplements',
    'Pharmacist Consultation', 'Vaccination', 'Medical Supplies', 'Compounding'
  ],
  electrician: [
    'Electrical Repair', 'Panel Upgrades', 'Wiring Installation', 'Lighting Installation',
    'EV Charger Installation', 'Safety Inspections', 'Emergency Services', 'Smart Home Setup'
  ],
  plumber: [
    'Pipe Repair', 'Drain Cleaning', 'Water Heater Installation', 'Leak Detection',
    'Bathroom Remodel', 'Emergency Services', 'Sewer Line Repair', 'Fixture Installation'
  ],
  carpenter: [
    'Custom Furniture', 'Cabinet Making', 'Deck Building', 'Trim & Molding',
    'Wood Flooring', 'Door Installation', 'Window Framing', 'Repairs & Restoration'
  ],
  consultant: [
    'Business Strategy', 'Market Research', 'Financial Planning', 'Operations Consulting',
    'HR Consulting', 'Process Improvement', 'Project Management', 'Executive Coaching'
  ],
  lawyer: [
    'Contract Review', 'Business Formation', 'Legal Consultation', 'Document Drafting',
    'Dispute Resolution', 'Intellectual Property', 'Employment Law', 'Real Estate Law'
  ],
  accountant: [
    'Tax Preparation', 'Bookkeeping', 'Financial Reporting', 'Payroll Services',
    'Audit Services', 'Business Tax Planning', 'CFO Services', 'QuickBooks Setup'
  ],
  photographer: [
    'Portrait Photography', 'Event Photography', 'Product Photography',
    'Real Estate Photography', 'Headshots', 'Wedding Photography', 'Photo Editing', 'Photo Printing'
  ],
  landscaper: [
    'Lawn Mowing', 'Garden Design', 'Tree Trimming', 'Irrigation Systems',
    'Mulching & Planting', 'Snow Removal', 'Hardscaping', 'Weed Control'
  ],
  cleaner: [
    'Residential Cleaning', 'Commercial Cleaning', 'Deep Cleaning',
    'Move-in/Move-out Cleaning', 'Window Cleaning', 'Carpet Cleaning',
    'Post-Construction Cleaning', 'Recurring Maintenance'
  ],
  handyman: [
    'General Repairs', 'Furniture Assembly', 'Drywall Patching', 'Painting Touch-ups',
    'Fixture Replacement', 'Door & Lock Repair', 'Weatherproofing', 'Small Renovations'
  ],
  mechanic: [
    'Oil Changes', 'Brake Service', 'Engine Diagnostics', 'Tire Services',
    'Transmission Repair', 'AC Service', 'Battery Replacement', 'Pre-purchase Inspection'
  ],
  painter: [
    'Interior Painting', 'Exterior Painting', 'Cabinet Painting', 'Deck Staining',
    'Wallpaper Removal', 'Color Consultation', 'Pressure Washing', 'Commercial Painting'
  ],
  tutor: [
    'Math Tutoring', 'Science Tutoring', 'English & Writing', 'Test Prep (SAT/ACT)',
    'Language Lessons', 'Music Lessons', 'Online Tutoring', 'Study Skills Coaching'
  ],
  designer: [
    'Logo Design', 'Brand Identity', 'Web Design', 'Graphic Design',
    'UI/UX Design', 'Print Design', 'Social Media Graphics', 'Packaging Design'
  ],
  contractor: [
    'General Contracting', 'Kitchen Remodeling', 'Bathroom Remodeling', 'Home Additions',
    'Flooring Installation', 'Roofing', 'Siding Installation', 'Basement Finishing'
  ],
};

const ServicesPricingStep: React.FC<ServicesPricingStepProps> = ({ formData, setFormData }) => {
  const [newService, setNewService] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);

  const suggestions = suggestedServices[formData.category] || [];

  // Reset suggestions panel when category changes
  useEffect(() => {
    setShowSuggestions(false);
    setShowCustomInput(false);
    setNewService('');
  }, [formData.category]);

  const addService = (service?: string) => {
    const serviceToAdd = service || newService.trim();
    if (serviceToAdd && !formData.servicesOffered.includes(serviceToAdd)) {
      setFormData(prev => ({
        ...prev,
        servicesOffered: [...prev.servicesOffered, serviceToAdd]
      }));
      setNewService('');
      setShowSuggestions(false);
      setShowCustomInput(false);
    }
  };

  const removeService = (service: string) => {
    setFormData(prev => ({
      ...prev,
      servicesOffered: prev.servicesOffered.filter(s => s !== service)
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center pb-4 border-b">
        <Handshake className="h-12 w-12 mx-auto mb-3 text-primary" />
        <h3 className="text-lg font-semibold">
          {formData.businessType === 'both' ? 'What products & services do you offer?' : 'What do you offer and need?'}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {formData.businessType === 'both'
            ? 'Add both your products and services — customers can barter for either'
            : 'Define your services, barter terms, and what you\'re looking to trade for'}
        </p>
      </div>

      {/* Barter Percentage */}
      <div className="space-y-3">
        <Label className="text-base font-medium flex items-center gap-2">
          <Handshake className="h-4 w-4" />
          Barter Percentage *
        </Label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: 100, label: '100%', description: 'Full barter — accept 100% in barter points' },
            { value: 50, label: '50%', description: 'Hybrid — accept 50% barter, 50% cash' },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, barterPercentage: option.value }))}
              className={`p-4 rounded-xl border-2 text-left transition-all ${
                (formData.barterPercentage || 100) === option.value
                  ? 'border-indigo-500 bg-indigo-50'
                  : 'border-border bg-white hover:border-indigo-200'
              }`}
            >
              <div className={`text-2xl font-bold mb-1 ${
                (formData.barterPercentage || 100) === option.value ? 'text-indigo-600' : 'text-gray-700'
              }`}>
                {option.label}
              </div>
              <div className="text-xs text-muted-foreground leading-snug">{option.description}</div>
              {option.value === 100 && (
                <Badge className="mt-2 bg-green-600 hover:bg-green-700 text-xs">Recommended</Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Services Offered */}
      <div className="space-y-3">
        <Label className="text-base font-medium flex items-center gap-2">
          <Briefcase className="h-4 w-4" />
          {formData.businessType === 'both' ? 'Products & Services You Offer *' : 'Services You Offer *'}
        </Label>
        {/* Custom input — always visible, enabled only after Other is clicked */}
        <div className="flex gap-2">
          <Input
            value={newService}
            onChange={(e) => setNewService(e.target.value)}
            placeholder={showCustomInput ? "Type a custom service…" : "Click \"Other\" below to type a custom service"}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addService())}
            className="text-base"
            disabled={suggestions.length > 0 && !showCustomInput}
            autoFocus={showCustomInput}
          />
          <Button onClick={() => addService()} size="sm" type="button" disabled={suggestions.length > 0 && !showCustomInput}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        {/* Added services tags — right below input so they're always visible */}
        {formData.servicesOffered.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formData.servicesOffered.map((service) => (
              <Badge key={service} variant="secondary" className="pr-1 text-sm py-1">
                {service}
                <button
                  onClick={() => removeService(service)}
                  className="ml-2 hover:text-destructive transition-colors"
                  type="button"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
        {formData.servicesOffered.length === 0 && (
          <p className="text-xs text-muted-foreground">Add at least one service you offer</p>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs font-medium text-blue-900 mb-2">💡 Select services you offer:</p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <Badge
                  key={suggestion}
                  variant={formData.servicesOffered.includes(suggestion) ? 'default' : 'outline'}
                  className={`cursor-pointer transition-colors ${
                    formData.servicesOffered.includes(suggestion)
                      ? 'bg-indigo-600 hover:bg-indigo-700'
                      : 'hover:bg-blue-100'
                  }`}
                  onClick={() => {
                    if (formData.servicesOffered.includes(suggestion)) {
                      removeService(suggestion);
                    } else {
                      addService(suggestion);
                    }
                  }}
                >
                  {formData.servicesOffered.includes(suggestion)
                    ? <X className="h-3 w-3 mr-1" />
                    : <Plus className="h-3 w-3 mr-1" />
                  }
                  {suggestion}
                </Badge>
              ))}
              <Badge
                variant="outline"
                className="cursor-pointer hover:bg-blue-100 transition-colors border-dashed"
                onClick={() => { setShowCustomInput(true); setShowSuggestions(false); }}
              >
                <Plus className="h-3 w-3 mr-1" />
                Other
              </Badge>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default ServicesPricingStep;
