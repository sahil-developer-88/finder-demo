import React, { useState, useEffect, useRef } from 'react';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Loader2 } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';

// Get Mapbox token from environment variables (Vite). In Lovable preview, .env may not hot-reload,
// so we keep a safe fallback (Mapbox public tokens are OK to ship client-side).
const MAPBOX_TOKEN =
  (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string | undefined) ||
  'pk.eyJ1IjoidmFsdWVodWJleGNoYW5nZSIsImEiOiJjbWprdThvaWQyZ3g1M2RweWk5NzE0cHFhIn0.7HdiwLx7O_Bp5dgstmnj4g';

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: AddressDetails) => void;
  placeholder?: string;
  label?: string;
  required?: boolean;
}

export interface AddressDetails {
  fullAddress: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  lat?: number;
  lng?: number;
}

interface MapboxFeature {
  id: string;
  place_name: string;
  center: [number, number]; // [lng, lat]
  context?: Array<{
    id: string;
    text: string;
    short_code?: string;
  }>;
  address?: string;
  text?: string;
  place_type?: string[];
}

interface MapboxGeocodingResponse {
  features: MapboxFeature[];
}

const AddressAutocomplete: React.FC<AddressAutocompleteProps> = ({
  value,
  onChange,
  placeholder = "Enter business address",
  label = "Business Address",
  required = true
}) => {
  const [searchQuery, setSearchQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);
  const debounceTimer = useRef<NodeJS.Timeout>();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const hasGeocodedInitialValue = useRef(false);

  // Geocode initial value to show map when coming back to the page
  useEffect(() => {
    if (value && !hasGeocodedInitialValue.current && MAPBOX_TOKEN) {
      hasGeocodedInitialValue.current = true;

      // Geocode the initial value to get coordinates
      fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value)}.json?` +
        `access_token=${MAPBOX_TOKEN}&` +
        `limit=1`
      )
        .then(res => res.json())
        .then((data: MapboxGeocodingResponse) => {
          if (data.features && data.features.length > 0) {
            const feature = data.features[0];
            setSelectedLocation({
              lat: feature.center[1],
              lng: feature.center[0],
              address: feature.place_name
            });
          }
        })
        .catch(err => console.error('Failed to geocode initial value:', err));
    }
  }, [value, MAPBOX_TOKEN]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Initialize map when location is selected
  useEffect(() => {
    if (!selectedLocation || !mapContainerRef.current || !MAPBOX_TOKEN) return;

    let isMounted = true;

    // Clean up existing map safely
    if (mapRef.current) {
      try {
        if (typeof mapRef.current.remove === 'function') {
          mapRef.current.remove();
        }
      } catch (error) {
        console.warn('Error removing map:', error);
      }
      mapRef.current = null;
    }

    // Clean up existing marker safely
    if (markerRef.current) {
      try {
        if (typeof markerRef.current.remove === 'function') {
          markerRef.current.remove();
        }
      } catch (error) {
        console.warn('Error removing marker:', error);
      }
      markerRef.current = null;
    }

    // Dynamically import mapbox-gl
    import('mapbox-gl').then((mapboxgl) => {
      if (!isMounted) return;

      try {
        // mapboxgl is the module, need to access default export
        const mapboxglLib = mapboxgl.default || mapboxgl;

        // Create new map
        const map = new mapboxglLib.Map({
          container: mapContainerRef.current!,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: [selectedLocation.lng, selectedLocation.lat],
          zoom: 15,
          accessToken: MAPBOX_TOKEN
        });

        // Add navigation controls
        map.addControl(new mapboxglLib.NavigationControl(), 'top-right');

        // Create custom marker element
        const el = document.createElement('div');
        el.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="rgb(239, 68, 68)" stroke="rgb(239, 68, 68)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`;
        el.style.cursor = 'pointer';

        // Add marker
        const marker = new mapboxglLib.Marker(el)
          .setLngLat([selectedLocation.lng, selectedLocation.lat])
          .addTo(map);

        if (isMounted) {
          mapRef.current = map;
          markerRef.current = marker;
        } else {
          // Component unmounted before map loaded, clean up
          marker.remove();
          map.remove();
        }
      } catch (error) {
        console.error('Mapbox error:', error);
      }
    }).catch((error) => {
      console.error('Failed to load mapbox-gl:', error);
    });

    // Cleanup on unmount
    return () => {
      isMounted = false;
      if (markerRef.current) {
        try {
          if (typeof markerRef.current.remove === 'function') {
            markerRef.current.remove();
          }
        } catch (error) {
          console.warn('Error cleaning up marker:', error);
        }
      }
      if (mapRef.current) {
        try {
          if (typeof mapRef.current.remove === 'function') {
            mapRef.current.remove();
          }
        } catch (error) {
          console.warn('Error cleaning up map:', error);
        }
      }
    };
  }, [selectedLocation, MAPBOX_TOKEN]);

  // Search addresses using Mapbox Geocoding API
  const searchAddress = async (query: string) => {
    if (!query || query.length < 3) {
      setSuggestions([]);
      return;
    }

    if (!MAPBOX_TOKEN) {
      console.error('Mapbox token is not configured. Please add VITE_MAPBOX_ACCESS_TOKEN to your .env file');
      return;
    }

    setIsLoading(true);

    try {
      // Mapbox Geocoding API - Broad search for all address types worldwide
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${MAPBOX_TOKEN}&` +
        `limit=10&` + // Show more results
        `autocomplete=true&` +
        `fuzzyMatch=true` // Enable fuzzy matching for better results
      );

      if (!response.ok) {
        throw new Error('Failed to fetch addresses');
      }

      const data: MapboxGeocodingResponse = await response.json();
      setSuggestions(data.features);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Address search error:', error);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounce search
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    // Clear existing timer
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    // Set new timer
    debounceTimer.current = setTimeout(() => {
      searchAddress(query);
    }, 500); // Wait 500ms after user stops typing
  };

  // Parse address components from Mapbox feature
  const parseAddressComponents = (feature: MapboxFeature) => {
    let street = '';
    let city = '';
    let state = '';
    let zipCode = '';
    let country = 'USA';

    // Extract street address
    if (feature.address && feature.text) {
      street = `${feature.address} ${feature.text}`;
    } else if (feature.text) {
      street = feature.text;
    }

    // Parse context for city, state, zipcode
    if (feature.context) {
      feature.context.forEach((item) => {
        if (item.id.startsWith('place')) {
          city = item.text;
        } else if (item.id.startsWith('region')) {
          state = item.short_code?.replace('US-', '') || item.text;
        } else if (item.id.startsWith('postcode')) {
          zipCode = item.text;
        } else if (item.id.startsWith('country')) {
          country = item.text;
        }
      });
    }

    return { street, city, state, zipCode, country };
  };

  // Handle address selection
  const handleSelectAddress = (feature: MapboxFeature) => {
    const { street, city, state, zipCode, country } = parseAddressComponents(feature);

    const addressDetails: AddressDetails = {
      fullAddress: feature.place_name,
      street: street,
      city: city,
      state: state,
      zipCode: zipCode,
      country: country,
      lat: feature.center[1], // Mapbox returns [lng, lat]
      lng: feature.center[0]
    };

    setSearchQuery(feature.place_name);
    setSuggestions([]);
    setShowSuggestions(false);

    // Set location for map
    const location = {
      lat: feature.center[1],
      lng: feature.center[0],
      address: feature.place_name
    };

    setSelectedLocation(location);
    onChange(addressDetails);
  };

  return (
    <div className="space-y-2" ref={wrapperRef}>
      {label && (
        <Label htmlFor="address-autocomplete" className="text-base font-medium flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          {label} {required && '*'}
        </Label>
      )}

      <div className="relative">
        <Input
          id="address-autocomplete"
          type="text"
          value={searchQuery}
          onChange={handleInputChange}
          placeholder={placeholder}
          className="text-base"
          autoComplete="off"
        />

        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Suggestions Dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
            {suggestions.map((feature) => {
              const { street, city, state, zipCode } = parseAddressComponents(feature);

              return (
                <div
                  key={feature.id}
                  onClick={() => handleSelectAddress(feature)}
                  className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-100 last:border-0"
                >
                  <div className="flex items-start gap-2">
                    <MapPin className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm">
                      <div className="font-medium text-gray-900">
                        {street || feature.text}
                      </div>
                      <div className="text-gray-600 text-xs mt-0.5">
                        {city && `${city}, `}{state} {zipCode}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Manual entry option */}
            <div
              onClick={() => {
                // Allow manual entry with geocoding attempt
                const manualFeature: MapboxFeature = {
                  id: 'manual-' + Date.now(),
                  place_name: searchQuery,
                  center: [0, 0],
                  text: searchQuery
                };
                handleSelectAddress(manualFeature);
              }}
              className="px-4 py-3 hover:bg-green-50 cursor-pointer border-t-2 border-green-200 bg-green-50"
            >
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <div className="font-medium text-green-900">
                    Use: "{searchQuery}"
                  </div>
                  <div className="text-green-700 text-xs mt-0.5">
                    Enter this address manually
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* No results - offer manual entry */}
        {showSuggestions && !isLoading && suggestions.length === 0 && searchQuery.length >= 3 && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg">
            <div className="p-3 text-sm text-gray-500 text-center border-b border-gray-200">
              No addresses found in Mapbox database
            </div>
            <div
              onClick={() => {
                const manualFeature: MapboxFeature = {
                  id: 'manual-' + Date.now(),
                  place_name: searchQuery,
                  center: [0, 0],
                  text: searchQuery
                };
                handleSelectAddress(manualFeature);
              }}
              className="px-4 py-3 hover:bg-green-50 cursor-pointer bg-green-50"
            >
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <div className="font-medium text-green-900">
                    Use: "{searchQuery}"
                  </div>
                  <div className="text-green-700 text-xs mt-0.5">
                    Enter this address manually (map will not be available)
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Start typing your business address (e.g., "123 Main St, San Francisco")
      </p>

      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>✓ Powered by</span>
        <a
          href="https://www.mapbox.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline"
        >
          Mapbox
        </a>
      </div>

      {/* Map Preview - Shows when location is selected */}
      {selectedLocation && MAPBOX_TOKEN && (
        <div className="mt-4 rounded-lg overflow-hidden border border-gray-200 shadow-sm">
          <div className="bg-blue-50 px-3 py-2 border-b border-blue-200">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-900">Selected Location</span>
            </div>
          </div>

          <div
            ref={mapContainerRef}
            style={{ width: '100%', height: '250px' }}
          />

          <div className="bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <div className="flex items-center justify-between">
              <span>Coordinates: {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}</span>
              <button
                onClick={() => setSelectedLocation(null)}
                className="text-red-600 hover:text-red-700 font-medium"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {!MAPBOX_TOKEN && selectedLocation && (
        <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>Mapbox token not configured.</strong> Please add <code className="bg-yellow-100 px-1 rounded">VITE_MAPBOX_ACCESS_TOKEN</code> to your .env file.
          </p>
        </div>
      )}
    </div>
  );
};

export default AddressAutocomplete;
