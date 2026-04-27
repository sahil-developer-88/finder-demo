/**
 * Shopify GraphQL API Client for Draft Orders
 *
 * Uses GraphQL Admin API which doesn't have protected customer data restrictions
 * Docs: https://shopify.dev/docs/api/admin-graphql/2024-01/mutations/draftOrderUpdate
 */

const API_VERSION = '2024-01';

export class ShopifyGraphQLClient {
  private shopDomain: string;
  private accessToken: string;
  private graphqlUrl: string;

  constructor(shopDomain: string, accessToken: string) {
    this.shopDomain = shopDomain;
    this.accessToken = accessToken;
    this.graphqlUrl = `https://${shopDomain}/admin/api/${API_VERSION}/graphql.json`;
  }

  /**
   * Execute GraphQL query
   */
  private async graphql(query: string, variables: any = {}): Promise<any> {
    try {
      const response = await fetch(this.graphqlUrl, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': this.accessToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, variables })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Shopify GraphQL error: ${response.status} - ${errorText}`);
        throw new Error(`GraphQL request failed: ${response.status}`);
      }

      const data = await response.json();

      if (data.errors) {
        console.error('GraphQL errors:', data.errors);
        throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
      }

      return data.data;
    } catch (error) {
      console.error('Error executing GraphQL query:', error);
      throw error;
    }
  }

  /**
   * Get draft order by ID
   */
  async getDraftOrder(draftOrderId: string): Promise<any> {
    const query = `
      query getDraftOrder($id: ID!) {
        draftOrder(id: $id) {
          id
          name
          totalPrice
          subtotalPrice
          totalTax
          currencyCode
          lineItems(first: 50) {
            edges {
              node {
                id
                title
                quantity
                originalTotal
              }
            }
          }
          appliedDiscount {
            description
            value
            valueType
            amountV2 {
              amount
              currencyCode
            }
          }
        }
      }
    `;

    // Convert numeric ID to GraphQL global ID format
    const globalId = `gid://shopify/DraftOrder/${draftOrderId}`;

    try {
      const result = await this.graphql(query, { id: globalId });
      return result.draftOrder;
    } catch (error) {
      console.error('Error fetching draft order:', error);
      return null;
    }
  }

  /**
   * Apply discount to draft order using GraphQL
   */
  async applyDiscountToDraftOrder(
    draftOrderId: string,
    discountAmount: number,
    description: string
  ): Promise<{ success: boolean; discount_id?: string; error?: string }> {
    const mutation = `
      mutation draftOrderUpdate($id: ID!, $input: DraftOrderInput!) {
        draftOrderUpdate(id: $id, input: $input) {
          draftOrder {
            id
            totalPrice
            appliedDiscount {
              description
              value
              amountV2 {
                amount
              }
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    // Convert numeric ID to GraphQL global ID format
    const globalId = `gid://shopify/DraftOrder/${draftOrderId}`;

    const input = {
      appliedDiscount: {
        description: description,
        valueType: 'FIXED_AMOUNT',
        value: discountAmount
      }
    };

    console.log(`📤 Shopify GraphQL Request: draftOrderUpdate`);
    console.log(`   Draft Order ID: ${draftOrderId}`);
    console.log(`   Discount: $${discountAmount.toFixed(2)}`);
    console.log(`   Description: ${description}`);

    try {
      const result = await this.graphql(mutation, { id: globalId, input });

      if (result.draftOrderUpdate.userErrors?.length > 0) {
        const errors = result.draftOrderUpdate.userErrors;
        console.error('❌ User errors:', errors);
        return {
          success: false,
          error: errors.map((e: any) => e.message).join(', ')
        };
      }

      const draftOrder = result.draftOrderUpdate.draftOrder;
      console.log(`✅ Discount applied successfully`);
      console.log(`   New total: $${draftOrder.totalPrice}`);

      return {
        success: true,
        discount_id: 'applied'
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
   * Complete draft order (convert to order)
   */
  async completeDraftOrder(draftOrderId: string): Promise<any> {
    const mutation = `
      mutation draftOrderComplete($id: ID!) {
        draftOrderComplete(id: $id) {
          draftOrder {
            id
            order {
              id
              name
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const globalId = `gid://shopify/DraftOrder/${draftOrderId}`;

    try {
      const result = await this.graphql(mutation, { id: globalId });

      if (result.draftOrderComplete.userErrors?.length > 0) {
        console.error('User errors:', result.draftOrderComplete.userErrors);
        return null;
      }

      return result.draftOrderComplete.draftOrder;
    } catch (error) {
      console.error('Error completing draft order:', error);
      return null;
    }
  }
}
