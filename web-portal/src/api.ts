import axios from 'axios';
import { Account, Product, Order, Cart, Quote } from './types';

const ACCOUNT_API_URL = import.meta.env.VITE_ACCOUNT_API_URL || 'http://127.0.0.1:3000';
const CATALOG_API_URL = import.meta.env.VITE_CATALOG_API_URL || 'http://127.0.0.1:3001';
const CHECKOUT_API_URL = import.meta.env.VITE_CHECKOUT_API_URL || 'http://127.0.0.1:3002';

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
      url: error.config.url,
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
  const response = await api.post(`${ACCOUNT_API_URL}/accounts/register`, data);
  return response.data;
};

export const login = async (data: { email: string; password: string }): Promise<{ accessToken: string; account: Account }> => {
  const response = await api.post(`${ACCOUNT_API_URL}/accounts/login`, data);
  return response.data;
};

export const logout = async (): Promise<void> => {
  try {
    const token = localStorage.getItem('accessToken');
    if (token) {
      await api.post(`${ACCOUNT_API_URL}/accounts/logout`, {});
    }
  } catch (_) {
    // Intentionally left empty
  } finally {
    localStorage.removeItem('accessToken');
  }
};

export const getAccounts = async (): Promise<Account[]> => {
  const response = await api.get(`${ACCOUNT_API_URL}/accounts`);
  return response.data;
};

export const getAccount = async (id: string): Promise<Account> => {
  const response = await api.get(`${ACCOUNT_API_URL}/accounts/${id}`);
  return response.data;
};

export const updateAccount = async (id: string, data: Partial<Omit<Account, '_id'>>): Promise<Account> => {
  const response = await api.patch(`${ACCOUNT_API_URL}/accounts/${id}`, data);
  return response.data;
};

export const deleteAccount = async (id: string): Promise<void> => {
  await api.delete(`${ACCOUNT_API_URL}/accounts/${id}`);
};

export const createProduct = async (data: Omit<Product, '_id'>): Promise<Product> => {
  const response = await api.post(`${CATALOG_API_URL}/products`, data);
  return response.data;
};

export const getProducts = async (): Promise<Product[]> => {
  const response = await api.get(`${CATALOG_API_URL}/products`);
  console.log('Products fetched:', response.data);
  return response.data;
};

export const updateProduct = async (id: string, data: Partial<Product>): Promise<Product> => {
  const response = await api.put(`${CATALOG_API_URL}/products/${id}`, data);
  return response.data;
};

export const deleteProduct = async (id: string): Promise<void> => {
  await api.delete(`${CATALOG_API_URL}/products/${id}`);
};

export const deleteOrder = async (id: string): Promise<void> => {
  await api.delete(`${CHECKOUT_API_URL}/orders/${id}`);
};

export const createOrder = async (data: { quoteId: string; paymentMethod: string; paymentToken: string }): Promise<Order> => {
  const response = await api.post(`${CHECKOUT_API_URL}/orders`, data);
  return response.data;
};

export const getOrders = async (sellerId?: string): Promise<Order[]> => {
  const url = sellerId ? `${CHECKOUT_API_URL}/orders?sellerId=${sellerId}` : `${CHECKOUT_API_URL}/orders`;
  console.log('Fetching orders from:', url);
  const response = await api.get(url);
  return response.data;
};

export const updateOrder = async (id: string, data: { entity: Omit<Order, '_id'> }): Promise<Order> => {
  const response = await api.put(`${CHECKOUT_API_URL}/orders/${id}`, data);
  return response.data;
};

export const addItemToCart = async (data: { entity: { productId: string; quantity: number; sellerId: string; name: string; price: number } }): Promise<Cart> => {
  const response = await api.post(`${CHECKOUT_API_URL}/cart`, data);
  return response.data;
};

export const getCart = async (sellerId: string): Promise<Cart> => {
  const response = await api.get(`${CHECKOUT_API_URL}/cart?sellerId=${sellerId}`);
  return response.data;
};

export const updateCartItem = async (itemId: string, data: { entity: { quantity: number } }, sellerId: string): Promise<Cart> => {
  const response = await api.put(`${CHECKOUT_API_URL}/cart/${itemId}?sellerId=${sellerId}`, data);
  return response.data;
};

export const removeItemFromCart = async (itemId: string, sellerId: string): Promise<Cart> => {
  const response = await api.delete(`${CHECKOUT_API_URL}/cart/${itemId}?sellerId=${sellerId}`);
  return response.data;
};

export const clearCart = async (sellerId: string): Promise<Cart> => {
  const response = await api.delete(`${CHECKOUT_API_URL}/cart?sellerId=${sellerId}`);
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

export const createQuote = async (sellerId: string): Promise<Quote> => {
  const response = await api.post(`${CHECKOUT_API_URL}/quotes`, { sellerId });
  return response.data;
};

export const getQuote = async (quoteId: string): Promise<Quote> => {
  const response = await api.get(`${CHECKOUT_API_URL}/quotes/${quoteId}`);
  return response.data;
};
