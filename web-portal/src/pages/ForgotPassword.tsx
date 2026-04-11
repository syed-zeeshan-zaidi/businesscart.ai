import { useState } from 'react';
import { Link } from 'react-router-dom';
import { forgotPassword } from '../api';
import toast, { Toaster } from 'react-hot-toast';
import Navbar from '../components/Navbar';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }
    setIsLoading(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
    } catch {
      // Always show success to prevent email enumeration
      setSent(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      <Toaster />
      <div className="flex items-center justify-center py-16 px-4">
        <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Reset your password</h2>
          {sent ? (
            <div>
              <p className="text-gray-600 mb-6">
                If an account with <strong>{email}</strong> exists, we've sent a password reset link. Check your email and follow the instructions.
              </p>
              <p className="text-sm text-gray-500 mb-4">The link expires in 1 hour.</p>
              <Link to="/login" className="text-teal-700 hover:underline text-sm font-medium">
                Back to Login
              </Link>
            </div>
          ) : (
            <>
              <p className="text-gray-600 mb-6">Enter your email address and we'll send you a link to reset your password.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-teal-700 text-white p-2 rounded-md hover:bg-teal-800 transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
              <p className="text-center text-gray-600 mt-4 text-sm">
                Remember your password?{' '}
                <Link to="/login" className="text-teal-700 hover:underline">Login</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
