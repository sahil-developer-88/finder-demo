import {
  ShoppingBag, Wrench, Utensils, Scissors, Car, Home,
  BookOpen, Stethoscope, Camera, Dumbbell, Briefcase,
  Tag, Clock, SortAsc, MapPin, Star,
} from 'lucide-react';

export const SIDEBAR_CATS = [
  { label: 'Home',        value: 'All Categories', icon: Home },
  { label: 'Restaurant',  value: 'restaurant',     icon: Utensils },
  { label: 'Grocery',     value: 'grocery',        icon: ShoppingBag },
  { label: 'Retail',      value: 'retail',         icon: Tag },
  { label: 'Services',    value: 'service',        icon: Wrench },
  { label: 'Health',      value: 'health',         icon: Stethoscope },
  { label: 'Beauty',      value: 'beauty',         icon: Scissors },
  { label: 'Fitness',     value: 'fitness',        icon: Dumbbell },
  { label: 'Auto',        value: 'mechanic',       icon: Car },
  { label: 'Legal',       value: 'lawyer',         icon: Briefcase },
  { label: 'Education',   value: 'tutor',          icon: BookOpen },
  { label: 'Photo',       value: 'photographer',   icon: Camera },
];

export const FILTER_CHIPS = [
  { label: 'Value Exchange+',   value: 'premium' },
  { label: '100% Barter', value: '100barter' },
  { label: 'Top Rated',   value: 'toprated' },
  { label: 'Rating',      value: 'rating',   icon: Star },
  { label: 'Sort',        value: 'sort',     icon: SortAsc },
  { label: 'Near Me',     value: 'near',     icon: MapPin },
  { label: 'New',         value: 'new',      icon: Clock },
];

export type Banner = { title: string; sub: string; cta: string; bg: string; imgBg: string; expires: string };
export type CatConfig = { featuredTitle: string; nearTitle: string; banners: Banner[] };

