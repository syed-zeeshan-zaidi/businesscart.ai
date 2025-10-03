import React, { useState, useEffect, Fragment, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BellIcon, ShoppingCartIcon, ArrowRightStartOnRectangleIcon } from '@heroicons/react/24/outline';
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
  const [notificationCount] = useState(3); // Placeholder
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
    const accountData = localStorage.getItem('account');

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
          const parsedAccount: Account = JSON.parse(accountData);
          setAccount(parsedAccount);
          setCompanyName(parsedAccount.company?.name || 'Company');
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

  return (
    <Disclosure as="nav" className="bg-white shadow">
      {() => (
        <>
          <Toaster position="top-right" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                {userRole !== 'company' ? (
                  <Link to="/" className="flex items-center">
                    <span className="w-10 h-10 mr-2"><Logo /></span>
                    <span className="text-lg font-semibold text-gray-600">{companyName}</span>
                  </Link>
                ) : (
                  <Link to="/dashboard" className="flex items-center">
                    {account?.company?.logoUrl ? (
                      <img src={account.company.logoUrl} alt="Company Logo" className="w-8 h-8 mr-1" />
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
                      <BellIcon className="h-6 w-6 text-gray-600 cursor-pointer" />
                      {notificationCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-red-600 text-white text- rounded-full h-4 w-4 flex items-center justify-center">
                          {notificationCount}
                        </span>
                      )}
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
                      <div className="h-8 w-8 rounded-full bg-teal-600 text-white flex items-center justify-center text-sm font-medium">
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
                                  Product Catalog
                                </Link>
                              )}
                            </Menu.Item>

                            <Menu.Item>
                              {({ active }) => (
                                <Link
                                  to="/account"
                                  className={`${active ? 'bg-gray-100' : ''} flex items-center w-full px-4 py-2 text-sm text-gray-700`}
                                >
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
                                  Order History
                                </Link>
                              )}
                            </Menu.Item>
                            <Menu.Item>
                              {({ active }) => (
                                <Link
                                  to="/customer/addresses"
                                  className={`${active ? 'bg-gray-100' : ''} flex items-center w-full px-4 py-2 text-sm text-gray-700`}
                                >
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
                      className="bg-teal-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-teal-700"
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