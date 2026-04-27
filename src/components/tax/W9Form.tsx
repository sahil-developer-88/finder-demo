
import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { FileText, Shield, AlertTriangle, Eye, Download, Loader2, Pen, Trash2 } from "lucide-react";
import { generateFilledW9Pdf, downloadFilledW9Pdf } from '@/utils/w9PdfGenerator';
import SignatureCanvas from 'react-signature-canvas';

interface W9FormData {
  firstName: string;
  middleName?: string;
  lastName: string;
  legalName: string;
  businessName: string;
  businessType: 'individual' | 'soleProprietor' | 'llc' | 'corporation' | 'partnership';
  llcClassification?: 'C' | 'S' | 'P'; // C=C corporation, S=corporation, P=Partnership
  otherBusinessType?: string;
  taxId: string;
  taxIdType: 'ssn' | 'ein';
  address: string;
  city: string;
  state: string;
  zipCode: string;
  accountNumber: string;
  exemptFromBackupWithholding: boolean;
  certificationAgreed: boolean;
  signature?: string;
  signatureDate?: string;
}

interface W9FormProps {
  onSubmit: (data: W9FormData) => void;
  onSkip: () => void;
  isRequired?: boolean;
  initialAddress?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
  };
  initialData?: Partial<W9FormData>;
}

