import { useState, useEffect } from 'react';
import { createBlogPost, getBlogPosts, updateBlogPost, deleteBlogPost, getProducts, getUploadUrl, uploadFileToS3 } from '../api';
import { BlogPost, Product } from '../types';
import Navbar from './Navbar';
import { PageHeader, CARD, BTN_PRIMARY } from './ui';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { PencilIcon, TrashIcon, PlusIcon, MagnifyingGlassIcon, PhotoIcon, XMarkIcon, NewspaperIcon } from '@heroicons/react/24/outline';
import toast, { Toaster } from 'react-hot-toast';

const toSlug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const emptyForm: Partial<BlogPost> = {
  title: '',
  slug: '',
  excerpt: '',
  body: '',
  featuredImage: '',
  author: '',
  authorBio: '',
  category: '',
  tags: [],
  mentionedProductIDs: [],
  metaTitle: '',
  metaDescription: '',
  active: true,
};

const BlogManager = () => {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filtered, setFiltered] = useState<BlogPost[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 10;
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<BlogPost>>(emptyForm);
  const [tagsInput, setTagsInput] = useState('');
  const [errors, setErrors] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [postsData, productsData] = await Promise.all([getBlogPosts(), getProducts()]);
      const sorted = [...postsData].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      setPosts(sorted);
      setFiltered(sorted);
      setProducts(productsData);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load blog posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(posts.filter((p) => p.title.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)));
    setPage(1);
  }, [search, posts]);

  const openCreate = () => {
    setFormData(emptyForm);
    setTagsInput('');
    setEditingId(null);
    setErrors([]);
    setIsModalOpen(true);
  };

  const openEdit = (post: BlogPost) => {
    setFormData({ ...post });
    setTagsInput((post.tags || []).join(', '));
    setEditingId(post._id);
    setErrors([]);
    setIsModalOpen(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    const updates: Partial<BlogPost> = { [name]: value } as Partial<BlogPost>;
    // Auto-slug from title if slug is empty or matches the previous auto-slug
    if (name === 'title' && (!formData.slug || formData.slug === toSlug(formData.title || ''))) {
      updates.slug = toSlug(value);
    }
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2 MB');
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const { uploadUrl, imageUrl } = await getUploadUrl(file.type, ext, formData.slug || 'blog');
      await uploadFileToS3(uploadUrl, file);
      setFormData((prev) => ({ ...prev, featuredImage: imageUrl }));
      toast.success('Image uploaded');
    } catch (err: any) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!formData.title || formData.title.trim().length < 10) errs.push('Title must be at least 10 characters');
    if (!formData.slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(formData.slug)) errs.push('Slug must be lowercase letters/digits/hyphens (no leading or trailing hyphen)');
    if (!formData.body || formData.body.trim().length < 200) errs.push('Body must be at least 200 characters');
    if (!formData.author || formData.author.trim().length < 2) errs.push('Author is required');
    if (!formData.category || formData.category.trim().length < 2) errs.push('Category is required');
    if (formData.excerpt && formData.excerpt.length > 300) errs.push('Excerpt max 300 characters');
    if (formData.metaTitle && formData.metaTitle.length > 70) errs.push('Meta title max 70 characters');
    if (formData.metaDescription && formData.metaDescription.length > 160) errs.push('Meta description max 160 characters');
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (errs.length > 0) return;
    setLoading(true);
    try {
      const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
      const payload = { ...formData, tags } as Omit<BlogPost, '_id' | 'createdAt' | 'updatedAt'>;
      if (editingId) {
        await updateBlogPost(editingId, payload);
        toast.success('Blog post updated');
      } else {
        await createBlogPost(payload);
        toast.success('Blog post created');
      }
      setIsModalOpen(false);
      setFormData(emptyForm);
      setTagsInput('');
      setEditingId(null);
      await fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setLoading(true);
    try {
      await deleteBlogPost(deletingId);
      toast.success('Blog post deleted');
      setIsDeleteOpen(false);
      setDeletingId(null);
      await fetchAll();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete');
    } finally {
      setLoading(false);
    }
  };

  const toggleMentionedProduct = (id: string) => {
    const ids = formData.mentionedProductIDs || [];
    setFormData((prev) => ({
      ...prev,
      mentionedProductIDs: ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id],
    }));
  };

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const pageStart = (page - 1) * perPage;
  const pagePosts = filtered.slice(pageStart, pageStart + perPage);

  return (
    <div>
      <Navbar />
      <Toaster position="top-right" />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader title="Blog posts" subtitle="Create and manage your storefront blog.">
          <button onClick={openCreate} className={`${BTN_PRIMARY} inline-flex items-center gap-2`}>
            <PlusIcon className="w-5 h-5" /> New post
          </button>
        </PageHeader>

        <div className="relative mt-6 mb-6">
          <MagnifyingGlassIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by title or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
          />
        </div>

        {loading && posts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className={`${CARD} text-center py-12`}>
            <NewspaperIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No blog posts yet. Click "New Post" to create your first.</p>
          </div>
        ) : (
          <div className={`${CARD} overflow-hidden`}>
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase">Author</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase">Published</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-700 uppercase">Status</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-700 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {pagePosts.map((post) => (
                  <tr key={post._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{post.title}</div>
                      <div className="text-xs text-gray-500">/{post.slug}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">{post.category}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{post.author}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {new Date(post.publishedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                        post.active === false ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'
                      }`}>
                        {post.active === false ? 'Draft' : 'Published'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => openEdit(post)}
                        className="text-teal-700 hover:text-teal-900 mr-3"
                        aria-label="Edit"
                      >
                        <PencilIcon className="w-5 h-5" />
                      </button>
                      <button
                        onClick={() => { setDeletingId(post._id); setIsDeleteOpen(true); }}
                        className="text-red-600 hover:text-red-800"
                        aria-label="Delete"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
                <span className="text-sm text-gray-600">
                  Page {page} of {totalPages} ({filtered.length} posts)
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Transition appear show={isModalOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsModalOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-150"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-3xl bg-white rounded-xl shadow-xl overflow-hidden">
                  <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <Dialog.Title className="text-lg font-bold text-gray-900">
                      {editingId ? 'Edit Blog Post' : 'New Blog Post'}
                    </Dialog.Title>
                    <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                      <XMarkIcon className="w-6 h-6" />
                    </button>
                  </div>
                  <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4 max-h-[75vh] overflow-y-auto">
                    {errors.length > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                        <ul className="text-sm text-red-700 list-disc list-inside">
                          {errors.map((err, i) => <li key={i}>{err}</li>)}
                        </ul>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Title <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="title"
                        value={formData.title || ''}
                        onChange={handleChange}
                        maxLength={200}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                      />
                      <div className="text-xs text-gray-500 mt-1">{(formData.title || '').length}/200</div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Slug <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        name="slug"
                        value={formData.slug || ''}
                        onChange={(e) => setFormData((prev) => ({ ...prev, slug: e.target.value.toLowerCase() }))}
                        maxLength={120}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 font-mono text-sm"
                      />
                      <div className="text-xs text-gray-500 mt-1">URL: /blog/{formData.slug || 'your-slug'}-XXXXXX.html</div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Author <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="author"
                          value={formData.author || ''}
                          onChange={handleChange}
                          maxLength={100}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Category <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="text"
                          name="category"
                          value={formData.category || ''}
                          onChange={handleChange}
                          maxLength={80}
                          placeholder="welding-gloves"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Author Bio</label>
                      <textarea
                        name="authorBio"
                        value={formData.authorBio || ''}
                        onChange={handleChange}
                        rows={2}
                        maxLength={500}
                        placeholder="Short bio for E-E-A-T (Expertise, Authority, Trust)"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Excerpt (card display)</label>
                      <textarea
                        name="excerpt"
                        value={formData.excerpt || ''}
                        onChange={handleChange}
                        rows={2}
                        maxLength={300}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                      />
                      <div className="text-xs text-gray-500 mt-1">{(formData.excerpt || '').length}/300</div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Body (HTML) <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        name="body"
                        value={formData.body || ''}
                        onChange={handleChange}
                        rows={14}
                        maxLength={100000}
                        placeholder={'<h2>Section heading</h2>\n\n<p>Paragraph text with <strong>bold</strong> and <a href="/products/xyz.html">internal link</a>.</p>\n\n<table>\n  <tr><th>Col 1</th><th>Col 2</th></tr>\n  <tr><td>Cell</td><td>Cell</td></tr>\n</table>'}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600 font-mono text-sm"
                      />
                      <div className="text-xs text-gray-500 mt-1">
                        {(formData.body || '').length} chars · ~{Math.ceil((formData.body || '').split(/\s+/).length / 200)} min read · Use <code>&lt;h2&gt;</code>, <code>&lt;p&gt;</code>, <code>&lt;strong&gt;</code>, <code>&lt;a&gt;</code>, <code>&lt;table&gt;</code>, <code>&lt;ul&gt;</code> for structure
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Featured Image</label>
                      {formData.featuredImage ? (
                        <div className="flex items-center gap-3">
                          <img src={formData.featuredImage} alt="" className="w-24 h-24 object-cover rounded" />
                          <button
                            type="button"
                            onClick={() => setFormData((prev) => ({ ...prev, featuredImage: '' }))}
                            className="text-sm text-red-600 hover:text-red-800"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center gap-2 w-full px-3 py-3 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                          <PhotoIcon className="w-5 h-5 text-gray-400" />
                          <span className="text-sm text-gray-600">
                            {uploading ? 'Uploading...' : 'Click to upload featured image (max 2 MB)'}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="hidden"
                            disabled={uploading}
                          />
                        </label>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
                      <input
                        type="text"
                        value={tagsInput}
                        onChange={(e) => setTagsInput(e.target.value)}
                        placeholder="welding, buyer-guide, mig"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                      />
                    </div>

                    {products.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Mentioned Products
                          <span className="text-xs text-gray-500 ml-2 font-normal">(internal reference — link these in body text)</span>
                        </label>
                        <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-lg p-2 space-y-1">
                          {products.map((p) => (
                            <label key={p._id} className="flex items-center gap-2 text-sm hover:bg-gray-50 px-2 py-1 rounded">
                              <input
                                type="checkbox"
                                checked={(formData.mentionedProductIDs || []).includes(p._id)}
                                onChange={() => toggleMentionedProduct(p._id)}
                              />
                              <span className="truncate">{p.name}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="border-t border-gray-200 pt-4">
                      <div className="text-sm font-semibold text-gray-700 mb-3">SEO (optional)</div>
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Meta Title</label>
                          <input
                            type="text"
                            name="metaTitle"
                            value={formData.metaTitle || ''}
                            onChange={handleChange}
                            maxLength={70}
                            placeholder="Falls back to title if empty"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                          />
                          <div className="text-xs text-gray-500 mt-1">{(formData.metaTitle || '').length}/70</div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Meta Description</label>
                          <textarea
                            name="metaDescription"
                            value={formData.metaDescription || ''}
                            onChange={handleChange}
                            rows={2}
                            maxLength={160}
                            placeholder="Falls back to excerpt if empty"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                          />
                          <div className="text-xs text-gray-500 mt-1">{(formData.metaDescription || '').length}/160</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="checkbox"
                        id="active"
                        checked={formData.active !== false}
                        onChange={(e) => setFormData((prev) => ({ ...prev, active: e.target.checked }))}
                      />
                      <label htmlFor="active" className="text-sm text-gray-700">
                        Published (visible on storefront)
                      </label>
                    </div>
                  </form>
                  <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-gray-50">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      onClick={handleSubmit}
                      disabled={loading}
                      className="px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg disabled:opacity-50"
                    >
                      {loading ? 'Saving...' : (editingId ? 'Update' : 'Create')}
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Delete Confirm */}
      <Transition appear show={isDeleteOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsDeleteOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/40" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Dialog.Panel className="w-full max-w-sm bg-white rounded-xl shadow-xl p-6">
                <Dialog.Title className="text-lg font-bold text-gray-900 mb-2">Delete blog post?</Dialog.Title>
                <p className="text-sm text-gray-600 mb-4">This permanently removes the post. Cannot be undone.</p>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setIsDeleteOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </Dialog.Panel>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
};

export default BlogManager;
