
import { X, MapPin, Star, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';

interface SearchFiltersProps {
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  onClose: () => void;
}

const SearchFilters = ({ categories, selectedCategory, onCategoryChange, onClose }: SearchFiltersProps) => {
  return (
    <Card className="animate-fade-in bg-white/90 backdrop-blur-md border-0 shadow-xl">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg font-semibold">Search Filters</CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0 hover:bg-gray-100"
        >
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Categories */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-900">Categories</Label>
            <div className="space-y-2">
              {categories.slice(0, 5).map((category) => (
                <div key={category} className="flex items-center space-x-2">
                  <Checkbox
                    id={category}
                    checked={selectedCategory === category.toLowerCase()}
                    onCheckedChange={() => onCategoryChange(category.toLowerCase())}
                  />
                  <Label htmlFor={category} className="text-sm text-gray-700 cursor-pointer">
                    {category}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Distance */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-900 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Distance (miles)
            </Label>
            <div className="space-y-2">
              <Slider
                defaultValue={[5]}
                max={20}
                min={1}
                step={1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500">
                <span>1 mi</span>
                <span>20 mi</span>
              </div>
            </div>
          </div>

          {/* Rating */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-900 flex items-center gap-2">
              <Star className="w-4 h-4" />
              Minimum Rating
            </Label>
            <div className="space-y-2">
              {[4.5, 4.0, 3.5, 3.0].map((rating) => (
                <div key={rating} className="flex items-center space-x-2">
                  <Checkbox id={`rating-${rating}`} />
                  <Label htmlFor={`rating-${rating}`} className="text-sm text-gray-700 cursor-pointer flex items-center gap-1">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    {rating}+ stars
                  </Label>
                </div>
              ))}
            </div>
          </div>

          {/* Special Features */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-900">Features</Label>
            <div className="space-y-2">
              {[
                'Featured Merchants',
                'Quick Response',
                'Multiple Locations',
                'Online Trading',
                'Same Day Pickup'
              ].map((feature) => (
                <div key={feature} className="flex items-center space-x-2">
                  <Checkbox id={feature} />
                  <Label htmlFor={feature} className="text-sm text-gray-700 cursor-pointer">
                    {feature}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-between pt-4 border-t border-gray-200">
          <Button variant="outline" onClick={onClose}>
            Clear All
          </Button>
          <Button 
            onClick={onClose}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            Apply Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SearchFilters;
