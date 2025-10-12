import { NavLink } from 'react-router-dom';
import { UserIcon, HomeIcon, BuildingOffice2Icon, ShoppingBagIcon, ClipboardDocumentListIcon, DocumentPlusIcon, MapPinIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import { Logo } from './logo';

const Sidebar = () => {
  const { decodeJWT } = useAuth();
  const token = localStorage.getItem('accessToken');
  const user = token ? decodeJWT(token) : null;

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
    links.push({ name: 'Locations', path: '/locations', icon: MapPinIcon });
  }

  return (
    <div className="w-64 bg-gray-800 shadow-lg h-screen sticky top-0">
      <div className="p-6 flex">
        <span className="w-10 h-10"><Logo /></span>
        <h1 className="text-2xl font-semibold text-gray-400 p-1">BusinessCart</h1>
      </div>
      <nav className="mt-4">
        {links.map((link) => (
          <NavLink
            key={link.name}
            to={link.path}
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
    </div>
  );
};

export default Sidebar;