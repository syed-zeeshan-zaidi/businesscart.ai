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
  name: string;
  email: string;
  role: 'admin' | 'company' | 'customer' | 'partner';
  accountStatus: 'active' | 'pending' | 'suspended' | 'inactive';
  company?: CompanyData;
  customer?: CustomerData;
  partner?: PartnerData;
  address?: Address;
  password?: string;
}

export interface Attribute {
  key: string;
  value: string;
  type?: 'filterable' | 'system';
}

export interface PriceTier {
  minQty: number;
  price: number;
}

export interface CustomerGroup {
  id: string;
  name: string;
  groupPriceDiscount?: number;
}

export const MAX_CUSTOMER_GROUPS = 5;

export interface Product {
  _id: string;
  name: string;
  description?: string;
  price: number;
  dealPrice?: number;
  dealStartDate?: string;
  dealEndDate?: string;
  discountedPrice?: number;
  sellerID: string;
  images?: string[];
  category?: string;
  slug?: string;
  sku?: string;
  barcode?: string;
  stock?: number;
  active?: boolean;
  featured?: boolean;
  priceTiers?: PriceTier[];
  groupIDs?: string[];
  attributes?: Attribute[];
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
  transactionId?: string;
  createdAt: string;
  status: string;
  paymentMethod?: string;
  deliveryMethod?: string;
  pickupLocationId?: string;
  deliveryAddressId?: string;
  customerEmail?: string;
  trackingNumber?: string;
  trackingCarrier?: string;
  trackingUrl?: string;
  shippedAt?: string;
  deliveredAt?: string;
  updatedAt?: string;
}

export interface NewCartItem {
  productId: string;
  quantity: number;
  sellerId: string;
  name: string;
  price: number;
  discountedPrice?: number;
  image?: string;
  dealPrice?: number;
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
  image?: string;
  proposedPrice?: number;
}

export interface Cart {
  id: string;
  accountId: string;
  sellerId: string;
  items: CartItem[];
  totalPrice: number;
}

export interface QuoteHistory {
  status: string;
  changedAt: string;
}

export interface Comment {
  id: string;
  accountId: string;
  text: string;
  createdAt: string;
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
  quoteType: 'standard' | 'negotiable';
  status: 'draft' | 'open' | 'proposed' | 'approved' | 'rejected' | 'ordered';
  history: QuoteHistory[];
  comments: Comment[];
  discountPercentage?: number;
  discountAmount?: number;
  notes?: string;
  leadTime?: number;
}

export type DeliveryMethod = 'pickup' | 'dropoff' | 'shipping_out';
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
  taxRate?: number;
  shippingRate?: number;
  quotesAllowed?: boolean;
  companyCodeId?: string;
  companyCode: string;
  sellingArea: {
    radius: number;
    center: { lat: number; lng: number };
  };
  address: Address;
  d2c?: D2CConfig;
  customerGroups?: CustomerGroup[];
  feeds?: string[];
}

export interface D2CConfig {
  enabled: boolean;
  primaryColor: string;
  secondaryColor: string;
  contactEmail: string;
  contactPhone?: string;
  previewDomain?: string;
  customDomain?: string;
  heroTitle?: string;
  heroSlogan?: string;
  heroTextColor?: string;
  heroBgColor?: string;
  aboutText?: string;
  privacyText?: string;
  termsText?: string;
  shippingText?: string;
  shippingBadge?: string;
  returnsBadge?: string;
  feedGender?: string;
  feedAgeGroup?: string;
  whatsappNumber?: string;
  facebookUrl?: string;
  instagramUrl?: string;
  twitterUrl?: string;
  linkedinUrl?: string;
  tiktokUrl?: string;
}

export interface CustomerCodeEntry {
  codeId: string;
  customerCode: string;
  groupID?: string;
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
  quotesAllowed?: boolean;
  creditLimit?: number;
  minOrderAmountLimit?: number;
  maxOrderAmountLimit?: number;
  minOrderQuantityLimit?: number;
  maxOrderQuantityLimit?: number;
  monthlyOrderLimit?: number;
  yearlyOrderLimit?: number;
  taxableGoods?: boolean;
  taxRate?: number;
  shippingRate?: number;
  leadTime?: number;
  groupID?: string;
  groupPriceDiscount?: number;
}



export interface DecodedUser {

  id: string;

  email: string;

  role: 'admin' | 'company' | 'customer' | 'partner';

  associate_company_ids: string[];

  configurations?: CustomerConfiguration[];

}



export interface CreateQuoteRequest {
  sellerId: string;
  accountId?: string;
  quotesAllowed: boolean;
  paymentMethods: string[];
  deliveryMethods: string[];
  shippingOutOptions: string[];
  companyLocations: CompanyLocation[];
  customerAddresses: CustomerAddress[];
  configurations?: CustomerConfiguration[];
  quoteType?: 'standard' | 'negotiable';
  status?: 'draft' | 'open' | 'proposed' | 'approved' | 'rejected' | 'ordered';
  creditLimit?: number;
  minOrderAmountLimit?: number;
  maxOrderAmountLimit?: number;
  minOrderQuantityLimit?: number;
  maxOrderQuantityLimit?: number;
  monthlyOrderLimit?: number;
  yearlyOrderLimit?: number;
  taxableGoods?: boolean;
  taxRate?: number;
  shippingRate?: number;
  leadTime?: number;
}