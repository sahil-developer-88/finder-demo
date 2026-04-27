
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import FileUpload from '@/components/upload/FileUpload';
import NotificationCenter from '@/components/notifications/NotificationCenter';
import TradeSystem from '@/components/trading/TradeSystem';
import AdvancedSearch from '@/components/search/AdvancedSearch';
import DashboardAnalytics from '@/components/analytics/DashboardAnalytics';
import { useNotifications } from '@/hooks/useNotifications';
import { useMessages } from '@/hooks/useMessages';
import { useFileUpload } from '@/hooks/useFileUpload';
import { sendEmail, emailTemplates } from '@/utils/emailService';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/hooks/use-toast';
import { TestTube, Mail, Upload, Bell, MessageSquare, BarChart3, Search, Handshake } from 'lucide-react';

const TestingPage = () => {
  const [testResults, setTestResults] = useState<Record<string, 'pass' | 'fail' | 'pending'>>({});
  const { createNotification } = useNotifications();
  const { sendMessage } = useMessages();
  const { uploadFile } = useFileUpload();
  const { user } = useAuth();

  const runTest = async (testName: string, testFunction: () => Promise<boolean>) => {
    setTestResults(prev => ({ ...prev, [testName]: 'pending' }));
    try {
      const result = await testFunction();
      setTestResults(prev => ({ ...prev, [testName]: result ? 'pass' : 'fail' }));
    } catch (error) {
      setTestResults(prev => ({ ...prev, [testName]: 'fail' }));
    }
  };

  const testEmailSystem = async () => {
    if (!user) return false;
    const template = emailTemplates.welcome(user.email || 'Test User');
    const result = await sendEmail({
      to: user.email || 'test@example.com',
      subject: template.subject,
      html: template.html,
      type: 'welcome',
      userId: user.id,
    });
    return result;
  };

  const testNotificationSystem = async () => {
    if (!user) return false;
    await createNotification(
      user.id,
      'Test Notification',
      'This is a test notification to verify the system is working',
      'info'
    );
    return true;
  };

  const testFileUpload = async () => {
    // Create a test file
    const testFile = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const result = await uploadFile(testFile, {
      fileType: 'business_document',
      maxSize: 1,
      allowedTypes: ['text/plain'],
    });
    return !!result;
  };

  const testMessaging = async () => {
    if (!user) return false;
    // Send a test message to self (for testing purposes)
    const result = await sendMessage(
      user.id,
      'Test message from system test',
      'text'
    );
    return !!result;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass':
        return <Badge className="bg-green-100 text-green-800">PASS</Badge>;
      case 'fail':
        return <Badge className="bg-red-100 text-red-800">FAIL</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-100 text-yellow-800">RUNNING</Badge>;
      default:
        return <Badge variant="outline">NOT RUN</Badge>;
    }
  };

  const categories = ['Technology', 'Marketing', 'Design', 'Consulting', 'Health', 'Education'];

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <TestTube className="h-6 w-6" />
        <h1 className="text-3xl font-bold">System Testing & Features</h1>
      </div>

      <Tabs defaultValue="testing" className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="testing">System Tests</TabsTrigger>
          <TabsTrigger value="upload">File Upload</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="trading">Trading</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="messaging">Messaging</TabsTrigger>
        </TabsList>

        <TabsContent value="testing">
          <Card>
            <CardHeader>
              <CardTitle>Automated System Tests</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="flex items-center justify-between p-4 border rounded">
                  <div>
                    <h3 className="font-medium">Email System</h3>
                    <p className="text-sm text-gray-600">Test email sending with Resend</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(testResults.email || 'not-run')}
                    <Button 
                      onClick={() => runTest('email', testEmailSystem)}
                      size="sm"
                    >
                      Test
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded">
                  <div>
                    <h3 className="font-medium">Notification System</h3>
                    <p className="text-sm text-gray-600">Test real-time notifications</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(testResults.notifications || 'not-run')}
                    <Button 
                      onClick={() => runTest('notifications', testNotificationSystem)}
                      size="sm"
                    >
                      Test
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded">
                  <div>
                    <h3 className="font-medium">File Upload System</h3>
                    <p className="text-sm text-gray-600">Test file upload to Supabase Storage</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(testResults.upload || 'not-run')}
                    <Button 
                      onClick={() => runTest('upload', testFileUpload)}
                      size="sm"
                    >
                      Test
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 border rounded">
                  <div>
                    <h3 className="font-medium">Messaging System</h3>
                    <p className="text-sm text-gray-600">Test real-time messaging</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(testResults.messaging || 'not-run')}
                    <Button 
                      onClick={() => runTest('messaging', testMessaging)}
                      size="sm"
                    >
                      Test
                    </Button>
                  </div>
                </div>
              </div>

              <Button 
                onClick={() => {
                  runTest('email', testEmailSystem);
                  runTest('notifications', testNotificationSystem);
                  runTest('upload', testFileUpload);
                  runTest('messaging', testMessaging);
                }}
                className="w-full"
              >
                Run All Tests
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="upload">
          <div className="grid gap-6 md:grid-cols-2">
            <FileUpload
              fileType="business_document"
              maxSize={5}
              allowedTypes={['application/pdf', 'image/jpeg', 'image/png']}
              accept=".pdf,.jpg,.jpeg,.png"
              onUploadComplete={(url) => {
                toast({
                  title: "Upload successful",
                  description: `File uploaded: ${url}`,
                });
              }}
            />
            <FileUpload
              fileType="profile_image"
              maxSize={2}
              allowedTypes={['image/jpeg', 'image/png']}
              accept=".jpg,.jpeg,.png"
              onUploadComplete={(url) => {
                toast({
                  title: "Profile image uploaded",
                  description: "Your profile image has been updated",
                });
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <div className="grid gap-6 md:grid-cols-2">
            <NotificationCenter />
            <Card>
              <CardHeader>
                <CardTitle>Test Notifications</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button 
                  onClick={() => user && createNotification(
                    user.id, 
                    'Test Info', 
                    'This is an info notification', 
                    'info'
                  )}
                  variant="outline"
                  className="w-full"
                >
                  Send Info Notification
                </Button>
                <Button 
                  onClick={() => user && createNotification(
                    user.id, 
                    'Test Success', 
                    'This is a success notification', 
                    'success'
                  )}
                  variant="outline"
                  className="w-full"
                >
                  Send Success Notification
                </Button>
                <Button 
                  onClick={() => user && createNotification(
                    user.id, 
                    'Test Warning', 
                    'This is a warning notification', 
                    'warning'
                  )}
                  variant="outline"
                  className="w-full"
                >
                  Send Warning Notification
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trading">
          <TradeSystem />
        </TabsContent>

        <TabsContent value="search">
          <AdvancedSearch
            categories={categories}
            onSearch={(filters) => {
              toast({
                title: "Search executed",
                description: `Searching with filters: ${JSON.stringify(filters)}`,
              });
            }}
          />
        </TabsContent>

        <TabsContent value="analytics">
          <DashboardAnalytics />
        </TabsContent>

        <TabsContent value="messaging">
          <Card>
            <CardHeader>
              <CardTitle>Messaging System Test</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-4">
                The messaging system is integrated. Use the notification center and other components 
                to test real-time messaging functionality.
              </p>
              <Button onClick={() => testMessaging()}>
                Send Test Message
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default TestingPage;
