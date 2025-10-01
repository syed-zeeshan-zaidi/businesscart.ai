import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const Careers: React.FC = () => {
  const sections = [
    { id: 'why-join-us', title: 'Why Join Us?' },
    { id: 'our-culture', title: 'Our Culture' },
    { id: 'open-positions', title: 'Open Positions' },
  ];

  const openPositions = [
    {
      title: 'Senior Frontend Engineer',
      location: 'Remote',
      description: 'We are looking for a talented and passionate Frontend Engineer to join our team. You will be responsible for building and maintaining our web application, and for ensuring that it is fast, reliable, and easy to use.',
    },
    {
      title: 'Senior Backend Engineer',
      location: 'Remote',
      description: 'We are looking for a talented and passionate Backend Engineer to join our team. You will be responsible for building and maintaining our API, and for ensuring that it is fast, reliable, and scalable.',
    },
    {
      title: 'Product Manager',
      location: 'Remote',
      description: 'We are looking for a talented and passionate Product Manager to join our team. You will be responsible for defining the product roadmap, and for working with our engineering team to build and launch new features.',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Navbar />
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white shadow-lg rounded-lg p-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1">
              <div className="sticky top-24">
                <h2 className="text-lg font-semibold text-gray-800 mb-4">Careers</h2>
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
              <section id="why-join-us">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Why Join Us?</h2>
                <p className="text-gray-600">
                  At BusinessCart, we are on a mission to revolutionize the B2B e-commerce industry. We are a team of passionate and talented individuals who are dedicated to building a platform that is powerful, flexible, and easy to use. We are looking for people who are excited about our mission and who want to be a part of a team that is making a real impact.
                </p>
              </section>
              <section id="our-culture">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Our Culture</h2>
                <p className="text-gray-600">
                  We believe in a culture of collaboration, innovation, and continuous improvement. We are a team of lifelong learners who are always looking for new and better ways to do things. We are a remote-first company, and we believe in giving our employees the flexibility and autonomy they need to do their best work.
                </p>
              </section>
              <section id="open-positions">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Open Positions</h2>
                <div className="space-y-8">
                  {openPositions.map((position, index) => (
                    <div key={index} className="border-b border-gray-200 pb-8">
                      <h3 className="text-xl font-semibold text-gray-800">{position.title}</h3>
                      <p className="text-gray-600">{position.location}</p>
                      <p className="text-gray-600 mt-4">{position.description}</p>
                      <Link to="/contact-us" className="text-teal-600 hover:underline mt-4 inline-block">Apply Now</Link>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Careers;
