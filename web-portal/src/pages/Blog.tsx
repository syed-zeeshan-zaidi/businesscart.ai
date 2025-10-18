import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const blogPosts = [
  {
    slug: 'the-true-cost-of-marketplaces',
    title: 'The True Cost of Marketplaces: Why 30% Commission is Just the Beginning',
    excerpt: 'You see the charge every month: 15%, 20%, maybe even 30% of your hard-earned revenue handed over to a marketplace. But what if that\'s just the tip of the iceberg?'
  }
];

const Blog: React.FC = () => {
  return (
    <div className="bg-gray-100">
      <Navbar />
      <main className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-extrabold text-gray-900">Blog</h1>
            <p className="mt-4 text-lg text-gray-500">
              Insights and stories from the BusinessCart.ai team.
            </p>
          </div>

          <div className="space-y-8">
            {blogPosts.map((post) => (
              <div key={post.slug} className="bg-white shadow-lg rounded-lg p-8">
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  <Link to={`/blog/${post.slug}`} className="hover:text-teal-600">
                    {post.title}
                  </Link>
                </h2>
                <p className="text-gray-600 mb-4">{post.excerpt}</p>
                <Link to={`/blog/${post.slug}`} className="text-teal-600 font-semibold hover:underline">
                  Read more &rarr;
                </Link>
              </div>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Blog;
