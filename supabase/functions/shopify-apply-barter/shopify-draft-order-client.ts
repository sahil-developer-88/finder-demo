/**
 * Shopify Draft Order API Client
 *
 * Handles communication with Shopify Admin API for draft orders
 * Docs: https://shopify.dev/docs/api/admin-rest/2024-01/resources/draftorder
 */

const API_VERSION = '2024-01';

export class ShopifyDraftOrderClient {
  private shopDomain: string;
  private accessToken: string;
  private baseUrl: string;

  constructor(shopDomain: string, accessToken: string) {
    this.shopDomain = shopDomain;
    this.accessToken = accessToken;
    this.baseUrl = `https://${shopDomain}/admin/api/${API_VERSION}`;
  }

  /**
   * Get draft order by ID
   */
  async getDraftOrder(draftOrderId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/draft_orders/${draftOrderId}.json`, {
        method: 'GET',
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Shopify API error: ${response.status} - ${errorText}`);
        return null;
      }

      const data = await response.json();
      return data.draft_order;
    } catch (error) {
      console.error('Error fetching draft order:', error);
      return null;
    }
  }

  /**
   * Apply discount to draft order
   *
   * @param draftOrderId - Shopify draft order ID
   * @param discountAmount - Dollar amount to discount
   * @param description - Discount description (e.g., "Barter Credits - 30%")
   */
  async applyDiscountToDraftOrder(
    draftOrderId: string,
    discountAmount: number,
    description: string
  ): Promise<{ success: boolean; discount_id?: string; error?: string }> {
    try {
      // Shopify draft orders use "applied_discount" field
      // This is a fixed dollar amount discount
      const discountPayload = {
        draft_order: {
          applied_discount: {
            description: description,
            value_type: 'fixed_amount',
            value: discountAmount.toFixed(2),
            amount: discountAmount.toFixed(2)
          }
        }
      };

      console.log(`📤 Shopify API Request: PUT /draft_orders/${draftOrderId}.json`);
      console.log(`   Discount: $${discountAmount.toFixed(2)}`);
      console.log(`   Description: ${description}`);

      const response = await fetch(`${this.baseUrl}/draft_orders/${draftOrderId}.json`, {
        method: 'PUT',
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(discountPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Shopify API error: ${response.status} - ${errorText}`);

        return {
          success: false,
          error: `Shopify API error: ${response.status} - ${errorText}`
        };
      }

      const data = await response.json();
      const updatedDraftOrder = data.draft_order;

      console.log(`✅ Discount applied successfully`);
      console.log(`   New total: $${updatedDraftOrder.total_price}`);

      return {
        success: true,
        discount_id: updatedDraftOrder.applied_discount?.id || 'applied'
      };

    } catch (error: any) {
      console.error('❌ Error applying discount:', error);
      return {
        success: false,
        error: error.message || 'Unknown error'
      };
    }
  }

  /**
   * Complete draft order (convert to order and collect payment)
   *
   * Note: This is typically done by the cashier in Shopify POS,
   * but can be automated if needed.
   */
  async completeDraftOrder(draftOrderId: string): Promise<any> {
    try {
      const response = await fetch(
        `${this.baseUrl}/draft_orders/${draftOrderId}/complete.json`,
        {
          method: 'PUT',
          headers: {
            'X-Shopify-Access-Token': this.accessToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            payment_pending: true // Customer will pay at POS
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Shopify API error: ${response.status} - ${errorText}`);
        return null;
      }

      const data = await response.json();
      return data.draft_order;
    } catch (error) {
      console.error('Error completing draft order:', error);
      return null;
    }
  }

  /**
   * Create a new draft order
   *
   * Useful for programmatically creating orders with items
   */
  async createDraftOrder(lineItems: any[], customerId?: string): Promise<any> {
    try {
      const draftOrderPayload: any = {
        draft_order: {
          line_items: lineItems,
          use_customer_default_address: true
        }
      };

      if (customerId) {
        draftOrderPayload.draft_order.customer = { id: customerId };
      }

      const response = await fetch(`${this.baseUrl}/draft_orders.json`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(draftOrderPayload)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Shopify API error: ${response.status} - ${errorText}`);
        return null;
      }

      const data = await response.json();
      return data.draft_order;
    } catch (error) {
      console.error('Error creating draft order:', error);
      return null;
    }
  }

  /**
   * Search for open draft orders
   *
   * Useful for finding draft orders created recently
   */
  async searchDraftOrders(status: string = 'open', limit: number = 10): Promise<any[]> {
    try {
      const response = await fetch(
        `${this.baseUrl}/draft_orders.json?status=${status}&limit=${limit}`,
        {
          method: 'GET',
          headers: {
            'X-Shopify-Access-Token': this.accessToken,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Shopify API error: ${response.status} - ${errorText}`);
        return [];
      }

      const data = await response.json();
      return data.draft_orders || [];
    } catch (error) {
      console.error('Error searching draft orders:', error);
      return [];
    }
  }

  /**
   * Delete/cancel draft order
   */
  async deleteDraftOrder(draftOrderId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/draft_orders/${draftOrderId}.json`, {
        method: 'DELETE',
        headers: {
          'X-Shopify-Access-Token': this.accessToken
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Error deleting draft order:', error);
      return false;
    }
  }

  /**
   * Send draft order invoice to customer
   *
   * Useful for online orders where customer pays later
   */
  async sendInvoice(draftOrderId: string, customMessage?: string): Promise<any> {
    try {
      const payload: any = {
        draft_order_invoice: {}
      };

      if (customMessage) {
        payload.draft_order_invoice.custom_message = customMessage;
      }

      const response = await fetch(
        `${this.baseUrl}/draft_orders/${draftOrderId}/send_invoice.json`,
        {
          method: 'POST',
          headers: {
            'X-Shopify-Access-Token': this.accessToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Shopify API error: ${response.status} - ${errorText}`);
        return null;
      }

      const data = await response.json();
      return data.draft_order_invoice;
    } catch (error) {
      console.error('Error sending invoice:', error);
      return null;
    }
  }
}
