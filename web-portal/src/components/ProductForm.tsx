import { useState, useEffect } from 'react';
import { createProduct, getProducts, updateProduct, deleteProduct, getAccount, getUploadUrl, uploadFileToS3 } from '../api';
import { Product, Account, Attribute, PriceTier } from '../types';
import Navbar from './Navbar';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { PencilIcon, TrashIcon, PlusIcon, MagnifyingGlassIcon, PhotoIcon, XMarkIcon, StarIcon, ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarIconSolid } from '@heroicons/react/24/solid';
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
    googleProductCategory: '',
    slug: '',
    sku: '',
    barcode: '',
    stock: 0,
    active: true,
    featured: false,
    attributes: [],
    priceTiers: [],
    groupIDs: [],
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
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
    if (formData.category && (formData.category.split('/').length > 2)) newErrors.push('Category supports max one "/" for primary / sub hierarchy');
    if (formData.price === undefined || formData.price <= 0) newErrors.push('Price must be positive');
    if (formData.dealPrice !== undefined && (formData.dealPrice < 0 || formData.dealPrice > 50)) {
      newErrors.push('Deal Price must be between 0 and 50');
    }
    if (formData.stock !== undefined && formData.stock < 0) newErrors.push('Stock cannot be negative');
    if (!formData.description) newErrors.push('Description is required');
    if (formData.priceTiers && formData.priceTiers.length > 0) {
      for (let i = 0; i < formData.priceTiers.length; i++) {
        const t = formData.priceTiers[i];
        if (i === 0 && (!t.minQty || t.minQty < 2)) { newErrors.push('First tier: Min qty must be >= 2 (base price covers qty 1)'); }
        else if (!t.minQty || t.minQty < 1) { newErrors.push(`Tier ${i + 1}: Min qty must be >= 1`); }
        if (!t.price || t.price <= 0) newErrors.push(`Tier ${i + 1}: Price must be > 0`);
        if (i > 0 && t.minQty <= formData.priceTiers[i - 1].minQty) newErrors.push(`Tier ${i + 1}: Min qty must be greater than previous tier`);
      }
    }
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
        googleProductCategory: '',
        slug: '',
        sku: '',
        barcode: '',
        stock: 0,
        active: true,
        featured: false,
        attributes: [],
        priceTiers: [],
        groupIDs: [],
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

  const handleTierChange = (index: number, field: keyof PriceTier, value: string) => {
    const tiers = [...(formData.priceTiers || [])];
    tiers[index] = { ...tiers[index], [field]: field === 'minQty' ? parseInt(value) || 0 : parseFloat(value) || 0 };
    setFormData({ ...formData, priceTiers: tiers });
  };

  const addTier = () => {
    const tiers = [...(formData.priceTiers || [])];
    const lastMinQty = tiers.length > 0 ? tiers[tiers.length - 1].minQty : 0;
    tiers.push({ minQty: lastMinQty + 10, price: 0 });
    setFormData({ ...formData, priceTiers: tiers });
  };

  const removeTier = (index: number) => {
    const tiers = [...(formData.priceTiers || [])];
    tiers.splice(index, 1);
    setFormData({ ...formData, priceTiers: tiers });
  };

  const toggleGroup = (groupId: string) => {
    const current = formData.groupIDs || [];
    const next = current.includes(groupId)
      ? current.filter((id) => id !== groupId)
      : [...current, groupId];
    setFormData({ ...formData, groupIDs: next });
  };

  const handleEdit = (product: Product) => {
    setFormData({
      name: product.name,
      price: product.price,
      dealPrice: product.dealPrice,
      dealStartDate: product.dealStartDate,
      dealEndDate: product.dealEndDate,
      description: product.description,
      sellerID: product.sellerID,
      images: product.images || [],
      category: product.category,
      googleProductCategory: product.googleProductCategory || '',
      slug: product.slug || '',
      sku: product.sku || '',
      barcode: product.barcode || '',
      stock: product.stock || 0,
      active: product.active !== false,
      featured: product.featured || false,
      attributes: product.attributes || [],
      priceTiers: product.priceTiers || [],
      groupIDs: product.groupIDs || [],
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
      const { uploadUrl, imageUrl } = await getUploadUrl(file.type, ext, formData.slug);
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

  const setMainImage = (index: number) => {
    setFormData(prev => {
      const imgs = [...(prev.images || [])];
      const [moved] = imgs.splice(index, 1);
      imgs.unshift(moved);
      return { ...prev, images: imgs };
    });
  };

  const openModal = () => {
    setFormData({
      name: '',
      price: 0,
      description: '',
      sellerID: account?._id || '',
      images: [],
      category: '',
      googleProductCategory: '',
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-6">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-800">Products</h2>
          <button
            onClick={openModal}
            className="bg-teal-700 text-white px-3 py-1.5 text-sm rounded-md hover:bg-teal-800 transition-colors flex items-center space-x-1"
          >
            <PlusIcon className="h-4 w-4" />
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
              <table className="min-w-[750px] w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-16">Image</th>
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
                      <td className="px-4 py-2 whitespace-nowrap">
                        {product.images && product.images[0] ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            loading="lazy"
                            className="h-10 w-10 rounded object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded bg-gray-100 border border-gray-200 flex items-center justify-center">
                            <PhotoIcon className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">{product.active !== false ? <span className="text-green-700 font-medium">Active</span> : <span className="text-red-600 font-medium">Inactive</span>}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.category}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.attributes?.length || 0}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${product.price.toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {product.dealPrice ? (
                          <>
                            {product.dealPrice}%
                            {product.dealEndDate && (
                              <span className={`ml-1 text-xs ${new Date(product.dealEndDate) < new Date() ? 'text-red-500' : 'text-green-600'}`}>
                                {new Date(product.dealEndDate) < new Date() ? '(expired)' : `(until ${new Date(product.dealEndDate).toLocaleDateString()})`}
                              </span>
                            )}
                          </>
                        ) : 'N/A'}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(product)}
                          className="text-yellow-600 hover:bg-yellow-50 rounded p-2 mr-1"
                          aria-label={`Edit ${product.name}`}
                        >
                          <PencilIcon className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => openDeleteConfirm(product._id)}
                          className="text-red-600 hover:bg-red-50 rounded p-2"
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
              <div className="flex min-h-full items-center justify-center p-2 sm:p-4 text-center">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full max-w-5xl transform overflow-hidden rounded-xl bg-white text-left align-middle shadow-2xl transition-all flex flex-col max-h-[95vh] sm:max-h-[90vh]">
                    <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 flex-shrink-0 flex items-center justify-between">
                      <Dialog.Title as="h3" className="text-base sm:text-lg font-semibold leading-6 text-gray-900">
                        {editingId ? 'Edit Product' : 'Add Product'}
                      </Dialog.Title>
                      <button
                        type="button"
                        onClick={() => setIsModalOpen(false)}
                        className="text-gray-400 hover:text-gray-600 rounded p-1"
                        aria-label="Close"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                    </div>
                    <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
                      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-5 sm:space-y-6">
                    {errors.length > 0 && (
                      <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
                        {errors.map((error, idx) => (
                          <p key={idx}>{error}</p>
                        ))}
                      </div>
                    )}
                      {/* Section: Basic Info */}
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3">Basic Info</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Product Name</label>
                            <input
                              name="name"
                              value={formData.name}
                              onChange={handleChange}
                              placeholder="Product Name"
                              className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Category</label>
                            <input
                              list="category-suggestions"
                              name="category"
                              value={formData.category}
                              onChange={handleChange}
                              placeholder="e.g. Electronics / Phones"
                              className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                            />
                            <datalist id="category-suggestions">
                              {Array.from(new Set(products.map(p => p.category).filter(Boolean))).map(cat => (
                                <option key={cat} value={cat} />
                              ))}
                            </datalist>
                            <p className="mt-1 text-xs text-gray-400">Use "Primary / Sub" for hierarchy (e.g. "Electronics / Phones"). Without "/" it's a standalone category.</p>
                          </div>
                          <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-gray-700">Google Product Category (for ad feeds)</label>
                            <input
                              name="googleProductCategory"
                              value={formData.googleProductCategory || ''}
                              onChange={handleChange}
                              placeholder="e.g. Home & Garden > Kitchen & Dining > Kitchen Tools & Utensils > Oven Mitts & Potholders"
                              className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                            />
                            <p className="mt-1 text-xs text-gray-400">Paste the full path or numeric ID from <a href="https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt" target="_blank" rel="noopener noreferrer" className="text-teal-600 underline">Google's product taxonomy</a>. Used in Google Shopping, Facebook, Pinterest, Bing, and TikTok feeds. Leave blank to skip.</p>
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
                        </div>
                      </div>

                      {/* Section: Pricing */}
                      <div className="pt-2 border-t border-gray-100">
                        <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3 mt-4">Pricing</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                        </div>
                        {formData.dealPrice && formData.dealPrice > 0 && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Deal Start Date</label>
                              <input
                                name="dealStartDate"
                                type="datetime-local"
                                value={formData.dealStartDate ? new Date(formData.dealStartDate).toISOString().slice(0, 16) : ''}
                                onChange={(e) => setFormData({ ...formData, dealStartDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                                className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500 text-sm"
                              />
                              <p className="text-xs text-gray-500 mt-1">Optional. Leave empty for immediate start.</p>
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700">Deal End Date</label>
                              <input
                                name="dealEndDate"
                                type="datetime-local"
                                value={formData.dealEndDate ? new Date(formData.dealEndDate).toISOString().slice(0, 16) : ''}
                                onChange={(e) => setFormData({ ...formData, dealEndDate: e.target.value ? new Date(e.target.value).toISOString() : undefined })}
                                className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500 text-sm"
                              />
                              <p className="text-xs text-gray-500 mt-1">Optional. Leave empty for no expiry.</p>
                            </div>
                          </div>
                        )}
                        {/* Price Tiers */}
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700 mb-1">Volume Price Tiers</label>
                          <p className="text-xs text-gray-500 mb-2">Optional. Set lower prices for bulk orders. Base price applies below the first tier.</p>
                          {(formData.priceTiers || []).map((tier, i) => (
                            <div key={i} className="flex items-center gap-2 mb-2">
                              <input type="number" min="1" value={tier.minQty || ''} onChange={(e) => handleTierChange(i, 'minQty', e.target.value)} placeholder="Min qty" className="w-24 p-2 border border-gray-300 rounded-md text-sm" />
                              <span className="text-sm text-gray-500">+ units @</span>
                              <input type="number" min="0.01" step="0.01" value={tier.price || ''} onChange={(e) => handleTierChange(i, 'price', e.target.value)} placeholder="Price" className="w-28 p-2 border border-gray-300 rounded-md text-sm" />
                              <button type="button" onClick={() => removeTier(i)} className="text-red-500 hover:text-red-700 text-sm">Remove</button>
                            </div>
                          ))}
                          <button type="button" onClick={addTier} className="text-sm text-teal-700 hover:text-teal-900 font-medium">+ Add tier</button>
                        </div>
                      </div>

                      {/* Section: Visibility */}
                      <div className="pt-2 border-t border-gray-100">
                        <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3 mt-4">Visibility</h4>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">B2B Visibility Groups</label>
                        <p className="text-xs text-gray-500 mb-2">
                          Restrict this product to specific B2B customer groups. Leave all unchecked = visible to everyone (B2B + B2C). B2C storefront customers always see this product regardless of groups.
                        </p>
                        {(account?.company?.customerGroups || []).length === 0 ? (
                          <p className="text-xs text-gray-400 italic">No groups defined. Add groups in Company Settings → Customer Groups.</p>
                        ) : (
                          <div className="space-y-2">
                            {(account?.company?.customerGroups || []).map((g) => {
                              const checked = (formData.groupIDs || []).includes(g.id);
                              return (
                                <label key={g.id} className="flex items-center space-x-3 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleGroup(g.id)}
                                    className="h-4 w-4 text-teal-700 focus:ring-teal-500 border-gray-300 rounded"
                                  />
                                  <span className="text-sm text-gray-700">
                                    {g.name}
                                    {g.groupPriceDiscount ? <span className="text-xs text-gray-400 ml-2">{g.groupPriceDiscount}% off</span> : null}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              name="active"
                              checked={formData.active !== false}
                              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                              className="h-4 w-4 text-teal-700 focus:ring-teal-500 border-gray-300 rounded"
                            />
                            <label className="text-sm font-medium text-gray-700">Active (visible on storefront and catalog)</label>
                          </div>
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              name="featured"
                              checked={formData.featured || false}
                              onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                              className="h-4 w-4 text-teal-700 focus:ring-teal-500 border-gray-300 rounded"
                            />
                            <label className="text-sm font-medium text-gray-700">Featured on storefront homepage</label>
                          </div>
                        </div>
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700">Account ID</label>
                          <input
                            name="accountID"
                            value={formData.sellerID}
                            onChange={handleChange}
                            placeholder="Account ID"
                            className="mt-1 w-full p-2 border border-gray-300 rounded-md bg-gray-50 text-gray-600 focus:ring-teal-500 focus:border-teal-500"
                            readOnly
                          />
                        </div>
                      </div>

                      {/* Section: Media */}
                      <div className="pt-2 border-t border-gray-100">
                        <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3 mt-4">Media</h4>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">Images</label>
                        {((formData.images || []).length > 0 || pendingFiles.length > 0) && (
                          <div className="mt-2 grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
                            {(formData.images || []).map((url, i) => (
                              <div key={`existing-${i}`} className={`relative group rounded-lg overflow-hidden border-2 ${i === 0 ? 'border-teal-700' : 'border-gray-200'} hover:border-teal-500 transition-colors`}>
                                <div className="aspect-square cursor-pointer" onClick={() => setPreviewImage(url)}>
                                  <img src={url} alt={`Product ${i + 1}`} className="w-full h-full object-cover" />
                                </div>
                                {i === 0 && (
                                  <span className="absolute top-1 left-1 flex items-center gap-0.5 bg-teal-700 text-white text-xs px-1.5 py-0.5 rounded">
                                    <StarIconSolid className="h-3 w-3" /> Main
                                  </span>
                                )}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors pointer-events-none" />
                                <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {i !== 0 && (
                                    <button type="button" onClick={() => setMainImage(i)} className="bg-white text-teal-700 rounded-full p-1 shadow hover:bg-teal-50" title="Set as main">
                                      <StarIcon className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                  <button type="button" onClick={() => removeImage(i)} className="bg-white text-red-500 rounded-full p-1 shadow hover:bg-red-50" title="Remove">
                                    <XMarkIcon className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                            {pendingFiles.map((file, i) => (
                              <div key={`pending-${i}`} className="relative group rounded-lg overflow-hidden border-2 border-dashed border-teal-500">
                                <div className="aspect-square">
                                  <img src={URL.createObjectURL(file)} alt={`New ${i + 1}`} className="w-full h-full object-cover" />
                                </div>
                                <span className="absolute top-1 left-1 bg-teal-700 text-white text-xs px-1.5 py-0.5 rounded">Pending</span>
                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button type="button" onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))} className="bg-white text-red-500 rounded-full p-1 shadow hover:bg-red-50" title="Remove">
                                    <XMarkIcon className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        <label className="mt-3 flex items-center justify-center w-full h-20 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-teal-500 hover:bg-teal-50/50 transition-all">
                          <input
                            type="file"
                            accept="image/webp,image/jpeg,image/png"
                            onChange={handleImageUpload}
                            className="hidden"
                            disabled={isLoading}
                          />
                          <div className="flex flex-col items-center text-sm text-gray-500">
                            <PhotoIcon className="h-6 w-6 mb-1" />
                            <span>Click to add image</span>
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
                      </div>

                      {/* Section: Details */}
                      <div className="pt-2 border-t border-gray-100">
                        <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wide mb-3 mt-4">Details</h4>
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
                        <div className="mt-4">
                          <label className="block text-sm font-medium text-gray-700">Attributes</label>
                          {formData.attributes?.map((attr, index) => (
                            <div key={index} className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_140px_auto] gap-2 mt-2 items-start">
                              <input
                                type="text"
                                placeholder="Key"
                                value={attr.key}
                                onChange={(e) => handleAttributeChange(index, 'key', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-md text-sm"
                              />
                              <input
                                type="text"
                                placeholder="Value"
                                value={attr.value}
                                onChange={(e) => handleAttributeChange(index, 'value', e.target.value)}
                                className="w-full p-2 border border-gray-300 rounded-md text-sm"
                              />
                              <select
                                value={attr.type}
                                onChange={(e) => handleAttributeChange(index, 'type', e.target.value as 'filterable' | 'system')}
                                className="w-full p-2 border border-gray-300 rounded-md text-sm"
                              >
                                <option value="">None</option>
                                <option value="filterable">Filterable</option>
                                <option value="system">System</option>
                              </select>
                              <button
                                type="button"
                                onClick={() => removeAttribute(index)}
                                className="text-red-600 hover:bg-red-50 rounded p-2 justify-self-start sm:justify-self-center"
                                aria-label="Remove attribute"
                              >
                                <TrashIcon className="h-5 w-5" />
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={addAttribute}
                            className="mt-2 text-sm text-teal-700 hover:text-teal-900 font-medium"
                          >
                            + Add Attribute
                          </button>
                        </div>
                      </div>
                      </div>
                      <div className="px-4 sm:px-6 py-3 border-t border-gray-200 bg-gray-50 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => setIsModalOpen(false)}
                          className="w-full sm:w-auto px-4 py-2 border border-gray-300 bg-white rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={isLoading}
                          className="w-full sm:w-auto px-4 py-2 bg-teal-700 text-white rounded-md text-sm font-medium hover:bg-teal-800 disabled:opacity-50"
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
      {previewImage && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4" onClick={(e) => { e.stopPropagation(); setPreviewImage(null); }}>
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <img src={previewImage} alt="Preview" className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" />
            <button onClick={() => setPreviewImage(null)} className="absolute -top-3 -right-3 bg-white text-gray-700 rounded-full p-1.5 shadow-lg hover:bg-gray-100">
              <XMarkIcon className="h-5 w-5" />
            </button>
            {(formData.images || []).length > 1 && (() => {
              const imgs = formData.images || [];
              const idx = imgs.indexOf(previewImage);
              return (
                <>
                  {idx > 0 && (
                    <button onClick={() => setPreviewImage(imgs[idx - 1])} className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/90 text-gray-700 rounded-full p-2 shadow-lg hover:bg-white">
                      <ChevronLeftIcon className="h-5 w-5" />
                    </button>
                  )}
                  {idx < imgs.length - 1 && (
                    <button onClick={() => setPreviewImage(imgs[idx + 1])} className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/90 text-gray-700 rounded-full p-2 shadow-lg hover:bg-white">
                      <ChevronRightIcon className="h-5 w-5" />
                    </button>
                  )}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-black/60 text-white text-xs px-3 py-1 rounded-full">
                    {idx + 1} / {imgs.length}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductForm;