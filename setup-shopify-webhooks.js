// Shopify Webhook Setup Script
// Run this with: node setup-shopify-webhooks.js

const SHOPIFY_STORE = 'your-store-name'; // e.g., 'mystore' from mystore.myshopify.com
const SHOPIFY_ACCESS_TOKEN = 'your-admin-api-access-token'; // Get from app credentials
const WEBHOOK_URL = 'https://YOUR-SUPABASE-PROJECT-ID.supabase.co/functions/v1/pos-webhook?provider=shopify';

const webhooks = [
  { topic: 'PRODUCTS_CREATE', address: WEBHOOK_URL },
  { topic: 'PRODUCTS_UPDATE', address: WEBHOOK_URL },
  { topic: 'PRODUCTS_DELETE', address: WEBHOOK_URL },
];

async function createWebhook(topic, address) {
  const query = `
    mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
        webhookSubscription {
          id
          topic
          endpoint {
            __typename
            ... on WebhookHttpEndpoint {
              callbackUrl
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

  const variables = {
    topic: topic,
    webhookSubscription: {
      callbackUrl: address,
      format: 'JSON'
    }
  };

  const response = await fetch(
    `https://${SHOPIFY_STORE}.myshopify.com/admin/api/2024-10/graphql.json`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    }
  );

  const result = await response.json();
  return result;
}

async function setupWebhooks() {
  console.log('🚀 Setting up Shopify webhooks...\n');

  for (const webhook of webhooks) {
    console.log(`Creating webhook: ${webhook.topic}`);
    try {
      const result = await createWebhook(webhook.topic, webhook.address);

      if (result.data?.webhookSubscriptionCreate?.webhookSubscription) {
        console.log('✅ Success!');
        console.log(`   ID: ${result.data.webhookSubscriptionCreate.webhookSubscription.id}`);
      } else if (result.data?.webhookSubscriptionCreate?.userErrors?.length > 0) {
        console.log('❌ Error:', result.data.webhookSubscriptionCreate.userErrors);
      } else {
        console.log('❌ Unknown error:', result);
      }
    } catch (error) {
      console.error('❌ Failed:', error.message);
    }
    console.log('');
  }

  console.log('✨ Done!');
}

// Run the setup
setupWebhooks();
