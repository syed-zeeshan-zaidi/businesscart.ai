import { useState } from 'react';
import { register } from '../api';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';

const Register = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'company',
    phoneNumber: '',
    code: '',
    customerCodes: '',
  });
  const [errors, setErrors] = useState<string[]>([]);

  const validateForm = () => {
    const errors: string[] = [];
    if (!formData.name) errors.push('Name is required');
    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errors.push('Valid email is required');
    if (!formData.password || formData.password.length < 8) errors.push('Password must be at least 8 characters');
    if (formData.password && !/[A-Z]/.test(formData.password)) errors.push('Password must contain at least one uppercase letter');
    if (formData.password && !/[a-z]/.test(formData.password)) errors.push('Password must contain at least one lowercase letter');
    if (formData.password && !/[0-9]/.test(formData.password)) errors.push('Password must contain at least one digit');
    if (formData.password && !/[^A-Za-z0-9]/.test(formData.password)) errors.push('Password must contain at least one special character');
    if (!formData.role) errors.push('Role is required');
    if (formData.role === 'company' && !formData.code) errors.push('Business code is required');
    if (formData.role === 'customer' && !formData.customerCodes) errors.push('Company access code is required');
    if (!formData.phoneNumber || !/^\d{10}$/.test(formData.phoneNumber)) errors.push('Valid 10-digit phone number is required');
    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors = validateForm();
    setErrors(newErrors);
    if (newErrors.length > 0) return;

    try {
      const { accessToken } = await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        code: formData.code,
        customerCodes: formData.customerCodes.split(',').map(c => c.trim()),
        phoneNumber: formData.phoneNumber,
      });
      localStorage.setItem('accessToken', accessToken);
      setErrors([]);
      navigate('/dashboard');
    } catch (err: any) {
      setErrors([err.response?.data?.message || 'Registration failed']);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <Navbar />
      <div className="flex-grow flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 w-full max-w-md">
          <h2 className="text-2xl font-semibold text-gray-800 mb-2 text-center">Create Your Account</h2>
          <div className="bg-teal-50 border border-teal-200 rounded-md p-3 mb-6 text-center">
            <p className="text-sm text-teal-800">A business code or customer access code is required to register. <a href="/contact-us" className="font-semibold underline">Request a code</a> if you do not have one.</p>
          </div>
          {errors.length > 0 && (
            <div className="bg-red-50 text-red-600 p-3 rounded-md mb-6">
              {errors.map((error, idx) => (
                <p key={idx}>{error}</p>
              ))}
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name <span className="text-red-500">*</span></label>
              <input
                name="name"
                value={formData.name}
                onChange={handleChange}
                placeholder="Company User"
                className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Email <span className="text-red-500">*</span></label>
              <input
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="company@example.com"
                className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Password <span className="text-red-500">*</span></label>
              <input
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="securepassword"
                className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
              />
              <p className="mt-1 text-xs text-gray-500">Min 8 characters with uppercase, lowercase, digit, and special character.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Role <span className="text-red-500">*</span></label>
              <select
                name="role"
                value={formData.role}
                onChange={handleChange}
                className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="company">Company</option>
                <option value="customer">Customer</option>
              </select>
            </div>
            {formData.role === 'company' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Business Code <span className="text-red-500">*</span></label>
                <input
                  name="code"
                  value={formData.code}
                  onChange={handleChange}
                  placeholder="Enter your business code"
                  className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  A business code is provided after we verify your business. Do not have one? <a href="/contact-us" className="text-teal-700 hover:underline">Request a code</a>.
                </p>
              </div>
            )}
            {formData.role === 'customer' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Company Access Code <span className="text-red-500">*</span></label>
                <input
                  name="customerCodes"
                  value={formData.customerCodes}
                  onChange={handleChange}
                  placeholder="Enter company access code(s), comma separated"
                  className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  This code is provided by the company you are purchasing from. Contact your supplier if you do not have one.
                </p>
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700">Phone Number <span className="text-red-500">*</span></label>
              <input
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                placeholder="1234567890"
                className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-teal-700 text-white p-2 rounded-md hover:bg-teal-800 transition-colors"
            >
              Register
            </button>
          </form>
          <p className="mt-4 text-center text-sm text-gray-600">
            Already have an account?{' '}
            <a href="/login" className="text-teal-700 hover:underline">
              Log in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;