import { v2 as cloudinary } from 'cloudinary';
import { createLogger } from './logger';

const logger = createLogger('Cloudinary');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface UploadOptions {
  folder?: string;
  resourceType?: 'image' | 'raw' | 'video' | 'auto';
  allowedFormats?: string[];
  maxFileSize?: number; // in bytes
  transformation?: any;
}

export interface UploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  format: string;
  resourceType: string;
  bytes: number;
  width?: number;
  height?: number;
}

/**
 * Upload a file to Cloudinary
 */
export async function uploadToCloudinary(
  fileBuffer: Buffer,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const {
    folder = 'documents',
    resourceType = 'auto',
    allowedFormats = ['jpg', 'jpeg', 'png', 'pdf'],
    maxFileSize = 10 * 1024 * 1024, // 10MB default
  } = options;

  // Check file size
  if (fileBuffer.length > maxFileSize) {
    throw new Error(`File size exceeds maximum allowed size of ${maxFileSize / (1024 * 1024)}MB`);
  }

  try {
    logger.info('Uploading file to Cloudinary', {
      folder,
      resourceType,
      size: fileBuffer.length,
    });

    // Upload to Cloudinary using upload_stream
    const result = await new Promise<any>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: resourceType,
          allowed_formats: allowedFormats,
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );

      uploadStream.end(fileBuffer);
    });

    logger.info('File uploaded successfully to Cloudinary', {
      publicId: result.public_id,
      url: result.secure_url,
    });

    return {
      url: result.url,
      secureUrl: result.secure_url,
      publicId: result.public_id,
      format: result.format,
      resourceType: result.resource_type,
      bytes: result.bytes,
      width: result.width,
      height: result.height,
    };
  } catch (error) {
    logger.error('Failed to upload file to Cloudinary', error);
    throw new Error(`Failed to upload file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete a file from Cloudinary
 */
export async function deleteFromCloudinary(publicId: string, resourceType: 'image' | 'raw' | 'video' = 'image'): Promise<void> {
  try {
    logger.info('Deleting file from Cloudinary', { publicId });
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    logger.info('File deleted successfully from Cloudinary', { publicId });
  } catch (error) {
    logger.error('Failed to delete file from Cloudinary', error);
    throw new Error(`Failed to delete file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get Cloudinary URL for a public ID
 */
export function getCloudinaryUrl(publicId: string, options: any = {}): string {
  return cloudinary.url(publicId, options);
}

/**
 * Check if Cloudinary is configured
 */
export function isCloudinaryConfigured(): boolean {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
}

export default {
  upload: uploadToCloudinary,
  delete: deleteFromCloudinary,
  getUrl: getCloudinaryUrl,
  isConfigured: isCloudinaryConfigured,
};
