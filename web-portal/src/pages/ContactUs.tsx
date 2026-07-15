import React, { useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import {
  EnvelopeIcon, CheckCircleIcon, ChatBubbleLeftRightIcon,
  ArrowPathRoundedSquareIcon, ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import { trackContactRequest } from '../tracker';

type Status = 'idle' | 'sending' | 'sent' | 'error';

const Field: React.FC<{
  label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string; type?: string; required?: boolean; optional?: boolean; invalid?: boolean;
}> = ({ label, value, onChange, placeholder, type = 'text', required, optional, invalid }) => (
  <div className="mb-4">
    <label className="block text-xs font-semibold text-gray-600 mb-1.5">
      {label} {required && <span className="text-teal-700">*</span>}
      {optional && <span className="text-gray-400 font-normal uppercase text-[10px] tracking-wide ml-1">optional</span>}
    </label>
    <input
      type={type} value={value} onChange={onChange} placeholder={placeholder}
      className={`w-full rounded-md border px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 ${invalid ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
    />
  </div>
);

const ContactUs: React.FC = () => {
  const [form, setForm] = useState({
    purpose: 'demo', name: '', email: '', company: '', sells: '', phone: '', website: '',
  });
  const [status, setStatus] = useState<Status>('idle');
  const [touched, setTouched] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });
  const missing = !form.name.trim() || !form.email.trim() || !form.company.trim();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.website) return; // honeypot: bots fill it, humans never see it
    setTouched(true);
    if (missing) return;
    setStatus('sending');
    const ok = await trackContactRequest(form);
    setStatus(ok ? 'sent' : 'error');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-grow">
        {/* Hero */}
        <div className="bg-gray-800 py-16 sm:py-20">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h1 className="text-3xl sm:text-4xl font-extrabold text-white">Book a demo, or get access</h1>
            <p className="mt-4 text-lg text-gray-200 max-w-2xl mx-auto">
              You talk directly to the US-based team that builds the platform — no overseas call center.
              Tell us a little about your business and we'll reply within one business day.
            </p>
          </div>
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Risk-reversal band */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
            <div className="flex gap-4 bg-white shadow rounded-lg p-5">
              <ArrowPathRoundedSquareIcon className="h-9 w-9 text-teal-700 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-gray-900">Run it in parallel</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Stand up a full store in 30 minutes and trial it on the side. Your current setup keeps
                  running, untouched — move over only when you're ready.
                </p>
              </div>
            </div>
            <div className="flex gap-4 bg-white shadow rounded-lg p-5">
              <ArrowRightOnRectangleIcon className="h-9 w-9 text-teal-700 flex-shrink-0" />
              <div>
                <h3 className="font-bold text-gray-900">Leave anytime</h3>
                <p className="text-sm text-gray-600 mt-1">
                  No lock-in, no cancellation fees. Export your customers &amp; orders as CSV whenever you
                  want — leaving costs nothing.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
            {/* Form */}
            <div className="lg:col-span-3 bg-white shadow-lg rounded-lg p-6 sm:p-8">
              {status === 'sent' ? (
                <div className="text-center py-10">
                  <div className="mx-auto h-14 w-14 rounded-full bg-teal-50 flex items-center justify-center mb-4">
                    <CheckCircleIcon className="h-8 w-8 text-teal-700" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Got it — check your inbox</h2>
                  <p className="text-gray-600 mt-2 max-w-sm mx-auto">
                    We'll email <b>{form.email}</b> within one business day to set up your walkthrough.
                    Prefer to chat now? Message us on WhatsApp or email help@businesscart.ai.
                  </p>
                </div>
              ) : (
                <form onSubmit={submit} noValidate>
                  <h2 className="text-xl font-bold text-gray-900">Tell us about your business</h2>
                  <p className="text-sm text-gray-500 mt-1 mb-6">
                    Three quick fields. The rest is optional — the more you share, the more tailored your demo.
                  </p>

                  <div className="grid grid-cols-3 gap-2 bg-gray-50 border border-gray-200 rounded-lg p-1 mb-5">
                    {([['demo', 'See a demo'], ['start', 'Get started'], ['ask', 'Just ask']] as const).map(([v, label]) => (
                      <button
                        type="button" key={v} onClick={() => setForm({ ...form, purpose: v })}
                        className={`text-sm font-semibold py-2 rounded-md transition ${form.purpose === v ? 'bg-white text-teal-700 shadow border border-gray-200' : 'text-gray-600 hover:text-gray-900'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <Field label="Full name" required value={form.name} onChange={set('name')} placeholder="Jordan Rivera" invalid={touched && !form.name.trim()} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="Business email" type="email" required value={form.email} onChange={set('email')} placeholder="you@yourcompany.com" invalid={touched && !form.email.trim()} />
                    <Field label="Business name" required value={form.company} onChange={set('company')} placeholder="Rivera Specialty Foods" invalid={touched && !form.company.trim()} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="What do you sell?" optional value={form.sells} onChange={set('sells')} placeholder="Halal grocery, wholesale" />
                    <Field label="Phone" optional type="tel" value={form.phone} onChange={set('phone')} placeholder="(optional)" />
                  </div>

                  {/* honeypot — hidden from humans; bots fill it and the server drops the submission */}
                  <input
                    type="text" tabIndex={-1} autoComplete="off" aria-hidden="true"
                    value={form.website} onChange={set('website')}
                    className="absolute -left-[9999px] w-px h-px overflow-hidden"
                  />

                  {touched && missing && (
                    <p className="text-sm text-red-600 mb-3">Please fill in your name, business email, and business name.</p>
                  )}
                  {status === 'error' && (
                    <p className="text-sm text-red-600 mb-3">
                      Couldn't send just now — email <a className="underline" href="mailto:help@businesscart.ai">help@businesscart.ai</a> or message us on WhatsApp.
                    </p>
                  )}

                  <button
                    type="submit" disabled={status === 'sending'}
                    className="w-full inline-flex justify-center items-center gap-2 px-6 py-3 bg-teal-700 text-white font-medium rounded-md hover:bg-teal-800 disabled:opacity-60 transition"
                  >
                    {status === 'sending' ? 'Sending…' : 'Request access →'}
                  </button>
                  <p className="text-xs text-gray-500 text-center mt-3">
                    No credit card. No commitment. We reply within one business day.
                  </p>
                </form>
              )}
            </div>

            {/* Right column */}
            <div className="lg:col-span-2">
              <div className="bg-white shadow-lg rounded-lg p-6">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-teal-700">What happens next</h3>
                <ol className="mt-4 space-y-4">
                  {([
                    ['You send this', 'We match a specialist to your vertical.'],
                    ['Guided 30-minute setup', 'We tailor a walkthrough and hand you an access code.'],
                    ['Your store goes live', 'Custom domain, sub-second pages, B2B portal included.'],
                  ] as const).map(([t, d], i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex-none h-6 w-6 rounded bg-teal-50 text-teal-700 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      <div>
                        <div className="font-semibold text-gray-900 text-sm">{t}</div>
                        <div className="text-sm text-gray-500">{d}</div>
                      </div>
                    </li>
                  ))}
                </ol>
                <div className="border-t border-gray-100 mt-5 pt-5 space-y-3">
                  <a href="https://wa.me/16575010200" target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 text-gray-700 hover:text-teal-700">
                    <ChatBubbleLeftRightIcon className="h-5 w-5 text-teal-700 flex-shrink-0" />
                    <span className="text-sm font-semibold">Chat with us on WhatsApp</span>
                  </a>
                  <a href="mailto:help@businesscart.ai" className="flex items-center gap-3 text-gray-700 hover:text-teal-700">
                    <EnvelopeIcon className="h-5 w-5 text-teal-700 flex-shrink-0" />
                    <span className="text-sm font-semibold">help@businesscart.ai</span>
                  </a>
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  A real store on the platform:{' '}
                  <a className="text-teal-700 font-semibold hover:underline" href="https://www.usetgo.com" target="_blank" rel="noopener noreferrer">usetgo.com</a>
                  {' '}— under 1s load.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ContactUs;
