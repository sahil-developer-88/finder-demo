
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { CartProvider } from "@/contexts/CartContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Index from "./pages/Index";
import LandingPage from "./pages/LandingPage";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import MerchantPaymentPage from "./pages/MerchantPayment";
import MerchantDashboardPage from "./pages/MerchantDashboard";
import ListingDetail from "./pages/ListingDetail";
import ProductDetail from "./pages/ProductDetail";
import ServiceDetail from "./pages/ServiceDetail";
import CustomerCheckout from "./pages/CustomerCheckout";
import WebhookTest from "./pages/WebhookTest";
import TradeCompletion from "./pages/TradeCompletion";
import AdminPanel from "./pages/AdminPanel";
import Trading from "./pages/Trading";
import Onboarding from "./components/Onboarding";
import NotFound from "./pages/NotFound";
import TestAccounts from "./pages/TestAccounts";
import TestingPage from "./pages/TestingPage";
import BarterCustomer from "./pages/BarterCustomer";
import BarterMerchant from "./pages/BarterMerchant";
import ProductDashboard from "./pages/ProductDashboard";
import ResetPassword from "./pages/ResetPassword";
import ShopifyPOSCheckout from "./pages/ShopifyPOSCheckout";
import MerchantOrders from "./pages/MerchantOrders";
import EditProfile from "./pages/EditProfile";
import CheckoutComplete from "./pages/CheckoutComplete";
import PaymentRequestsPage from "./pages/PaymentRequestsPage";
import NotificationsPage from "./pages/NotificationsPage";
import Layout from "./components/Layout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
    },
  },
});

const App = () => (
  <ErrorBoundary>
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <CartProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
          <Routes>
            <Route path="/" element={
              <Layout>
                <RootRedirect />
              </Layout>
            } />
            <Route path="/stores" element={
              <ProtectedRoute>
                <Layout>
                  <Index />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/auth" element={
              <Layout showHeader={false} showFooter={false} showCart={false}>
                <Auth />
              </Layout>
            } />
            <Route path="/join" element={
              <Layout showHeader={false} showFooter={false} showCart={false}>
                <Auth />
              </Layout>
            } />
            <Route path="/reset-password" element={
              <Layout showHeader={false} showFooter={false} showCart={false}>
                <ResetPassword />
              </Layout>
            } />
            {import.meta.env.DEV && (
              <Route path="/test-accounts" element={
                <Layout>
                  <TestAccounts />
                </Layout>
              } />
            )}
            <Route path="/testing" element={
              <ProtectedRoute>
                <Layout>
                  <TestingPage />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/barter-customer" element={
              <ProtectedRoute>
                <Layout>
                  <BarterCustomer />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/barter-merchant" element={
              <ProtectedRoute>
                <Layout>
                  <BarterMerchant />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/onboarding" element={
              <ProtectedRoute>
                <Layout showHeader={false} showFooter={false} showCart={false}>
                  <OnboardingPage />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/edit-profile" element={
              <ProtectedRoute>
                <Layout>
                  <EditProfile />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/account-dashboard" element={
              <ProtectedRoute>
                <Layout showCart={false}>
                  <Dashboard />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/trading" element={
              <ProtectedRoute>
                <Layout>
                  <Trading />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/listing/:id" element={
              <Layout>
                <ListingDetail />
              </Layout>
            } />
            <Route path="/product/:id" element={
              <ProtectedRoute>
                <Layout>
                  <ProductDetail />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/service/:businessId" element={
              <Layout>
                <ServiceDetail />
              </Layout>
            } />
            <Route path="/trade-completion/:tradeId" element={
              <ProtectedRoute>
                <Layout>
                  <TradeCompletion />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute adminOnly>
                <Layout showCart={false}>
                  <AdminPanel />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/payment-requests" element={
              <ProtectedRoute>
                <Layout>
                  <PaymentRequestsPage />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/notifications" element={
              <ProtectedRoute>
                <Layout>
                  <NotificationsPage />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/merchant-payment" element={
              <ProtectedRoute>
                <Layout>
                  <MerchantPaymentPage />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/merchant/dashboard" element={
              <ProtectedRoute blockAdmin>
                <Layout>
                  <MerchantDashboardPage />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/merchant/products" element={
              <ProtectedRoute blockAdmin>
                <Layout>
                  <ProductDashboard />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/merchant/orders" element={
              <ProtectedRoute blockAdmin>
                <Layout>
                  <MerchantOrders />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/checkout" element={
              <ProtectedRoute>
                <Layout>
                  <CustomerCheckout />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/checkout/complete" element={
              <ProtectedRoute>
                <Layout>
                  <CheckoutComplete />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/checkout/failed" element={
              <ProtectedRoute>
                <Layout>
                  <CheckoutComplete />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/shopify-pos-checkout" element={
              <ProtectedRoute>
                <Layout>
                  <ShopifyPOSCheckout />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="/webhook-test" element={
              <ProtectedRoute>
                <Layout>
                  <WebhookTest />
                </Layout>
              </ProtectedRoute>
            } />
            <Route path="*" element={
              <Layout>
                <NotFound />
              </Layout>
            } />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
      </CartProvider>
    </AuthProvider>
  </QueryClientProvider>
  </ErrorBoundary>
);

// Wrapper component for onboarding
const OnboardingPage = () => {
  return <Onboarding />;
};

// Redirect logged-in users away from the landing page to the store
const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/stores" replace />;
  return <LandingPage />;
};

export default App;
