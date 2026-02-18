import { ValidationError } from '../../../shared/utils';

export interface PassportVerificationResult {
  success: boolean;
  data?: {
    firstName: string;
    lastName: string;
    dateOfBirth: string;
    passportNumber: string;
    nationality: string;
    email?: string;
    phoneNumber?: string;
  };
  message: string;
  error?: string;
}

export class PassportVerificationService {
  async verifyPassport(passportDocumentUrl: string): Promise<PassportVerificationResult> {
    if (!passportDocumentUrl) {
      throw new ValidationError('Passport document URL is required');
    }

    try {
      // TODO: Replace with actual document verification service integration
      // This would typically involve:
      // 1. OCR to extract text from passport image/PDF
      // 2. Validate passport format and security features
      // 3. Verify with immigration database if available
      // 4. Extract and structure the data

      const result = await this.mockPassportVerification(passportDocumentUrl);

      return result;
    } catch (error: any) {
      console.error('Passport verification error:', error);
      return {
        success: false,
        message: 'Passport verification failed',
        error: error.message,
      };
    }
  }

  private async mockPassportVerification(documentUrl: string): Promise<PassportVerificationResult> {
    // Simulate OCR and verification delay
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Generate dynamic user data based on document URL
    // This ensures each unique document URL generates consistent but unique data
    const timestamp = Date.now();
    const urlHash = documentUrl.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

    const firstNames = ['John', 'Maria', 'Wei', 'Ahmed', 'Sophie', 'Raj', 'Elena', 'Kwame', 'Yuki', 'Carlos'];
    const lastNames = ['Smith', 'Garcia', 'Zhang', 'Al-Fayed', 'Dubois', 'Patel', 'Rossi', 'Osei', 'Tanaka', 'Silva'];

    const nationalities = [
      { name: 'United Kingdom', prefix: 'GB', phoneCode: '+44' },
      { name: 'Spain', prefix: 'ES', phoneCode: '+34' },
      { name: 'China', prefix: 'CN', phoneCode: '+86' },
      { name: 'United Arab Emirates', prefix: 'AE', phoneCode: '+971' },
      { name: 'France', prefix: 'FR', phoneCode: '+33' },
      { name: 'India', prefix: 'IN', phoneCode: '+91' },
      { name: 'Italy', prefix: 'IT', phoneCode: '+39' },
      { name: 'Ghana', prefix: 'GH', phoneCode: '+233' },
      { name: 'Japan', prefix: 'JP', phoneCode: '+81' },
      { name: 'Brazil', prefix: 'BR', phoneCode: '+55' },
    ];

    const firstNameIndex = urlHash % firstNames.length;
    const lastNameIndex = (urlHash * 2) % lastNames.length;
    const nationalityIndex = urlHash % nationalities.length;

    const firstName = firstNames[firstNameIndex];
    const lastName = lastNames[lastNameIndex];
    const nationality = nationalities[nationalityIndex];

    // Generate unique email using timestamp
    const emailPrefix = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${String(timestamp).slice(-9)}`;
    const email = `${emailPrefix}@yopmail.com`;

    // Generate unique passport number using nationality prefix and timestamp
    const passportNumber = `${nationality.prefix}${String(timestamp).slice(-8)}`;

    // Generate unique phone number
    const phoneDigits = String(timestamp).slice(-9);
    const phoneNumber = `${nationality.phoneCode}${phoneDigits}`;

    // Generate date of birth (between 18 and 70 years old)
    const age = 18 + (urlHash % 52);
    const year = new Date().getFullYear() - age;
    const month = String(1 + (urlHash % 12)).padStart(2, '0');
    const day = String(1 + (urlHash % 28)).padStart(2, '0');
    const dateOfBirth = `${year}-${month}-${day}`;

    const passportData = {
      firstName,
      lastName,
      dateOfBirth,
      passportNumber,
      nationality: nationality.name,
      email,
      phoneNumber,
    };

    return {
      success: true,
      data: passportData,
      message: 'Passport verified successfully',
    };
  }

  /**
   * Production implementation would look like this:
   *
   * private async callDocumentVerificationService(documentUrl: string): Promise<PassportVerificationResult> {
   *   const apiUrl = process.env.DOCUMENT_SERVICE_URL;
   *
   *   // Step 1: Upload document for OCR processing
   *   const response = await fetch(`${apiUrl}/verify/passport`, {
   *     method: 'POST',
   *     headers: {
   *       'Content-Type': 'application/json',
   *       'Authorization': `Bearer ${process.env.DOCUMENT_SERVICE_API_KEY}`,
   *     },
   *     body: JSON.stringify({
   *       documentUrl,
   *       verificationType: 'PASSPORT',
   *     }),
   *   });
   *
   *   if (!response.ok) {
   *     throw new Error('Document verification failed');
   *   }
   *
   *   const result = await response.json();
   *
   *   // Step 2: Extract structured data from OCR result
   *   return {
   *     success: result.status === 'VERIFIED',
   *     data: result.extractedData,
   *     message: result.message,
   *   };
   * }
   *
   * // Alternative: Use existing document-service
   * private async useExistingDocumentService(documentUrl: string, userId: string): Promise<string> {
   *   // Call the document-service verification.service.ts
   *   // This would create a VerificationRequest and process it
   *
   *   const verificationRequest = await fetch(`${DOCUMENT_SERVICE_URL}/api/verify`, {
   *     method: 'POST',
   *     headers: { 'Content-Type': 'application/json' },
   *     body: JSON.stringify({
   *       userId,
   *       documentUrl,
   *       verificationType: 'PASSPORT',
   *       transactionId: generateId(), // or null for signup
   *     }),
   *   });
   *
   *   const { verificationId } = await verificationRequest.json();
   *   return verificationId;
   * }
   */
}

export default new PassportVerificationService();
