import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';

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

const App = () => {
  const { isAuthenticated, decodeJWT } = useAuth();

  const getRedirectPath = () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      return '/login';
    }
    try {
      const decoded = decodeJWT(token);
      const role = decoded?.role || '';
      if (!['customer', 'admin', 'company'].includes(role)) {
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
    '/users',
    '/codes',
    '/admin',
    '/admin/users',
    '/admin/products',
    '/admin/orders',
    '/locations',
  ];

  return (
    <Router>
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
        <div className="flex-1">
          <Suspense fallback={<div>Loading...</div>}>
            <Routes>
              <Route path="/home" element={<Home />} />
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
                path="/catalog"
                element={isAuthenticated ? <Catalog /> : <Navigate to="/login" replace />}
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
              <Route path="/user-guide" element={<UserGuide />} />
              <Route path="/api-status" element={<ApiStatus />} />
              <Route path="/contact-us" element={<ContactUs />} />
              <Route path="/about" element={<About />} />
              <Route path="/careers" element={<Careers />} />
              <Route path="/privacy-policy" element={<PrivacyPolicy />} />
              <Route path="/terms-of-service" element={<TermsOfService />} />
              <Route path="/faq" element={<FAQ />} />
              <Route path="/" element={<Home />} />
              <Route path="*" element={<div className="p-4 text-center text-gray-600">404 Not Found</div>} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </Router>
  );
};

export default App;