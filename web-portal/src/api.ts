import axios from 'axios';
import { Account, Product, Order, Cart, Quote, CompanyLocation, CustomerAddress, CustomerConfiguration } from './types';

const API_URL = import.meta.env.VITE_API_URL;

const api = axios.create();

api.interceptors.request.use((config) => {
  console.log('Starting Request', {
    url: config.url,
    method: config.method,
    headers: config.headers,
    data: config.data,
  });

  const token = localStorage.getItem('accessToken');
  if (token) {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiry = payload.exp * 1000;
      if (Date.now() >= expiry) {
        console.log('Token expired, removing from storage and redirecting to login.');
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        throw new Error('Token expired');
      }
      config.headers.Authorization = `Bearer ${token}`;
    } catch (e) {
      console.error('Error processing token:', e);
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    console.log('Response:', {
      status: response.status,
      url: response.config.url,
      data: response.data,
    });
    return response;
  },
  (error) => {
    console.error('Response Error:', {
      status: error.response?.status,
      url: error.config?.url,
      data: error.response?.data,
      message: error.message,
    });

    if (error.response?.status === 401) {
      console.log('Unauthorized, removing token and redirecting to login.');
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const register = async (data: {
  name: string;
  email: string;
  password: string;
  role: string;
  code?: string;
  customerCodes?: string[];
}): Promise<{ accessToken: string; account: Account }> => {
  const response = await api.post(`${API_URL}/accounts/register`, data);
  return response.data;
};

export const login = async (data: { email: string; password: string }): Promise<{ accessToken: string; account: Account }> => {
  const response = await api.post(`${API_URL}/accounts/login`, data);
  return response.data;
};

export const logout = async (): Promise<void> => {
  try {
    const token = localStorage.getItem('accessToken');
    if (token) {
      await api.post(`${API_URL}/accounts/logout`, {});
    }
  } catch (_) {
    // Intentionally left empty
  } finally {
    localStorage.removeItem('accessToken');
  }
};

export const getAccounts = async (): Promise<Account[]> => {
  const response = await api.get(`${API_URL}/accounts`);
  return response.data;
};

export const getAccount = async (id: string): Promise<Account> => {
  const response = await api.get(`${API_URL}/accounts/${id}`);
  return response.data;
};

export const updateAccount = async (id: string, data: Partial<Omit<Account, '_id'>>): Promise<Account> => {
  const response = await api.patch(`${API_URL}/accounts/${id}`, data);
  return response.data;
};

export const deleteAccount = async (id: string): Promise<void> => {
  await api.delete(`${API_URL}/accounts/${id}`);
};

export const createCodes = async (data: { companyCode: string; customerCode: string; partnerCode?: string }): Promise<void> => {
  await api.post(`${API_URL}/codes`, data);
};

export const getCode = async (code: string): Promise<any> => {
  const response = await api.get(`${API_URL}/codes/${code}`);
  return response.data;
};

export const getCodes = async (): Promise<any[]> => {
  const response = await api.get(`${API_URL}/codes`);
  return response.data;
};

export const createProduct = async (data: Omit<Product, '_id'>): Promise<Product> => {
  const response = await api.post(`${API_URL}/products`, data);
  return response.data;
};

export const getProducts = async (): Promise<Product[]> => {
  const response = await api.get(`${API_URL}/products`);
  console.log('Products fetched:', response.data);
  return response.data;
};

export const updateProduct = async (id: string, data: Partial<Product>): Promise<Product> => {
  const response = await api.put(`${API_URL}/products/${id}`, data);
  return response.data;
};

export const deleteProduct = async (id: string): Promise<void> => {
  await api.delete(`${API_URL}/products/${id}`);
};

export const deleteOrder = async (id: string): Promise<void> => {
  await api.delete(`${API_URL}/checkout/orders/${id}`);
};

export const createOrder = async (data: { 
  quoteId: string; 
  paymentMethod: string; 
  paymentToken: string;
  deliveryMethod: string;
  pickupLocationId?: string;
  deliveryAddressId?: string;
}): Promise<Order> => {
  const response = await api.post(`${API_URL}/checkout/orders`, data);
  return response.data;
};

export const getOrders = async (sellerId?: string): Promise<Order[]> => {
  const url = sellerId ? `${API_URL}/checkout/orders?sellerId=${sellerId}` : `${API_URL}/checkout/orders`;
  console.log('Fetching orders from:', url);
  const response = await api.get(url);
  return response.data;
};

export const updateOrder = async (id: string, data: { entity: Omit<Order, '_id'> }): Promise<Order> => {
  const response = await api.put(`${API_URL}/checkout/orders/${id}`, data);
  return response.data;
};

export const addItemToCart = async (data: { entity: { productId: string; quantity: number; sellerId: string; name: string; price: number, discountedPrice?: number, image?: string, dealPrice?: number } }): Promise<Cart> => {
  const response = await api.post(`${API_URL}/checkout/cart`, data);
  return response.data;
};

export const getCart = async (sellerId: string): Promise<Cart> => {
  const response = await api.get(`${API_URL}/checkout/cart?sellerId=${sellerId}`);
  return response.data;
};

export const updateCartItem = async (itemId: string, data: { entity: { quantity: number } }, sellerId: string): Promise<Cart> => {
  const response = await api.put(`${API_URL}/checkout/cart/${itemId}?sellerId=${sellerId}`, data);
  return response.data;
};

export const removeItemFromCart = async (itemId: string, sellerId: string): Promise<Cart> => {
  const response = await api.delete(`${API_URL}/checkout/cart/${itemId}?sellerId=${sellerId}`);
  return response.data;
};

export const clearCart = async (sellerId: string): Promise<Cart> => {
  const response = await api.delete(`${API_URL}/checkout/cart?sellerId=${sellerId}`);
  return response.data;
};

export const getAssociatedCompanyIds = async (): Promise<string[]> => {
  const jwt = localStorage.getItem('accessToken');
  if (!jwt) {
    throw new Error('No JWT found');
  }
  const payload = JSON.parse(atob(jwt.split('.')[1]));
  // This needs to be updated based on how customer/company association is stored in the JWT
  // For now, returning an empty array.
  return payload.user?.associate_company_ids || [];
};

export const createQuote = async (data: {
  sellerId: string;
  paymentMethods: string[];
  deliveryMethods: string[];
  shippingOutOptions: string[];
  companyLocations: CompanyLocation[];
  customerAddresses: CustomerAddress[];
  configurations?: CustomerConfiguration[];
  quoteType?: 'standard' | 'negotiable';
}): Promise<Quote> => {
  const response = await api.post(`${API_URL}/checkout/quotes`, data);
  return response.data;
};

export const getUserClaims = async (): Promise<any> => {
  const jwt = localStorage.getItem('accessToken');
  if (!jwt) {
    throw new Error('No JWT found');
  }
  return JSON.parse(atob(jwt.split('.')[1]));
};

export const getCustomerConfigurations = async (): Promise<CustomerConfiguration[]> => {
  const claims = await getUserClaims();
  return claims.user?.customerConfig || [];
};

export const getQuote = async (quoteId: string): Promise<Quote> => {
  const response = await api.get(`${API_URL}/checkout/quotes/${quoteId}`);
  return response.data;
};

export const getMyQuotes = async (sellerId?: string): Promise<Quote[]> => {
  const url = sellerId ? `${API_URL}/checkout/quotes?sellerId=${sellerId}` : `${API_URL}/checkout/quotes`;
  const response = await api.get(url);
  return response.data;
};
export const proposeQuoteChanges = async (quoteId: string, changes: { itemId: string; proposedPrice: number }[]): Promise<Quote> => {
  const response = await api.put(`${API_URL}/checkout/quotes/${quoteId}/propose`, changes);
  return response.data;
};

export const updateQuoteStatus = async (quoteId: string, status: string): Promise<Quote> => {
  const response = await api.put(`${API_URL}/checkout/quotes/${quoteId}/status`, { status });
  return response.data;
};

export const getCompanyLocations = async (companyId: string): Promise<CompanyLocation[]> => {
  const response = await api.get(`${API_URL}/accounts/locations/${companyId}`);
  return response.data;
};

export const upsertCompanyLocation = async (companyId: string, location: Partial<CompanyLocation>): Promise<CompanyLocation> => {
  const response = await api.post(`${API_URL}/accounts/locations/${companyId}`, location);
  return response.data;
};

export const deleteCompanyLocation = async (companyId: string, locationId: string): Promise<void> => {
  await api.delete(`${API_URL}/accounts/locations/${companyId}/${locationId}`);
};

// Customer Address specific functions
export const getCustomerAddresses = async (customerId: string): Promise<CustomerAddress[]> => {
  const response = await api.get(`${API_URL}/accounts/locations/${customerId}`);
  return response.data;
};

export const upsertCustomerAddress = async (customerId: string, address: Partial<CustomerAddress>): Promise<CustomerAddress> => {
  const response = await api.post(`${API_URL}/accounts/locations/${customerId}`, address);
  return response.data;
};

export const deleteCustomerAddress = async (customerId: string, addressId: string): Promise<void> => {
  await api.delete(`${API_URL}/accounts/locations/${customerId}/${addressId}`);
};

export const updateCustomerConfiguration = async (customerId: string, config: Partial<CustomerConfiguration>): Promise<void> => {
  await api.patch(`${API_URL}/customers/${customerId}/configuration`, config);
};

export const associateCompany = async (customerCode: string): Promise<void> => {
  const claims = await getUserClaims();
  const customerId = claims.user.id;
  await api.patch(`${API_URL}/customers/${customerId}/associate`, { customerCode });
};