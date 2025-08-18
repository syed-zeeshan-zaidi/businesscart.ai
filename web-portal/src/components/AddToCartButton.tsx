import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Product } from '../types';
import { addItemToCart } from '../api';
import { AxiosError } from 'axios';

interface AddToCartButtonProps {
  product: Product;
  quantity: number;
}

const AddToCartButton: React.FC<AddToCartButtonProps> = ({ product, quantity }) => {
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

  return (
    <button
      className="mt-4 w-full bg-teal-600 text-white py-2 rounded-md hover:bg-teal-700 transition"
      onClick={(e) => {
        e.stopPropagation(); // Prevent product card's onClick from firing
        handleAddToCart();
      }}
      disabled={loading}
    >
      {loading ? 'Adding...' : 'Add to Cart'}
    </button>
  );
};

export default AddToCartButton;