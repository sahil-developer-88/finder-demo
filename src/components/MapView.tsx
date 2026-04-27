
import React, { useState, useEffect } from 'react';
import { MapPin, Search, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import MerchantCard from './MerchantCard';

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
  coordinates: [number, number]; // [lat, lng]
}

interface MapViewProps {
  merchants: Merchant[];
}

const MapView = ({ merchants }: MapViewProps) => {
  const [zipCode, setZipCode] = useState('');
  const [radius, setRadius] = useState(5);
  const [filteredMerchants, setFilteredMerchants] = useState(merchants);
  const [selectedMerchant, setSelectedMerchant] = useState<Merchant | null>(null);
  const [mapCenter, setMapCenter] = useState([40.7128, -74.0060]); // Default to NYC

  // Simulate zip code to coordinates conversion
  const getCoordinatesFromZip = (zip: string): [number, number] => {
    // In a real app, you'd use a geocoding API
    const zipCoords: { [key: string]: [number, number] } = {
      '10001': [40.7505, -73.9934], // Manhattan
      '90210': [34.0901, -118.4065], // Beverly Hills
      '60601': [41.8781, -87.6298], // Chicago
      '30309': [33.7490, -84.3880], // Atlanta
      '94102': [37.7749, -122.4194], // San Francisco
    };
    return zipCoords[zip] || [40.7128, -74.0060];
  };

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 3959; // Earth's radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const handleSearch = () => {
    if (!zipCode) return;
    
    const centerCoords = getCoordinatesFromZip(zipCode);
    setMapCenter(centerCoords);
    
    const filtered = merchants.filter(merchant => {
      const distance = calculateDistance(
        centerCoords[0], centerCoords[1],
        merchant.coordinates[0], merchant.coordinates[1]
      );
      return distance <= radius;
    });
    
    setFilteredMerchants(filtered);
  };

  return (
    <div className="h-screen flex">
      {/* Map Controls Sidebar */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold mb-4">Map Search</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Zip Code
              </label>
              <Input
                placeholder="Enter zip code"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                className="w-full"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Radius (miles)
              </label>
              <select 
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value={1}>1 mile</option>
                <option value={5}>5 miles</option>
                <option value={10}>10 miles</option>
                <option value={25}>25 miles</option>
                <option value={50}>50 miles</option>
              </select>
            </div>
            
            <Button onClick={handleSearch} className="w-full">
              <Search className="w-4 h-4 mr-2" />
              Search Area
            </Button>
          </div>
        </div>
        
        {/* Merchant List */}
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="text-lg font-semibold mb-3">
            Merchants ({filteredMerchants.length})
          </h3>
          
          <div className="space-y-3">
            {filteredMerchants.map((merchant) => (
              <Card 
                key={merchant.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedMerchant?.id === merchant.id ? 'ring-2 ring-blue-500' : ''
                }`}
                onClick={() => setSelectedMerchant(merchant)}
              >
                <CardContent className="p-3">
                  <div className="flex items-start space-x-3">
                    <img
                      src={`https://images.unsplash.com/${merchant.image}?w=60&h=60&fit=crop`}
                      alt={merchant.name}
                      className="w-12 h-12 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">{merchant.name}</h4>
                      <p className="text-xs text-gray-500 truncate">{merchant.address}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <div className="flex items-center">
                          <span className="text-xs text-yellow-600">★</span>
                          <span className="text-xs text-gray-600 ml-1">{merchant.rating}</span>
                        </div>
                        <span className="text-xs text-gray-400">•</span>
                        <span className="text-xs text-gray-600">{merchant.distance}</span>
                      </div>
                      <Badge variant="outline" className="text-xs mt-1">
                        {merchant.category}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
      
      {/* Map Area */}
      <div className="flex-1 relative">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-100 to-green-100 flex items-center justify-center">
          <div className="text-center">
            <div className="w-32 h-32 bg-white rounded-full flex items-center justify-center mb-4 mx-auto shadow-lg">
              <MapPin className="w-16 h-16 text-blue-600" />
            </div>
            <h3 className="text-xl font-semibold text-gray-800 mb-2">Interactive Map View</h3>
            <p className="text-gray-600 mb-4 max-w-md">
              Enter a zip code and select a radius to find merchants in your area. 
              In a full implementation, this would show an interactive map with merchant pins.
            </p>
            {zipCode && (
              <div className="bg-white rounded-lg p-4 shadow-md inline-block">
                <p className="text-sm text-gray-600">Searching near:</p>
                <p className="font-semibold">{zipCode}</p>
                <p className="text-sm text-gray-600">Within {radius} miles</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Selected Merchant Details */}
        {selectedMerchant && (
          <div className="absolute bottom-4 left-4 right-4 max-w-md">
            <MerchantCard merchant={selectedMerchant} />
          </div>
        )}
      </div>
    </div>
  );
};

export default MapView;
