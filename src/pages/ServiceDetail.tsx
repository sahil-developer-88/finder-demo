import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, MapPin, Star, Coins, Clock, CheckCircle, MessageSquare, Store, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import InquiryModal from '@/components/merchant/InquiryModal';

// Category image map (same as ListingDetail)
function getCategoryImage(category: string): string {
  const lower = (category ?? '').toLowerCase();
  const entries: [string, string][] = [
    ['restaurant', 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&h=800&fit=crop&q=80'],
    ['cafe',       'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1200&h=800&fit=crop&q=80'],
    ['grocery',    'https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&h=800&fit=crop&q=80'],
    ['retail',     'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200&h=800&fit=crop&q=80'],
    ['beauty',     'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1200&h=800&fit=crop&q=80'],
    ['mechanic',   'https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=1200&h=800&fit=crop&q=80'],
    ['health',     'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=1200&h=800&fit=crop&q=80'],
    ['fitness',    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=1200&h=800&fit=crop&q=80'],
    ['lawyer',     'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=1200&h=800&fit=crop&q=80'],
    ['tutor',      'https://images.unsplash.com/photo-1509062522246-3755977927d7?w=1200&h=800&fit=crop&q=80'],
    ['photo',      'https://images.unsplash.com/photo-1554048612-b6a482bc67e5?w=1200&h=800&fit=crop&q=80'],
  ];
  for (const [key, url] of entries) {
    if (lower.includes(key)) return url;
  }
  return 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=800&fit=crop&q=80';
}

const ServiceDetail = () => {
  const { businessId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const serviceName = searchParams.get('name') ?? 'Service';

  const [business, setBusiness] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isInquiryOpen, setIsInquiryOpen] = useState(false);

  useEffect(() => {
    const fetchBusiness = async () => {
      if (!businessId) return;
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('businesses')
          .select('*')
          .eq('id', businessId)
          .single();
        if (error) throw error;

        // If this is a product business, redirect to the listing page
        const { data: profile } = await supabase
          .from('profiles')
          .select('business_type')
          .eq('user_id', data.user_id)
          .single();
        if (profile?.business_type !== 'service') {
          navigate(`/listing/${businessId}`, { replace: true });
          return;
        }

        setBusiness(data);
      } catch {
        toast({ title: 'Error', description: 'Failed to load service details', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    fetchBusiness();
  }, [businessId, toast, navigate]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
    </div>
  );

  if (!business) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Service not found</h2>
        <button onClick={() => navigate(-1)} className="text-indigo-600 font-semibold hover:underline">Go back</button>
      </div>
    </div>
  );

  const barterAmount = business.barter_percentage ?? 0;
  const categoryImage = getCategoryImage(business.category);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Two-column layout (desktop) ─────────────────────────────────────── */}
      <div className="lg:flex lg:h-[calc(100vh-64px)]">

        {/* LEFT: sticky image panel */}
        <div className="lg:w-1/2 lg:sticky lg:top-16 lg:h-[calc(100vh-64px)] bg-gray-900 flex items-center justify-center relative overflow-hidden">
          <img
            src={categoryImage}
            alt={serviceName}
            className="w-full h-full object-cover opacity-80"
          />
          {/* Gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

          {/* Back button */}
          <button
            onClick={() => navigate(-1)}
            className="absolute top-4 left-4 w-9 h-9 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors z-10"
          >
            <ChevronLeft className="h-5 w-5 text-gray-800" />
          </button>

          {/* Service name overlay on image */}
          <div className="absolute bottom-0 left-0 right-0 p-6">
            <span className="inline-block bg-violet-500/90 text-white text-xs font-bold px-3 py-1 rounded-full mb-2">
              Service
            </span>
            <h1 className="text-3xl font-bold text-white leading-tight">{serviceName}</h1>
            <p className="text-white/70 text-sm mt-1">{business.business_name}</p>
          </div>
        </div>

        {/* RIGHT: scrollable details */}
        <div className="lg:w-1/2 lg:overflow-y-auto lg:h-[calc(100vh-64px)] bg-white">
          <div className="px-6 py-8 space-y-6">

            {/* Business info */}
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-100 to-indigo-100 flex items-center justify-center shrink-0">
                <Store className="h-6 w-6 text-violet-500" />
              </div>
              <div>
                <Link
                  to={`/listing/${business.id}`}
                  className="font-bold text-gray-900 hover:text-indigo-600 transition-colors"
                >
                  {business.business_name}
                </Link>
                <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                  <MapPin className="h-3 w-3" />
                  <span>{business.location || 'Location not set'}</span>
                  <span>·</span>
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span>{Number(business.average_rating || 4.5).toFixed(1)}</span>
                </div>
              </div>
            </div>

            {/* Service highlights */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-violet-50 rounded-2xl p-4 text-center">
                <Coins className="h-5 w-5 text-violet-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-violet-700">{barterAmount}%</p>
                <p className="text-xs text-violet-500 font-medium">Barter Rate</p>
              </div>
              <div className="bg-indigo-50 rounded-2xl p-4 text-center">
                <Clock className="h-5 w-5 text-indigo-500 mx-auto mb-1" />
                <p className="text-lg font-bold text-indigo-700">Flexible</p>
                <p className="text-xs text-indigo-500 font-medium">Duration</p>
              </div>
            </div>

            {/* Barter breakdown */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
              <p className="text-sm font-bold text-emerald-800 mb-2 flex items-center gap-2">
                <Coins className="h-4 w-4" /> Barter Breakdown
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Credits accepted</span>
                  <span className="font-semibold text-emerald-700">{barterAmount}% of service value</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Remaining cash</span>
                  <span className="font-semibold text-gray-800">{100 - barterAmount}% of service value</span>
                </div>
              </div>
            </div>

            {/* What's included */}
            {business.services_offered?.length > 0 && (
              <div>
                <h3 className="font-bold text-gray-900 mb-3">Other Services by this Business</h3>
                <div className="space-y-2">
                  {business.services_offered.filter((s: string) => s !== serviceName).slice(0, 4).map((s: string, i: number) => (
                    <Link
                      key={i}
                      to={`/service/${business.id}?name=${encodeURIComponent(s)}`}
                      className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-violet-200 hover:bg-violet-50 transition-all group"
                    >
                      <CheckCircle className="h-4 w-4 text-violet-400 group-hover:text-violet-500 shrink-0" />
                      <span className="text-sm text-gray-700 group-hover:text-violet-700 font-medium">{s}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* About the business */}
            {business.description && (
              <div>
                <h3 className="font-bold text-gray-900 mb-2">About {business.business_name}</h3>
                <div
                  className="text-sm text-gray-600 leading-relaxed prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: business.description }}
                />
              </div>
            )}

            {/* Location */}
            {business.location && (
              <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 rounded-xl p-3">
                <MapPin className="h-4 w-4 text-gray-400 shrink-0" />
                {business.location}
              </div>
            )}

            {/* CTA */}
            <div className="pt-2 pb-8">
              <button
                onClick={() => setIsInquiryOpen(true)}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold text-base flex items-center justify-center gap-2 transition-all shadow-lg shadow-violet-200"
              >
                <MessageSquare className="h-5 w-5" />
                Request Quote for "{serviceName}"
              </button>
              <p className="text-center text-xs text-gray-400 mt-3">
                The business will respond with pricing and availability
              </p>
            </div>

          </div>
        </div>
      </div>

      <InquiryModal
        isOpen={isInquiryOpen}
        onClose={() => setIsInquiryOpen(false)}
        merchantName={business.business_name}
        businessName={business.business_name}
        availableServices={business.services_offered || []}
        preselectedService={serviceName}
        pricedItems={[]}
      />
    </div>
  );
};

export default ServiceDetail;
