import { useState, useEffect } from 'react';
import { createProduct, getProducts, updateProduct, deleteProduct, getAccount, getUploadUrl, uploadFileToS3 } from '../api';
import { Product, Account, Attribute } from '../types';
import Navbar from './Navbar';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { PencilIcon, TrashIcon, PlusIcon, MagnifyingGlassIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';
import toast, { Toaster } from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';

const CACHE_KEY = 'products_cache';

const ProductForm = () => {
  const { decodeJWT } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const productsPerPage = 10;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    price: 0,
    dealPrice: undefined,
    description: '',
    sellerID: '',
    images: [],
    category: '',
    slug: '',
    sku: '',
    barcode: '',
    stock: 0,
    active: true,
    featured: false,
    attributes: [],
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const loadInitialData = async () => {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const decodedUser = decodeJWT(token);
          if (decodedUser && decodedUser.id) {
            const fetchedAccount = await getAccount(decodedUser.id);
            setAccount(fetchedAccount);
            if (fetchedAccount.role === 'company') {
              setFormData((prev) => ({
                ...prev,
                accountID: fetchedAccount._id,
              }));
            }
          }
        } catch (e) {
          toast.error('Failed to fetch account data.');
        }
      } else {
        toast.error('Please log in to access products.');
      }
      await fetchProducts();
    };

    loadInitialData();
  }, [decodeJWT]);

  useEffect(() => {
    const filtered = products.filter((product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredProducts(filtered);
    setCurrentPage(1);
  }, [searchQuery, products]);

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      const data = await getProducts();
      const sorted = [...data].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setProducts(sorted);
      setFilteredProducts(sorted);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ data, timestamp: Date.now() }));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error fetching products');
    } finally {
      setIsLoading(false);
    }
  };

  const invalidateCache = () => {
    localStorage.removeItem(CACHE_KEY);
  };

  const validateForm = () => {
    const newErrors: string[] = [];
    if (!formData.name) newErrors.push('Product name is required');
    if (formData.name && formData.name.includes('/')) newErrors.push('Product name cannot contain "/"');
    if (!formData.slug) newErrors.push('Slug is required');
    if (formData.slug && formData.slug.includes('/')) newErrors.push('Slug cannot contain "/"');
    if (formData.category && formData.category.includes('/')) newErrors.push('Category cannot contain "/"');
    if (formData.price === undefined || formData.price <= 0) newErrors.push('Price must be positive');
    if (formData.dealPrice !== undefined && (formData.dealPrice < 0 || formData.dealPrice > 50)) {
      newErrors.push('Deal Price must be between 0 and 50');
    }
    if (formData.stock !== undefined && formData.stock < 0) newErrors.push('Stock cannot be negative');
    if (!formData.description) newErrors.push('Description is required');
    return newErrors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = validateForm();
    setErrors(newErrors);
    if (newErrors.length > 0) return;

    setIsLoading(true);
    try {
      // Upload any pending files first, then combine with existing images
      let allImages = [...(formData.images || [])];
      if (pendingFiles.length > 0) {
        const newUrls = await uploadPendingFiles();
        allImages = [...allImages, ...newUrls];
      }
      const dataToSave = { ...formData, images: allImages };

      if (editingId) {
        await updateProduct(editingId, dataToSave as Product);
        toast.success('Product updated successfully');
      } else {
        await createProduct(dataToSave as Omit<Product, '_id'>);
        toast.success('Product created successfully');
      }
      setFormData({
        name: '',
        price: 0,
        dealPrice: undefined,
        description: '',
        sellerID: account?._id || '',
        images: [],
        category: '',
        slug: '',
        sku: '',
        barcode: '',
        stock: 0,
        active: true,
    featured: false,
        attributes: [],
      });
      setEditingId(null);
      setPendingFiles([]);
      setIsModalOpen(false);
      invalidateCache();
      await fetchProducts();
      setErrors([]);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save product');
    } finally {
      setIsLoading(false);
    }
  };

  const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    const parsed = (name === 'price' || name === 'dealPrice') ? parseFloat(value) || undefined : name === 'stock' ? parseInt(value) || 0 : value;
    const updates: Partial<Product> = { [name]: parsed };
    // Auto-generate slug from name (only if slug hasn't been manually edited)
    if (name === 'name' && (!formData.slug || formData.slug === toSlug(formData.name || ''))) {
      updates.slug = toSlug(value);
    }
    setFormData({ ...formData, ...updates });
  };

  const handleAttributeChange = (index: number, field: keyof Attribute, value: string) => {
    const newAttributes = [...(formData.attributes || [])];
    newAttributes[index] = { ...newAttributes[index], [field]: value };
    setFormData({ ...formData, attributes: newAttributes });
  };

  const addAttribute = () => {
    setFormData({
      ...formData,
      attributes: [...(formData.attributes || []), { key: '', value: '', type: undefined }],
    });
  };

  const removeAttribute = (index: number) => {
    const newAttributes = [...(formData.attributes || [])];
    newAttributes.splice(index, 1);
    setFormData({ ...formData, attributes: newAttributes });
  };

  const handleEdit = (product: Product) => {
    setFormData({
      name: product.name,
      price: product.price,
      dealPrice: product.dealPrice,
      description: product.description,
      sellerID: product.sellerID,
      images: product.images || [],
      category: product.category,
      slug: product.slug || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      stock: product.stock || 0,
      active: product.active !== false,
      featured: product.featured || false,
      attributes: product.attributes || [],
    });
    setEditingId(product._id);
    setPendingFiles([]);
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!productToDelete) return;
    setIsLoading(true);
    try {
      await deleteProduct(productToDelete);
      toast.success('Product deleted successfully');
      invalidateCache();
      await fetchProducts();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete product');
    } finally {
      setIsDeleteConfirmOpen(false);
      setProductToDelete(null);
      setIsLoading(false);
    }
  };

  const openDeleteConfirm = (id: string) => {
    setProductToDelete(id);
    setIsDeleteConfirmOpen(true);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPendingFiles(prev => [...prev, file]);
    toast.success('Image added — will upload when you save');
    e.target.value = '';
  };

  const uploadPendingFiles = async (): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    for (const file of pendingFiles) {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const { uploadUrl, imageUrl } = await getUploadUrl(file.type, ext);
      await uploadFileToS3(uploadUrl, file);
      uploadedUrls.push(imageUrl);
    }
    return uploadedUrls;
  };

  const removeImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: (prev.images || []).filter((_, i) => i !== index),
    }));
  };

  const openModal = () => {
    setFormData({
      name: '',
      price: 0,
      description: '',
      sellerID: account?._id || '',
      images: [],
      category: '',
      slug: '',
      sku: '',
      barcode: '',
      stock: 0,
      active: true,
    featured: false,
      attributes: [],
    });
    setEditingId(null);
    setErrors([]);
    setIsModalOpen(true);
  };

  // Pagination
  const indexOfLastProduct = currentPage * productsPerPage;
  const indexOfFirstProduct = indexOfLastProduct - productsPerPage;
  const currentProducts = filteredProducts.slice(indexOfFirstProduct, indexOfLastProduct);
  const totalPages = Math.ceil(filteredProducts.length / productsPerPage);

  const paginate = (pageNumber: number) => setCurrentPage(pageNumber);

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Toaster position="top-right" />
      <Navbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-800">Products</h2>
          <button
            onClick={openModal}
            className="bg-teal-700 text-white px-4 py-2 rounded-md hover:bg-teal-800 transition-colors flex items-center space-x-2"
          >
            <PlusIcon className="h-5 w-5" />
            <span>Add Product</span>
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products by name..."
              className="w-full p-2 pl-10 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
            />
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          </div>
        </div>

        {/* Product Table */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          {isLoading ? (
            <div className="p-6 flex justify-center">
              <div className="animate-spin h-8 w-8 border-4 border-teal-700 border-t-transparent rounded-full"></div>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-6 text-center text-gray-600">No products found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>

                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Attributes</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Deal Price (%)</th>

                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentProducts.map((product) => (
                    <tr key={product._id} className="hover:bg-gray-50">

                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{product.active !== false ? <span className="text-green-700 font-medium">Active</span> : <span className="text-red-600 font-medium">Inactive</span>}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.category}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.attributes?.length || 0}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${product.price.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.dealPrice ? `${product.dealPrice}%` : 'N/A'}</td>

                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(product)}
                          className="text-yellow-600 hover:text-yellow-800 mr-4"
                          aria-label={`Edit ${product.name}`}
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => openDeleteConfirm(product._id)}
                          className="text-red-600 hover:text-red-800"
                          aria-label={`Delete ${product.name}`}
                        >
                          <TrashIcon className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {filteredProducts.length > 0 && (
          <div className="mt-4 text-sm text-gray-500">
            Showing {((currentPage - 1) * productsPerPage) + 1}-{Math.min(currentPage * productsPerPage, filteredProducts.length)} of {filteredProducts.length} products
          </div>
        )}
        {totalPages > 1 && (
          <div className="mt-2 flex justify-end space-x-2">
            <button
              onClick={() => paginate(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => (
              <button
                key={i + 1}
                onClick={() => paginate(i + 1)}
                className={`px-3 py-1 border border-gray-300 rounded-md text-sm font-medium ${currentPage === i + 1 ? 'bg-teal-700 text-white' : 'text-gray-700 hover:bg-gray-50'
                  }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => paginate(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}

        {/* Product Form Modal */}
        <Transition appear show={isModalOpen} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setIsModalOpen(false)}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black bg-opacity-25" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4 text-center">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all">
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                      {editingId ? 'Edit Product' : 'Add Product'}
                    </Dialog.Title>
                    {errors.length > 0 && (
                      <div className="mt-4 bg-red-50 text-red-600 p-3 rounded-md">
                        {errors.map((error, idx) => (
                          <p key={idx}>{error}</p>
                        ))}
                      </div>
                    )}
                    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Product Name</label>
                        <input
                          name="name"
                          value={formData.name}
                          onChange={handleChange}
                          placeholder="Product Name"
                          className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Category</label>
                        <input
                          name="category"
                          value={formData.category}
                          onChange={handleChange}
                          placeholder="Category"
                          className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Slug</label>
                        <input
                          name="slug"
                          value={formData.slug}
                          onChange={handleChange}
                          placeholder="product-slug"
                          className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">SKU</label>
                        <input
                          name="sku"
                          value={formData.sku}
                          onChange={handleChange}
                          placeholder="e.g., GLV-BBQ-001"
                          className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Barcode / UPC</label>
                        <input
                          name="barcode"
                          value={formData.barcode}
                          onChange={handleChange}
                          placeholder="e.g., 012345678901"
                          className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Stock</label>
                        <input
                          name="stock"
                          type="number"
                          min="0"
                          value={formData.stock}
                          onChange={handleChange}
                          placeholder="0"
                          className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Price</label>
                        <input
                          name="price"
                          type="number"
                          step="0.01"
                          value={formData.price}
                          onChange={handleChange}
                          placeholder="19.99"
                          className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Deal Price (%)</label>
                        <input
                          name="dealPrice"
                          type="number"
                          step="1"
                          min="0"
                          max="50"
                          value={formData.dealPrice ?? ''}
                          onChange={handleChange}
                          placeholder="e.g., 10 (for 10% off)"
                          className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                        />
                      </div>
                      <div className="flex items-center space-x-3 pt-2">
                        <input
                          type="checkbox"
                          name="active"
                          checked={formData.active !== false}
                          onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                          className="h-4 w-4 text-teal-700 focus:ring-teal-500 border-gray-300 rounded"
                        />
                        <label className="text-sm font-medium text-gray-700">Active (visible on storefront and catalog)</label>
                      </div>
                      <div className="flex items-center space-x-3 pt-2">
                        <input
                          type="checkbox"
                          name="featured"
                          checked={formData.featured || false}
                          onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                          className="h-4 w-4 text-teal-700 focus:ring-teal-500 border-gray-300 rounded"
                        />
                        <label className="text-sm font-medium text-gray-700">Featured on storefront homepage</label>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Account ID</label>
                        <input
                          name="accountID"
                          value={formData.sellerID}
                          onChange={handleChange}
                          placeholder="Account ID"
                          className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                          readOnly
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Images</label>
                        {((formData.images || []).length > 0 || pendingFiles.length > 0) && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            {(formData.images || []).map((url, i) => (
                              <div key={`existing-${i}`} className="relative group w-20 h-20">
                                <img src={url} alt={`Product ${i + 1}`} className="w-20 h-20 object-cover rounded-md border" />
                                <button
                                  type="button"
                                  onClick={() => removeImage(i)}
                                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <XMarkIcon className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                            {pendingFiles.map((file, i) => (
                              <div key={`pending-${i}`} className="relative group w-20 h-20">
                                <img src={URL.createObjectURL(file)} alt={`New ${i + 1}`} className="w-20 h-20 object-cover rounded-md border border-teal-700" />
                                <button
                                  type="button"
                                  onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))}
                                  className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <XMarkIcon className="h-3 w-3" />
                                </button>
                                <span className="absolute bottom-0 left-0 right-0 bg-teal-700 text-white text-xs text-center rounded-b-md">New</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <label className="mt-2 flex items-center justify-center w-full h-16 border-2 border-dashed border-gray-300 rounded-md cursor-pointer hover:border-teal-500 transition-colors">
                          <input
                            type="file"
                            accept="image/webp,image/jpeg,image/png"
                            onChange={handleImageUpload}
                            className="hidden"
                            disabled={isLoading}
                          />
                          <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <PhotoIcon className="h-5 w-5" />
                            <span>Add image</span>
                          </div>
                        </label>
                        <div className="mt-2 flex items-center space-x-2">
                          <input
                            type="text"
                            placeholder="Or paste image URLs (comma-separated)"
                            className="flex-1 p-2 border border-gray-300 rounded-md text-sm focus:ring-teal-500 focus:border-teal-500"
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                const input = e.currentTarget;
                                const urls = input.value.split(',').map(u => u.trim()).filter(Boolean);
                                if (urls.length > 0) {
                                  setFormData(prev => ({
                                    ...prev,
                                    images: [...(prev.images || []), ...urls],
                                  }));
                                  input.value = '';
                                }
                              }
                            }}
                          />
                          <button
                            type="button"
                            className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-md text-sm hover:bg-gray-200"
                            onClick={(e) => {
                              const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                              const urls = input.value.split(',').map(u => u.trim()).filter(Boolean);
                              if (urls.length > 0) {
                                setFormData(prev => ({
                                  ...prev,
                                  images: [...(prev.images || []), ...urls],
                                }));
                                input.value = '';
                              }
                            }}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Description</label>
                        <textarea
                          name="description"
                          value={formData.description}
                          onChange={handleChange}
                          placeholder="Product description"
                          className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                          rows={4}
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Attributes</label>
                        {formData.attributes?.map((attr, index) => (
                          <div key={index} className="flex items-center space-x-2 mt-2">
                            <input
                              type="text"
                              placeholder="Key"
                              value={attr.key}
                              onChange={(e) => handleAttributeChange(index, 'key', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-md"
                            />
                            <input
                              type="text"
                              placeholder="Value"
                              value={attr.value}
                              onChange={(e) => handleAttributeChange(index, 'value', e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded-md"
                            />
                            <select
                              value={attr.type}
                              onChange={(e) => handleAttributeChange(index, 'type', e.target.value as 'filterable' | 'system')}
                              className="w-full p-2 border border-gray-300 rounded-md"
                            >
                              <option value="">None</option>
                              <option value="filterable">Filterable</option>
                              <option value="system">System</option>
                            </select>
                            <button
                              type="button"
                              onClick={() => removeAttribute(index)}
                              className="text-red-600"
                            >
                              <TrashIcon className="h-5 w-5" />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={addAttribute}
                          className="mt-2 text-teal-700"
                        >
                          + Add Attribute
                        </button>
                      </div>
                      <div className="mt-6 flex justify-end space-x-3">
                        <button
                          type="button"
                          onClick={() => setIsModalOpen(false)}
                          className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isLoading}
                          className="px-4 py-2 bg-teal-700 text-white rounded-md text-sm font-medium hover:bg-teal-800 disabled:opacity-50"
                        >
                          {isLoading ? 'Saving...' : editingId ? 'Update' : 'Create'}
                        </button>
                      </div>
                    </form>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>

        {/* Delete Confirmation Modal */}
        <Transition appear show={isDeleteConfirmOpen} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setIsDeleteConfirmOpen(false)}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black bg-opacity-25" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4 text-center">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-lg bg-white p-6 text-left align-middle shadow-xl transition-all">
                    <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                      Delete Product
                    </Dialog.Title>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Are you sure you want to delete this product? This action cannot be undone.
                      </p>
                    </div>
                    <div className="mt-6 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setIsDeleteConfirmOpen(false)}
                        className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isLoading}
                        className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                      >
                        {isLoading ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      </div>
    </div>
  );
};

export default ProductForm;