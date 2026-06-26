import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import {
  HomeIcon,
  ShoppingBagIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  BuildingOffice2Icon,
  UserIcon,
  KeyIcon,
  MapPinIcon,
  ChartBarIcon,
  BanknotesIcon,
  XMarkIcon,
  NewspaperIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import { Logo } from './logo';
import { computeTier, TierName } from '../tier';
import { Order } from '../types';

interface NavItem {
  name: string;
  path: string;
  icon: React.ElementType;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const APP_VERSION = '1.0.0';

const Sidebar = () => {
  const { decodeJWT } = useAuth();
  const token = localStorage.getItem('accessToken');
  const user = token ? decodeJWT(token) : null;
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const open = () => setMobileOpen(true);
    window.addEventListener('toggle-sidebar', open);
    return () => window.removeEventListener('toggle-sidebar', open);
  }, []);

  const isAdmin = user?.role === 'admin';
  const isCompany = user?.role === 'company';
  const isPartner = user?.role === 'partner';

  // Pending order count + current pricing tier from dashboard cache (no API calls).
  // Tier shown only for company role; admins see no tier (they don't have one).
  const [pendingOrders, setPendingOrders] = useState(0);
  const [tier, setTier] = useState<TierName | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem('dash_orders');
      if (raw) {
        const { data } = JSON.parse(raw);
        if (Array.isArray(data)) {
          setPendingOrders(data.filter((o: { status?: string }) => !o.status || o.status === 'pending').length);
          if (user?.role === 'company') {
            setTier(computeTier(data as Order[]).tier);
          }
        }
      }
    } catch { /* ignore */ }
  }, [user]);

  const sections: NavSection[] = isPartner
    ? [
        {
          label: '',
          items: [
            { name: 'Dashboard', path: '/dashboard', icon: HomeIcon },
          ],
        },
      ]
    : [
        {
          label: '',
          items: [
            { name: 'Dashboard', path: '/dashboard', icon: HomeIcon },
          ],
        },
        {
          label: 'Commerce',
          items: [
            { name: 'Products', path: '/products', icon: ShoppingBagIcon },
            { name: 'Orders', path: '/orders', icon: ClipboardDocumentListIcon },
            { name: 'Quotes', path: '/quotes', icon: DocumentTextIcon },
            ...((isAdmin || isCompany) ? [{ name: 'Blog Posts', path: '/blog-manager', icon: NewspaperIcon }] : []),
          ],
        },
        {
          label: 'Management',
          items: [
            { name: 'Company', path: '/companies', icon: BuildingOffice2Icon },
            { name: 'Users', path: '/users', icon: UserIcon },
            ...(isAdmin ? [{ name: 'Codes', path: '/codes', icon: KeyIcon }] : []),
            ...((isAdmin || isCompany) ? [{ name: 'Billing', path: isAdmin ? '/admin/billing' : '/billing', icon: BanknotesIcon }] : []),
            { name: 'Locations', path: '/locations', icon: MapPinIcon },
          ],
        },
        {
          label: 'Insights',
          items: [
            { name: 'Analytics', path: '/analytics', icon: ChartBarIcon },
          ],
        },
      ];

  const navContent = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="p-5 flex items-center gap-2">
        <span className="w-8 h-8"><Logo /></span>
        <span className="text-lg font-bold text-gray-400">BusinessCart</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-4 mt-2">
        {sections.map((section) => (
          <div key={section.label || 'main'}>
            {section.label && (
              <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-500">{section.label}</p>
            )}
            <div className="space-y-0.5">
              {section.items.map((link) => (
                <NavLink
                  key={link.name}
                  to={link.path}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-teal-700/20 text-teal-400'
                        : 'text-gray-400 hover:bg-gray-700/50 hover:text-gray-200'
                    }`
                  }
                >
                  <link.icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1">{link.name}</span>
                  {link.name === 'Orders' && pendingOrders > 0 && (
                    <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">{pendingOrders}</span>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User + Version */}
      <div className="p-4 border-t border-gray-700/50 mt-auto">
        {user && (
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-teal-700/30 flex items-center justify-center text-teal-400 text-sm font-bold shrink-0">
              {(user.name || user.email || '?')[0].toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-300 truncate">{user.name || user.email}</p>
              <p className="text-xs text-gray-500 capitalize flex items-center gap-2">
                <span>{user.role}</span>
                {tier && (
                  <span className="inline-block px-1.5 py-0.5 rounded bg-teal-700/30 text-teal-400 text-[10px] font-bold uppercase tracking-wider">
                    {tier}
                  </span>
                )}
              </p>
            </div>
          </div>
        )}
        <p className="text-[10px] text-gray-600">App v{APP_VERSION}</p>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile slide-over */}
      <Transition show={mobileOpen} as={Fragment}>
        <Dialog onClose={() => setMobileOpen(false)} className="relative z-50 lg:hidden">
          <Transition.Child
            as={Fragment}
            enter="transition-opacity duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-50"
            leave="transition-opacity duration-300"
            leaveFrom="opacity-50"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black" aria-hidden="true" />
          </Transition.Child>
          <Transition.Child
            as={Fragment}
            enter="transition-transform duration-300 ease-out"
            enterFrom="-translate-x-full"
            enterTo="translate-x-0"
            leave="transition-transform duration-300 ease-in"
            leaveFrom="translate-x-0"
            leaveTo="-translate-x-full"
          >
            <Dialog.Panel className="fixed inset-y-0 left-0 w-64 bg-gray-800 shadow-xl overflow-y-auto">
              <div className="absolute top-4 right-4 z-10">
                <button onClick={() => setMobileOpen(false)} className="text-gray-400 hover:text-white">
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              {navContent}
            </Dialog.Panel>
          </Transition.Child>
        </Dialog>
      </Transition>

      {/* Desktop sidebar */}
      <div className="hidden lg:block w-64 bg-gray-800 h-screen sticky top-0 flex-shrink-0">
        {navContent}
      </div>
    </>
  );
};

export default Sidebar;
