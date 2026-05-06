import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, CheckCircle2, AlertCircle, ExternalLink, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface POSConnectionWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  onBeforeOAuth?: () => Promise<void>;
  targetUserId?: string;    // admin: connect on behalf of this merchant
  callbackRedirect?: string; // admin: redirect here after OAuth (e.g. /admin?section=listings&sub=Listing+Details)
}

type POSProvider = 'square' | 'shopify' | 'adyen' | 'clover' | 'toast' | 'lightspeed';

interface ConnectionConfig {
  provider: POSProvider;
  storeId: string;
  merchantId?: string;
  apiKey?: string;
  accessToken?: string;
  webhookUrl: string;
  barterPercentage: number;
}

/**
 * POS Connection Wizard - Guides merchants through connecting their POS system
 * Supports OAuth flows and API key authentication
 */
export function POSConnectionWizard({ open, onOpenChange, onSuccess, onBeforeOAuth, targetUserId, callbackRedirect }: POSConnectionWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<'provider' | 'credentials' | 'webhook' | 'testing' | 'complete'>('provider');
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [authMethod, setAuthMethod] = useState<'oauth' | 'api_key'>('oauth');
  const [shopName, setShopName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [userBarterPercentage, setUserBarterPercentage] = useState<number>(25);
  const [lightspeedMode, setLightspeedMode] = useState<'xseries' | 'ecom'>('xseries');
  const [connectedProviders, setConnectedProviders] = useState<Set<string>>(new Set());

  const [config, setConfig] = useState<ConnectionConfig>({
    provider: 'square',
    storeId: '',
    apiKey: '',
    webhookUrl: `https://etzwoyyhxvwpdejckpaq.supabase.co/functions/v1/pos-webhook`,
    barterPercentage: 25
  });

  // Fetch user's barter percentage and existing integrations
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [{ data: profile }, { data: integrations }] = await Promise.all([
          supabase.from('profiles').select('barter_percentage').eq('user_id', user.id).single(),
          supabase.from('pos_integrations').select('provider').eq('user_id', user.id).eq('status', 'active'),
        ]);

        if (profile?.barter_percentage) {
          setUserBarterPercentage(profile.barter_percentage);
          setConfig(prev => ({ ...prev, barterPercentage: profile.barter_percentage }));
        }

        if (integrations) {
          setConnectedProviders(new Set(integrations.map(i => i.provider)));
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    fetchUserData();
  }, [open]);

  // Reset wizard state when dialog closes
  useEffect(() => {
    if (!open) {
      // Reset to initial state when dialog is closed
      setStep('provider');
      setLoading(false);
      setTestResult(null);
      setAuthMethod('oauth');
      setShopName('');
      setStoreName('');
      setLightspeedMode('xseries');
      setConfig({
        provider: 'square',
        storeId: '',
        apiKey: '',
        webhookUrl: `https://etzwoyyhxvwpdejckpaq.supabase.co/functions/v1/pos-webhook`,
        barterPercentage: userBarterPercentage
      });
    }
  }, [open, userBarterPercentage]);

  const providerInfo: Record<POSProvider, { name: string; oauth: boolean; docs: string }> = {
    square: { 
      name: 'Square', 
      oauth: true, 
      docs: 'https://developer.squareup.com/docs/webhooks/overview' 
    },
    shopify: { 
      name: 'Shopify POS', 
      oauth: true, 
      docs: 'https://shopify.dev/docs/api/admin-rest/webhooks' 
    },
    adyen: { 
      name: 'Adyen', 
      oauth: false, 
      docs: 'https://docs.adyen.com/development-resources/webhooks' 
    },
    clover: { 
      name: 'Clover', 
      oauth: true, 
      docs: 'https://docs.clover.com/docs/webhooks' 
    },
    toast: {
      name: 'Toast POS',
      oauth: true,
      docs: 'https://doc.toasttab.com/doc/devguide/webhooks.html'
    },
    lightspeed: {
      name: 'Lightspeed Retail',
      oauth: true,
      docs: 'https://x-series-api.lightspeedhq.com/docs/webhooks'
    }
  };

  const handleProviderSelect = (provider: POSProvider) => {
    if (connectedProviders.has(provider)) return; // already connected
    setConfig({ ...config, provider });
    if (providerInfo[provider].oauth) {
      setAuthMethod('oauth');
    } else {
      setAuthMethod('api_key');
    }
    setStep('credentials');
  };

  const handleOAuthConnect = async () => {
    setLoading(true);
    try {
      // Call onBeforeOAuth callback first (e.g., to save onboarding data)
      if (onBeforeOAuth) {
        toast({
          title: 'Saving your data...',
          description: 'Please wait while we complete your setup.',
        });
        await onBeforeOAuth();
      }

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Not authenticated');
      }

      // Call edge function to initiate OAuth flow for all providers including Lightspeed eCom
      const { data, error } = await supabase.functions.invoke('pos-oauth-initiate', {
        body: {
          provider: config.provider,
          shopName: config.provider === 'shopify' ? shopName :
                   (config.provider === 'lightspeed' && lightspeedMode === 'xseries') ? storeName : undefined,
          lightspeedMode: config.provider === 'lightspeed' ? lightspeedMode : undefined,
          targetUserId:    targetUserId    || undefined,
          callbackRedirect: callbackRedirect || undefined,
        }
      });

      if (error) throw error;

      // Redirect to OAuth authorization URL
      if (data?.authorizationUrl) {
        window.location.href = data.authorizationUrl;
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Check for OAuth callback on component mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthSuccess = params.get('oauth_success');
    const oauthError = params.get('oauth_error');
    const provider = params.get('provider');

    if (oauthSuccess === 'true' && provider) {
      // Clean up URL params FIRST to prevent reload loop
      window.history.replaceState({}, '', window.location.pathname);

      toast({
        title: 'Success!',
        description: `Your ${provider} POS has been connected.`,
      });
      onSuccess?.();
    }

    if (oauthError) {
      toast({
        title: 'OAuth Error',
        description: decodeURIComponent(oauthError),
        variant: 'destructive'
      });
      // Clean up URL params
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleTestConnection = async () => {
    setLoading(true);
    setTestResult(null);

    try {
      // Validate connection by attempting to fetch test data
      const response = await fetch(`${config.webhookUrl}?provider=${config.provider}&test=true`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setTestResult({ success: true, message: 'Connection successful!' });
        setTimeout(() => setStep('complete'), 1500);
      } else {
        setTestResult({ success: false, message: 'Connection failed. Please check your credentials.' });
      }
    } catch (error: any) {
      setTestResult({ success: false, message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConnection = async () => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        throw new Error('Not authenticated');
      }

      // Deactivate all existing active POS integrations for this user
      const { error: deactivateError } = await supabase
        .from('pos_integrations')
        .update({ status: 'inactive' })
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (deactivateError) {
        console.error('Warning: Failed to deactivate old integrations:', deactivateError);
        // Don't throw - continue with new integration
      }

      // Save POS integration to database
      const { error } = await supabase.from('pos_integrations').insert({
        user_id: user.id,
        provider: config.provider,
        store_id: config.storeId,
        merchant_id: config.merchantId,
        access_token: config.apiKey || config.accessToken,
        auth_method: authMethod,
        config: {
          barterPercentage: config.barterPercentage,
          webhookUrl: config.webhookUrl
        },
        status: 'active'
      });

      if (error) throw error;

      toast({
        title: 'Success!',
        description: 'Your POS system has been connected.',
      });

      onSuccess?.();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Connect Your POS System</DialogTitle>
          <DialogDescription>
            Follow the steps below to integrate your point-of-sale system with automatic barter transaction detection.
          </DialogDescription>
        </DialogHeader>

        {/* Step 1: Provider Selection */}
        {step === 'provider' && (
          <div className="space-y-4">
            <h3 className="font-semibold">Select Your POS Provider</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Object.entries(providerInfo).map(([key, info]) => {
                const alreadyConnected = connectedProviders.has(key);
                return (
                  <Card
                    key={key}
                    className={`transition-colors ${alreadyConnected ? 'opacity-60 cursor-not-allowed border-emerald-200 bg-emerald-50/40' : 'cursor-pointer hover:border-primary'}`}
                    onClick={() => !alreadyConnected && handleProviderSelect(key as POSProvider)}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{info.name}</CardTitle>
                        {alreadyConnected && (
                          <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Connected
                          </span>
                        )}
                      </div>
                      <CardDescription>
                        {alreadyConnected
                          ? 'Already connected to your account'
                          : `${info.oauth ? 'OAuth 2.0 / API Key' : 'API Key'} Authentication`}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 2: Credentials */}
        {step === 'credentials' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Connect {providerInfo[config.provider].name}</h3>
              <Button variant="link" size="sm" asChild>
                <a href={providerInfo[config.provider].docs} target="_blank" rel="noopener noreferrer">
                  View Docs <ExternalLink className="ml-1 w-3 h-3" />
                </a>
              </Button>
            </div>

            {providerInfo[config.provider].oauth ? (
              <Tabs value={authMethod} onValueChange={(v) => setAuthMethod(v as 'oauth' | 'api_key')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="oauth" className="gap-1 text-xs sm:text-sm">
                    <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                    <span className="hidden xs:inline">Quick Connect (OAuth)</span>
                    <span className="xs:hidden">OAuth</span>
                  </TabsTrigger>
                  <TabsTrigger value="api_key" className="text-xs sm:text-sm">
                    Manual Setup
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="oauth" className="space-y-4">
                  <Alert>
                    <AlertDescription>
                      Click the button below to securely connect your {providerInfo[config.provider].name} account. You'll be redirected to authorize the connection.
                    </AlertDescription>
                  </Alert>

                  {config.provider === 'shopify' && (
                    <div>
                      <Label htmlFor="shop-name">Your Shop Name</Label>
                      <Input
                        id="shop-name"
                        value={shopName}
                        onChange={(e) => setShopName(e.target.value)}
                        placeholder="your-store"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Enter just the shop name (e.g., "your-store" from your-store.myshopify.com)
                      </p>
                    </div>
                  )}

                  {config.provider === 'lightspeed' && (
                    <div className="space-y-4">
                      <div className="flex rounded-lg border overflow-hidden">
                        <button
                          type="button"
                          className={`flex-1 py-2 text-sm font-medium transition-colors ${lightspeedMode === 'xseries' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                          onClick={() => setLightspeedMode('xseries')}
                        >
                          X-Series Retail
                        </button>
                        <button
                          type="button"
                          className={`flex-1 py-2 text-sm font-medium transition-colors ${lightspeedMode === 'ecom' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
                          onClick={() => setLightspeedMode('ecom')}
                        >
                          eCom E-Series
                        </button>
                      </div>

                      {lightspeedMode === 'xseries' && (
                        <div>
                          <Label htmlFor="store-name">Your Store Name</Label>
                          <Input
                            id="store-name"
                            value={storeName}
                            onChange={(e) => setStoreName(e.target.value)}
                            placeholder="your-store"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Enter your store name (e.g., "your-store" from your-store.retail.lightspeed.app)
                          </p>
                        </div>
                      )}

                      {lightspeedMode === 'ecom' && (
                        <div className="space-y-3">
                          <Alert>
                            <AlertDescription>
                              Click the button below to securely connect your Lightspeed eCom store. You'll be redirected to authorize the connection.
                            </AlertDescription>
                          </Alert>
                        </div>
                      )}
                    </div>
                  )}

                  <Button
                    onClick={handleOAuthConnect}
                    disabled={
                      loading ||
                      (config.provider === 'shopify' && !shopName) ||
                      (config.provider === 'lightspeed' && lightspeedMode === 'xseries' && !storeName)
                    }
                    className="w-full"
                    size="lg"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                        Connecting...
                      </>
                    ) : (
                      <>
                        <Zap className="mr-2 w-4 h-4" />
                        {config.provider === 'lightspeed' && lightspeedMode === 'ecom'
                          ? 'Connect with Lightspeed eCom'
                          : `Connect with ${providerInfo[config.provider].name}`}
                      </>
                    )}
                  </Button>

                  <div className="text-center text-sm text-muted-foreground">
                    <p>✓ Secure authentication</p>
                    <p>✓ No manual credentials needed</p>
                    <p>✓ Automatic configuration</p>
                  </div>
                </TabsContent>

                <TabsContent value="api_key" className="space-y-4">
                  <Alert>
                    <AlertDescription>
                      You'll need to generate API credentials from your {providerInfo[config.provider].name} dashboard.
                    </AlertDescription>
                  </Alert>

                  <div className="space-y-3">
                    {config.provider === 'square' && (
                      <>
                        <div>
                          <Label htmlFor="location-id">Location ID</Label>
                          <Input
                            id="location-id"
                            value={config.storeId}
                            onChange={(e) => setConfig({ ...config, storeId: e.target.value })}
                            placeholder="Your Square location ID"
                          />
                        </div>
                        <div>
                          <Label htmlFor="access-token">Access Token</Label>
                          <Input
                            id="access-token"
                            type="password"
                            value={config.apiKey}
                            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                            placeholder="Square access token"
                          />
                        </div>
                      </>
                    )}

                    {config.provider === 'shopify' && (
                      <>
                        <div>
                          <Label htmlFor="shop-domain">Shop Domain</Label>
                          <Input
                            id="shop-domain"
                            value={config.storeId}
                            onChange={(e) => setConfig({ ...config, storeId: e.target.value })}
                            placeholder="your-store.myshopify.com"
                          />
                        </div>
                        <div>
                          <Label htmlFor="access-token">Access Token</Label>
                          <Input
                            id="access-token"
                            type="password"
                            value={config.apiKey}
                            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                            placeholder="Shopify access token"
                          />
                        </div>
                      </>
                    )}

                    {config.provider === 'clover' && (
                      <>
                        <div>
                          <Label htmlFor="merchant-id">Merchant ID</Label>
                          <Input
                            id="merchant-id"
                            value={config.merchantId}
                            onChange={(e) => setConfig({ ...config, merchantId: e.target.value })}
                            placeholder="Your Clover merchant ID"
                          />
                        </div>
                        <div>
                          <Label htmlFor="access-token">Access Token</Label>
                          <Input
                            id="access-token"
                            type="password"
                            value={config.apiKey}
                            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                            placeholder="Clover access token"
                          />
                        </div>
                      </>
                    )}

                    {config.provider === 'toast' && (
                      <>
                        <div>
                          <Label htmlFor="restaurant-guid">Restaurant GUID</Label>
                          <Input
                            id="restaurant-guid"
                            value={config.storeId}
                            onChange={(e) => setConfig({ ...config, storeId: e.target.value })}
                            placeholder="Your Toast restaurant GUID"
                          />
                        </div>
                        <div>
                          <Label htmlFor="access-token">Access Token</Label>
                          <Input
                            id="access-token"
                            type="password"
                            value={config.apiKey}
                            onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                            placeholder="Toast access token"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <Label htmlFor="barter-percentage">Default Barter Percentage</Label>
                      <Input
                        id="barter-percentage"
                        type="number"
                        min="0"
                        max="100"
                        value={config.barterPercentage}
                        onChange={(e) => setConfig({ ...config, barterPercentage: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep('provider')}>
                      Back
                    </Button>
                    <Button onClick={() => setStep('webhook')} className="flex-1">
                      Continue
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            ) : (
              <>
                <Alert>
                  <AlertDescription>
                    You'll need to generate API credentials from your {providerInfo[config.provider].name} dashboard.
                  </AlertDescription>
                </Alert>

                <div className="space-y-3">
                  {config.provider === 'adyen' && (
                    <>
                      <div>
                        <Label htmlFor="merchant-account">Merchant Account</Label>
                        <Input
                          id="merchant-account"
                          value={config.merchantId}
                          onChange={(e) => setConfig({ ...config, merchantId: e.target.value })}
                          placeholder="Your Adyen merchant account"
                        />
                      </div>
                      <div>
                        <Label htmlFor="api-key">API Key</Label>
                        <Input
                          id="api-key"
                          type="password"
                          value={config.apiKey}
                          onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                          placeholder="Adyen API key"
                        />
                      </div>
                    </>
                  )}

                  {config.provider === 'toast' && (
                    <>
                      <div>
                        <Label htmlFor="restaurant-guid">Restaurant GUID</Label>
                        <Input
                          id="restaurant-guid"
                          value={config.storeId}
                          onChange={(e) => setConfig({ ...config, storeId: e.target.value })}
                          placeholder="Your Toast restaurant GUID"
                        />
                      </div>
                      <div>
                        <Label htmlFor="access-token">Access Token</Label>
                        <Input
                          id="access-token"
                          type="password"
                          value={config.apiKey}
                          onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                          placeholder="Toast access token"
                        />
                      </div>
                    </>
                  )}

                  <div>
                    <Label htmlFor="barter-percentage">Default Barter Percentage</Label>
                    <Input
                      id="barter-percentage"
                      type="number"
                      min="0"
                      max="100"
                      value={config.barterPercentage}
                      onChange={(e) => setConfig({ ...config, barterPercentage: parseInt(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep('provider')}>
                    Back
                  </Button>
                  <Button onClick={() => setStep('webhook')} className="flex-1">
                    Continue
                  </Button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 3: Webhook Setup */}
        {step === 'webhook' && (
          <div className="space-y-4">
            <h3 className="font-semibold">Configure Webhook</h3>
            
            <Alert>
              <AlertDescription>
                Copy this webhook URL and add it to your {providerInfo[config.provider].name} dashboard to receive real-time transaction updates.
              </AlertDescription>
            </Alert>

            <div>
              <Label htmlFor="webhook-url">Webhook URL</Label>
              <div className="flex gap-2">
                <Input
                  id="webhook-url"
                  value={`${config.webhookUrl}?provider=${config.provider}`}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(`${config.webhookUrl}?provider=${config.provider}`);
                    toast({ title: 'Copied!', description: 'Webhook URL copied to clipboard' });
                  }}
                >
                  Copy
                </Button>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Setup Instructions</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-2">
                <ol className="list-decimal list-inside space-y-1">
                  <li>Log in to your {providerInfo[config.provider].name} dashboard</li>
                  <li>Navigate to Webhooks or Notifications settings</li>
                  <li>Add a new webhook with the URL above</li>
                  <li>Select "Payment" or "Transaction" events</li>
                  <li>Save the webhook configuration</li>
                </ol>
              </CardContent>
            </Card>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('credentials')}>
                Back
              </Button>
              <Button onClick={() => setStep('testing')} className="flex-1">
                Test Connection
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Testing */}
        {step === 'testing' && (
          <div className="space-y-4">
            <h3 className="font-semibold">Testing Connection</h3>
            
            {testResult && (
              <Alert variant={testResult.success ? 'default' : 'destructive'}>
                {testResult.success ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <AlertCircle className="h-4 w-4" />
                )}
                <AlertDescription>{testResult.message}</AlertDescription>
              </Alert>
            )}

            {!testResult && (
              <div className="flex flex-col items-center justify-center py-8 space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Verifying connection...</p>
              </div>
            )}

            {!loading && !testResult && (
              <Button onClick={handleTestConnection} className="w-full">
                Start Test
              </Button>
            )}
          </div>
        )}

        {/* Step 5: Complete */}
        {step === 'complete' && (
          <div className="space-y-4">
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <CheckCircle2 className="w-16 h-16 text-green-500" />
              <h3 className="text-xl font-semibold">Connection Successful!</h3>
              <p className="text-center text-muted-foreground">
                Your {providerInfo[config.provider].name} POS is now connected and will automatically sync transactions.
              </p>
            </div>

            <Button onClick={handleSaveConnection} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="mr-2 w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Complete Setup'
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