const W9Form: React.FC<W9FormProps> = ({ onSubmit, onSkip, isRequired = true, initialAddress, initialData }) => {
  const signatureRef = useRef<SignatureCanvas>(null);

  // Restore saved signature onto canvas after mount
  // Use requestAnimationFrame to ensure canvas is fully sized before drawing
  useEffect(() => {
    if (!initialData?.signature) return;
    const draw = () => {
      if (!signatureRef.current) return;
      const canvas = signatureRef.current.getCanvas();
      if (!canvas.width || !canvas.height) {
        requestAnimationFrame(draw);
        return;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      };
      img.src = initialData.signature as string;
    };
    requestAnimationFrame(draw);
  }, []);

  const [formData, setFormData] = useState<W9FormData>({
    firstName: initialData?.firstName || '',
    middleName: initialData?.middleName || '',
    lastName: initialData?.lastName || '',
    legalName: initialData?.legalName || '',
    businessName: initialData?.businessName || '',
    businessType: initialData?.businessType || '' as any,
    otherBusinessType: initialData?.otherBusinessType || '',
    taxId: initialData?.taxId || '',
    taxIdType: initialData?.taxIdType || '' as any,
    address: initialData?.address || initialAddress?.street || '',
    city: initialData?.city || initialAddress?.city || '',
    state: initialData?.state || initialAddress?.state || '',
    zipCode: initialData?.zipCode || initialAddress?.zipCode || '',
    accountNumber: initialData?.accountNumber || '',
    exemptFromBackupWithholding: initialData?.exemptFromBackupWithholding || false,
    certificationAgreed: initialData?.certificationAgreed || false,
    signatureDate: initialData?.signatureDate || new Date().toLocaleDateString('en-US'),
    llcClassification: initialData?.llcClassification,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!formData.taxIdType) {
      newErrors.taxIdType = 'Tax ID type is required';
    }

    if (!formData.businessType) {
      newErrors.businessType = 'Federal tax classification is required';
    }

    if (!formData.taxId.trim()) {
      newErrors.taxId = 'Tax ID is required';
    } else {
      const taxIdClean = formData.taxId.replace(/\D/g, '');
      if (taxIdClean.length !== 9) {
        newErrors.taxId = 'Tax ID must be 9 digits';
      }
    }

    // Validate LLC classification if LLC is selected under EIN
    if (formData.businessType === 'llc' && formData.taxIdType === 'ein' && !formData.llcClassification) {
      newErrors.llcClassification = 'LLC tax classification is required';
    }

    if (!formData.address.trim()) {
      newErrors.address = 'Address is required';
    }

    if (!formData.city.trim()) {
      newErrors.city = 'City is required';
    }

    if (!formData.state.trim()) {
      newErrors.state = 'State is required';
    }

    if (!formData.zipCode.trim()) {
      newErrors.zipCode = 'ZIP code is required';
    }

    if (!formData.certificationAgreed) {
      newErrors.certificationAgreed = 'You must agree to the certification';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      setLoading(true);
      try {
        // Capture signature from canvas
        let signatureData = formData.signature;
        if (signatureRef.current && !signatureRef.current.isEmpty()) {
          signatureData = signatureRef.current.toDataURL('image/png');
        }

        await onSubmit({
          ...formData,
          signature: signatureData
        });
      } catch (error) {
        console.error('Error submitting W-9:', error);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleSkip = () => {
    setLoading(true);
    onSkip();
  };

  const handlePreview = async () => {
    // Capture signature from canvas
    let signatureData = formData.signature;
    if (signatureRef.current && !signatureRef.current.isEmpty()) {
      signatureData = signatureRef.current.toDataURL('image/png');
    }

    setGeneratingPdf(true);
    try {
      const url = await generateFilledW9Pdf({
        ...formData,
        signature: signatureData
      });
      setPdfUrl(url);
      setShowPreview(true);
    } catch (error) {
      console.error('Error generating preview:', error);
      setErrors({ preview: 'Failed to generate PDF preview. Please try again.' });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleDownloadPdf = async () => {
    setGeneratingPdf(true);
    try {
      // Capture signature from canvas
      let signatureData = formData.signature;
      if (signatureRef.current && !signatureRef.current.isEmpty()) {
        signatureData = signatureRef.current.toDataURL('image/png');
      }

      await downloadFilledW9Pdf(
        { ...formData, signature: signatureData },
        `w9-${formData.legalName.replace(/\s+/g, '-').toLowerCase()}.pdf`
      );
    } catch (error) {
      console.error('Error downloading PDF:', error);
      setErrors({ download: 'Failed to download PDF' });
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleClearSignature = () => {
    if (signatureRef.current) {
      signatureRef.current.clear();
    }
  };

  const formatTaxId = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    if (formData.taxIdType === 'ein' && cleaned.length >= 2) {
      return cleaned.slice(0, 2) + '-' + cleaned.slice(2, 9);
    }
    if (formData.taxIdType === 'ssn' && cleaned.length >= 3) {
      let formatted = cleaned.slice(0, 3);
      if (cleaned.length >= 5) {
        formatted += '-' + cleaned.slice(3, 5);
        if (cleaned.length >= 9) {
          formatted += '-' + cleaned.slice(5, 9);
        } else if (cleaned.length > 5) {
          formatted += '-' + cleaned.slice(5);
        }
      } else if (cleaned.length > 3) {
        formatted += '-' + cleaned.slice(3);
      }
      return formatted;
    }
    return cleaned;
  };

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-6 w-6" />
          W-9 Tax Information Form
        </CardTitle>
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            This information is required for IRS tax reporting. All data is encrypted and stored securely.
          </AlertDescription>
        </Alert>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Legal Disclosure */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important Tax Notice:</strong> All barter transactions are considered taxable income and are reportable to the IRS. 
              By using this platform, you agree to receive IRS Form 1099-B at year-end if your total barter income exceeds $600.
              You are responsible for reporting all barter income on your tax return.
            </AlertDescription>
          </Alert>

          {/* Name Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="firstName">First Name *</Label>
              <Input
                id="firstName"
                value={formData.firstName}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData(prev => {
                    const combined = [val, prev.middleName, prev.lastName].filter(Boolean).join(' ');
                    return { ...prev, firstName: val, legalName: combined };
                  });
                }}
                placeholder="John"
              />
              {errors.firstName && <p className="text-sm text-red-600 mt-1">{errors.firstName}</p>}
            </div>

            <div>
              <Label htmlFor="middleName">Middle Name</Label>
              <Input
                id="middleName"
                value={formData.middleName || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData(prev => {
                    const combined = [prev.firstName, val, prev.lastName].filter(Boolean).join(' ');
                    return { ...prev, middleName: val, legalName: combined };
                  });
                }}
                placeholder="Michael"
              />
            </div>

            <div>
              <Label htmlFor="lastName">Last Name *</Label>
              <Input
                id="lastName"
                value={formData.lastName}
                onChange={(e) => {
                  const val = e.target.value;
                  setFormData(prev => {
                    const combined = [prev.firstName, prev.middleName, val].filter(Boolean).join(' ');
                    return { ...prev, lastName: val, legalName: combined };
                  });
                }}
                placeholder="Doe"
              />
              {errors.lastName && <p className="text-sm text-red-600 mt-1">{errors.lastName}</p>}
            </div>
          </div>

          <div>
            <Label htmlFor="businessName">Business Name (if different)</Label>
            <Input
              id="businessName"
              value={formData.businessName}
              onChange={(e) => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
              placeholder="ABC Services LLC"
            />
          </div>

          {/* Tax ID Type Selection - FIRST */}
          <div>
            <Label>Tax ID Type *</Label>
            <RadioGroup
              value={formData.taxIdType}
              onValueChange={(value) => {
                const newTaxIdType = value as 'ssn' | 'ein';
                setFormData(prev => ({
                  ...prev,
                  taxIdType: newTaxIdType,
                  taxId: '',
                  // Clear business type and LLC classification when changing tax ID type
                  businessType: '' as any,
                  llcClassification: undefined
                }));
              }}
              className="mt-2"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ssn" id="ssn" />
                <Label htmlFor="ssn">Social Security Number / Single Member LLC</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ein" id="ein" />
                <Label htmlFor="ein">Employer Identification Number</Label>
              </div>
            </RadioGroup>
            {errors.taxIdType && <p className="text-sm text-red-600 mt-1">{errors.taxIdType}</p>}
          </div>

          {/* Business Classification - Shows AFTER Tax ID Type is selected */}
          {formData.taxIdType && (
            <div>
              <Label>Federal Tax Classification *</Label>
              <RadioGroup
                value={formData.businessType}
                onValueChange={(value) => setFormData(prev => ({
                  ...prev,
                  businessType: value as any,
                  llcClassification: value === 'llc' ? prev.llcClassification : undefined
                }))}
                className="mt-2"
              >
                {/* SSN Options - Only show if SSN is selected */}
                {formData.taxIdType === 'ssn' && (
                  <>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="individual" id="individual" />
                      <Label htmlFor="individual">Individual/sole proprietor</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="soleProprietor" id="soleProprietor" />
                      <Label htmlFor="soleProprietor">Single-member LLC</Label>
                    </div>
                  </>
                )}

                {/* EIN Options - Only show if EIN is selected */}
                {formData.taxIdType === 'ein' && (
                  <>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="llc" id="llc" />
                      <Label htmlFor="llc">LLC (multi-member)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="corporation" id="corporation" />
                      <Label htmlFor="corporation">Corporation</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="partnership" id="partnership" />
                      <Label htmlFor="partnership">Partnership</Label>
                    </div>
                  </>
                )}
              </RadioGroup>
              {errors.businessType && <p className="text-sm text-red-600 mt-1">{errors.businessType}</p>}

              {/* LLC Classification - Only show if LLC is selected under EIN */}
              {formData.businessType === 'llc' && formData.taxIdType === 'ein' && (
                <div className="mt-4 pl-6 border-l-2 border-primary">
                  <Label className="text-sm font-medium">LLC Tax Classification *</Label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Select how your LLC is taxed
                  </p>
                  <RadioGroup
                    value={formData.llcClassification || ''}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, llcClassification: value as 'C' | 'S' | 'P' }))}
                    className="mt-2"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="C" id="llc-c" />
                      <Label htmlFor="llc-c">C = corporation</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="S" id="llc-s" />
                      <Label htmlFor="llc-s">S = corporation</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="P" id="llc-p" />
                      <Label htmlFor="llc-p">P = Partnership</Label>
                    </div>
                  </RadioGroup>
                  {errors.llcClassification && <p className="text-sm text-red-600 mt-1">{errors.llcClassification}</p>}
                </div>
              )}
            </div>
          )}

          {/* Tax ID Number Input - Shows AFTER Tax ID Type is selected */}
          {formData.taxIdType && (
            <div>
              <Label htmlFor="taxId">
                {formData.taxIdType === 'ssn' ? 'Social Security Number' : 'Employer ID Number'} *
              </Label>
              <Input
                id="taxId"
                value={formData.taxId}
                onChange={(e) => setFormData(prev => ({ ...prev, taxId: formatTaxId(e.target.value) }))}
                placeholder={formData.taxIdType === 'ssn' ? 'XXX-XX-XXXX' : 'XX-XXXXXXX'}
                maxLength={formData.taxIdType === 'ssn' ? 11 : 10}
              />
              {errors.taxId && <p className="text-sm text-red-600 mt-1">{errors.taxId}</p>}
            </div>
          )}

          {/* Address Information */}
          <div className="space-y-4">
            <div>
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="123 Main Street"
              />
              {errors.address && <p className="text-sm text-red-600 mt-1">{errors.address}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="New York"
                />
                {errors.city && <p className="text-sm text-red-600 mt-1">{errors.city}</p>}
              </div>

              <div>
                <Label htmlFor="state">State *</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))}
                  placeholder="NY"
                  maxLength={2}
                />
                {errors.state && <p className="text-sm text-red-600 mt-1">{errors.state}</p>}
              </div>

              <div>
                <Label htmlFor="zipCode">ZIP Code *</Label>
                <Input
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={(e) => setFormData(prev => ({ ...prev, zipCode: e.target.value }))}
                  placeholder="10001"
                />
                {errors.zipCode && <p className="text-sm text-red-600 mt-1">{errors.zipCode}</p>}
              </div>
            </div>
          </div>

          {/* Account Number */}
          <div>
            <Label htmlFor="accountNumber">Account Number (Optional)</Label>
            <Input
              id="accountNumber"
              value={formData.accountNumber}
              onChange={(e) => setFormData(prev => ({ ...prev, accountNumber: e.target.value }))}
              placeholder="Optional account number for your records"
            />
          </div>

          {/* Backup Withholding */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="exemptFromBackupWithholding"
              checked={formData.exemptFromBackupWithholding}
              onCheckedChange={(checked) => 
                setFormData(prev => ({ ...prev, exemptFromBackupWithholding: !!checked }))
              }
            />
            <Label htmlFor="exemptFromBackupWithholding">
              I am exempt from backup withholding
            </Label>
          </div>

          {/* Certification */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="certificationAgreed"
                checked={formData.certificationAgreed}
                onCheckedChange={(checked) =>
                  setFormData(prev => ({ ...prev, certificationAgreed: !!checked }))
                }
              />
              <Label htmlFor="certificationAgreed" className="text-sm leading-relaxed">
                I certify that: (1) The number shown on this form is my correct taxpayer identification number,
                (2) I am not subject to backup withholding because: (a) I am exempt from backup withholding,
                or (b) I have not been notified by the IRS that I am subject to backup withholding,
                (3) I am a U.S. citizen or other U.S. person, and (4) The FATCA code(s) entered on this form
                (if any) indicating that I am exempt from FATCA reporting is correct. *
              </Label>
            </div>
            {errors.certificationAgreed && (
              <p className="text-sm text-red-600">{errors.certificationAgreed}</p>
            )}
          </div>

          {/* Signature Section */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-semibold flex items-center gap-2">
                <Pen className="h-4 w-4" />
                Signature *
              </Label>
              <p className="text-sm text-gray-600 mt-1">
                Sign below using your mouse or touch screen
              </p>
            </div>

            <div className="border-2 border-gray-300 rounded-lg bg-white">
              <SignatureCanvas
                ref={signatureRef}
                canvasProps={{
                  className: 'w-full h-40 cursor-crosshair',
                  style: { touchAction: 'none' }
                }}
                backgroundColor="white"
              />
            </div>

            <div className="flex justify-between items-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleClearSignature}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Signature
              </Button>

              <div className="flex items-center gap-2">
                <Label htmlFor="signatureDate" className="text-sm">Date:</Label>
                <Input
                  id="signatureDate"
                  type="text"
                  value={formData.signatureDate || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, signatureDate: e.target.value }))}
                  className="w-full sm:w-40"
                  placeholder="MM/DD/YYYY"
                />
              </div>
            </div>
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-between items-center pt-6 gap-3">
            <div className="flex gap-2 ml-auto">
              <Button
                type="button"
                variant="secondary"
                onClick={handlePreview}
                disabled={loading || generatingPdf}
              >
                {generatingPdf ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4 mr-2" />
                    Preview PDF
                  </>
                )}
              </Button>

              <Button
                type="submit"
                disabled={loading || generatingPdf}
              >
                {loading ? (initialData ? 'Updating...' : 'Submitting...') : (initialData ? 'Update' : 'Submit')}
              </Button>
            </div>
          </div>
        </form>
      </CardContent>

      {/* PDF Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-[calc(100vw-2rem)] sm:max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>W-9 Form Preview</DialogTitle>
            <DialogDescription>
              Review your completed W-9 form below. You can download it or go back to make changes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {pdfUrl && (
              <iframe
                src={pdfUrl}
                className="w-full rounded-lg border"
                style={{ height: '600px' }}
                title="W-9 Preview"
              />
            )}

            <div className="flex justify-between">
              <Button
                variant="outline"
                onClick={() => setShowPreview(false)}
              >
                Close
              </Button>

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={handleDownloadPdf}
                  disabled={generatingPdf}
                >
                  {generatingPdf ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </>
                  )}
                </Button>

                <Button onClick={() => {
                  setShowPreview(false);
                  // Optionally submit after preview
                  // handleSubmit(new Event('submit'));
                }}>
                  Continue to Submit
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default W9Form;
