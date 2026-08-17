import { useState } from 'react';
import { register, login, SIGNUP_NOTICE_KEY } from '../api';
import { trackRegister } from '../tracker';
import { useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';

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
  const [showPassword, setShowPassword] = useState(false);

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

    // Split into two phases on purpose. Once register returns, the account EXISTS,
    // so a later failure must never be reported as "Registration failed": the user
    // would retry the form and hit a duplicate-email 409 on an account that is
    // already theirs. Phase 2 failing is only a missing session, which logging in
    // fixes, so it says so and sends them to the login screen.
    let res: { _id?: string; accessToken?: string };
    try {
      // The non-guest /accounts/register response IS the account object; it carries
      // no accessToken, because the handler only mints one for the guest-b2c path.
      // api.ts declares otherwise, which is a separate defect recorded as #43-J in
      // APPLICATION.md. This local cast reads the id that IS present.
      res = await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
        code: formData.code,
        customerCodes: formData.customerCodes.split(',').map(c => c.trim()).filter(Boolean),
        phoneNumber: formData.phoneNumber,
      }) as unknown as { _id?: string; accessToken?: string };
    } catch (err: any) {
      setErrors([err.response?.data?.message || 'Registration failed']);
      return;
    }

    // Fire-and-forget: the portal's only signup conversion signal. It can never
    // throw, block, or fail the registration.
    trackRegister(res?._id || '', formData.role);

    try {
      // The account exists now but we hold no token, so trade the credentials we
      // already have for one. Without this, storing the response's absent token put
      // the string "undefined" in localStorage, the api interceptor threw on
      // atob("undefined"), wiped it and redirected to /login: a new merchant
      // finished signup and landed on the login screen with no explanation.
      const { accessToken } = await login({ email: formData.email, password: formData.password });
      localStorage.setItem('accessToken', accessToken);
      setErrors([]);
      navigate('/dashboard');
    } catch {
      // Account created, session not. Never surface a registration error here.
      //
      // The notice goes through sessionStorage rather than router state because a 401
      // is the likeliest way this login fails, and the api response interceptor answers
      // 401 with window.location.href = '/login'. That is a full page load: it fires
      // before this catch and would discard router state, dropping the user on a bare
      // login screen. sessionStorage survives it either way.
      try { sessionStorage.setItem(SIGNUP_NOTICE_KEY, 'Your account was created. Please log in.'); } catch { /* private mode */ }
      navigate('/login');
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
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="securepassword"
                  className="mt-1 w-full p-2 pr-10 border border-gray-300 rounded-md focus:ring-teal-500 focus:border-teal-500"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeSlashIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                </button>
              </div>
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