
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from "@/components/ui/button";
import { Users, TrendingUp, Handshake, Store, Search, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from '@/hooks/useAuth';

interface HeroSectionProps {
  searchTerm?: string;
  onSearch?: (value: string) => void;
}

const HeroSection = ({ searchTerm = '', onSearch }: HeroSectionProps) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<{ activeBusinesses: number; totalTransactions: number } | null>(null);
  const [localSearch, setLocalSearch] = useState(searchTerm);

  useEffect(() => {
    setLocalSearch(searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const { count: businessCount } = await supabase
          .from('businesses')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'active');
        const { count: transactionCount } = await supabase
          .from('transactions')
          .select('*', { count: 'exact', head: true });
        setStats({
          activeBusinesses: businessCount ?? 0,
          totalTransactions: transactionCount ?? 0,
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };
    fetchStats();
  }, []);

  const formatValue = (transactions: number) => {
    const estimatedValue = transactions * 150;
    if (estimatedValue >= 1000000) return `$${(estimatedValue / 1000000).toFixed(1)}M`;
    if (estimatedValue >= 1000) return `$${(estimatedValue / 1000).toFixed(0)}K`;
    return `$${estimatedValue}`;
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch?.(localSearch);
    document.getElementById('listings')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-purple-900 to-violet-900 text-white">
      {/* Dot grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, white 1.5px, transparent 0)',
          backgroundSize: '32px 32px',
        }}
      />
      {/* Glow blobs */}
      <div className="absolute top-0 left-1/3 w-[500px] h-[500px] bg-purple-500 rounded-full opacity-20 blur-3xl -translate-y-2/3 pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-400 rounded-full opacity-15 blur-3xl translate-y-1/2 pointer-events-none" />

      <div className="relative px-6 py-16 md:py-24 text-center max-w-4xl mx-auto">
        {/* Live badge */}
        <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 text-sm mb-8">
          <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          Live marketplace ·{' '}
          {stats === null ? (
            <span className="inline-block w-5 h-3.5 bg-white/20 rounded animate-pulse" />
          ) : (
            stats.activeBusinesses
          )}{' '}
          merchants active
        </div>

        <h1 className="text-5xl md:text-6xl font-black mb-5 leading-[1.1] tracking-tight">
          Trade Services,{' '}
          <span className="bg-gradient-to-r from-yellow-300 via-orange-300 to-pink-400 bg-clip-text text-transparent">
            Not Just Cash
          </span>
        </h1>

        <p className="text-lg md:text-xl text-white/65 mb-10 max-w-xl mx-auto leading-relaxed">
          Join local businesses exchanging services with flexible barter percentages.
          Save cash while growing your network.
        </p>

        {/* Search bar */}
        <form onSubmit={handleSearchSubmit} className="max-w-2xl mx-auto mb-10">
          <div className="flex items-center bg-white rounded-2xl shadow-2xl shadow-black/30 p-2 gap-2">
            <Search className="ml-3 h-5 w-5 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              placeholder="Search businesses, services, categories..."
              value={localSearch}
              onChange={(e) => {
                setLocalSearch(e.target.value);
                onSearch?.(e.target.value);
              }}
              className="flex-1 text-gray-900 placeholder-gray-400 bg-transparent outline-none text-base py-2"
            />
            <Button
              type="submit"
              className="bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 rounded-xl px-6 shrink-0"
            >
              Search
            </Button>
          </div>
        </form>

        {/* CTAs */}
        {!user && (
          <div className="flex flex-col sm:flex-row justify-center gap-3 mb-12">
            <Button
              size="lg"
              className="bg-white text-indigo-900 hover:bg-white/90 font-semibold rounded-xl shadow-lg"
              asChild
            >
              <Link to="/auth">
                <Store className="w-4 h-4 mr-2" />
                Join as Merchant
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10 rounded-xl"
              asChild
            >
              <a href="#listings">
                Browse Listings
                <ArrowRight className="w-4 h-4 ml-2" />
              </a>
            </Button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
          {[
            { icon: Users, label: 'Active Merchants', value: stats?.activeBusinesses },
            {
              icon: TrendingUp,
              label: 'Value Exchanged',
              value: stats ? formatValue(stats.totalTransactions) : null,
            },
            { icon: Handshake, label: 'Successful Trades', value: stats?.totalTransactions },
          ].map(({ icon: Icon, label, value }) => (
            <div
              key={label}
              className="bg-white/10 backdrop-blur-sm border border-white/15 rounded-2xl p-4 text-center"
            >
              <Icon className="h-5 w-5 mx-auto mb-2 text-white/50" />
              {value === null || value === undefined ? (
                <div className="h-7 w-16 bg-white/20 rounded-lg animate-pulse mx-auto mb-1" />
              ) : (
                <div className="text-2xl font-bold">{value}</div>
              )}
              <div className="text-xs text-white/50 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default HeroSection;
