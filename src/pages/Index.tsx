import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useHasRole } from '@/hooks/useHasRole';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { MessageSquare, Settings, Store, Search, Loader2, ChevronLeft } from 'lucide-react';
import AIChatbar from '@/components/AIChatbar';
import PWAInstallPrompt from '@/components/PWAInstallPrompt';
import { usePWA } from '@/hooks/usePWA';

import { SIDEBAR_CATS, getCategoryConfig } from '@/constants/storeCategories';
import { transformBusiness, enrichBusinessType } from '@/utils/transformBusiness';
import StoreSidebar from '@/components/store/StoreSidebar';
import StoreFilterChips from '@/components/store/StoreFilterChips';
import HScrollSection from '@/components/store/HScrollSection';
import StoreCard from '@/components/store/StoreCard';
import PromoBanners from '@/components/store/PromoBanners';
import { useFavorites } from '@/hooks/useFavorites';
import AdvancedFilters, { FilterState, DEFAULT_FILTERS } from '@/components/store/AdvancedFilters';
import { useRecommendations } from '@/hooks/useRecommendations';

const PAGE_SIZE = 9;

const Index = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchParams, setSearchParams] = useSearchParams();
  const VALID_CATS = SIDEBAR_CATS.map(c => c.value);
  const selectedCategory = VALID_CATS.includes(searchParams.get('category') ?? '') ? searchParams.get('category')! : 'All Categories';
  const setSelectedCategory = (cat: string) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      cat === 'All Categories' ? next.delete('category') : next.set('category', cat);
      return next;
    });
  };
  const [activeFilter, setActiveFilter] = useState('');
  const [showAIChat, setShowAIChat] = useState(false);
  const [advFilters, setAdvFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const { toggleFavorite, isFavorite } = useFavorites();
  const { recommendations, loading: recoLoading } = useRecommendations();
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [featured, setFeatured] = useState<any[]>([]);
  const [nearYou, setNearYou] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);
  const [topServices, setTopServices] = useState<any[]>([]);
  const [sectionsLoading, setSectionsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showInstallPromptState, setShowInstallPromptState] = useState(true);

  const pageRef = useRef(0);
  const isFetchingRef = useRef(false);
  const hasMoreRef = useRef(true);

  const { isInstallable, isInstalled } = usePWA();
  const { user } = useAuth();
  const { hasRole: isAdmin } = useHasRole('admin');
  const navigate = useNavigate();

  // Fetch featured + near you sections (re-fetch when category changes)
  useEffect(() => {
    const fetchSections = async () => {
      setSectionsLoading(true);
      try {
        const isCat = selectedCategory !== 'All Categories';
        let fQuery = supabase.from('businesses')
          .select('id, user_id, business_name, category, description, services_offered, barter_percentage, location, contact_method, status')
          .order('barter_percentage', { ascending: false })
          .limit(12);
        let nQuery = supabase.from('businesses')
          .select('id, user_id, business_name, category, description, services_offered, barter_percentage, location, contact_method, status')
          .order('created_at', { ascending: false })
          .limit(12);
        if (user) { fQuery = fQuery.neq('user_id', user.id); nQuery = nQuery.neq('user_id', user.id); }

        if (isCat) {
          if (selectedCategory === 'service') {
            // "Services" sidebar item = filter by business_type, not category name
            const { data: svcProfiles } = await supabase.from('profiles').select('user_id').eq('business_type', 'service');
            const svcUserIds = (svcProfiles || []).map(p => p.user_id);
            if (svcUserIds.length) {
              fQuery = fQuery.in('user_id', svcUserIds);
              nQuery = nQuery.in('user_id', svcUserIds);
            }
          } else {
            fQuery = fQuery.ilike('category', `%${selectedCategory}%`);
            nQuery = nQuery.ilike('category', `%${selectedCategory}%`);
          }
        }

        // Top product/service sections — only for home page
        if (!isCat) {
          const [productProfiles, serviceProfiles] = await Promise.all([
            supabase.from('profiles').select('user_id').eq('business_type', 'product'),
            supabase.from('profiles').select('user_id').eq('business_type', 'service'),
          ]);
          const productUserIds = (productProfiles.data || []).map(p => p.user_id);
          const serviceUserIds = (serviceProfiles.data || []).map(p => p.user_id);

          let pQuery = supabase.from('businesses')
            .select('id, user_id, business_name, category, description, services_offered, barter_percentage, location, contact_method, status')
            .order('barter_percentage', { ascending: false }).limit(12);
          let sQuery = supabase.from('businesses')
            .select('id, user_id, business_name, category, description, services_offered, barter_percentage, location, contact_method, status')
            .order('barter_percentage', { ascending: false }).limit(12);
          if (user) { pQuery = pQuery.neq('user_id', user.id); sQuery = sQuery.neq('user_id', user.id); }

          if (productUserIds.length) pQuery = pQuery.in('user_id', productUserIds);
          if (serviceUserIds.length) sQuery = sQuery.in('user_id', serviceUserIds);

          const [f, n, p, s] = await Promise.all([fQuery, nQuery, pQuery, sQuery]);
          const [featuredData, nearYouData] = await Promise.all([
            enrichBusinessType(f.data || []),
            enrichBusinessType(n.data || []),
          ]);
          setFeatured(featuredData);
          setNearYou(nearYouData);
          setTopProducts((p.data || []).map(b => transformBusiness(b, 'product')));
          setTopServices((s.data || []).map(b => transformBusiness(b, 'service')));
        } else {
          const [f, n] = await Promise.all([fQuery, nQuery]);
          const [featuredData, nearYouData] = await Promise.all([
            enrichBusinessType(f.data || []),
            enrichBusinessType(n.data || []),
          ]);
          setFeatured(featuredData);
          setNearYou(nearYouData);
          setTopProducts([]);
          setTopServices([]);
        }
      } catch (err) {
        console.error('Failed to fetch sections:', err);
      } finally {
        setSectionsLoading(false);
      }
    };
    fetchSections();
  }, [selectedCategory]);

  const fetchPage = useCallback(async (pageIndex: number, replace: boolean) => {
    const from = pageIndex * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const sort = searchParams.get('sort') ?? '';

    let query = supabase
      .from('businesses')
      .select('id, user_id, business_name, category, description, services_offered, barter_percentage, location, contact_method, status')
      .order(sort === 'featured' ? 'barter_percentage' : 'created_at', { ascending: false })
      .range(from, to);

    if (user) query = query.neq('user_id', user.id);
    if (searchTerm) {
      query = query.or(
        `business_name.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,location.ilike.%${searchTerm}%`
      );
    }
    if (selectedCategory !== 'All Categories') {
      if (selectedCategory === 'service') {
        const { data: svcProfiles } = await supabase.from('profiles').select('user_id').eq('business_type', 'service');
        const svcUserIds = (svcProfiles || []).map(p => p.user_id);
        if (svcUserIds.length) query = query.in('user_id', svcUserIds);
      } else {
        query = query.ilike('category', `%${selectedCategory}%`);
      }
    }
    if (activeFilter === '100barter') query = query.gte('barter_percentage', 50);
    if (advFilters.minBarter > 0) query = query.gte('barter_percentage', advFilters.minBarter);
    if (advFilters.location.trim()) query = query.ilike('location', `%${advFilters.location.trim()}%`);
    if (advFilters.minRating > 0) query = query.gte('average_rating', advFilters.minRating);
    if (advFilters.businessType !== 'all') {
      const { data: typeProfiles } = await supabase.from('profiles').select('user_id').eq('business_type', advFilters.businessType);
      const typeUserIds = (typeProfiles || []).map((p: any) => p.user_id);
      if (typeUserIds.length) query = query.in('user_id', typeUserIds);
    }

    const { data, error } = await query;
    if (error) throw error;
    const transformed = await enrichBusinessType(data || []);

    if (replace) {
      setBusinesses(transformed);
    } else {
      setBusinesses(prev => {
        const ids = new Set(prev.map(b => b.id));
        return [...prev, ...transformed.filter((b: any) => !ids.has(b.id))];
      });
    }
    const more = transformed.length === PAGE_SIZE;
    hasMoreRef.current = more;
    setHasMore(more);
  }, [searchTerm, selectedCategory, activeFilter, advFilters, searchParams]);

  useEffect(() => {
    pageRef.current = 0;
    isFetchingRef.current = false;
    hasMoreRef.current = true;
    setHasMore(true);
    setInitialLoading(true);
    setBusinesses([]);
    fetchPage(0, true).catch(console.error).finally(() => setInitialLoading(false));
  }, [fetchPage]);

  useEffect(() => {
    if (initialLoading) return;
    const handleScroll = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      if (scrolled >= total - 400 && hasMoreRef.current && !isFetchingRef.current) {
        const next = pageRef.current + 1;
        pageRef.current = next;
        isFetchingRef.current = true;
        setLoadingMore(true);
        fetchPage(next, false).catch(console.error).finally(() => { isFetchingRef.current = false; setLoadingMore(false); });
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [fetchPage, initialLoading]);

  const sortParam = searchParams.get('sort') ?? '';
  const isFiltering = searchTerm || activeFilter || advFilters.minBarter > 0 || advFilters.businessType !== 'all' || advFilters.minRating > 0 || advFilters.location.trim();
  const isSeeAll = !!sortParam;
  const selectedCatLabel = SIDEBAR_CATS.find(c => c.value === selectedCategory)?.label || 'All';
  const catConfig = getCategoryConfig(selectedCategory);

  return (
    <div className="bg-gray-50 flex min-h-screen">

      <StoreSidebar
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
        onClearFilter={() => setActiveFilter('')}
      />

      {/* ── Right content ────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col">
        <main className="flex-1 px-4 lg:px-8 py-5">

          {/* Search bar */}
          <div className="relative mb-5 max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search businesses, services..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white border border-gray-200 text-gray-800 placeholder-gray-400 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 transition-all"
            />
          </div>

          {/* Selected category title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{selectedCatLabel}</h1>

          <div className="flex items-start gap-3 flex-wrap mb-5">
            <StoreFilterChips activeFilter={activeFilter} onFilterChange={setActiveFilter} />
            <AdvancedFilters filters={advFilters} onChange={setAdvFilters} />
          </div>


          {/* See All: back button + title */}
          {isSeeAll && (
            <div className="flex items-center gap-3 mb-5">
              <Link
                to={selectedCategory === 'All Categories' ? '/stores' : `/stores?category=${selectedCategory}`}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </Link>
              <h1 className="text-2xl font-bold text-gray-900">
                {sortParam === 'featured' ? catConfig.featuredTitle : catConfig.nearTitle}
              </h1>
            </div>
          )}

          {/* Sections — only when not filtering and not see-all */}
          {!isFiltering && !isSeeAll && (
            <>
              <PromoBanners />

              {user && (recoLoading || recommendations.length > 0) && (
                <HScrollSection
                  title="⭐ Recommended for You"
                  businesses={recommendations}
                  loading={recoLoading}
                  onToggleFavorite={toggleFavorite}
                  isFavorite={isFavorite}
                />
              )}

              <HScrollSection
                title={catConfig.featuredTitle}
                businesses={featured}
                loading={sectionsLoading}
                seeAllUrl={selectedCategory === 'All Categories'
                  ? '/stores?sort=featured'
                  : `/stores?category=${selectedCategory}&sort=featured`}
                onToggleFavorite={toggleFavorite}
                isFavorite={isFavorite}
              />
              <HScrollSection
                title={catConfig.nearTitle}
                businesses={nearYou}
                loading={sectionsLoading}
                seeAllUrl={selectedCategory === 'All Categories'
                  ? '/stores?sort=new'
                  : `/stores?category=${selectedCategory}&sort=new`}
                onToggleFavorite={toggleFavorite}
                isFavorite={isFavorite}
              />

              {selectedCategory === 'All Categories' && (
                <>
                  <HScrollSection
                    title="🛍️ Top Product Businesses"
                    businesses={topProducts}
                    loading={sectionsLoading}
                    seeAllUrl="/stores?sort=featured&type=product"
                    onToggleFavorite={toggleFavorite}
                    isFavorite={isFavorite}
                  />
                  <HScrollSection
                    title="🔧 Top Service Businesses"
                    businesses={topServices}
                    loading={sectionsLoading}
                    seeAllUrl="/stores?sort=featured&type=service"
                    onToggleFavorite={toggleFavorite}
                    isFavorite={isFavorite}
                  />
                </>
              )}
            </>
          )}

          {/* All businesses / results */}
          <div>
            {!initialLoading && (
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  {isSeeAll
                    ? (sortParam === 'featured' ? catConfig.featuredTitle : catConfig.nearTitle)
                    : isFiltering ? 'Results' : 'All Businesses'}
                </h2>
                <span className="text-sm text-gray-400">{businesses.length} {businesses.length === 1 ? 'store' : 'stores'}</span>
              </div>
            )}

            {/* Skeleton */}
            {initialLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: PAGE_SIZE }).map((_, i) => (
                  <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                    <div className="h-36 bg-gray-100" />
                    <div className="p-3 space-y-2">
                      <div className="h-4 bg-gray-100 rounded w-3/4" />
                      <div className="h-3 bg-gray-50 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty */}
            {!initialLoading && businesses.length === 0 && (
              <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
                {isFiltering ? (
                  <>
                    <div className="text-4xl mb-3">🔍</div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-1">No matches found</h3>
                    <p className="text-sm text-gray-400">Try different keywords or broaden your search</p>
                    <button
                      onClick={() => { setSearchTerm(''); setSelectedCategory('All Categories'); setActiveFilter(''); }}
                      className="mt-4 text-sm text-indigo-600 font-semibold hover:underline"
                    >
                      Clear filters
                    </button>
                  </>
                ) : (
                  <>
                    <div className="text-4xl mb-3">🌱</div>
                    <h3 className="text-lg font-semibold text-gray-700 mb-1">This spot is wide open!</h3>
                    <p className="text-sm text-gray-400">No businesses have joined this category yet — be the first to get discovered on Valuehub Exchange!</p>
                  </>
                )}
              </div>
            )}

            {/* Grid */}
            {!initialLoading && businesses.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {businesses.map(b => <StoreCard key={b.id} business={b} onToggleFavorite={toggleFavorite} isFavorite={isFavorite} />)}
              </div>
            )}

            {/* Load more */}
            <div className="mt-8 flex justify-center">
              {loadingMore && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-500" /> Loading more...
                </div>
              )}
              {!hasMore && !initialLoading && businesses.length > 0 && (
                <p className="text-sm text-gray-400">You've seen all businesses</p>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* PWA */}
      {isInstallable && showInstallPromptState && !isInstalled && (
        <PWAInstallPrompt onDismiss={() => setShowInstallPromptState(false)} />
      )}

      {/* Admin button */}
      {user && isAdmin && (
        <div className="fixed bottom-20 left-24 z-40">
          <Button onClick={() => navigate('/admin')} className="rounded-full w-12 h-12 bg-gray-800 hover:bg-gray-900 shadow-lg">
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      )}

      {/* AI chat panel — fixed overlay above button */}
      {showAIChat && (
        <div className="fixed bottom-20 right-4 w-[calc(100vw-2rem)] max-w-md z-50">
          <AIChatbar onSearch={(q) => { setSearchTerm(q); setShowAIChat(false); }} onClose={() => setShowAIChat(false)} />
        </div>
      )}

      {/* AI chat button */}
      <Button
        onClick={() => setShowAIChat(!showAIChat)}
        className="fixed bottom-4 right-4 rounded-full w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 shadow-lg z-50"
      >
        <MessageSquare className="w-5 h-5 sm:w-6 sm:h-6" />
      </Button>
    </div>
  );
};

export default Index;
