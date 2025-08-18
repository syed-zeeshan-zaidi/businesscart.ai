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
  sellerID: string;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: string;
  quoteId: string;
  accountId: string;
  sellerId: string;
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
  sellerId: string;
  name: string;
  price: number;
}

export interface Cart {
  id: string;
  accountId: string;
  sellerId: string;
  items: CartItem[];
  totalPrice: number;
}

export interface Quote {
  id: string;
  cartId: string;
  accountId: string;
  sellerId: string;
  items: CartItem[];
  subtotal: number;
  shippingCost: number;
  taxAmount: number;
  grandTotal: number;
  createdAt: string;
  expiresAt: string;
}
export interface CompanyData {
  _id?: string;
  name: string;
  status: string;
  uniqueIdentifier?: string;
  saleRepresentative?: string;
  creditLimit?: number;
  shippingMethods?: string[] | null;
  paymentMethods?: string[];
  deliveryMethods?: string[] | null;
  leadTime?: number;
  maxOrderAmountLimit?: number;
  maxOrderQuantityLimit?: number;
  minOrderAmountLimit?: number;
  minOrderQuantityLimit?: number;
  monthlyOrderLimit?: number;
  yearlyOrderLimit?: number;
  taxableGoods?: boolean;
  quotesAllowed?: boolean;
  companyCodeId?: string;
  companyCode: string;
  sellingArea: {
    radius: number;
    center: {
      lat: number;
      lng: number;
    };
  };
  address: Address;
}

export interface CustomerCodeEntry {
  codeId: string;
  customerCode: string;
}
