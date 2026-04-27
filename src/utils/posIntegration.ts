
export interface POSTransaction {
  id: string;
  items: Array<{
    barcode: string;
    name: string;
    price: number;
    quantity: number;
    category?: string;
  }>;
  subtotal: number;
  tax: number;
  taxRate: number;
  timestamp: string;
  storeId?: string;
  cashierInfo?: string;
}

export interface BarterPaymentCalculation {
  originalSubtotal: number;
  barterAmount: number;
  barterPercentage: number;
  cashAmount: number;
  taxOnCashAmount: number;
  gratuity: number;
  finalTotal: number;
  barterCreditsRemaining: number;
}

export interface POSSystemConfig {
  system: 'square' | 'shopify' | 'toast' | 'clover' | 'generic';
  apiKey?: string;
  webhookUrl?: string;
  storeId?: string;
  defaultBarterPercentage: number;
  categoryBarterRules?: Record<string, number>;
}

export interface UPCProductData {
  barcode: string;
  name: string;
  brand?: string;
  category?: string;
  price?: number;
  description?: string;
}

// UPC Database lookup service
export const lookupProductByUPC = async (barcode: string): Promise<UPCProductData | null> => {
  try {
    // Using OpenFoodFacts API for product lookup (free service)
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
    const data = await response.json();
    
    if (data.status === 1 && data.product) {
      return {
        barcode,
        name: data.product.product_name || 'Unknown Product',
        brand: data.product.brands,
        category: data.product.categories,
        description: data.product.generic_name
      };
    }
    
    // Fallback to UPC Item DB (requires API key in production)
    const fallbackResponse = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcode}`);
    const fallbackData = await fallbackResponse.json();
    
    if (fallbackData.items && fallbackData.items.length > 0) {
      const item = fallbackData.items[0];
      return {
        barcode,
        name: item.title,
        brand: item.brand,
        category: item.category,
        description: item.description
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error looking up product:', error);
    return null;
  }
};

export const calculateBarterPayment = (
  transaction: POSTransaction,
  barterPercentage: number,
  availableBarterCredits: number,
  gratuity: number = 0
): BarterPaymentCalculation => {
  const maxBarterAmount = Math.min(availableBarterCredits, transaction.subtotal);
  const barterAmount = Math.min(maxBarterAmount, (transaction.subtotal * barterPercentage) / 100);
  const cashAmount = Math.max(0, transaction.subtotal - barterAmount);
  
  // Tax is only applied to the cash portion
  const taxOnCashAmount = cashAmount * (transaction.taxRate / 100);
  const finalTotal = cashAmount + taxOnCashAmount + gratuity;
  const barterCreditsRemaining = availableBarterCredits - barterAmount;

  return {
    originalSubtotal: transaction.subtotal,
    barterAmount,
    barterPercentage,
    cashAmount,
    taxOnCashAmount,
    gratuity,
    finalTotal,
    barterCreditsRemaining
  };
};

export const formatReceiptData = (
  transaction: POSTransaction,
  payment: BarterPaymentCalculation
) => {
  return {
    transactionId: transaction.id,
    timestamp: transaction.timestamp,
    storeInfo: transaction.storeId,
    cashierInfo: transaction.cashierInfo,
    items: transaction.items.map(item => ({
      name: item.name,
      barcode: item.barcode,
      quantity: item.quantity,
      unitPrice: item.price,
      total: item.price * item.quantity,
      category: item.category || 'General'
    })),
    payment: {
      subtotal: payment.originalSubtotal,
      barterCredits: payment.barterAmount,
      cashSubtotal: payment.cashAmount,
      tax: payment.taxOnCashAmount,
      gratuity: payment.gratuity,
      total: payment.finalTotal
    },
    barterInfo: {
      percentageUsed: payment.barterPercentage,
      creditsUsed: payment.barterAmount,
      remainingBalance: payment.barterCreditsRemaining
    }
  };
};

// Enhanced webhook handler with real POS system support
export const handlePOSWebhook = async (webhookData: any): Promise<POSTransaction | null> => {
  try {
    // Determine POS system based on webhook structure
    if (webhookData.type === 'payment.updated' && webhookData.data?.object?.source_type === 'CARD') {
      return parseSquareTransaction(webhookData);
    } else if (webhookData.topic && webhookData.topic.startsWith('orders/')) {
      return parseShopifyTransaction(webhookData);
    } else if (webhookData.eventType === 'ORDER_UPDATED') {
      return parseToastTransaction(webhookData);
    } else if (webhookData.type === 'order_created') {
      return parseCloverTransaction(webhookData);
    }
    
    return parseGenericTransaction(webhookData);
  } catch (error) {
    console.error('Error parsing POS webhook:', error);
    return null;
  }
};

// Enhanced Square transaction parser
const parseSquareTransaction = (data: any): POSTransaction => {
  const payment = data.data.object;
  const order = payment.order_id ? data.order : null;
  
  return {
    id: payment.id,
    items: order?.line_items?.map((item: any) => ({
      barcode: item.catalog_object_id || '',
      name: item.name,
      price: item.price_money.amount / 100,
      quantity: parseInt(item.quantity),
      category: item.variation_name
    })) || [],
    subtotal: payment.amount_money.amount / 100,
    tax: payment.total_tax_money?.amount / 100 || 0,
    taxRate: 8.25, // Would be calculated from actual tax data
    timestamp: payment.created_at,
    storeId: payment.location_id
  };
};

// Enhanced Shopify transaction parser
const parseShopifyTransaction = (data: any): POSTransaction => {
  const order = data.order || data;
  
  return {
    id: order.id.toString(),
    items: order.line_items.map((item: any) => ({
      barcode: item.sku || item.product_id?.toString() || '',
      name: item.title,
      price: parseFloat(item.price),
      quantity: item.quantity,
      category: item.product_type
    })),
    subtotal: parseFloat(order.subtotal_price),
    tax: parseFloat(order.total_tax),
    taxRate: parseFloat(order.tax_rate || '8.25'),
    timestamp: order.created_at,
    storeId: order.location_id?.toString()
  };
};

// Enhanced Toast transaction parser
const parseToastTransaction = (data: any): POSTransaction => {
  const order = data.order || data;
  
  return {
    id: order.guid,
    items: order.selections?.map((item: any) => ({
      barcode: item.item?.sku || item.item?.guid || '',
      name: item.item?.name || 'Unknown Item',
      price: item.price || 0,
      quantity: item.quantity || 1,
      category: item.item?.menuGroup?.name
    })) || [],
    subtotal: order.amount || 0,
    tax: order.tax || 0,
    taxRate: 8.25,
    timestamp: order.date || new Date().toISOString(),
    storeId: order.restaurant?.guid
  };
};

// New Clover transaction parser
const parseCloverTransaction = (data: any): POSTransaction => {
  const order = data.order || data;
  
  return {
    id: order.id,
    items: order.lineItems?.map((item: any) => ({
      barcode: item.item?.code || item.item?.id || '',
      name: item.name,
      price: item.price / 100, // Clover uses cents
      quantity: item.quantity || 1,
      category: item.item?.category?.name
    })) || [],
    subtotal: order.total / 100,
    tax: order.tax / 100,
    taxRate: 8.25,
    timestamp: new Date(order.createdTime).toISOString(),
    storeId: order.merchant?.id
  };
};

const parseGenericTransaction = (data: any): POSTransaction => {
  return {
    id: data.id || Date.now().toString(),
    items: data.items || [],
    subtotal: data.subtotal || 0,
    tax: data.tax || 0,
    taxRate: data.taxRate || 8.25,
    timestamp: data.timestamp || new Date().toISOString(),
    storeId: data.storeId,
    cashierInfo: data.cashierInfo
  };
};

// Function to shift entire POS transaction to barter system
export const shiftPOSTransaction = async (
  posTransactionId: string,
  customerId: string,
  barterPercentage: number
): Promise<{ success: boolean; barterTransaction?: any; error?: string }> => {
  try {
    // This would integrate with your backend to:
    // 1. Fetch the POS transaction details
    // 2. Calculate barter vs cash amounts
    // 3. Verify customer has sufficient credits
    // 4. Create the barter transaction record
    // 5. Update customer credit balance
    
    return {
      success: true,
      barterTransaction: {
        id: `barter_${Date.now()}`,
        posTransactionId,
        customerId,
        barterPercentage,
        status: 'completed'
      }
    };
  } catch (error) {
    console.error('Error shifting POS transaction:', error);
    return {
      success: false,
      error: 'Failed to process barter transaction'
    };
  }
};

// Real-time POS connection manager
export class POSConnectionManager {
  private config: POSSystemConfig;
  private isConnected: boolean = false;
  
  constructor(config: POSSystemConfig) {
    this.config = config;
  }
  
  async connect(): Promise<boolean> {
    try {
      // Implement actual API connections based on POS system
      switch (this.config.system) {
        case 'square':
          return await this.connectSquare();
        case 'shopify':
          return await this.connectShopify();
        case 'toast':
          return await this.connectToast();
        case 'clover':
          return await this.connectClover();
        default:
          return await this.connectGeneric();
      }
    } catch (error) {
      console.error('POS connection failed:', error);
      return false;
    }
  }
  
  private async connectSquare(): Promise<boolean> {
    // Implement Square API connection
    this.isConnected = true;
    return true;
  }
  
  private async connectShopify(): Promise<boolean> {
    // Implement Shopify POS API connection
    this.isConnected = true;
    return true;
  }
  
  private async connectToast(): Promise<boolean> {
    // Implement Toast API connection
    this.isConnected = true;
    return true;
  }
  
  private async connectClover(): Promise<boolean> {
    // Implement Clover API connection
    this.isConnected = true;
    return true;
  }
  
  private async connectGeneric(): Promise<boolean> {
    // Generic webhook-based connection
    this.isConnected = true;
    return true;
  }
  
  isSystemConnected(): boolean {
    return this.isConnected;
  }
  
  async fetchTransaction(transactionId: string): Promise<POSTransaction | null> {
    if (!this.isConnected) {
      throw new Error('POS system not connected');
    }
    
    // Implement transaction fetching based on POS system
    return null; // Placeholder
  }
}
