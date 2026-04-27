import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, CheckCircle, XCircle, AlertCircle } from "lucide-react";

const WebhookTest = () => {
  const [webhookLogs, setWebhookLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [projectId, setProjectId] = useState('');

  useEffect(() => {
    // Get Supabase project ID from URL
    const url = 'https://etzwoyyhxvwpdejckpaq.supabase.co';
    const id = url.replace('https://', '').split('.')[0];
    setProjectId(id);

    fetchWebhookLogs();
  }, []);

  const fetchWebhookLogs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('webhook_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setWebhookLogs(data || []);
    } catch (error) {
      console.error('Error fetching webhook logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const webhookUrl = `https://etzwoyyhxvwpdejckpaq.supabase.co/functions/v1/pos-webhook?provider=shopify`;

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Webhook Testing & Debugging</h1>
        <p className="text-gray-600">Check if your Shopify webhooks are working correctly</p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {/* Webhook URL */}
        <Card>
          <CardHeader>
            <CardTitle>Your Webhook URL</CardTitle>
            <CardDescription>Use this URL in Shopify webhook settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-gray-100 p-4 rounded-lg font-mono text-sm break-all">
              {webhookUrl}
            </div>
            <Button
              onClick={() => {
                navigator.clipboard.writeText(webhookUrl);
                alert('Copied to clipboard!');
              }}
              className="mt-3"
              variant="outline"
              size="sm"
            >
              Copy URL
            </Button>
          </CardContent>
        </Card>

        {/* Setup Checklist */}
        <Card>
          <CardHeader>
            <CardTitle>Setup Checklist</CardTitle>
            <CardDescription>Follow these steps to configure webhooks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 font-semibold text-sm">
                1
              </div>
              <div>
                <p className="font-medium">Go to Shopify Admin</p>
                <p className="text-sm text-gray-600">Settings → Notifications → Webhooks section</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 font-semibold text-sm">
                2
              </div>
              <div>
                <p className="font-medium">Create 3 Webhooks</p>
                <ul className="text-sm text-gray-600 list-disc list-inside mt-1">
                  <li>Product creation</li>
                  <li>Product update</li>
                  <li>Product deletion</li>
                </ul>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 font-semibold text-sm">
                3
              </div>
              <div>
                <p className="font-medium">Test the Webhook</p>
                <p className="text-sm text-gray-600">
                  Make a small change to a product in Shopify, then check the logs below
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Webhook Logs */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Webhook Activity</CardTitle>
                <CardDescription>Last 10 webhook calls received</CardDescription>
              </div>
              <Button onClick={fetchWebhookLogs} variant="outline" size="sm" disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {webhookLogs.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <AlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                <p className="font-medium">No webhooks received yet</p>
                <p className="text-sm mt-1">
                  Make a change in Shopify to test the webhook connection
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {webhookLogs.map((log, index) => (
                  <div
                    key={log.id || index}
                    className="border rounded-lg p-4 hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={log.status === 'success' ? 'default' : 'destructive'}>
                          {log.provider}
                        </Badge>
                        {log.status === 'success' ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : log.status === 'failed_verification' ? (
                          <XCircle className="h-4 w-4 text-red-600" />
                        ) : (
                          <AlertCircle className="h-4 w-4 text-yellow-600" />
                        )}
                        <span className="text-sm text-gray-600">{log.status}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(log.created_at).toLocaleString()}
                      </span>
                    </div>

                    <div className="text-sm">
                      <p className="font-medium">Endpoint: {log.endpoint}</p>
                      {log.payload?.topic && (
                        <p className="text-gray-600 mt-1">
                          Topic: <span className="font-mono">{log.payload.topic}</span>
                        </p>
                      )}
                      {log.payload?.id && (
                        <p className="text-gray-600">
                          Product ID: <span className="font-mono">{log.payload.id}</span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Troubleshooting */}
        <Card>
          <CardHeader>
            <CardTitle>Troubleshooting</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="font-medium mb-1">❌ No logs appearing?</p>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>Check if webhooks are created in Shopify Admin</li>
                <li>Verify the webhook URL is correct</li>
                <li>Make sure you made a change to a product (edit/create/delete)</li>
              </ul>
            </div>

            <div>
              <p className="font-medium mb-1">❌ Status shows "failed_verification"?</p>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>Webhook signature secret may be incorrect</li>
                <li>Go to Supabase Dashboard → Edge Functions → Secrets</li>
                <li>Add/update: SHOPIFY_WEBHOOK_SECRET</li>
              </ul>
            </div>

            <div>
              <p className="font-medium mb-1">✅ Webhook working but products not updating?</p>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>Check if POS integration exists in database</li>
                <li>Verify business_id is set correctly</li>
                <li>Try manually refreshing the products page</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default WebhookTest;
