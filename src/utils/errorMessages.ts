/**
 * Error Message Utility
 * Converts technical errors into user-friendly, actionable messages
 */

export interface ErrorContext {
  error: string | Error;
  context?: 'sync' | 'checkout' | 'auth' | 'webhook' | 'general';
  provider?: string;
}

export interface UserFriendlyError {
  title: string;
  description: string;
  action?: {
    label: string;
    type: 'reconnect' | 'retry' | 'contact_support' | 'refresh';
  };
  variant: 'destructive' | 'default';
}

/**
 * Convert technical error to user-friendly message
 */
export function getUserFriendlyError(errorContext: ErrorContext): UserFriendlyError {
  const errorMessage = typeof errorContext.error === 'string'
    ? errorContext.error
    : errorContext.error.message || 'Unknown error';

  const lowerError = errorMessage.toLowerCase();
  const { context = 'general', provider } = errorContext;

  // Token Expiration Errors
  if (
    lowerError.includes('token expired') ||
    lowerError.includes('token invalid') ||
    lowerError.includes('unauthorized') ||
    lowerError.includes('401')
  ) {
    return {
      title: 'Connection Expired',
      description: `Your ${provider || 'POS'} connection has expired. Please reconnect to continue syncing products.`,
      action: {
        label: 'Reconnect Now',
        type: 'reconnect'
      },
      variant: 'destructive'
    };
  }

  // Network/Connectivity Errors
  if (
    lowerError.includes('network') ||
    lowerError.includes('failed to fetch') ||
    lowerError.includes('timeout') ||
    lowerError.includes('connection')
  ) {
    return {
      title: 'Connection Problem',
      description: 'Unable to connect to the server. Please check your internet connection and try again.',
      action: {
        label: 'Retry',
        type: 'retry'
      },
      variant: 'destructive'
    };
  }

  // Permission/Access Errors
  if (
    lowerError.includes('permission') ||
    lowerError.includes('forbidden') ||
    lowerError.includes('403') ||
    lowerError.includes('access denied')
  ) {
    return {
      title: 'Permission Required',
      description: `You don't have permission to access this ${context === 'sync' ? 'POS integration' : 'resource'}. Please check your account settings or contact support.`,
      action: {
        label: 'Contact Support',
        type: 'contact_support'
      },
      variant: 'destructive'
    };
  }

  // Rate Limiting
  if (
    lowerError.includes('rate limit') ||
    lowerError.includes('too many requests') ||
    lowerError.includes('429')
  ) {
    return {
      title: 'Too Many Requests',
      description: 'You\'ve made too many requests. Please wait a few minutes and try again.',
      action: {
        label: 'Retry in 1 min',
        type: 'retry'
      },
      variant: 'destructive'
    };
  }

  // Insufficient Credits (Checkout specific)
  if (
    lowerError.includes('insufficient credit') ||
    lowerError.includes('not enough credit')
  ) {
    return {
      title: 'Insufficient Credits',
      description: 'You don\'t have enough barter credits for this purchase. Please add more credits or remove items from your cart.',
      variant: 'destructive'
    };
  }

  // Product Not Available
  if (
    lowerError.includes('out of stock') ||
    lowerError.includes('not available') ||
    lowerError.includes('product not found')
  ) {
    return {
      title: 'Product Unavailable',
      description: 'One or more products in your cart are no longer available. Please remove them and try again.',
      action: {
        label: 'Refresh Cart',
        type: 'refresh'
      },
      variant: 'destructive'
    };
  }

  // Authentication Required
  if (
    lowerError.includes('not authenticated') ||
    lowerError.includes('login required') ||
    lowerError.includes('session expired')
  ) {
    return {
      title: 'Login Required',
      description: 'Your session has expired. Please log in again to continue.',
      action: {
        label: 'Log In',
        type: 'reconnect'
      },
      variant: 'destructive'
    };
  }

  // POS Integration Not Found
  if (
    lowerError.includes('integration not found') ||
    lowerError.includes('no pos integration')
  ) {
    return {
      title: 'POS Not Connected',
      description: 'No POS system is connected to your account. Please connect a POS system first.',
      action: {
        label: 'Connect POS',
        type: 'reconnect'
      },
      variant: 'destructive'
    };
  }

  // Sync-specific errors
  if (context === 'sync') {
    if (lowerError.includes('no products found')) {
      return {
        title: 'No Products Found',
        description: `No products were found in your ${provider || 'POS'} system. Make sure you have products added in your POS.`,
        variant: 'default'
      };
    }

    if (lowerError.includes('sync not implemented')) {
      return {
        title: 'Sync Not Available',
        description: `Product sync is not yet available for ${provider || 'this POS system'}. Contact support for more information.`,
        action: {
          label: 'Contact Support',
          type: 'contact_support'
        },
        variant: 'destructive'
      };
    }
  }

  // Checkout-specific errors
  if (context === 'checkout') {
    if (lowerError.includes('barter not enabled')) {
      return {
        title: 'Barter Not Available',
        description: 'One or more items in your cart are not eligible for barter. Please check category restrictions.',
        variant: 'destructive'
      };
    }

    if (lowerError.includes('merchant not configured')) {
      return {
        title: 'Merchant Setup Required',
        description: 'Your merchant account needs additional setup. Please complete your profile or contact support.',
        action: {
          label: 'Contact Support',
          type: 'contact_support'
        },
        variant: 'destructive'
      };
    }
  }

  // Generic fallback with the original error if it's somewhat readable
  const isReadableError = errorMessage.length < 100 && !errorMessage.includes('Error:');

  return {
    title: context === 'sync' ? 'Sync Failed'
      : context === 'checkout' ? 'Checkout Failed'
      : context === 'auth' ? 'Authentication Failed'
      : 'Something Went Wrong',
    description: isReadableError
      ? errorMessage
      : 'An unexpected error occurred. Please try again or contact support if the problem persists.',
    action: {
      label: 'Contact Support',
      type: 'contact_support'
    },
    variant: 'destructive'
  };
}

/**
 * Get provider display name
 */
export function getProviderDisplayName(provider?: string): string {
  if (!provider) return 'POS';

  const names: Record<string, string> = {
    square: 'Square',
    shopify: 'Shopify',
    clover: 'Clover',
    lightspeed: 'Lightspeed',
    toast: 'Toast'
  };

  return names[provider.toLowerCase()] || provider.charAt(0).toUpperCase() + provider.slice(1);
}
