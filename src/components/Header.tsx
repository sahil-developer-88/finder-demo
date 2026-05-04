
import React, { useState, useRef, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useHasRole } from "@/hooks/useHasRole";
import { useCart } from "@/contexts/CartContext";
import PaymentRequestButton from "@/components/PaymentRequestButton";
import { useMessages } from "@/hooks/useMessages";
import { useNotifications } from "@/hooks/useNotifications";
import { useNavigate } from 'react-router-dom';
import { LogOut, LogIn, Shield, ShoppingCart, User, Zap, Menu, X, Home, MessageSquare, CreditCard, Bell, Check, CheckCheck, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ScrollArea } from '@/components/ui/scroll-area';

const Header = () => {
  const { user, signOut } = useAuth();
  const { hasRole: isAdmin } = useHasRole('admin');
  const { cartCount } = useCart();
  const { totalUnread: totalUnreadMessages, markAllMessagesAsRead } = useMessages();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const closeMobile = () => setMobileMenuOpen(false);

  // Close notification dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <header className="sticky top-0 z-50">
      {/* Main bar */}
      <div className="bg-gradient-to-r from-slate-950 via-indigo-950 to-slate-950 border-b border-white/10">
        {/* Subtle top glow line */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-indigo-500 to-transparent opacity-60" />

        <div className="mobile-container">
          <div className="flex items-center justify-between h-16">

            {/* Logo */}
            <button
              onClick={() => { navigate('/'); closeMobile(); }}
              className="flex items-center gap-2.5 group"
            >
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/40 group-hover:shadow-indigo-500/60 transition-shadow">
                  <Zap className="w-5 h-5 text-white" fill="white" />
                </div>
                <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 blur-md opacity-40 group-hover:opacity-60 transition-opacity -z-10" />
              </div>
              <span className="text-xl font-black tracking-tight">
                <span className="bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">Swap</span>
                <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">Shop</span>
              </span>
            </button>

            {/* Desktop nav — hidden on mobile */}
            <nav className="hidden md:flex items-center gap-1">
              <NavLink icon={Home} label="Home" onClick={() => navigate('/stores')} />
              {user && !isAdmin && (
                <NavLink icon={User} label="Dashboard" onClick={() => navigate('/account-dashboard')} />
              )}
              {user && !isAdmin && (
                <NavLink icon={CreditCard} label="Trade: Send / Request" onClick={() => navigate('/account-dashboard?tab=trade-send-request&tsub=Send+Barter')} />
              )}
              {user && isAdmin && (
                <NavLink icon={Shield} label="Admin" onClick={() => navigate('/admin')} accent="emerald" />
              )}
            </nav>

            {/* Desktop right actions — hidden on mobile */}
            <div className="hidden md:flex items-center gap-1">
              {user && (
                <>
                  {cartCount > 0 && (
                    <IconButton onClick={() => navigate('/checkout')} title="Cart" badge={cartCount}>
                      <ShoppingCart className="w-5 h-5" />
                    </IconButton>
                  )}

                  {/* Notifications bell */}
                  <div className="relative" ref={notifRef}>
                    <button
                      onClick={() => setShowNotifications(prev => !prev)}
                      title="Notifications"
                      className={`relative p-2 rounded-xl transition-all ${
                        unreadCount > 0
                          ? 'text-indigo-300 hover:text-white bg-indigo-500/20 hover:bg-indigo-500/30 shadow-lg shadow-indigo-500/30'
                          : 'text-white/60 hover:text-white hover:bg-white/10'
                      }`}
                    >
                      <Bell className={`w-5 h-5 ${unreadCount > 0 ? 'animate-pulse' : ''}`} />
                      {unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 bg-indigo-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                          {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                    </button>

                    {/* Dropdown */}
                    {showNotifications && (
                      <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                          <span className="font-semibold text-gray-900 text-sm">Notifications</span>
                          {unreadCount > 0 && (
                            <button
                              onClick={markAllAsRead}
                              className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                            >
                              <CheckCheck className="h-3 w-3" /> Mark all read
                            </button>
                          )}
                        </div>

                        {/* List */}
                        <ScrollArea className="h-80">
                          {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                              <Bell className="h-8 w-8 mb-2 opacity-30" />
                              <p className="text-sm">No notifications yet</p>
                            </div>
                          ) : (
                            <div>
                              {notifications.map((n) => {
                                const isCR = n.title?.toLowerCase().includes('received') || n.title?.toLowerCase().includes('credit');
                                const isDR = n.title?.toLowerCase().includes('debit') || n.title?.toLowerCase().includes('debited');
                                return (
                                  <div
                                    key={n.id}
                                    onClick={() => {
                                      if (!n.read) markAsRead(n.id);
                                      setShowNotifications(false);
                                      if (n.message?.startsWith('trade_request:') || n.title?.toLowerCase().includes('trade request')) {
                                        navigate('/account-dashboard?tab=trade-send-request&tsub=Trade+Requests');
                                      } else if (n.title?.toLowerCase().includes('credit') || n.title?.toLowerCase().includes('debit') || n.title?.toLowerCase().includes('barter')) {
                                        navigate('/account-dashboard?tab=wallet');
                                      } else {
                                        navigate('/notifications');
                                      }
                                    }}
                                    className={`flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${!n.read ? 'bg-indigo-50/50' : ''}`}
                                  >
                                    {/* Icon */}
                                    <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-0.5 ${
                                      isDR ? 'bg-red-100' : isCR ? 'bg-emerald-100' : 'bg-indigo-100'
                                    }`}>
                                      {isDR
                                        ? <ArrowUpRight className="h-4 w-4 text-red-500" />
                                        : isCR
                                        ? <ArrowDownLeft className="h-4 w-4 text-emerald-500" />
                                        : <Bell className="h-4 w-4 text-indigo-500" />
                                      }
                                    </div>

                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-semibold text-gray-900 truncate">{n.title}</p>
                                        {!n.read && <span className="shrink-0 w-2 h-2 rounded-full bg-indigo-500" />}
                                      </div>
                                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                                        {n.message?.startsWith('trade_request:') ? 'Tap to view and respond' : n.title?.toLowerCase().includes('trade request') ? 'Tap to view your trade requests' : n.message}
                                      </p>
                                      <p className="text-[10px] text-gray-400 mt-1">
                                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </ScrollArea>

                        <div className="p-2 border-t text-center">
                          <button
                            onClick={() => { setShowNotifications(false); navigate('/notifications'); }}
                            className="text-xs w-full py-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors font-medium"
                          >
                            View all notifications
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Messages */}
                  <button
                    onClick={() => { markAllMessagesAsRead(); navigate(isAdmin ? '/admin?section=support' : '/account-dashboard?tab=inbox'); }}
                    title="Messages"
                    className={`relative p-2 rounded-xl transition-all ${
                      totalUnreadMessages > 0
                        ? 'text-indigo-300 hover:text-white bg-indigo-500/20 hover:bg-indigo-500/30 shadow-lg shadow-indigo-500/30'
                        : 'text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <MessageSquare className={`w-5 h-5 ${totalUnreadMessages > 0 ? 'animate-pulse' : ''}`} />
                    {totalUnreadMessages > 0 && (
                      <>
                        <span className="absolute -top-0.5 -right-0.5 bg-indigo-500 text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center">
                          {totalUnreadMessages}
                        </span>
                        <span className="absolute inset-0 rounded-xl bg-indigo-400/20 animate-ping" />
                      </>
                    )}
                  </button>

                  <div className="mr-1">
                    <PaymentRequestButton />
                  </div>

                  <button
                    onClick={signOut}
                    className="flex items-center gap-1.5 ml-1 px-3 py-1.5 rounded-xl text-sm font-medium text-white/50 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Sign Out</span>
                  </button>
                </>
              )}

              {!user && (
                <button
                  onClick={() => navigate('/auth')}
                  className="relative flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold text-white overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 group-hover:from-indigo-500 group-hover:to-violet-500 transition-all" />
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 blur-md opacity-50 group-hover:opacity-70 transition-opacity" />
                  <LogIn className="w-4 h-4 relative z-10" />
                  <span className="relative z-10">Sign In</span>
                </button>
              )}
            </div>

            {/* Mobile right: Home + Sign In (logged out) OR Home + hamburger (logged in) */}
            <div className="flex md:hidden items-center gap-2">
              <button
                onClick={() => navigate('/stores')}
                className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all"
                title="Home"
              >
                <Home className="w-5 h-5" />
              </button>
              {!user && (
                <button
                  onClick={() => navigate('/auth')}
                  className="relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 group-hover:from-indigo-500 group-hover:to-violet-500 transition-all" />
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-violet-600 blur-md opacity-50 group-hover:opacity-70 transition-opacity" />
                  <LogIn className="w-4 h-4 relative z-10" />
                  <span className="relative z-10">Sign In</span>
                </button>
              )}
              {user && (
                <button
                  className="p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all relative"
                  onClick={() => setMobileMenuOpen(prev => !prev)}
                >
                  {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                </button>
              )}
            </div>

          </div>
        </div>
        {/* Subtle bottom glow line */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />
      </div>

      {/* Mobile dropdown menu — logo + hamburger only above, everything else here */}
      {user && mobileMenuOpen && (
        <div className="md:hidden bg-slate-950 border-b border-white/10 px-4 py-3 space-y-1">
          {/* Nav links */}
          <button
            onClick={() => { navigate('/stores'); closeMobile(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all text-left"
          >
            <Home className="w-4 h-4" /> Home
          </button>
          {!isAdmin && (
            <button
              onClick={() => { navigate('/account-dashboard'); closeMobile(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all text-left"
            >
              <User className="w-4 h-4" /> Dashboard
            </button>
          )}
          {!isAdmin && (
            <button
              onClick={() => { navigate('/account-dashboard?tab=trade-send-request&tsub=Send+Barter'); closeMobile(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all text-left"
            >
              <CreditCard className="w-4 h-4" /> Trade: Send / Request
            </button>
          )}
          {isAdmin && (
            <button
              onClick={() => { navigate('/admin'); closeMobile(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 transition-all text-left"
            >
              <Shield className="w-4 h-4" /> Admin
            </button>
          )}

          {/* Divider */}
          <div className="border-t border-white/10 my-1" />

          {/* Cart */}
          {cartCount > 0 && (
            <button
              onClick={() => { navigate('/checkout'); closeMobile(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 transition-all text-left"
            >
              <ShoppingCart className="w-4 h-4" />
              Cart
              <span className="ml-auto bg-indigo-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {cartCount}
              </span>
            </button>
          )}

          {/* Messages */}
          <button
            onClick={() => { markAllMessagesAsRead(); navigate(isAdmin ? '/admin?section=support' : '/account-dashboard?tab=inbox'); closeMobile(); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
              totalUnreadMessages > 0
                ? 'text-indigo-300 bg-indigo-500/20 hover:bg-indigo-500/30'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <MessageSquare className={`w-4 h-4 ${totalUnreadMessages > 0 ? 'animate-pulse' : ''}`} />
            Messages
            {totalUnreadMessages > 0 && (
              <span className="ml-auto bg-indigo-500 text-white text-[10px] font-bold rounded-full h-5 w-5 flex items-center justify-center">
                {totalUnreadMessages}
              </span>
            )}
          </button>

          {/* Payment request */}
          <div className="px-3 py-1 [&_button]:w-full [&_button]:justify-start [&_button]:bg-transparent [&_button]:border-white/20 [&_button]:text-white/70 [&_button:hover]:bg-white/10 [&_button]:rounded-xl [&_button]:text-sm">
            <PaymentRequestButton />
          </div>

          {/* Sign out */}
          <button
            onClick={() => { signOut(); closeMobile(); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all text-left"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      )}
    </header>
  );
};

/* ── Small helper components ── */

const NavLink = ({
  icon: Icon,
  label,
  onClick,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  accent?: 'emerald';
}) => {
  const color = accent === 'emerald'
    ? 'text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300'
    : 'text-white/60 hover:text-white hover:bg-white/10';

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${color}`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
};

const IconButton = ({
  children,
  onClick,
  title,
  badge,
  badgeColor = 'indigo',
}: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  badge?: number;
  badgeColor?: 'indigo' | 'red';
}) => {
  const badgeBg = badgeColor === 'red' ? 'bg-red-500' : 'bg-indigo-500';
  return (
    <button
      onClick={onClick}
      title={title}
      className="relative p-2 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all"
    >
      {children}
      {badge && badge > 0 ? (
        <span className={`absolute -top-0.5 -right-0.5 ${badgeBg} text-white text-[10px] font-bold rounded-full h-4 w-4 flex items-center justify-center`}>
          {badge}
        </span>
      ) : null}
    </button>
  );
};

export default Header;
