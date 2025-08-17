export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
}

export interface CompanyData {
  _id?: string;
  name: string;
  companyCode: string;
  paymentMethods: string[];
  address: Address;
  sellingArea: {
    radius: number;
    center: {
      lat: number;
      lng: number;
    };
  };
  status: string;
}

export interface CustomerCodeEntry {
  codeId: string;
  customerCode: string;
}

export interface CustomerData {
  customerCodes: CustomerCodeEntry[];
  attachedCompanies?: CompanyData[];
}

export interface PartnerData {
  partnerCodeId?: string;
  partnerCode?: string;
  status: string;
}

export interface Account {
  _id: string;
  name:string;
  email: string;
  role: 'admin' | 'company' | 'customer' | 'partner';
  accountStatus: 'active' | 'pending' | 'suspended' | 'inactive';
  company?: CompanyData;
  customer?: CustomerData;
  partner?: PartnerData;
  address?: Address;
  password?: string;
}

export interface Product {
  _id: string;
  name: string;
  description?: string;
  price: number;
  accountID: string;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  quoteId: string;
  accountId: string;
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
  accountId: string;
  companyId: string;
  items: CartItem[];
  totalPrice: number;
}

export interface Quote {
  id: string;
  cartId: string;
  accountId: string;
  companyId: string;
  items: CartItem[];
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  grandTotal: number;
  createdAt: string;
  expiresAt: string;
}