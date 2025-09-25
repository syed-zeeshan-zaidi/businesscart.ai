import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Product } from '../types';
import { addItemToCart } from '../api';
import { AxiosError } from 'axios';
import { PlusIcon } from '@heroicons/react/24/solid';

interface AddToCartButtonProps {
  product: Product;
  quantity: number;
  variant?: 'card' | 'modal';
}

const AddToCartButton: React.FC<AddToCartButtonProps> = ({ product, quantity, variant = 'card' }) => {
  const [loading, setLoading] = useState(false);

  const handleAddToCart = async () => {
    setLoading(true);
    try {
      await addItemToCart({
        entity: {
          productId: product._id,
          quantity,
          sellerId: product.sellerID,
          name: product.name,
          price: product.price,
          discountedPrice: product.discountedPrice,
        },
      });
      toast.success(`${product.name} added to cart!`);
      localStorage.removeItem('cart_cache'); // Invalidate cart cache
      window.dispatchEvent(new Event('cartUpdated')); // Dispatch custom event
    } catch (error: unknown) {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message || 'Failed to add item to cart');
      } else {
        toast.error('An unexpected error occurred.');
      }
    } finally {
      setLoading(false);
    }
  };

  const cardClassName = "group relative flex items-center justify-center w-10 h-10 bg-teal-600 text-white rounded-full hover:w-32 transition-all duration-300 ease-in-out";
  const modalClassName = "mt-4 w-full bg-teal-600 text-white py-2 rounded-md hover:bg-teal-700 transition";

  return (
    <button
      className={variant === 'card' ? cardClassName : modalClassName}
      onClick={(e) => {
        e.stopPropagation(); // Prevent product card's onClick from firing
        handleAddToCart();
      }}
      disabled={loading}
    >
      {loading ? 'Adding...' : (variant === 'card' ? (
        <>
          <PlusIcon className="h-6 w-6 transition-opacity duration-300 group-hover:opacity-0" />
          <span className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap">
            Add to Cart
          </span>
        </>
      ) : 'Add to Cart')}
    </button>
  );
};

export default AddToCartButton;