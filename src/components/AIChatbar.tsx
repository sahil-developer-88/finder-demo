import { useState, useEffect } from 'react';
import { Send, X, MessageCircle, Sparkles, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface AIChatbarProps {
  onSearch: (query: string) => void;
  onClose: () => void;
}

const AIChatbar = ({ onSearch, onClose }: AIChatbarProps) => {
  const [query, setQuery] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [businesses, setBusinesses] = useState<any[]>([]);

  const suggestedQueries = [
    "Find businesses that accept 30% or more barter",
    "Looking for marketing services near me",
    "Show me businesses offering web design",
    "Find accounting services that want marketing",
    "Businesses accepting high barter percentages"
  ];

  // Fetch real businesses from database
  useEffect(() => {
    const fetchBusinesses = async () => {
      const { data, error } = await supabase
        .from('businesses')
        .select('*')
        .eq('status', 'active');

      if (!error && data) {
        setBusinesses(data);
      }
    };

    fetchBusinesses();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsProcessing(true);
    setShowResults(false);
    
    // Simulate AI processing and search with real data
    setTimeout(() => {
      const searchTerms = extractSearchTerms(query);
      const results = findRelevantBusinesses(searchTerms);
      
      setSearchResults(results);
      setShowResults(true);
      setIsProcessing(false);
    }, 1500);
  };

  const extractSearchTerms = (naturalQuery: string): {
    keywords: string[];
    minBarterPercentage?: number;
  } => {
    const lowerQuery = naturalQuery.toLowerCase();
    const keywords = [];
    let minBarterPercentage: number | undefined;
    
    // Extract barter percentage if mentioned
    const barterMatch = lowerQuery.match(/(\d+)%?\s*(or more)?\s*barter/);
    if (barterMatch) {
      minBarterPercentage = parseInt(barterMatch[1]);
    }
    
    // Extract service keywords
    const serviceKeywords = [
      'marketing', 'web design', 'accounting', 'legal', 'consulting',
      'photography', 'design', 'development', 'seo', 'social media',
      'content', 'writing', 'video', 'editing', 'coaching'
    ];
    
    serviceKeywords.forEach(keyword => {
      if (lowerQuery.includes(keyword)) {
        keywords.push(keyword);
      }
    });
    
    // If no specific keywords, use all words
    if (keywords.length === 0) {
      const words = lowerQuery.split(' ').filter(w => w.length > 3);
      keywords.push(...words);
    }
    
    return { keywords, minBarterPercentage };
  };

  const findRelevantBusinesses = (searchTerms: { keywords: string[]; minBarterPercentage?: number }) => {
    const { keywords, minBarterPercentage } = searchTerms;
    
    return businesses.filter(business => {
      // Check barter percentage if specified
      if (minBarterPercentage && Number(business.barter_percentage) < minBarterPercentage) {
        return false;
      }
      
      // Check if business matches any keywords
      const businessText = [
        business.business_name,
        business.category,
        business.description,
        ...(business.services_offered || []),
        ...(business.wanting_in_return || [])
      ].join(' ').toLowerCase();
      
      return keywords.some(keyword => businessText.includes(keyword));
    }).slice(0, 5); // Limit to 5 results
  };

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
  };

  const handleUseResults = () => {
    const searchTerms = searchResults.map(r => r.business_name).join(' ');
    onSearch(searchTerms);
    setShowResults(false);
    setQuery('');
  };

  return (
    <Card className="animate-fade-in bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 shadow-xl">
      <CardHeader className="flex flex-row items-center justify-between pb-4">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          AI Search Assistant
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-8 w-8 p-0 hover:bg-purple-100"
        >
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-600">
          Search for businesses by services, barter percentage, or what they're looking for!
        </p>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            <MessageCircle className="absolute left-3 top-1/2 transform -translate-y-1/2 text-purple-400 w-4 h-4" />
            <Input
              placeholder="e.g., 'Find businesses accepting 30% barter that offer marketing'"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10 border-purple-300 focus:border-purple-500 focus:ring-purple-500"
              disabled={isProcessing}
            />
          </div>
          <Button 
            type="submit" 
            disabled={!query.trim() || isProcessing}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            {isProcessing ? (
              <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </form>

        {isProcessing && (
          <div className="flex items-center gap-2 text-sm text-purple-600">
            <div className="animate-pulse w-2 h-2 bg-purple-400 rounded-full" />
            <span>AI is searching through active businesses...</span>
          </div>
        )}

        {showResults && searchResults.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium text-gray-900">Found {searchResults.length} matches:</h4>
              <Button size="sm" onClick={handleUseResults} className="bg-green-600 hover:bg-green-700">
                Use Results
              </Button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {searchResults.map((business) => (
                <div key={business.id} className="p-3 bg-white rounded-lg border border-purple-200">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-sm">{business.business_name}</h5>
                    <Badge className="text-xs bg-green-100 text-green-800">
                      {business.barter_percentage}% barter
                    </Badge>
                  </div>
                  <p className="text-xs text-gray-600 mb-2">{business.location}</p>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-xs">{business.category}</Badge>
                    {(business.services_offered || []).slice(0, 2).map((service: string, i: number) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        {service}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showResults && searchResults.length === 0 && (
          <div className="text-center py-4 text-sm text-gray-600">
            No businesses found matching your criteria. Try a different search!
          </div>
        )}

        {!showResults && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Try these examples:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedQueries.map((suggestion, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="cursor-pointer hover:bg-purple-100 border-purple-300 text-purple-700 text-xs"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AIChatbar;
