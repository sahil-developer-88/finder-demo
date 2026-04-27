import { Star, MapPin, Heart, ArrowRight, Clock, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Merchant {
  id: number;
  name: string;
  category: string;
  rating: number;
  distance: string;
  image: string;
  description: string;
  acceptedItems: string[];
  featured: boolean;
  address: string;
  phone: string;
  hours: string;
  specialties: string[];
  coordinates?: [number, number];
}

interface MerchantCardProps {
  merchant: Merchant;
  featured?: boolean;
}

const MerchantCard = ({ merchant, featured = false }: MerchantCardProps) => {
  return (
    <Card className={`group hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 bg-white/80 backdrop-blur-sm border-0 ${
      featured ? 'ring-2 ring-blue-500/20 shadow-xl' : 'shadow-lg'
    }`}>
      <div className="relative overflow-hidden rounded-t-lg">
        <img
          src={`https://images.unsplash.com/${merchant.image}?w=400&h=200&fit=crop`}
          alt={merchant.name}
          className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        
        {featured && (
          <Badge className="absolute top-3 left-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
            Featured
          </Badge>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          className="absolute top-3 right-3 h-8 w-8 p-0 bg-white/20 backdrop-blur-sm hover:bg-white/30"
        >
          <Heart className="w-4 h-4 text-white" />
        </Button>

        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-white font-semibold text-lg mb-1">{merchant.name}</h3>
          <div className="flex items-center gap-2 text-white/90 text-sm">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span>{merchant.rating}</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              <span>{merchant.distance}</span>
            </div>
          </div>
        </div>
      </div>

      <CardContent className="p-6">
        <div className="space-y-4">
          <div>
            <Badge variant="outline" className="mb-2">
              {merchant.category}
            </Badge>
            <p className="text-gray-600 text-sm leading-relaxed">
              {merchant.description}
            </p>
          </div>

          {/* Contact Info */}
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <MapPin className="w-3 h-3" />
              <span>{merchant.address}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-3 h-3" />
              <span>{merchant.phone}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3" />
              <span>{merchant.hours}</span>
            </div>
          </div>

          {/* Specialties */}
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Specialties:</h4>
            <div className="flex flex-wrap gap-1">
              {merchant.specialties.map((specialty, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="text-xs bg-green-50 text-green-700 hover:bg-green-100"
                >
                  {specialty}
                </Badge>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-2">Accepts:</h4>
            <div className="flex flex-wrap gap-1">
              {merchant.acceptedItems.map((item, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="text-xs bg-blue-50 text-blue-700 hover:bg-blue-100"
                >
                  {item}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button 
              size="sm" 
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              View Details
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
            <Button size="sm" variant="outline" className="hover:bg-gray-50">
              Contact
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MerchantCard;
