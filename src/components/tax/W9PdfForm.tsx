import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileText, Shield, AlertTriangle, Loader2 } from "lucide-react";
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker - use local bundled worker
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

interface W9FormData {
  legalName: string;
  businessName: string;
  businessType: 'individual' | 'soleProprietor' | 'llc' | 'corporation' | 'partnership';
  llcClassification?: 'C' | 'S' | 'P'; // C=C corporation, S=S corporation, P=Partnership
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

interface W9PdfFormProps {
  onSubmit: (data: W9FormData) => Promise<void>;
  onSkip: () => void;
  isRequired?: boolean;
}

const W9PdfForm: React.FC<W9PdfFormProps> = ({ onSubmit, onSkip, isRequired = false }) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  };

  const onDocumentLoadError = (error: Error) => {
    setError(`Failed to load W-9 form: ${error.message}.`);
    setLoading(false);
  };

  const extractFormData = (): W9FormData => {
    // Get all form input elements from the annotation layer
    const annotationLayer = document.querySelector('.react-pdf__Page__annotations');
    if (!annotationLayer) {
      throw new Error('Could not find form fields');
    }

    const inputs = annotationLayer.querySelectorAll<HTMLInputElement>('input, textarea');
    const fieldValues: Record<string, any> = {};

    inputs.forEach((input) => {
      const fieldName = input.name || input.getAttribute('data-annotation-id') || '';
      if (fieldName) {
        if (input.type === 'checkbox') {
          fieldValues[fieldName] = input.checked;
        } else if (input.type === 'radio') {
          if (input.checked) {
            fieldValues[fieldName] = input.value;
          }
        } else {
          fieldValues[fieldName] = input.value;
        }
      }
    });

    // Map to W9FormData structure
    // Note: These field names will need to be adjusted based on actual PDF field names
    return {
      legalName: fieldValues['f1_1'] || fieldValues['topmostSubform[0].Page1[0].f1_1[0]'] || '',
      businessName: fieldValues['f1_2'] || fieldValues['topmostSubform[0].Page1[0].f1_2[0]'] || '',
      businessType: 'individual', // Map from radio buttons
      otherBusinessType: '',
      taxId: combineFields(fieldValues, 'ssn') || combineFields(fieldValues, 'ein'),
      taxIdType: fieldValues['f1_11'] ? 'ssn' : 'ein',
      address: fieldValues['f1_7'] || fieldValues['topmostSubform[0].Page1[0].Address[0].f1_7[0]'] || '',
      city: extractCity(fieldValues),
      state: extractState(fieldValues),
      zipCode: extractZip(fieldValues),
      accountNumber: fieldValues['account_number'] || '',
      exemptFromBackupWithholding: fieldValues['backup_withholding'] === true,
      certificationAgreed: true // Assume agreed when submitting
    };
  };

  const combineFields = (fields: Record<string, any>, type: 'ssn' | 'ein'): string => {
    if (type === 'ssn') {
      const part1 = fields['f1_11'] || fields['SSN[0].f1_11[0]'] || '';
      const part2 = fields['f1_12'] || fields['SSN[0].f1_12[0]'] || '';
      const part3 = fields['f1_13'] || fields['SSN[0].f1_13[0]'] || '';
      if (!part1 && !part2 && !part3) return '';
      return `${part1}-${part2}-${part3}`;
    } else {
      const part1 = fields['f1_14'] || fields['EmployerID[0].f1_14[0]'] || '';
      const part2 = fields['f1_15'] || fields['EmployerID[0].f1_15[0]'] || '';
      if (!part1 && !part2) return '';
      return `${part1}-${part2}`;
    }
  };

  const extractCity = (fields: Record<string, any>): string => {
    const cityStateZip = fields['f1_8'] || fields['topmostSubform[0].Page1[0].Address[0].f1_8[0]'] || '';
    return cityStateZip.split(',')[0]?.trim() || '';
  };

  const extractState = (fields: Record<string, any>): string => {
    const cityStateZip = fields['f1_8'] || fields['topmostSubform[0].Page1[0].Address[0].f1_8[0]'] || '';
    const statePart = cityStateZip.split(',')[1]?.trim() || '';
    return statePart.split(' ')[0] || '';
  };

  const extractZip = (fields: Record<string, any>): string => {
    const cityStateZip = fields['f1_8'] || fields['topmostSubform[0].Page1[0].Address[0].f1_8[0]'] || '';
    return cityStateZip.split(' ').pop() || '';
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      setError('');

      // Extract data from filled PDF
      const formData = extractFormData();

      // Basic validation
      if (!formData.legalName || !formData.taxId) {
        setError('Please fill in all required fields (Legal Name and Tax ID)');
        setSubmitting(false);
        return;
      }

      // Submit data
      await onSubmit(formData);
    } catch (err: any) {
      setError(err.message || 'Failed to submit form');
      setSubmitting(false);
    }
  };

  const handleSkip = () => {
    setSubmitting(true);
    onSkip();
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
            Fill out the official IRS W-9 form below. Click directly on the form fields to enter your information.
          </AlertDescription>
        </Alert>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Legal Disclosure */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Important Tax Notice:</strong> All barter transactions are considered taxable income and are reportable to the IRS.
          </AlertDescription>
        </Alert>

        {loading && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin mr-2" />
            <p>Loading W-9 form...</p>
          </div>
        )}

        {/* PDF Viewer with react-pdf */}
        <div className="border rounded-lg overflow-auto bg-gray-50 p-4">
          <Document
            file="/assets/forms/fw9.pdf"
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            }
          >
            <Page
              pageNumber={pageNumber}
              renderAnnotationLayer={true}
              renderTextLayer={true}
              width={750}
            />
          </Document>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Instructions */}
        {!loading && !error && (
          <Alert>
            <FileText className="h-4 w-4" />
            <AlertDescription>
              <strong>How to fill:</strong> Click directly on the white boxes in the form above to type. The form fields are interactive.
            </AlertDescription>
          </Alert>
        )}

        {/* Submit Buttons */}
        <div className="flex justify-between pt-6">
          {!isRequired && (
            <Button
              type="button"
              variant="outline"
              onClick={handleSkip}
              disabled={submitting}
            >
              Skip for Now
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            className="ml-auto"
            disabled={submitting || loading}
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit W-9 Information'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default W9PdfForm;
