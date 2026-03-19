import { v2 as cloudinary, UploadApiResponse, UploadApiOptions } from 'cloudinary';
import { createLogger } from './logger';

const logger = createLogger('CloudinaryService');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

function assertCloudinaryConfigured(): void {
  if (
    !process.env.CLOUDINARY_CLOUD_NAME ||
    !process.env.CLOUDINARY_API_KEY ||
    !process.env.CLOUDINARY_API_SECRET
  ) {
    throw new Error('Cloudinary configuration missing');
  }
}

export type CloudinaryResourceType = 'image' | 'raw' | 'video' | 'auto';

export interface UploadOptions {
  folder?: string;
  resourceType?: CloudinaryResourceType;
  allowedFormats?: string[];
  maxFileSize?: number;
  transformation?: UploadApiOptions['transformation'];
  publicId?: string;
  timeoutMs?: number;
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

function extractCloudinaryError(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const err = error as any;
    return (
      err.message ||
      err.error?.message ||
      (err.http_code ? `Cloudinary error ${err.http_code}` : 'Unknown error')
    );
  }
  return 'Unknown error';
}

function validateFileSize(buffer: Buffer, maxSize: number): void {
  if (buffer.length > maxSize) {
    throw new Error(
      `File size exceeds maximum allowed size of ${maxSize / (1024 * 1024)}MB`
    );
  }
}

function validateUploadResponse(result: UploadApiResponse | undefined): asserts result is UploadApiResponse {
  if (!result || !result.public_id || !result.secure_url) {
    throw new Error('Invalid upload response from Cloudinary');
  }
}

export async function uploadToCloudinary(
  fileBuffer: Buffer,
  options: UploadOptions = {}
): Promise<UploadResult> {
  assertCloudinaryConfigured();

  const {
    folder = 'documents',
    resourceType = 'auto',
    allowedFormats = ['jpg', 'jpeg', 'png', 'pdf'],
    maxFileSize = 10 * 1024 * 1024,
    transformation,
    publicId,
    timeoutMs = 30000,
  } = options;

  validateFileSize(fileBuffer, maxFileSize);

  logger.info('Uploading file to Cloudinary', {
    folder,
    resourceType,
    size: fileBuffer.length,
    publicId,
  });

  const uploadOptions: UploadApiOptions = {
    folder,
    resource_type: resourceType,
    allowed_formats: allowedFormats,
    transformation,
    public_id: publicId,
  };

  const uploadPromise = new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      uploadOptions,
      (error, result) => {
        if (error) return reject(error);
        resolve(result as UploadApiResponse);
      }
    );

    stream.end(fileBuffer);
  });

  try {
    const result = await Promise.race([
      uploadPromise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Cloudinary upload timeout')), timeoutMs)
      ),
    ]);

    validateUploadResponse(result);

    logger.info('Cloudinary upload successful', {
      publicId: result.public_id,
      bytes: result.bytes,
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
    const message = extractCloudinaryError(error);
    logger.error('Cloudinary upload failed', { message, error });
    throw new Error(`Upload failed: ${message}`);
  }
}

export async function deleteFromCloudinary(
  publicId: string,
  resourceType: CloudinaryResourceType = 'auto'
): Promise<void> {
  assertCloudinaryConfigured();

  const tryDelete = async (rt: CloudinaryResourceType) => {
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: rt });
    return result?.result === 'ok' || result?.result === 'not found';
  };

  try {
    logger.info('Deleting Cloudinary asset', { publicId });

    if (resourceType === 'auto') {
      const order: CloudinaryResourceType[] = ['image', 'raw', 'video'];
      for (const rt of order) {
        try {
          const ok = await tryDelete(rt);
          if (ok) {
            logger.info('Cloudinary asset deleted', { publicId });
            return;
          }
        } catch {}
      }
      throw new Error('Delete failed for all resource types');
    } else {
      const ok = await tryDelete(resourceType);
      if (!ok) {
        throw new Error('Delete failed');
      }
    }

    logger.info('Cloudinary asset deleted', { publicId });
  } catch (error) {
    const message = extractCloudinaryError(error);
    logger.error('Cloudinary delete failed', { message });
    throw new Error(`Delete failed: ${message}`);
  }
}

export function getCloudinaryUrl(
  publicId: string,
  options?: UploadApiOptions
): string {
  assertCloudinaryConfigured();
  return cloudinary.url(publicId, options);
}

export function generateSignedUploadParams(options: UploadApiOptions = {}) {
  assertCloudinaryConfigured();

  return cloudinary.utils.api_sign_request(
    options,
    process.env.CLOUDINARY_API_SECRET as string
  );
}

export const CloudinaryService = {
  upload: uploadToCloudinary,
  delete: deleteFromCloudinary,
  getUrl: getCloudinaryUrl,
  generateSignedUploadParams,
};
