import React, { Suspense, lazy, useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import LoadingIndicator from './components/LoadingIndicator';
import { trackPageView, trackContactConversion } from './tracker';
// Eager-import LandingPage (homepage) so React hydration doesn't briefly
// replace the SSR'd hero with a Suspense fallback. This is the highest-traffic
// page; the small bundle-size cost is worth the LCP win.
import LandingPage from './pages/LandingPage';

const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./components/Login'));
const Register = lazy(() => import('./components/Register'));
const UserForm = lazy(() => import('./components/UserForm'));
const CompanyForm = lazy(() => import('./components/CompanyForm'));
const ProductForm = lazy(() => import('./components/ProductForm'));
const OrderForm = lazy(() => import('./components/OrderForm'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const Sidebar = lazy(() => import('./components/Sidebar'));
const Catalog = lazy(() => import('./pages/Catalog'));
const LineSheet = lazy(() => import('./pages/LineSheet'));
const QuickOrder = lazy(() => import('./pages/QuickOrder'));
const Cart = lazy(() => import('./pages/Cart'));
const Checkout = lazy(() => import('./pages/Checkout'));
const OrderSuccess = lazy(() => import('./pages/OrderSuccess'));
const Account = lazy(() => import('./pages/Account'));
const OrderHistory = lazy(() => import('./pages/OrderHistory'));
const CodeForm = lazy(() => import('./components/CodeForm'));
const LocationForm = lazy(() => import('./components/LocationForm'));
const Addresses = lazy(() => import('./pages/Addresses'));
const UserGuide = lazy(() => import('./pages/UserGuide'));
const ApiStatus = lazy(() => import('./pages/ApiStatus'));
const ContactUs = lazy(() => import('./pages/ContactUs'));
const About = lazy(() => import('./pages/About'));
const Careers = lazy(() => import('./pages/Careers'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const FAQ = lazy(() => import('./pages/FAQ'));
const Deals = lazy(() => import('./pages/Deals'));
const Quote = lazy(() => import('./pages/Quote'));
const QuoteForm = lazy(() => import('./components/QuoteForm'));
const QuoteDetailForm = lazy(() => import('./components/QuoteDetailForm'));
const QuoteHistory = lazy(() => import('./pages/QuoteHistory'));
const QuoteCreateForm = lazy(() => import('./components/QuoteCreateForm'));
const Compare = lazy(() => import('./pages/Compare'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const Industries = lazy(() => import('./pages/Industries'));
const SolutionsD2CBrands = lazy(() => import('./pages/SolutionsD2CBrands'));
const SolutionsAICommerce = lazy(() => import('./pages/SolutionsAICommerce'));
const SolutionsWholesale = lazy(() => import('./pages/SolutionsWholesale'));
const SolutionsRestaurants = lazy(() => import('./pages/SolutionsRestaurants'));
const SolutionsGrocery = lazy(() => import('./pages/SolutionsGrocery'));
const SolutionsManufacturers = lazy(() => import('./pages/SolutionsManufacturers'));
const SolutionsDistributors = lazy(() => import('./pages/SolutionsDistributors'));
const SolutionsMarketplaceEscape = lazy(() => import('./pages/SolutionsMarketplaceEscape'));
const Blog = lazy(() => import('./pages/Blog'));
const Analytics = lazy(() => import('./pages/Analytics'));
const BlogPost = lazy(() => import('./pages/BlogPost'));
const Billing = lazy(() => import('./pages/Billing'));
const BlogManager = lazy(() => import('./components/BlogManager'));

const AppContent = () => {
  const { isAuthenticated, decodeJWT } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const location = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    trackPageView(location.pathname);
    trackContactConversion(location.pathname);
    setIsLoading(true);
    const timer = setTimeout(() => setIsLoading(false), 500);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  const getRedirectPath = () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      return '/login';
    }
    try {
      const decoded = decodeJWT(token);
      const role = decoded?.role || '';
      if (!['customer', 'admin', 'company', 'partner'].includes(role)) {
        localStorage.removeItem('accessToken');
        return '/login';
      }
      return role === 'customer' ? '/home' : '/dashboard';
    } catch (err: any) {
      localStorage.removeItem('accessToken');
      return '/login';
    }
  };

  const protectedRoutes = [
    '/dashboard',
    '/companies',
    '/products',
    '/orders',
    '/quotes',
    '/line-sheet',
    '/quote-details/:quoteId',
    '/users',
    '/codes',
    '/admin',
    '/admin/users',
    '/admin/products',
    '/admin/orders',
    '/admin/billing',
    '/billing',
    '/locations',
    '/quote-create',
    '/analytics',
    '/blog-manager',
  ];

  return (
    <>
      <LoadingIndicator isLoading={isLoading} />
      <div className="min-h-screen bg-gray-100 flex">
        {isAuthenticated && (
          <Suspense fallback={<div>Loading...</div>}>
            <Routes>
              {protectedRoutes.map((path) => (
                <Route key={path} path={path} element={<Sidebar />} />
              ))}
            </Routes>
          </Suspense>
        )}
        <div className="flex-1 min-w-0">
          <Suspense fallback={<div>Loading...</div>}>
            <Routes>
              <Route path="/" element={isAuthenticated ? <Navigate to={getRedirectPath()} replace /> : <LandingPage />} />
              <Route
                path="/home"
                element={isAuthenticated ? <Home /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/login"
                element={isAuthenticated ? <Navigate to={getRedirectPath()} replace /> : <Login />}
              />
              <Route
                path="/register"
                element={isAuthenticated ? <Navigate to={getRedirectPath()} replace /> : <Register />}
              />
              <Route
                path="/dashboard"
                element={isAuthenticated ? <Dashboard /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/companies"
                element={isAuthenticated ? <CompanyForm /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/products"
                element={isAuthenticated ? <ProductForm /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/blog-manager"
                element={isAuthenticated ? <BlogManager /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/catalog"
                element={isAuthenticated ? <Catalog /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/quick-order"
                element={isAuthenticated ? <QuickOrder /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/line-sheet"
                element={isAuthenticated ? <LineSheet /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/deals"
                element={isAuthenticated ? <Deals /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/cart"
                element={isAuthenticated ? <Cart /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/checkout/:quoteId"
                element={isAuthenticated ? <Checkout /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/quote/:quoteId"
                element={isAuthenticated ? <Quote /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/quotes"
                element={isAuthenticated ? <QuoteForm /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/quote-details/:quoteId"
                element={isAuthenticated ? <QuoteDetailForm /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/quote-history"
                element={isAuthenticated ? <QuoteHistory /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/quote-create"
                element={isAuthenticated ? <QuoteCreateForm /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/order-success"
                element={isAuthenticated ? <OrderSuccess /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/account"
                element={isAuthenticated ? <Account /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/order-history"
                element={isAuthenticated ? <OrderHistory /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/orders"
                element={isAuthenticated ? <OrderForm /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/users"
                element={isAuthenticated ? <UserForm /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/codes"
                element={isAuthenticated ? <CodeForm /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/locations"
                element={isAuthenticated ? <LocationForm /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/customer/addresses"
                element={isAuthenticated ? <Addresses /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/admin"
                element={isAuthenticated ? <div>Admin Panel</div> : <Navigate to="/login" replace />}
              />
              <Route
                path="/admin/users"
                element={isAuthenticated ? <UserForm /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/admin/products"
                element={isAuthenticated ? <ProductForm /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/admin/orders"
                element={isAuthenticated ? <OrderForm /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/admin/billing"
                element={isAuthenticated ? <Billing /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/billing"
                element={isAuthenticated ? <Billing /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/analytics"
                element={isAuthenticated ? <Analytics /> : <Navigate to="/login" replace />}
              />
              <Route path="/user-guide" element={<UserGuide />} />
              <Route path="/system-status" element={<ApiStatus />} />
              <Route path="/contact-us" element={<ContactUs />} />
              <Route path="/about" element={<About />} />
              <Route path="/careers" element={<Careers />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-of-service" element={<TermsOfService />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/compare" element={<Compare />} />
              <Route path="/industries" element={<Industries />} />
              <Route path="/solutions/d2c-brands" element={<SolutionsD2CBrands />} />
              <Route path="/solutions/ai-commerce" element={<SolutionsAICommerce />} />
              <Route path="/solutions/wholesale" element={<SolutionsWholesale />} />
              <Route path="/solutions/restaurants" element={<SolutionsRestaurants />} />
              <Route path="/solutions/grocery" element={<SolutionsGrocery />} />
              <Route path="/solutions/manufacturers" element={<SolutionsManufacturers />} />
              <Route path="/solutions/distributors" element={<SolutionsDistributors />} />
              <Route path="/solutions/marketplace-escape" element={<SolutionsMarketplaceEscape />} />
              <Route path="/blog" element={<Blog />} />
              <Route path="/blog/:slug" element={<BlogPost />} />
              <Route path="*" element={<div className="p-4 text-center text-gray-600">404 Not Found</div>} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </>
  );
};

const App = () => (
  <Router>
    <AppContent />
  </Router>
);

export default App;