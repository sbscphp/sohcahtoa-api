import { ValidationError, validateBvn } from '../../../shared/utils';

export interface BvnVerificationResult {
  success: boolean;
  data?: {
    firstName: string;
    lastName: string;
    middleName?: string;
    dateOfBirth: string;
    phoneNumber: string;
    email?: string;
    address?: string;
    gender?: string;
    nationality?: string;
  };
  message: string;
  error?: string;
}

export class BvnService {
  async verifyBvn(bvn: string): Promise<BvnVerificationResult> {
    // Validate BVN format
    if (!validateBvn(bvn)) {
      throw new ValidationError('Invalid BVN format. BVN must be 11 digits');
    }

    try {
      // TODO: Replace with actual CBN TRMS API integration
      // This is a mock implementation for development
      const mockBvnData = await this.mockBvnVerification(bvn);

      if (!mockBvnData.success) {
        return {
          success: false,
          message: mockBvnData.message,
          error: mockBvnData.error,
        };
      }

      return {
        success: true,
        data: mockBvnData.data,
        message: 'BVN verified successfully',
      };
    } catch (error: any) {
      console.error('BVN verification error:', error);
      return {
        success: false,
        message: 'BVN verification failed',
        error: error.message,
      };
    }
  }

  private async mockBvnVerification(bvn: string): Promise<BvnVerificationResult> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Generate dynamic user data based on BVN
    // This ensures each BVN generates consistent but unique data
    const timestamp = Date.now();
    const bvnHash = parseInt(bvn.slice(-6)); // Use last 6 digits for variation

    const firstNames = ['Chinedu', 'Amina', 'Tunde', 'Aisha', 'Oluwaseun', 'Fatima', 'Emeka', 'Zainab', 'Adebayo', 'Hauwa'];
    const lastNames = ['Okafor', 'Ibrahim', 'Adeyemi', 'Bello', 'Eze', 'Musa', 'Nwosu', 'Yusuf', 'Okoro', 'Sani'];
    const middleNames = ['Emmanuel', 'Mohammed', 'Oluwaseun', 'Ahmed', 'Chukwuemeka', 'Abubakar', 'Oluwakemi', 'Hassan'];
    const genders = ['Male', 'Female'];
    const cities = [
      { city: 'Lagos', street: 'Victoria Island' },
      { city: 'Abuja', street: 'Wuse' },
      { city: 'Port Harcourt', street: 'GRA' },
      { city: 'Kano', street: 'Sabon Gari' },
      { city: 'Ibadan', street: 'Bodija' },
    ];

    const firstNameIndex = bvnHash % firstNames.length;
    const lastNameIndex = (bvnHash * 2) % lastNames.length;
    const middleNameIndex = (bvnHash * 3) % middleNames.length;
    const genderIndex = bvnHash % genders.length;
    const cityIndex = bvnHash % cities.length;

    const firstName = firstNames[firstNameIndex];
    const lastName = lastNames[lastNameIndex];
    const middleName = middleNames[middleNameIndex];
    const gender = genders[genderIndex];
    const location = cities[cityIndex];

    // Generate unique email using timestamp
    const emailPrefix = `${firstName.toLowerCase()}.${lastName.toLowerCase()}.${timestamp}`;
    const email = `${emailPrefix}@example.com`;

    // Generate unique phone number
    const phoneNumber = `+234${800 + (bvnHash % 100)}${String(timestamp).slice(-7)}`;

    // Generate date of birth (between 18 and 65 years old)
    const age = 18 + (bvnHash % 47);
    const year = new Date().getFullYear() - age;
    const month = String(1 + (bvnHash % 12)).padStart(2, '0');
    const day = String(1 + (bvnHash % 28)).padStart(2, '0');
    const dateOfBirth = `${year}-${month}-${day}`;

    // Generate address
    const streetNumber = 1 + (bvnHash % 999);
    const address = `${streetNumber} ${location.street} Street, ${location.city}`;

    const bvnData = {
      firstName,
      lastName,
      middleName,
      dateOfBirth,
      phoneNumber,
      email,
      address,
      gender,
      nationality: 'Nigerian',
    };

    return {
      success: true,
      data: bvnData,
      message: 'BVN verified successfully',
    };
  }

  /**
   * Production implementation would look like this:
   *
   * private async callCbnTrmsApi(bvn: string, phone: string): Promise<BvnVerificationResult> {
   *   const apiUrl = process.env.CBN_TRMS_API_URL;
   *   const apiKey = process.env.CBN_TRMS_API_KEY;
   *
   *   const response = await fetch(`${apiUrl}/verify-bvn`, {
   *     method: 'POST',
   *     headers: {
   *       'Content-Type': 'application/json',
   *       'Authorization': `Bearer ${apiKey}`,
   *     },
   *     body: JSON.stringify({ bvn, phone }),
   *   });
   *
   *   if (!response.ok) {
   *     throw new Error('BVN verification failed');
   *   }
   *
   *   const data = await response.json();
   *   return {
   *     success: data.verified,
   *     data: data.customerInfo,
   *     message: data.message,
   *   };
   * }
   */
}

export default new BvnService();
