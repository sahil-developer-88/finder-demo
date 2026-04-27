import { PDFDocument, PDFCheckBox, PDFTextField } from 'pdf-lib';

interface W9FormData {
  legalName: string;
  businessName: string;
  businessType: 'individual' | 'soleProprietor' | 'llc' | 'corporation' | 'partnership' | 'other';
  otherBusinessType?: string;
  llcClassification?: string;
  taxId: string;
  taxIdType: 'ssn' | 'ein';
  address: string;
  city: string;
  state: string;
  zipCode: string;
  accountNumber: string;
  exemptFromBackupWithholding: boolean;
  certificationAgreed: boolean;
  signature?: string; // Base64 image data
  signatureDate?: string;
}

/**
 * Fills the W-9 PDF form with the provided data
 * @param formData - The form data to fill into the PDF
 * @returns Promise<string> - Data URL of the filled PDF
 */
export async function generateFilledW9Pdf(formData: W9FormData): Promise<string> {
  try {
    // Load the blank W-9 PDF
    const pdfUrl = '/assets/forms/fw9.pdf';
    const existingPdfBytes = await fetch(pdfUrl).then(res => res.arrayBuffer());

    // Load the PDF with pdf-lib
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // Get the form from the PDF
    const form = pdfDoc.getForm();

    // Helper function to safely set text field
    const setTextField = (fieldName: string, value: string) => {
      try {
        const field = form.getTextField(fieldName);
        field.setText(value || '');
        return true;
      } catch (error) {
        return false;
      }
    };

    // Helper to try multiple field name variations
    const setTextFieldMultiple = (fieldNames: string[], value: string) => {
      for (const name of fieldNames) {
        if (setTextField(name, value)) {
          return true;
        }
      }
      return false;
    };

    // Helper function to safely set checkbox
    const setCheckBox = (fieldName: string, checked: boolean) => {
      try {
        const field = form.getCheckBox(fieldName);
        if (checked) {
          field.check();
        } else {
          field.uncheck();
        }
        return true;
      } catch (error) {
        return false;
      }
    };

    // Helper to try multiple checkbox variations
    const setCheckBoxMultiple = (fieldNames: string[], checked: boolean) => {
      for (const name of fieldNames) {
        if (setCheckBox(name, checked)) {
          return true;
        }
      }
      return false;
    };

    // Line 1: Name (Legal name)
    setTextField('topmostSubform[0].Page1[0].f1_01[0]', formData.legalName);

    // Line 2: Business name/disregarded entity name
    if (formData.businessName) {
      setTextField('topmostSubform[0].Page1[0].f1_02[0]', formData.businessName);
    }

    // Line 3: Federal tax classification (checkboxes)
    // c1_1[0] = Individual/sole proprietor or single-member LLC
    // c1_1[1] = C Corporation
    // c1_1[2] = S Corporation
    // c1_1[3] = Partnership
    // c1_1[4] = Trust/estate
    // c1_1[5] = Limited Liability Company
    // c1_1[6] = Other
    switch (formData.businessType) {
      case 'individual':
      case 'soleProprietor':
        setCheckBox('topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[0]', true);
        break;
      case 'llc':
        setCheckBox('topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[5]', true);
        if (formData.otherBusinessType) {
          setTextField('topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].f1_03[0]', formData.otherBusinessType);
        }
        break;
      case 'corporation':
        // Defaulting to C Corporation
        setCheckBox('topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[1]', true);
        break;
      case 'partnership':
        setCheckBox('topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[3]', true);
        break;
      case 'other':
        setCheckBox('topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_1[6]', true);
        if (formData.otherBusinessType) {
          setTextField('topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].f1_04[0]', formData.otherBusinessType);
        }
        break;
    }

    // Line 4: Exemptions - Exemption from FATCA reporting (usually blank)
    // setTextField('topmostSubform[0].Page1[0].f1_05[0]', ''); // Payee code
    // setTextField('topmostSubform[0].Page1[0].f1_06[0]', ''); // FATCA exemption

    // Line 5 & 6: Address
    setTextField('topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_07[0]', formData.address);

    // City, State, ZIP
    const cityStateZip = `${formData.city}, ${formData.state} ${formData.zipCode}`;
    setTextField('topmostSubform[0].Page1[0].Address_ReadOrder[0].f1_08[0]', cityStateZip);

    // Line 7: List account numbers (optional)
    if (formData.accountNumber) {
      setTextField('topmostSubform[0].Page1[0].f1_09[0]', formData.accountNumber);
    }

    // Part I: Taxpayer Identification Number (TIN)
    const taxIdClean = formData.taxId.replace(/\D/g, ''); // Remove all non-digits

    if (formData.taxIdType === 'ssn') {
      // Social Security Number (XXX-XX-XXXX)
      if (taxIdClean.length === 9) {
        const ssnPart1 = taxIdClean.substring(0, 3);
        const ssnPart2 = taxIdClean.substring(3, 5);
        const ssnPart3 = taxIdClean.substring(5, 9);

        setTextField('topmostSubform[0].Page1[0].f1_11[0]', ssnPart1);
        setTextField('topmostSubform[0].Page1[0].f1_12[0]', ssnPart2);
        setTextField('topmostSubform[0].Page1[0].f1_13[0]', ssnPart3);
      }
    } else if (formData.taxIdType === 'ein') {
      // Employer Identification Number (XX-XXXXXXX)
      if (taxIdClean.length === 9) {
        const einPart1 = taxIdClean.substring(0, 2);
        const einPart2 = taxIdClean.substring(2, 9);

        setTextField('topmostSubform[0].Page1[0].f1_14[0]', einPart1);
        setTextField('topmostSubform[0].Page1[0].f1_15[0]', einPart2);
      }
    }

    // Part II: Certification
    // Note: The certification checkbox is c1_2[0] based on the field list
    if (formData.certificationAgreed) {
      setCheckBox('topmostSubform[0].Page1[0].Boxes3a-b_ReadOrder[0].c1_2[0]', true);
    }

    // Signature field - try to set as text field first, then embed as image
    if (formData.signature) {
      // Try to find and fill signature text field (if it exists)
      const signatureFieldNames = [
        'topmostSubform[0].Page1[0].f1_16[0]',
        'topmostSubform[0].Page1[0].signature[0]',
        'signature',
        'f1_16'
      ];

      let signatureFieldFound = false;
      for (const fieldName of signatureFieldNames) {
        try {
          const field = form.getTextField(fieldName);
          field.setText('Digitally Signed');
          signatureFieldFound = true;
          break;
        } catch {
          // Field not found, continue
        }
      }

      // If no text field, embed signature as image
      if (!signatureFieldFound) {
        try {
          // Convert base64 to image bytes
          const base64Data = formData.signature.split(',')[1] || formData.signature;
          const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

          // Embed the PNG image
          const signatureImage = await pdfDoc.embedPng(imageBytes);

          // Get the first page
          const pages = pdfDoc.getPages();
          const firstPage = pages[0];
          const { width: pageWidth, height: pageHeight } = firstPage.getSize();

          // Draw signature image at W-9 signature location
          // W-9 signature line is in Part II, typically around 1/4 from bottom
          // Coordinates are from bottom-left: (x, y) where y=0 is bottom
          const signatureWidth = 120;
          const signatureHeight = 16;
          const signatureX = 130;
          const signatureY = 200;

          firstPage.drawImage(signatureImage, {
            x: signatureX,
            y: signatureY,
            width: signatureWidth,
            height: signatureHeight,
          });
        } catch (error) {
          console.error('Failed to embed signature image:', error);
        }
      }
    }

    // Date - draw as text on PDF at specific position
    if (formData.signatureDate) {
      try {
        const pages = pdfDoc.getPages();
        const firstPage = pages[0];

        // Date position specified by user
        const dateX = 450;
        const dateY = 195;
        const fontSize = 10;

        firstPage.drawText(formData.signatureDate, {
          x: dateX,
          y: dateY,
          size: fontSize,
        });
      } catch (error) {
        console.error('Failed to draw date:', error);
      }
    }

    // Note: There doesn't appear to be a specific backup withholding checkbox in this PDF
    // That would typically be on Part II of the form which may not be in this version

    // Flatten the form (make it non-editable)
    // Uncomment this if you want the PDF to be read-only
    // form.flatten();

    // Save the PDF
    const pdfBytes = await pdfDoc.save();

    // Convert to Blob and create data URL
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
    const dataUrl = URL.createObjectURL(blob);

    return dataUrl;

  } catch (error) {
    console.error('Error generating W-9 PDF:', error);
    throw new Error(`Failed to generate W-9 PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Downloads the filled W-9 PDF
 * @param formData - The form data to fill into the PDF
 * @param fileName - Optional filename for the download
 */
export async function downloadFilledW9Pdf(
  formData: W9FormData,
  fileName: string = 'w9-form.pdf'
): Promise<void> {
  try {
    const dataUrl = await generateFilledW9Pdf(formData);

    // Create a temporary link and trigger download
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Clean up the object URL after a delay
    setTimeout(() => URL.revokeObjectURL(dataUrl), 100);
  } catch (error) {
    console.error('Error downloading W-9 PDF:', error);
    throw error;
  }
}
