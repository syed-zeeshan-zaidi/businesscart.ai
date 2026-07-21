import React, { useState, useEffect, Fragment, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BellIcon, ShoppingCartIcon, ArrowRightStartOnRectangleIcon, TagIcon, HomeIcon, CubeIcon, UserCircleIcon, ClipboardDocumentListIcon, MapPinIcon, DocumentPlusIcon, Bars3Icon, BoltIcon } from '@heroicons/react/24/outline';
import { Toaster, toast } from 'react-hot-toast';
import { Disclosure, Menu, Transition } from '@headlessui/react';
import { useAuth } from '../hooks/useAuth';
import { Logo } from './logo';
import { Account } from '../types';

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const { isAuthenticated, logout } = useAuth();
  const [userInitials, setUserInitials] = useState('');
  const [companyName, setCompanyName] = useState('BusinessCart');
    const [notificationCount, setNotificationCount] = useState(0);
  const [userRole, setUserRole] = useState<'customer' | 'company' | 'admin' | null>(null);
  const [account, setAccount] = useState<Account | null>(null);

  const updateNavbarState = useCallback(() => {
    if (!isAuthenticated) {
      setUserInitials('');
      setCompanyName('BusinessCart');
      setUserRole(null);
      return;
    }

    const token = localStorage.getItem('accessToken');
    const accountData = localStorage.getItem('accounts_cache');

    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const role = payload.user?.role || null;
        setUserRole(role);

        const name = payload.user?.name || payload.user?.email || '';
        const initials = name
          .split(' ')
          .map((n: string) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2);
        setUserInitials(initials);

        if (role === 'company' && accountData) {
          const parsedCache = JSON.parse(accountData);
          if (parsedCache && parsedCache.data && parsedCache.data.length > 0) {
            const companyAccount = parsedCache.data.find((acc: Account) => acc.role === 'company');
            if (companyAccount) {
              setAccount(companyAccount);
              setCompanyName(companyAccount.company?.name || 'Company');
            }
          }
        } else {
          setCompanyName('BusinessCart');
        }
      } catch (_e) {
        toast.error('Failed to load user data');
        logout();
      }
    }
  }, [isAuthenticated, logout]);

  useEffect(() => {
    updateNavbarState();
    window.addEventListener('storageUpdated', updateNavbarState);

    return () => {
      window.removeEventListener('storageUpdated', updateNavbarState);
    };
  }, [updateNavbarState]);

  useEffect(() => {
    const updateNotificationCount = () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const userId = payload.user?.id;
          if (userId) {
            const cacheKey = `user_deals_cache_${userId}`;
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
              const { products } = JSON.parse(cached);
              setNotificationCount(products.length);
            } else {
              setNotificationCount(0);
            }
          } else {
            setNotificationCount(0);
          }
        } catch (e) {
          setNotificationCount(0);
        }
      } else {
        setNotificationCount(0);
      }
    };

    updateNotificationCount();
    window.addEventListener('storage', updateNotificationCount);

    return () => {
      window.removeEventListener('storage', updateNotificationCount);
    };
  }, []);

  return (
    <Disclosure as="nav" className="bg-white shadow">
      {() => (
        <>
          <Toaster position="top-right" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                {isAuthenticated && userRole !== 'customer' && (
                  <button
                    onClick={() => window.dispatchEvent(new Event('toggle-sidebar'))}
                    className="lg:hidden text-gray-500 hover:text-gray-700 p-1 mr-2"
                    aria-label="Open menu"
                  >
                    <Bars3Icon className="h-6 w-6" />
                  </button>
                )}
                {userRole !== 'company' ? (
                  <Link to="/" className="flex items-center">
                    <span className="w-10 h-10 mr-2"><Logo /></span>
                    <span className="text-lg font-semibold text-gray-600">{companyName}</span>
                  </Link>
                ) : (
                  <Link to="/dashboard" className="flex items-center">
                    {account?.company?.logoUrl ? (
                      <img src={account.company.logoUrl} alt="Company Logo" className="max-w-40 h-8 mr-1" />
                    ) : (
                      <span className="w-10 h-10 mr-2"><Logo /></span>
                    )}
                    <span className="text-lg font-semibold text-gray-600">{companyName}</span>
                  </Link>
                )}
              </div>
              <div className="flex items-center space-x-4">
                {userRole === 'customer' && (
                  <>
                    <div className="relative">
                      <Link to="/deals">
                      <BellIcon className="h-6 w-6 text-gray-600 cursor-pointer" />
                      {notificationCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-600 text-white text- rounded-full h-4 w-4 flex items-center justify-center">
                          {notificationCount}
                        </span>
                      )}
                      </Link>
                    </div>
                    <div className="relative">
                      <Link to="/cart">
                        <ShoppingCartIcon className="h-6 w-6 text-gray-600 cursor-pointer" />
                      </Link>
                    </div>
                  </>
                )}
                {isAuthenticated && (
                  <Menu as="div" className="relative">
                    <Menu.Button className="flex items-center space-x-2">
                      <div className="h-8 w-8 rounded-full bg-teal-700 text-white flex items-center justify-center text-sm font-medium">
                        {userInitials || 'U'}
                      </div>
                    </Menu.Button>
                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-100"
                      enterFrom="transform opacity-0 scale-95"
                      enterTo="transform opacity-100 scale-100"
                      leave="transition ease-in duration-75"
                      leaveFrom="transform opacity-100 scale-100"
                      leaveTo="transform opacity-0 scale-95"
                    >
                      <Menu.Items className="absolute right-0 mt-2 w-48 origin-top-right bg-white rounded-md shadow-lg py-1 ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                        {userRole === 'company' && (
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={() => navigate('/dashboard')}
                                className={`${active ? 'bg-gray-100' : ''} flex items-center w-full px-4 py-2 text-sm text-gray-700`}
                              >
                                Dashboard
                              </button>
                            )}
                          </Menu.Item>
                        )}
                        {userRole === 'customer' && (
                          <>
                            <Menu.Item>
                              {({ active }) => (
                                <Link
                                  to="/"
                                  className={`${active ? 'bg-gray-100' : ''} flex items-center w-full px-4 py-2 text-sm text-gray-700`}
                                >
                                  <HomeIcon className="h-5 w-5 mr-2" />
                                  Home
                                </Link>
                              )}
                            </Menu.Item>
                            <Menu.Item>
                              {({ active }) => (
                                <Link
                                  to="/catalog"
                                  className={`${active ? 'bg-gray-100' : ''} flex items-center w-full px-4 py-2 text-sm text-gray-700`}
                                >
                                  <CubeIcon className="h-5 w-5 mr-2" />
                                  Product Catalog
                                </Link>
                              )}
                            </Menu.Item>

                            <Menu.Item>
                              {({ active }) => (
                                <Link
                                  to="/quick-order"
                                  className={`${active ? 'bg-gray-100' : ''} flex items-center w-full px-4 py-2 text-sm text-gray-700`}
                                >
                                  <BoltIcon className="h-5 w-5 mr-2" />
                                  Quick Order
                                </Link>
                              )}
                            </Menu.Item>

                            <Menu.Item>
                              {({ active }) => (
                                <Link
                                  to="/deals"
                                  className={`${active ? 'bg-gray-100' : ''} flex items-center w-full px-4 py-2 text-sm text-gray-700`}
                                >
                                  <TagIcon className="h-5 w-5 mr-2" />
                                  Deals
                                </Link>
                              )}
                            </Menu.Item>

                            <Menu.Item>
                              {({ active }) => (
                                <Link
                                  to="/account"
                                  className={`${active ? 'bg-gray-100' : ''} flex items-center w-full px-4 py-2 text-sm text-gray-700`}
                                >
                                  <UserCircleIcon className="h-5 w-5 mr-2" />
                                  My Account
                                </Link>
                              )}
                            </Menu.Item>

                            <Menu.Item>
                              {({ active }) => (
                                <Link
                                  to="/order-history"
                                  className={`${active ? 'bg-gray-100' : ''} flex items-center w-full px-4 py-2 text-sm text-gray-700`}
                                >
                                  <ClipboardDocumentListIcon className="h-5 w-5 mr-2" />
                                  Order History
                                </Link>
                              )}
                            </Menu.Item>
                            <Menu.Item>
                              {({ active }) => (
                                <Link
                                  to="/quote-history"
                                  className={`${active ? 'bg-gray-100' : ''} flex items-center w-full px-4 py-2 text-sm text-gray-700`}
                                >
                                  <DocumentPlusIcon className="h-5 w-5 mr-2" />
                                  Quote History
                                </Link>
                              )}
                            </Menu.Item>
                            <Menu.Item>
                              {({ active }) => (
                                <Link
                                  to="/customer/addresses"
                                  className={`${active ? 'bg-gray-100' : ''} flex items-center w-full px-4 py-2 text-sm text-gray-700`}
                                >
                                  <MapPinIcon className="h-5 w-5 mr-2" />
                                  My Addresses
                                </Link>
                              )}
                            </Menu.Item>
                          </>
                        )}
                        {userRole === 'admin' && (
                          <Menu.Item>
                            {({ active }) => (
                              <button
                                onClick={() => navigate('/admin')}
                                className={`${active ? 'bg-gray-100' : ''} flex items-center w-full px-4 py-2 text-sm text-gray-700`}
                              >
                                Admin Panel
                              </button>
                            )}
                          </Menu.Item>
                        )}
                        <Menu.Item>
                          {({ active }) => (
                            <button
                              onClick={logout}
                              className={`${active ? 'bg-gray-100' : ''} flex items-center w-full px-4 py-2 text-sm text-gray-700`}
                            >
                              <ArrowRightStartOnRectangleIcon className="h-5 w-5 mr-2" />
                              Sign out
                            </button>
                          )}
                        </Menu.Item>
                      </Menu.Items>
                    </Transition>
                  </Menu>
                )}
                {!isAuthenticated && (
                  <>
                    <button
                      onClick={() => navigate('/login')}
                      className="text-gray-600 hover:text-gray-800 px-3 py-2 text-sm font-medium"
                    >
                      Login
                    </button>
                    <button
                      onClick={() => navigate('/register')}
                      className="bg-teal-700 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-teal-800"
                    >
                      Sign Up
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </Disclosure>
  );
};

export default Navbar;