export const CATEGORY_CONFIGS: Record<string, CatConfig> = {
  'All Categories': {
    featuredTitle: 'Featured on Value Exchange',
    nearTitle: 'Recently joined',
    banners: [
      { title: 'Earn 500 bonus credits', sub: 'On your first barter trade', cta: 'Start Trading', bg: 'bg-emerald-600', imgBg: 'bg-emerald-500', expires: 'Limited time offer' },
      { title: '0 fee trades this week', sub: 'Trade with any verified business', cta: 'Explore Deals', bg: 'bg-indigo-600', imgBg: 'bg-indigo-500', expires: 'Expires Mar 31' },
    ],
  },
  restaurant: {
    featuredTitle: 'Top Restaurants',
    nearTitle: 'New restaurants near you',
    banners: [
      { title: 'Free delivery on first trade', sub: 'Order from top local restaurants', cta: 'Order Now', bg: 'bg-orange-500', imgBg: 'bg-orange-400', expires: 'First order only' },
      { title: '100% barter restaurants', sub: 'Pay entirely with Value Exchange credits', cta: 'Browse', bg: 'bg-red-600', imgBg: 'bg-red-500', expires: 'Limited spots' },
      { title: 'Weekend special deals', sub: 'Exclusive restaurant offers', cta: 'See Deals', bg: 'bg-amber-600', imgBg: 'bg-amber-500', expires: 'Sat–Sun only' },
    ],
  },
  grocery: {
    featuredTitle: 'Top Grocery Stores',
    nearTitle: 'Grocery stores near you',
    banners: [
      { title: 'Fresh produce, barter style', sub: 'Trade credits for groceries', cta: 'Shop Now', bg: 'bg-green-600', imgBg: 'bg-green-500', expires: 'All week' },
      { title: 'Bulk deals available', sub: 'Save more when you trade more', cta: 'Explore', bg: 'bg-teal-600', imgBg: 'bg-teal-500', expires: 'While stock lasts' },
      { title: 'Organic & local stores', sub: 'Support local farmers with credits', cta: 'Browse', bg: 'bg-lime-600', imgBg: 'bg-lime-500', expires: 'Always available' },
    ],
  },
  retail: {
    featuredTitle: 'Top Retail Stores',
    nearTitle: 'New retail shops near you',
    banners: [
      { title: 'Shop & barter', sub: 'Use credits at local retail stores', cta: 'Shop Now', bg: 'bg-blue-600', imgBg: 'bg-blue-500', expires: 'Ongoing' },
      { title: 'Exclusive retail deals', sub: 'Members get early access', cta: 'Join Free', bg: 'bg-indigo-600', imgBg: 'bg-indigo-500', expires: 'Value Exchange+ only' },
      { title: 'Trade-in for credits', sub: 'Swap your items for store credit', cta: 'Learn More', bg: 'bg-cyan-600', imgBg: 'bg-cyan-500', expires: 'No expiry' },
    ],
  },
  service: {
    featuredTitle: 'Top Service Providers',
    nearTitle: 'New services near you',
    banners: [
      { title: 'Hire local, pay with credits', sub: 'Book services using Value Exchange credits', cta: 'Browse Services', bg: 'bg-purple-600', imgBg: 'bg-purple-500', expires: 'Ongoing' },
      { title: '50% off first booking', sub: 'Try a new service today', cta: 'Book Now', bg: 'bg-violet-600', imgBg: 'bg-violet-500', expires: 'New users only' },
      { title: 'Verified service pros', sub: 'Trusted & reviewed by the community', cta: 'See All', bg: 'bg-fuchsia-600', imgBg: 'bg-fuchsia-500', expires: 'Always' },
    ],
  },
  health: {
    featuredTitle: 'Top Health & Wellness',
    nearTitle: 'New health providers near you',
    banners: [
      { title: 'Your health, barter-powered', sub: 'Clinics & wellness using credits', cta: 'Book Now', bg: 'bg-rose-600', imgBg: 'bg-rose-500', expires: 'Ongoing' },
      { title: 'Mental wellness deals', sub: 'Therapy & coaching with Value Exchange', cta: 'Explore', bg: 'bg-pink-600', imgBg: 'bg-pink-500', expires: 'Limited slots' },
      { title: 'Free first consultation', sub: 'Meet a health pro near you', cta: 'Get Started', bg: 'bg-red-500', imgBg: 'bg-red-400', expires: 'New members' },
    ],
  },
  beauty: {
    featuredTitle: 'Top Beauty & Salons',
    nearTitle: 'New beauty spots near you',
    banners: [
      { title: 'Glow up with credits', sub: 'Salons & spas accept Value Exchange', cta: 'Book Now', bg: 'bg-pink-500', imgBg: 'bg-pink-400', expires: 'Ongoing' },
      { title: 'Free treatment on first trade', sub: 'At select partner salons', cta: 'Claim Now', bg: 'bg-fuchsia-500', imgBg: 'bg-fuchsia-400', expires: 'This month' },
      { title: 'Beauty box subscriptions', sub: 'Trade credits for monthly boxes', cta: 'Subscribe', bg: 'bg-rose-500', imgBg: 'bg-rose-400', expires: 'Members only' },
    ],
  },
  fitness: {
    featuredTitle: 'Top Gyms & Fitness Studios',
    nearTitle: 'New fitness studios near you',
    banners: [
      { title: 'Train now, pay with credits', sub: 'Gyms & studios on Value Exchange', cta: 'Find a Gym', bg: 'bg-orange-600', imgBg: 'bg-orange-500', expires: 'Ongoing' },
      { title: 'First class free', sub: 'Try any fitness studio near you', cta: 'Book Free', bg: 'bg-yellow-600', imgBg: 'bg-yellow-500', expires: 'New members' },
      { title: 'Personal training deals', sub: '1-on-1 sessions with credits', cta: 'Get Fit', bg: 'bg-lime-600', imgBg: 'bg-lime-500', expires: 'Limited spots' },
    ],
  },
  mechanic: {
    featuredTitle: 'Top Auto Services',
    nearTitle: 'New auto shops near you',
    banners: [
      { title: 'Car repairs with credits', sub: 'Trusted mechanics on Value Exchange', cta: 'Find Mechanic', bg: 'bg-slate-600', imgBg: 'bg-slate-500', expires: 'Ongoing' },
      { title: 'Free diagnostics', sub: 'At select partner auto shops', cta: 'Book Now', bg: 'bg-zinc-700', imgBg: 'bg-zinc-600', expires: 'This week' },
      { title: 'Oil change special', sub: 'Trade credits for routine service', cta: 'Claim', bg: 'bg-stone-600', imgBg: 'bg-stone-500', expires: 'While slots last' },
    ],
  },
  lawyer: {
    featuredTitle: 'Top Legal Services',
    nearTitle: 'New legal professionals near you',
    banners: [
      { title: 'Legal help, barter style', sub: 'Consult lawyers with Value Exchange credits', cta: 'Find a Lawyer', bg: 'bg-slate-700', imgBg: 'bg-slate-600', expires: 'Ongoing' },
      { title: 'Free first consultation', sub: 'Meet a local attorney today', cta: 'Book Free', bg: 'bg-gray-700', imgBg: 'bg-gray-600', expires: 'New members' },
      { title: 'Business legal packages', sub: 'Contracts, filings & more with credits', cta: 'Explore', bg: 'bg-neutral-700', imgBg: 'bg-neutral-600', expires: 'Limited offer' },
    ],
  },
  tutor: {
    featuredTitle: 'Top Tutors & Educators',
    nearTitle: 'New tutors near you',
    banners: [
      { title: 'Learn more, pay less', sub: 'Tutors & courses with Value Exchange credits', cta: 'Find a Tutor', bg: 'bg-sky-600', imgBg: 'bg-sky-500', expires: 'Ongoing' },
      { title: 'Free trial lesson', sub: 'Try any tutor risk-free', cta: 'Book Free', bg: 'bg-blue-600', imgBg: 'bg-blue-500', expires: 'New students' },
      { title: 'Group classes available', sub: 'Learn with others, save credits', cta: 'Browse', bg: 'bg-indigo-500', imgBg: 'bg-indigo-400', expires: 'Ongoing' },
    ],
  },
  photographer: {
    featuredTitle: 'Top Photographers',
    nearTitle: 'New photographers near you',
    banners: [
      { title: 'Capture moments with credits', sub: 'Book photographers on Value Exchange', cta: 'Book Now', bg: 'bg-amber-700', imgBg: 'bg-amber-600', expires: 'Ongoing' },
      { title: 'Portrait sessions from 0 cash', sub: 'Trade credits for pro photos', cta: 'Explore', bg: 'bg-orange-700', imgBg: 'bg-orange-600', expires: 'Limited slots' },
      { title: 'Events & weddings', sub: 'Barter coverage for your big day', cta: 'Inquire', bg: 'bg-yellow-700', imgBg: 'bg-yellow-600', expires: 'Book early' },
    ],
  },
};

export function getCategoryConfig(category: string): CatConfig {
  return CATEGORY_CONFIGS[category] ?? {
    featuredTitle: `Top ${category.charAt(0).toUpperCase() + category.slice(1)}`,
    nearTitle: `New ${category} near you`,
    banners: CATEGORY_CONFIGS['All Categories'].banners,
  };
}
