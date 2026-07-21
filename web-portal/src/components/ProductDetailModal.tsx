import React, { Fragment, useState } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { Product } from '../types';
import AddToCartButton from './AddToCartButton';
import { qtyRuleLabel } from '../qtyRules';

interface ProductDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: Product | null;
}

const EYEBROW = 'text-[11px] font-bold uppercase tracking-widest text-gray-400';

const ProductDetailModal: React.FC<ProductDetailModalProps> = ({ isOpen, onClose, product }) => {
  const [selectedImage, setSelectedImage] = useState(0);

  const images = product?.images?.length ? product.images : ['https://via.placeholder.com/300x200'];
  const discounted = !!product && !!product.discountedPrice && product.discountedPrice < product.price;
  const rule = qtyRuleLabel(product || undefined);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
          <div className="fixed inset-0 bg-black/40" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0 scale-95" enterTo="opacity-100 scale-100" leave="ease-in duration-150" leaveFrom="opacity-100 scale-100" leaveTo="opacity-0 scale-95">
              <Dialog.Panel className="w-full max-w-4xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                {product && (
                  <div className="max-h-[90vh] overflow-y-auto p-6 sm:p-8">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        {product.category && <p className={EYEBROW}>{product.category}</p>}
                        <Dialog.Title className="text-2xl font-extrabold tracking-tight text-gray-900">{product.name}</Dialog.Title>
                      </div>
                      <button onClick={onClose} className="shrink-0 text-gray-400 hover:text-gray-700" aria-label="Close">
                        <XMarkIcon className="h-6 w-6" />
                      </button>
                    </div>

                    <div className="mt-6 grid grid-cols-1 gap-8 md:grid-cols-2">
                      <div>
                        <img src={images[selectedImage]} alt={product.name} className="h-80 w-full rounded-lg border border-gray-100 bg-gray-50 object-contain" />
                        {images.length > 1 && (
                          <div className="mt-3 flex gap-2 overflow-x-auto">
                            {images.map((url, i) => (
                              <img
                                key={i}
                                src={url}
                                alt={`${product.name} ${i + 1}`}
                                onClick={() => setSelectedImage(i)}
                                className={`h-16 w-16 cursor-pointer rounded-md border-2 object-cover ${i === selectedImage ? 'border-teal-600' : 'border-gray-200 hover:border-gray-400'}`}
                              />
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <div className="flex items-baseline gap-2">
                          <p className="text-2xl font-extrabold tracking-tight tabular-nums text-teal-700">${(discounted ? product.discountedPrice! : product.price).toFixed(2)}</p>
                          {discounted && <p className="text-lg tabular-nums text-gray-400 line-through">${product.price.toFixed(2)}</p>}
                        </div>
                        {rule && <span className="mt-2 inline-block rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700">{rule}</span>}

                        {product.description && <p className="mt-4 text-sm leading-relaxed text-gray-600">{product.description}</p>}

                        {product.priceTiers && product.priceTiers.length > 0 && (
                          <div className="mt-5">
                            <p className={`${EYEBROW} mb-2`}>Volume pricing</p>
                            <div className="overflow-hidden rounded-lg border border-gray-200">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-400">
                                  <tr>
                                    <th className="px-3 py-2 text-left font-semibold">Quantity</th>
                                    <th className="px-3 py-2 text-right font-semibold">Price per unit</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  <tr>
                                    <td className="px-3 py-2 text-gray-700">1{product.priceTiers[0].minQty > 1 ? `–${product.priceTiers[0].minQty - 1}` : '+'}</td>
                                    <td className="px-3 py-2 text-right font-medium tabular-nums">${product.price.toFixed(2)}</td>
                                  </tr>
                                  {product.priceTiers.map((tier, i) => (
                                    <tr key={i}>
                                      <td className="px-3 py-2 text-gray-700">{tier.minQty}+ units</td>
                                      <td className="px-3 py-2 text-right font-medium tabular-nums text-teal-700">${tier.price.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}

                        {product.attributes && product.attributes.length > 0 && (
                          <div className="mt-5">
                            <p className={`${EYEBROW} mb-2`}>Details</p>
                            <div className="space-y-1.5">
                              {product.attributes.map((attr) => (
                                <div key={attr.key} className="flex justify-between border-b border-gray-100 pb-1 text-sm">
                                  <span className="font-medium text-gray-500">{attr.key}</span>
                                  <span className="text-gray-900">{attr.value}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="mt-8">
                          <AddToCartButton product={product} quantity={1} variant="modal" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
};

export default ProductDetailModal;
