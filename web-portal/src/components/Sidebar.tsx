import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { UserIcon, HomeIcon, BuildingOffice2Icon, ShoppingBagIcon, ClipboardDocumentListIcon, DocumentPlusIcon, MapPinIcon, ChartBarIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import { Logo } from './logo';

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

  const links = [
    { name: 'Dashboard', path: '/dashboard', icon: HomeIcon },
    { name: 'Users', path: '/users', icon: UserIcon },
    { name: 'Companies', path: '/companies', icon: BuildingOffice2Icon },
    { name: 'Products', path: '/products', icon: ShoppingBagIcon },
    { name: 'Orders', path: '/orders', icon: ClipboardDocumentListIcon },
    { name: 'Quotes', path: '/quotes', icon: DocumentPlusIcon },
  ];

  if (user && user.role === 'admin') {
    links.splice(1, 0, { name: 'Codes', path: '/codes', icon: DocumentPlusIcon });
  }

  if (user && (user.role === 'admin' || user.role === 'company')) {
    links.push({ name: 'Analytics', path: '/analytics', icon: ChartBarIcon });
  }

  if (user && (user.role === 'admin' || user.role === 'company')) {
    links.push({ name: 'Locations', path: '/locations', icon: MapPinIcon });
  }

  const navContent = (
    <>
      <div className="p-6 flex items-center">
        <span className="w-10 h-10"><Logo /></span>
        <h1 className="text-2xl font-semibold text-gray-400 p-1">BusinessCart</h1>
      </div>
      <nav className="mt-4">
        {links.map((link) => (
          <NavLink
            key={link.name}
            to={link.path}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              `flex items-center px-6 py-3 text-gray-200 hover:bg-gray-700 transition-colors ${
                isActive ? 'bg-gray-900 text-white border-l-4 border-teal-500' : ''
              }`
            }
          >
            <link.icon className="h-5 w-5 mr-3" />
            <span>{link.name}</span>
          </NavLink>
        ))}
      </nav>
    </>
  );

  return (
    <>
      {/* Mobile slide-over — opened via 'toggle-sidebar' event from Navbar */}
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
              <div className="absolute top-4 right-4">
                <button onClick={() => setMobileOpen(false)} className="text-gray-400 hover:text-white">
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              {navContent}
            </Dialog.Panel>
          </Transition.Child>
        </Dialog>
      </Transition>

      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden lg:block w-64 bg-gray-800 shadow-lg h-screen sticky top-0 flex-shrink-0">
        {navContent}
      </div>
    </>
  );
};

export default Sidebar;
