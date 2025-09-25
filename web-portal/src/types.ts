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
  customerConfigs: CustomerCodeEntry[];
  attachedCompanies?: CompanyData[];
  customerAddresses?: CustomerAddress[];
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
  discountedPrice?: number;
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
  discountedPrice?: number;
  lineItemTotal: number;
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
  availablePaymentMethods: string[];
  availableDeliveryMethods: string[];
  availableShippingOutOptions: string[];
  companyLocations?: CompanyLocation[];
  customerAddresses?: CustomerAddress[];
  createdAt: string;
  expiresAt: string;
}

export type DeliveryMethod   = 'pickup' | 'dropoff' | 'shipping_out';
export type ShippingOutOption = 'standard' | 'express';

export interface CompanyData {
  _id?: string;
  name: string;
  logoUrl?: string;
  status: string;
  uniqueIdentifier?: string;
  saleRepresentative?: string;
  creditLimit?: number;
  shippingMethods?: string[] | null;
  paymentMethods?: string[];
  deliveryMethods?: DeliveryMethod[];
  shippingOutOptions?: ShippingOutOption[];
  companyLocations?: CompanyLocation[];
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
    center: { lat: number; lng: number };
  };
  address: Address;
}

export interface CustomerCodeEntry {
  codeId: string;
  customerCode: string;
  configuration?: CustomerConfiguration;
}

export interface CompanyLocation {
  id: string;
  companyId: string;
  locationName: string;
  address: Address;
  contactPerson?: string;
  phoneNumber?: string;
  operatingHours?: string;
  capacity?: string;
  locationType: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerAddress {
  id: string;
  customerId: string;
  recipientName: string;
  address: Address;
  phoneNumber?: string;
  addressLabel?: string;
  isDefaultShipping: boolean;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod = 'credit_card' | 'purchase_order' | 'on_account' | 'stripe_pay';

export interface CustomerConfiguration {
  company_id: string;
  discountPercentage?: number;
  paymentMethods?: PaymentMethod[];
  deliveryMethods?: DeliveryMethod[];
  shippingOutOptions?: ShippingOutOption[];
}

export interface DecodedUser {
  id: string;
  email: string;
  role: 'admin' | 'company' | 'customer' | 'partner';
  associate_company_ids: string[];
  configurations?: CustomerConfiguration[];
}
