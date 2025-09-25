import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface FilterSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  filterableAttributes: Record<string, string[]>;
  attributeFilters: Record<string, string>;
  setAttributeFilters: (filters: Record<string, string>) => void;
}

const FilterSidebar: React.FC<FilterSidebarProps> = ({ 
  isOpen, 
  onClose, 
  filterableAttributes, 
  attributeFilters, 
  setAttributeFilters 
}) => {
  if (!isOpen) return null;

  const handleAttributeFilterChange = (key: string, value: string) => {
    setAttributeFilters({ ...attributeFilters, [key]: value });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-25 z-40" onClick={onClose}>
      <div className="absolute inset-y-0 left-0 w-80 bg-white shadow-lg p-6 z-50" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Attribute Filters</h2>
          <button onClick={onClose}>
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        
        <div className="space-y-4">
          {Object.entries(filterableAttributes).map(([key, values]) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700">{key}</label>
              <select
                value={attributeFilters[key] || ''}
                onChange={(e) => handleAttributeFilterChange(key, e.target.value)}
                className="w-full p-2 border border-gray-300 rounded-md mt-1"
              >
                <option value="">All {key}s</option>
                {values.map(value => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FilterSidebar;
