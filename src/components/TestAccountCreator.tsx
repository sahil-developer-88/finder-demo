
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, Users, LogIn, AlertTriangle, RefreshCw } from 'lucide-react';
import { createTestAccounts } from '@/utils/createTestAccounts';
import { useNavigate } from 'react-router-dom';

interface CreateResult {
  admin: {
    email: string;
    password: string;
    success: boolean;
    error?: string;
  };
  customer: {
    email: string;
    password: string;
    success: boolean;
    error?: string;
  };
}

const TestAccountCreator = () => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CreateResult | null>(null);
  const [error, setError] = useState('');
  const [autoCreated, setAutoCreated] = useState(false);
  const navigate = useNavigate();

  // Auto-create accounts on component mount
  useEffect(() => {
    if (!autoCreated) {
      handleCreateAccounts();
      setAutoCreated(true);
    }
  }, [autoCreated]);

  const handleCreateAccounts = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    
    try {
      const createResult = await createTestAccounts();
      console.log('Account creation result:', createResult);
      setResult(createResult);
    } catch (err: any) {
      console.error('Failed to create accounts:', err);
      setError(err.message || 'Failed to create accounts');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
            Setting Up Test Accounts
          </CardTitle>
          <CardDescription>
            Creating admin and customer accounts automatically...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <RefreshCw className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">This will take just a moment...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (result) {
    const hasSuccessfulAccounts = result.admin.success || result.customer.success;
    
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {hasSuccessfulAccounts ? (
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            ) : (
              <AlertTriangle className="h-6 w-6 text-red-600" />
            )}
            Test Accounts Ready
          </CardTitle>
          <CardDescription>
            Your test accounts are set up and ready to use
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          
          {hasSuccessfulAccounts && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-700">
                <strong>Ready to login!</strong> Use the credentials below to access the app. The admin account has full backend access.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className={`p-4 rounded-lg ${result.admin.success ? 'bg-blue-50 border-2 border-blue-200' : 'bg-red-50'}`}>
              <h3 className={`font-semibold mb-2 ${result.admin.success ? 'text-blue-900' : 'text-red-900'}`}>
                🔑 Admin Account {result.admin.success ? '✓' : '✗'}
              </h3>
              <p className={`text-sm font-mono ${result.admin.success ? 'text-blue-800' : 'text-red-800'}`}>
                <strong>Email:</strong> {result.admin.email}
              </p>
              <p className={`text-sm font-mono ${result.admin.success ? 'text-blue-800' : 'text-red-800'}`}>
                <strong>Password:</strong> {result.admin.password}
              </p>
              {result.admin.success ? (
                <>
                  <p className="text-xs text-blue-600 mt-2">✓ Full Admin Panel Access</p>
                  <p className="text-xs text-blue-600">✓ Backend Management</p>
                  <p className="text-xs text-blue-600">✓ $1,000 Credits</p>
                </>
              ) : (
                <p className="text-xs text-red-600 mt-2">Error: {result.admin.error}</p>
              )}
            </div>
            
            <div className={`p-4 rounded-lg ${result.customer.success ? 'bg-green-50' : 'bg-red-50'}`}>
              <h3 className={`font-semibold mb-2 ${result.customer.success ? 'text-green-900' : 'text-red-900'}`}>
                👤 Customer Account {result.customer.success ? '✓' : '✗'}
              </h3>
              <p className={`text-sm font-mono ${result.customer.success ? 'text-green-800' : 'text-red-800'}`}>
                <strong>Email:</strong> {result.customer.email}
              </p>
              <p className={`text-sm font-mono ${result.customer.success ? 'text-green-800' : 'text-red-800'}`}>
                <strong>Password:</strong> {result.customer.password}
              </p>
              {result.customer.success ? (
                <>
                  <p className="text-xs text-green-600 mt-2">✓ Customer Dashboard</p>
                  <p className="text-xs text-green-600">✓ Trading Features</p>
                  <p className="text-xs text-green-600">✓ $500 Credits</p>
                </>
              ) : (
                <p className="text-xs text-red-600 mt-2">Error: {result.customer.error}</p>
              )}
            </div>
          </div>
          
          {hasSuccessfulAccounts && (
            <Alert>
              <LogIn className="h-4 w-4" />
              <AlertDescription>
                <strong>Ready to login!</strong> Click "Go to Login" below and use any of the successful accounts above. 
                <br />Admin users will see the "Admin" button in the header for backend access.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            {hasSuccessfulAccounts && (
              <Button onClick={() => navigate('/auth')} className="flex-1 bg-blue-600 hover:bg-blue-700">
                <LogIn className="h-4 w-4 mr-2" />
                Go to Login
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={() => {
                setResult(null);
                setAutoCreated(false);
              }}
              className="flex items-center gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Recreate Accounts
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-6 w-6" />
            Setup Failed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert className="mb-4 border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-700">{error}</AlertDescription>
          </Alert>
          
          <Button 
            onClick={() => {
              setError('');
              setAutoCreated(false);
            }}
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return null;
};

export default TestAccountCreator;
