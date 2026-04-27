import React from 'react';
import Header from './Header';
import Footer from './Footer';
import CartDrawer from './cart/CartDrawer';

interface LayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
  showFooter?: boolean;
  showCart?: boolean;
}

const Layout: React.FC<LayoutProps> = ({ children, showHeader = true, showFooter = true, showCart = true }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {showHeader && <Header />}
      <main className="flex-1">
        {children}
      </main>
      {showFooter && <Footer />}
      {showCart && <CartDrawer />}
    </div>
  );
};

export default Layout;
