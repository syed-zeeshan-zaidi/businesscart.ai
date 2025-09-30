import React from 'react';
import { Link } from 'react-router-dom';

const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-800 text-white">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Solutions</h3>
            <ul className="mt-4 space-y-4">
              <li><Link to="#" className="text-base text-gray-300 hover:text-white">B2B Commerce</Link></li>
              <li><Link to="#" className="text-base text-gray-300 hover:text-white">Marketplace</Link></li>
              <li><Link to="#" className="text-base text-gray-300 hover:text-white">Integrations</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Support</h3>
            <ul className="mt-4 space-y-4">
              <li><Link to="/user-guide" className="text-base text-gray-300 hover:text-white">User Guide</Link></li>
              <li><Link to="/api-status" className="text-base text-gray-300 hover:text-white">API Status</Link></li>
              <li><Link to="/contact-us" className="text-base text-gray-300 hover:text-white">Contact Us</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Company</h3>
            <ul className="mt-4 space-y-4">
              <li><Link to="/about" className="text-base text-gray-300 hover:text-white">About</Link></li>
              <li><Link to="/faq" className="text-base text-gray-300 hover:text-white">FAQ</Link></li>
              <li><Link to="/careers" className="text-base text-gray-300 hover:text-white">Careers</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-400 tracking-wider uppercase">Legal</h3>
            <ul className="mt-4 space-y-4">
              <li><Link to="/privacy-policy" className="text-base text-gray-300 hover:text-white">Privacy Policy</Link></li>
              <li><Link to="/terms-of-service" className="text-base text-gray-300 hover:text-white">Terms of Service</Link></li>
              <li><Link to="/contact-us" className="text-base text-gray-300 hover:text-white">Request Business Code</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t border-gray-700 pt-8 md:flex md:items-center md:justify-between">
          <div className="flex space-x-6 md:order-2">
            <a href="#" className="text-gray-400 hover:text-gray-300">
              <span className="sr-only">Facebook</span>
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" clipRule="evenodd" />
              </svg>
            </a>
            <a href="#" className="text-gray-400 hover:text-gray-300">
              <span className="sr-only">X</span>
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M14.258 10.152L23.176 0h-2.11l-7.744 8.813L7.13 0H0l9.308 13.324L0 24h2.11l8.178-9.307L16.87 24h7.13L14.258 10.152zM11.5 13.51L3.66 2.4h3.2l7.85 11.18-3.21 4.58h-3.2l8.2-11.7z" />
              </svg>
            </a>
            <a href="#" className="text-gray-400 hover:text-gray-300">
              <span className="sr-only">LinkedIn</span>
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.784-1.75-1.75s.784-1.75 1.75-1.75 1.75.784 1.75 1.75-.784 1.75-1.75 1.75zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" />
              </svg>
            </a>
            <a href="#" className="text-gray-400 hover:text-gray-300">
              <span className="sr-only">Reddit</span>
              <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path fillRule="evenodd" d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.01 16.164c-1.105 0-2-.895-2-2s.895-2 2-2 2 .895 2 2-.895 2-2 2zm-10.02 0c-1.105 0-2-.895-2-2s.895-2 2-2 2 .895 2 2-.895 2-2 2zm5.01-8.164c-1.105 0-2-.895-2-2s.895-2 2-2 2 .895 2 2-.895 2-2 2zm-5.01 0c-1.105 0-2-.895-2-2s.895-2 2-2 2 .895 2 2-.895 2-2 2zm10.02 0c-1.105 0-2-.895-2-2s.895-2 2-2 2 .895 2 2-.895 2-2 2z" clipRule="evenodd" />
              </svg>
            </a>
          </div>
          <p className="mt-8 text-base text-gray-400 md:mt-0 md:order-1">&copy; 2025 BusinessCart, Inc. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
