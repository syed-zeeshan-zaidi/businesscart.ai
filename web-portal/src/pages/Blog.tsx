import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import blogPosts from '../data/blogPosts';

const Blog: React.FC = () => {
  return (
    <div className="bg-gray-50">
      <Navbar />
      <main className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold text-gray-900">Blog</h1>
            <p className="mt-4 text-lg text-gray-500">
              Insights on e-commerce, AI, and growing your business online.
            </p>
          </div>

          <div className="space-y-8">
            {blogPosts.map((post) => (
              <article key={post.slug} className="bg-white shadow-lg rounded-lg p-4 sm:p-8">
                <time dateTime={post.date} className="text-sm text-gray-500">{post.date}</time>
                <h2 className="text-2xl font-bold text-gray-800 mt-1 mb-2">
                  <Link to={`/blog/${post.slug}`} className="hover:text-teal-800">
                    {post.title}
                  </Link>
                </h2>
                <p className="text-gray-600 mb-4">{post.excerpt}</p>
                <Link to={`/blog/${post.slug}`} className="text-teal-700 font-semibold hover:underline">
                  Read more &rarr;
                </Link>
              </article>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Blog;
