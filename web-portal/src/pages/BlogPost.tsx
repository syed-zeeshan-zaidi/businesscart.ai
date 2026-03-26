import React from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import blogPosts from '../data/blogPosts';

interface BlogPostProps {
  slug?: string;
}

const BlogPost: React.FC<BlogPostProps> = ({ slug: propSlug }) => {
  const { slug: paramSlug } = useParams<{ slug: string }>();
  const slug = propSlug || paramSlug;
  const post = blogPosts.find((p) => p.slug === slug);

  if (!post) {
    return (
      <div className="bg-gray-50">
        <Navbar />
        <main className="py-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-4xl font-extrabold text-gray-900 mb-4">Post Not Found</h1>
            <Link to="/blog" className="text-teal-700 font-semibold hover:underline">Back to Blog</Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="bg-gray-50">
      <Navbar />
      <main className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <article className="bg-white shadow-lg rounded-lg p-8">
            <Link to="/blog" className="text-teal-700 text-sm hover:underline">&larr; Back to Blog</Link>
            <time dateTime={post.date} className="block text-sm text-gray-500 mt-4">{post.date}</time>
            <h1 className="text-4xl font-extrabold text-gray-900 mt-1 mb-6">{post.title}</h1>
            <div className="blog-content text-gray-600 text-lg leading-relaxed">
              {post.content}
            </div>
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default BlogPost;
