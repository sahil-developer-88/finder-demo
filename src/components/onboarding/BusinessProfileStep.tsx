import React, { useState, useEffect } from 'react';
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { OnboardingFormData } from '@/hooks/useOnboardingForm';
import { Building2, Tag, FileText, ShoppingBag, Wrench, Layers } from 'lucide-react';
import { BUSINESS_CATEGORIES, BusinessType, getCategoriesByType } from '@/config/businessCategories';

type ExtendedBusinessType = BusinessType | 'both';
import { Card } from "@/components/ui/card";

interface BusinessProfileStepProps {
  formData: OnboardingFormData;
  setFormData: React.Dispatch<React.SetStateAction<OnboardingFormData>>;
}

const BusinessProfileStep: React.FC<BusinessProfileStepProps> = ({ formData, setFormData }) => {
  // Initialize from formData so navigating back preserves selection
  const [selectedBusinessType, setSelectedBusinessType] = useState<ExtendedBusinessType | ''>(
    (formData.businessType as ExtendedBusinessType | undefined) || ''
  );
  const [filteredCategories, setFilteredCategories] = useState(
    formData.businessType === 'both' || !formData.businessType
      ? BUSINESS_CATEGORIES
      : getCategoriesByType(formData.businessType as BusinessType)
  );

  // Update filtered categories when business type changes
  useEffect(() => {
    if (selectedBusinessType === 'both') {
      setFilteredCategories(BUSINESS_CATEGORIES);
      // Reset category since all are now available
      setFormData(prev => ({ ...prev, category: '' }));
    } else if (selectedBusinessType) {
      setFilteredCategories(getCategoriesByType(selectedBusinessType as BusinessType));
      // Reset category if it doesn't match the new type
      if (formData.category) {
        const categoryMatch = getCategoriesByType(selectedBusinessType as BusinessType).find(
          cat => cat.value === formData.category
        );
        if (!categoryMatch) {
          setFormData(prev => ({ ...prev, category: '' }));
        }
      }
    } else {
      setFilteredCategories(BUSINESS_CATEGORIES);
    }
  }, [selectedBusinessType]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center pb-4 border-b">
        <Building2 className="h-12 w-12 mx-auto mb-3 text-primary" />
        <h3 className="text-lg font-semibold">Tell us about your business</h3>
        <p className="text-sm text-muted-foreground mt-1">
          This information will be displayed on your public profile
        </p>
      </div>

      {/* Business Type Selection */}
      <div className="space-y-3">
        <Label className="text-base font-medium">What type of business do you have? *</Label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card
            className={`p-4 cursor-pointer border-2 transition-all hover:border-primary ${
              selectedBusinessType === 'product' ? 'border-primary bg-primary/5' : 'border-border'
            }`}
            onClick={() => { setSelectedBusinessType('product'); setFormData(prev => ({ ...prev, businessType: 'product' })); }}
          >
            <div className="flex flex-col items-center text-center space-y-2">
              <ShoppingBag className={`h-8 w-8 ${selectedBusinessType === 'product' ? 'text-primary' : 'text-muted-foreground'}`} />
              <div>
                <div className="font-semibold">Product</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Sell physical goods with fixed prices (retail, food, etc.)
                </div>
              </div>
            </div>
          </Card>

          <Card
            className={`p-4 cursor-pointer border-2 transition-all hover:border-primary ${
              selectedBusinessType === 'service' ? 'border-primary bg-primary/5' : 'border-border'
            }`}
            onClick={() => { setSelectedBusinessType('service'); setFormData(prev => ({ ...prev, businessType: 'service' })); }}
          >
            <div className="flex flex-col items-center text-center space-y-2">
              <Wrench className={`h-8 w-8 ${selectedBusinessType === 'service' ? 'text-primary' : 'text-muted-foreground'}`} />
              <div>
                <div className="font-semibold">Service</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Provide services with variable pricing (plumber, consultant, etc.)
                </div>
              </div>
            </div>
          </Card>

          <Card
            className={`p-4 cursor-pointer border-2 transition-all hover:border-primary ${
              selectedBusinessType === 'both' ? 'border-primary bg-primary/5' : 'border-border'
            }`}
            onClick={() => { setSelectedBusinessType('both'); setFormData(prev => ({ ...prev, businessType: 'both' })); }}
          >
            <div className="flex flex-col items-center text-center space-y-2">
              <Layers className={`h-8 w-8 ${selectedBusinessType === 'both' ? 'text-primary' : 'text-muted-foreground'}`} />
              <div>
                <div className="font-semibold">Both</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Sell products AND offer services (restaurant + catering, etc.)
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Business Name */}
      <div className="space-y-2">
        <Label htmlFor="businessName" className="text-base font-medium flex items-center gap-2">
          <Building2 className="h-4 w-4" />
          Business Name *
        </Label>
        <Input
          id="businessName"
          value={formData.businessName}
          onChange={(e) => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
          placeholder="Enter your business name"
          className="text-base"
          maxLength={100}
        />
        <p className="text-xs text-muted-foreground">
          {formData.businessName.length}/100 characters
        </p>
      </div>

      {/* Category */}
      {selectedBusinessType && (
        <div className="space-y-2">
          <Label htmlFor="category" className="text-base font-medium flex items-center gap-2">
            <Tag className="h-4 w-4" />
            Business Category *
          </Label>
          <Select
            value={formData.category}
            onValueChange={(value) => {
              setFormData(prev => ({ ...prev, category: value, businessType: selectedBusinessType }));
            }}
          >
            <SelectTrigger className="text-base">
              <SelectValue placeholder="Select your business category" />
            </SelectTrigger>
            <SelectContent>
              {filteredCategories.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  <div>
                    <div className="font-medium">{cat.label}</div>
                    <div className="text-xs text-muted-foreground">{cat.description}</div>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {selectedBusinessType === 'product'
              ? 'Select the product category that best matches your business'
              : selectedBusinessType === 'both'
              ? 'Select the primary category that best represents your business'
              : 'Select the service category that best describes what you offer'}
          </p>
        </div>
      )}

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description" className="text-base font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Business Description
        </Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
          placeholder="Describe what makes your business unique and what services you provide..."
          rows={4}
          className="text-base resize-none"
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground">
          {formData.description.length}/500 characters • Optional but recommended
        </p>
      </div>

      {/* Info Card */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>💡 Tip:</strong> A clear description helps other businesses understand what you offer and increases your chances of finding great trading partners.
        </p>
      </div>
    </div>
  );
};

export default BusinessProfileStep;
