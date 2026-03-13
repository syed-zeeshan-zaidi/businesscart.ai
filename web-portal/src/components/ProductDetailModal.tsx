import React, { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Product } from '../types';
import AddToCartButton from './AddToCartButton';

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
}

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ isOpen, onClose, product }) => {
  const [selectedImage, setSelectedImage] = useState(0);

  if (!isOpen || !product) return null;

  const images = product.images?.length ? product.images : ['https://via.placeholder.com/300x200'];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-start">
          <h2 className="text-2xl font-bold text-gray-800">{product.name}</h2>
          <button onClick={onClose}>
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <img src={images[selectedImage]} alt={product.name} className="w-full h-80 object-contain rounded-lg bg-gray-50" />
            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {images.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`${product.name} ${i + 1}`}
                    onClick={() => setSelectedImage(i)}
                    className={`w-16 h-16 object-cover rounded-md cursor-pointer border-2 ${
                      i === selectedImage ? 'border-teal-500' : 'border-gray-200 hover:border-gray-400'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="text-gray-500 text-sm">{product.category}</p>
            <div className="mt-2">
              {product.discountedPrice && product.discountedPrice < product.price ? (
                <>
                  <p className="text-2xl font-bold text-teal-600">
                    ${product.discountedPrice.toFixed(2)}
                  </p>
                  <p className="text-gray-500 line-through text-lg">
                    ${product.price.toFixed(2)}
                  </p>
                </>
              ) : (
                <p className="text-2xl font-bold text-teal-600">${product.price.toFixed(2)}</p>
              )}
            </div>
            <p className="text-gray-600 mt-4">{product.description}</p>
            <div className="mt-6">
              <h3 className="text-lg font-semibold">Attributes</h3>
              <div className="mt-2 space-y-2">
                {product.attributes?.map(attr => (
                  <div key={attr.key} className="flex justify-between border-b pb-1">
                    <span className="font-medium text-gray-600">{attr.key}</span>
                    <span className="text-gray-800">{attr.value}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-8">
              <AddToCartButton product={product} quantity={1} variant="modal" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetailModal;
