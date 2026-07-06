import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Product } from '../types';
import { addItemToCart } from '../api';
import { AxiosError } from 'axios';
import { PlusIcon, CheckIcon } from '@heroicons/react/24/solid';

interface AddToCartButtonProps {
  product: Product;
  quantity: number;
  variant?: 'card' | 'modal';
}

type ButtonState = 'idle' | 'adding' | 'added';

const AddToCartButton: React.FC<AddToCartButtonProps> = ({ product, quantity, variant = 'card' }) => {
  const [buttonState, setButtonState] = useState<ButtonState>('idle');
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (buttonState === 'added') {
      const timer = setTimeout(() => {
        setButtonState('idle');
        setIsHovered(false); // Explicitly reset hover state for mobile
      }, 2000); // Revert to idle after 2 seconds
      return () => clearTimeout(timer);
    }
  }, [buttonState]);

  const handleAddToCart = async () => {
    if (buttonState !== 'idle') return;

    setButtonState('adding');
    try {
      await addItemToCart({
        entity: {
          productId: product._id,
          quantity,
          sellerId: product.sellerID,
          partnerId: product.partnerId,
          name: product.name,
          price: product.price,
          discountedPrice: product.discountedPrice,
          image: product.images?.[0],
          dealPrice: product.dealPrice,
        },
      });
      toast.success(`${product.name} added to cart!`);
      localStorage.removeItem('cart_cache'); // Invalidate cart cache
      window.dispatchEvent(new Event('cartUpdated')); // Dispatch custom event
      setButtonState('added');
    } catch (error: unknown) {
      if (error instanceof AxiosError) {
        toast.error(error.response?.data?.message || 'Failed to add item to cart');
      } else {
        toast.error('An unexpected error occurred.');
      }
      setButtonState('idle'); // Revert to idle on error
    }
  };

  const isExpanded = isHovered || buttonState === 'adding' || buttonState === 'added';
  const cardClassName = `group relative flex items-center justify-center h-10 bg-teal-700 text-white rounded-full transition-all duration-300 ease-in-out ${isExpanded ? 'w-32' : 'w-10'}`;
  const modalClassName = "mt-4 w-full bg-teal-700 text-white py-2 rounded-md hover:bg-teal-800 transition";

  const renderCardContent = () => {
    switch (buttonState) {
      case 'adding':
        return 'Adding...';
      case 'added':
        return (
          <>
            <CheckIcon className="h-6 w-6" />
            <span className="ml-2">Added!</span>
          </>
        );
      case 'idle':
      default:
        return (
          <>
            <PlusIcon className={`h-6 w-6 transition-opacity duration-300 ${isExpanded ? 'opacity-0' : 'opacity-100'}`} />
            <span className={`absolute transition-opacity duration-300 whitespace-nowrap ${isExpanded ? 'opacity-100' : 'opacity-0'}`}>
              Add to Cart
            </span>
          </>
        );
    }
  };

  return (
    <button
      className={variant === 'card' ? cardClassName : modalClassName}
      onClick={(e) => {
        e.stopPropagation();
        handleAddToCart();
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={() => setIsHovered(true)}
      onTouchEnd={() => setIsHovered(false)}
      disabled={buttonState === 'adding'}
    >
      {variant === 'card' ? renderCardContent() : (buttonState === 'adding' ? 'Adding...' : 'Add to Cart')}
    </button>
  );
};

export default AddToCartButton;
