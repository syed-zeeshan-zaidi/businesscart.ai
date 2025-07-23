export interface User {
  _id: string;
  name: string;
  email: string;
  password?: string;
  role: 'admin' | 'company' | 'customer';
  company_id?: string;
  associate_company_ids?: string[];
  phoneNumber: string;
}

export interface Company {
  _id: string;
  name: string;
  companyCode: string;
  paymentMethods: string[];
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
    coordinates: { lat: number; lng: number };
  };
  sellingArea: {
    radius: number;
    center: { lat: number; lng: number };
  };
}

export interface Product {
  _id: string;
  name: string;
  price: number;
  companyId: string;
  userId: string;
  description: string;
  image?: string;
}

export interface Order {
  id: string;
  quoteId: string;
  userId: string;
  companyId: string;
  items: CartItem[];
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  grandTotal: number;
  payment: {
    transactionId: string;
  };
  createdAt: string;
}

export interface CartItem {
  id: string;
  productId: string;
  quantity: number;
  companyId: string;
  name: string;
  price: number;
}

export interface Cart {
  id: string;
  userId: string;
  companyId: string;
  items: CartItem[];
  totalPrice: number;
}

export interface Quote {
  id: string;
  cartId: string;
  userId: string;
  companyId: string;
  items: CartItem[];
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  grandTotal: number;
  createdAt: string;
  expiresAt: string;
}