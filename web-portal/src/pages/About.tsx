import React from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const About: React.FC = () => {
  const sections = [
    { id: 'our-story', title: 'Our Story' },
    { id: 'our-mission', title: 'Our Mission' },
    { id: 'our-team', title: 'Our Team' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Navbar />
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">About Us</h2>
                <ul className="space-y-2">
                  {sections.map((section) => (
                    <li key={section.id}>
                      <a href={`#${section.id}`} className="text-gray-600 hover:text-teal-600">{section.title}</a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="lg:col-span-3 space-y-12">
              <section id="our-story">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Our Story</h2>
                <p className="text-gray-600">
                  Founded in 2023, BusinessCart was born out of a simple observation: B2B e-commerce is unnecessarily complex. We saw businesses struggling with outdated systems, manual processes, and a lack of tools to effectively manage their relationships with their customers. We knew there had to be a better way.
                </p>
                <p className="text-gray-600 mt-4">
                  We started with a small team of passionate developers and business experts, and we set out to build a platform that would revolutionize the B2B e-commerce landscape. Our goal was to create a solution that was powerful, flexible, and easy to use, a platform that would empower businesses to connect with their customers in a whole new way.
                </p>
              </section>
              <section id="our-mission">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Our Mission</h2>
                <p className="text-gray-600">
                  Our mission is to empower businesses to thrive in the digital age. We believe that every business, regardless of size, deserves access to the best tools and technology to help them succeed. We are committed to providing a platform that is not only powerful and feature-rich, but also affordable and accessible to all.
                </p>
              </section>
              <section id="our-team">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Our Team</h2>
                <p className="text-gray-600">
                  We are a team of innovators, problem-solvers, and collaborators. We are passionate about what we do, and we are dedicated to helping our customers succeed. We believe in the power of teamwork, and we work together to create a culture of excellence and continuous improvement.
                </p>
              </section>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default About;
