export type Product = {
  id: string;
  name: string;
  category: string;
  price: number; // Always in base currency (e.g., USD)
  stockQuantity: number;
  imageUrl: string;
  imageHint?: string;
  reorderThreshold: number;
  description?: string;
};

export type Order = {
  id: string;
  customerName: string;
  date: string;
  total: number;
  status: 'Paid' | 'Pending' | 'Failed';
  items: { productId: string; quantity: number }[];
};

export type SaleItem = {
  productId: string;
  quantity: number;
  priceAtTime: number; // Price in base currency at the time of sale
};

export type Sale = {
  id: string;
  saleDate: string;
  totalAmount: number; // Total in base currency
  paymentMethod: string;
  items: SaleItem[];
  appliedCoupon?: string;
  cashierId: string;
  cashierName: string;
  baseCurrency: string;
  displayCurrency: string;
  conversionRate: number;
};

export type Category = {
  id: string;
  name: string;
  description?: string;
};

export type Coupon = {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  expirationDate: string;
  usageLimit: number;
  usageCount: number;
  isActive: boolean;
};

export type AccessKey = {
  id: string;
  key: string;
  tagName: string;
  createdAt: string;
  isMasterKey: boolean;
  permissions: PagePermission[];
}

export type PagePermission = 'pos' | 'dashboard' | 'sales' | 'inventory' | 'coupons' | 'settings';


export type Settings = {
  storeName: string;
  storeAddress: string;
  storeEmail: string;
  defaultTaxRate: number;
  receiptFooterMessage: string;
  baseCurrency: string;
  lastCurrencySync?: string;
};

export type ExchangeRate = {
    id: string; // The currency code, e.g., "EUR"
    code: string;
    rate: number;
    lastUpdated: string;
}
