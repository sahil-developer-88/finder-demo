
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, MessageSquare, Package, Clock, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface InquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  merchantName: string;
  businessName: string;
  availableServices: string[];
  preselectedService?: string;
  pricedItems?: Array<{
    name: string;
    price: number;
    points: number;
    description?: string;
  }>;
}

const InquiryModal: React.FC<InquiryModalProps> = ({
  isOpen,
  onClose,
  merchantName,
  businessName,
  availableServices,
  preselectedService,
  pricedItems = []
}) => {
  const [activeTab, setActiveTab] = useState("request");
  const [serviceRequest, setServiceRequest] = useState({
    service: preselectedService || '',
    customService: '',
    description: '',
    timeline: '',
    budget: '',
    contactInfo: ''
  });

  React.useEffect(() => {
    if (isOpen) {
      setServiceRequest(prev => ({ ...prev, service: preselectedService || '' }));
    }
  }, [isOpen, preselectedService]);
  const [directPurchase, setDirectPurchase] = useState({
    selectedItems: [] as Array<{name: string, price: number, points: number, quantity: number}>,
    customerInfo: {
      name: '',
      email: '',
      phone: ''
    }
  });
  const { toast } = useToast();

  const handleServiceRequest = () => {
    toast({
      title: "Service Request Sent",
      description: `Your request has been sent to ${merchantName}. They will contact you soon.`,
    });
    onClose();
  };

  const handleDirectPurchase = () => {
    toast({
      title: "Purchase Request Sent",
      description: "Your purchase request has been submitted. You'll receive confirmation shortly.",
    });
    onClose();
  };

  const addToCart = (item: any) => {
    const existingItem = directPurchase.selectedItems.find(i => i.name === item.name);
    if (existingItem) {
      setDirectPurchase(prev => ({
        ...prev,
        selectedItems: prev.selectedItems.map(i => 
          i.name === item.name ? { ...i, quantity: i.quantity + 1 } : i
        )
      }));
    } else {
      setDirectPurchase(prev => ({
        ...prev,
        selectedItems: [...prev.selectedItems, { ...item, quantity: 1 }]
      }));
    }
  };

  const removeFromCart = (itemName: string) => {
    setDirectPurchase(prev => ({
      ...prev,
      selectedItems: prev.selectedItems.filter(i => i.name !== itemName)
    }));
  };

  const getTotalCost = () => {
    return directPurchase.selectedItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const getTotalPoints = () => {
    return directPurchase.selectedItems.reduce((total, item) => total + (item.points * item.quantity), 0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Contact {businessName}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="request" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Request Service
            </TabsTrigger>
            <TabsTrigger value="purchase" className="flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Direct Purchase
            </TabsTrigger>
          </TabsList>

          <TabsContent value="request" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label htmlFor="service">Select Service</Label>
                <Select 
                  value={serviceRequest.service} 
                  onValueChange={(value) => setServiceRequest(prev => ({ ...prev, service: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a service or select 'Custom'" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableServices.map(service => (
                      <SelectItem key={service} value={service}>{service}</SelectItem>
                    ))}
                    <SelectItem value="custom">Custom Service Request</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {serviceRequest.service === 'custom' && (
                <div>
                  <Label htmlFor="customService">Custom Service Description</Label>
                  <Input
                    id="customService"
                    value={serviceRequest.customService}
                    onChange={(e) => setServiceRequest(prev => ({ ...prev, customService: e.target.value }))}
                    placeholder="Describe the service you need..."
                  />
                </div>
              )}

              <div>
                <Label htmlFor="description">Project Details</Label>
                <Textarea
                  id="description"
                  value={serviceRequest.description}
                  onChange={(e) => setServiceRequest(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Provide more details about your project requirements..."
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="timeline">Timeline</Label>
                  <Select 
                    value={serviceRequest.timeline} 
                    onValueChange={(value) => setServiceRequest(prev => ({ ...prev, timeline: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="When do you need this?" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asap">ASAP</SelectItem>
                      <SelectItem value="1-week">Within 1 week</SelectItem>
                      <SelectItem value="2-weeks">Within 2 weeks</SelectItem>
                      <SelectItem value="1-month">Within 1 month</SelectItem>
                      <SelectItem value="flexible">Flexible</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="budget">Budget Range</Label>
                  <Input
                    id="budget"
                    value={serviceRequest.budget}
                    onChange={(e) => setServiceRequest(prev => ({ ...prev, budget: e.target.value }))}
                    placeholder="e.g., $500-1000"
                  />
                </div>

                <div>
                  <Label htmlFor="contactInfo">Your Contact Info</Label>
                  <Input
                    id="contactInfo"
                    value={serviceRequest.contactInfo}
                    onChange={(e) => setServiceRequest(prev => ({ ...prev, contactInfo: e.target.value }))}
                    placeholder="Email or phone"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button onClick={handleServiceRequest}>
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Send Request
                </Button>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="purchase" className="space-y-4">
            {pricedItems.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center">
                  <Package className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">No Direct Purchase Items</h3>
                  <p className="text-gray-500">This merchant doesn't have items available for direct purchase. Try requesting a custom service instead.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Available Items */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Available Items</h3>
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {pricedItems.map((item, index) => (
                      <Card key={index}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium">{item.name}</h4>
                            <div className="text-right">
                              <div className="font-semibold">${item.price}</div>
                              <Badge variant="secondary" className="text-xs">
                                {item.points} pts
                              </Badge>
                            </div>
                          </div>
                          {item.description && (
                            <p className="text-sm text-gray-600 mb-3">{item.description}</p>
                          )}
                          <Button 
                            size="sm" 
                            onClick={() => addToCart(item)}
                            className="w-full"
                          >
                            <ShoppingCart className="h-4 w-4 mr-2" />
                            Add to Cart
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Shopping Cart */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg">Your Cart</h3>
                  {directPurchase.selectedItems.length === 0 ? (
                    <Card>
                      <CardContent className="p-6 text-center">
                        <ShoppingCart className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                        <p className="text-gray-500">Your cart is empty</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {directPurchase.selectedItems.map((item, index) => (
                        <Card key={index}>
                          <CardContent className="p-3">
                            <div className="flex justify-between items-center">
                              <div className="flex-1">
                                <h5 className="font-medium">{item.name}</h5>
                                <p className="text-sm text-gray-600">
                                  ${item.price} × {item.quantity} = ${item.price * item.quantity}
                                </p>
                              </div>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => removeFromCart(item.name)}
                              >
                                Remove
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}

                      <Card className="bg-green-50 border-green-200">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-semibold">Total:</span>
                            <div className="text-right">
                              <div className="font-semibold text-lg">${getTotalCost()}</div>
                              <Badge className="bg-green-600">
                                {getTotalPoints()} points
                              </Badge>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Customer Info */}
                      <div className="space-y-3">
                        <h4 className="font-medium">Your Information</h4>
                        <div className="grid grid-cols-1 gap-3">
                          <Input
                            placeholder="Full Name"
                            value={directPurchase.customerInfo.name}
                            onChange={(e) => setDirectPurchase(prev => ({
                              ...prev,
                              customerInfo: { ...prev.customerInfo, name: e.target.value }
                            }))}
                          />
                          <Input
                            placeholder="Email"
                            type="email"
                            value={directPurchase.customerInfo.email}
                            onChange={(e) => setDirectPurchase(prev => ({
                              ...prev,
                              customerInfo: { ...prev.customerInfo, email: e.target.value }
                            }))}
                          />
                          <Input
                            placeholder="Phone (optional)"
                            value={directPurchase.customerInfo.phone}
                            onChange={(e) => setDirectPurchase(prev => ({
                              ...prev,
                              customerInfo: { ...prev.customerInfo, phone: e.target.value }
                            }))}
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={onClose}>Cancel</Button>
                        <Button 
                          onClick={handleDirectPurchase}
                          disabled={!directPurchase.customerInfo.name || !directPurchase.customerInfo.email}
                        >
                          <ShoppingCart className="h-4 w-4 mr-2" />
                          Submit Purchase Request
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default InquiryModal;
