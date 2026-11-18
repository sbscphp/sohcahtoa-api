import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createLogger } from './logger';

const logger = createLogger('StorageService');

/**
 * S3-backed file storage.
 * Env: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_BUCKET_NAME
 * Optional: AWS_S3_PUBLIC_BASE_URL (e.g. a CloudFront domain) used to build returned URLs.
 */
let client: S3Client | null = null;

function getConfig() {
  const region = process.env.AWS_REGION;
  const bucket = process.env.AWS_BUCKET_NAME;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!region || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error('S3 storage configuration missing (AWS_REGION, AWS_BUCKET_NAME, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)');
  }
  return { region, bucket, accessKeyId, secretAccessKey };
}

function getClient(): S3Client {
  if (!client) {
    const { region, accessKeyId, secretAccessKey } = getConfig();
    client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
  }
  return client;
}

function publicBaseUrl(): string {
  const custom = process.env.AWS_S3_PUBLIC_BASE_URL?.trim();
  if (custom) return custom.replace(/\/+$/, '');
  const { bucket, region } = getConfig();
  return `https://${bucket}.s3.${region}.amazonaws.com`;
}

function urlForKey(key: string): string {
  return `${publicBaseUrl()}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

/** Returns the S3 object key for a URL we generated, or null if the URL isn't ours (e.g. a legacy Cloudinary URL). */
export function keyFromUrl(url: string): string | null {
  try {
    const base = publicBaseUrl();
    if (!url.startsWith(`${base}/`)) return null;
    const path = url.slice(base.length + 1).split('?')[0];
    return path.split('/').map(decodeURIComponent).join('/');
  } catch {
    return null;
  }
}

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

/** Detects the real file type from magic bytes — never trusts the client-supplied mimetype. */
function sniffFormat(buf: Buffer): string | null {
  if (buf.length >= 4 && buf.subarray(0, 4).toString('latin1') === '%PDF') return 'pdf';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.length >= 4 && buf.subarray(0, 4).toString('latin1') === 'GIF8') return 'gif';
  if (buf.length >= 12 && buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return 'webp';
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return 'docx';
  if (buf.length >= 4 && buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0) return 'doc';
  return null;
}

export type StorageResourceType = 'image' | 'raw' | 'video' | 'auto';

export interface UploadOptions {
  folder?: string;
  resourceType?: StorageResourceType; // kept for call-site compatibility; type is detected from content
  allowedFormats?: string[];
  maxFileSize?: number;
  publicId?: string;
  timeoutMs?: number;
}

export interface UploadResult {
  url: string;
  secureUrl: string;
  publicId: string; // the S3 object key
  format: string;
  resourceType: string;
  bytes: number;
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const e = error as any;
    return e.message || e.name || 'Unknown error';
  }
  return 'Unknown error';
}

export async function uploadToStorage(fileBuffer: Buffer, options: UploadOptions = {}): Promise<UploadResult> {
  const { bucket } = getConfig();
  const {
    folder = 'documents',
    allowedFormats = ['jpg', 'jpeg', 'png', 'pdf'],
    maxFileSize = 10 * 1024 * 1024,
    publicId,
    timeoutMs = 30000,
  } = options;

  if (fileBuffer.length > maxFileSize) {
    throw new Error(`File size exceeds maximum allowed size of ${maxFileSize / (1024 * 1024)}MB`);
  }

  const format = sniffFormat(fileBuffer);
  const allowed = allowedFormats.map((f) => (f.toLowerCase() === 'jpeg' ? 'jpg' : f.toLowerCase()));
  if (!format || !allowed.includes(format)) {
    throw new Error(`Unsupported file type. Allowed formats: ${allowedFormats.join(', ')}`);
  }

  const cleanFolder = folder.replace(/^\/+|\/+$/g, '');
  const name = publicId ? publicId.replace(/[^a-zA-Z0-9._/-]/g, '_') : `${Date.now()}-${randomUUID()}`;
  const key = `${cleanFolder}/${name}${name.toLowerCase().endsWith(`.${format}`) ? '' : `.${format}`}`;

  logger.info('Uploading file to S3', { bucket, key, size: fileBuffer.length });

  try {
    await getClient().send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: fileBuffer,
        ContentType: CONTENT_TYPES[format] || 'application/octet-stream',
      }),
      { abortSignal: AbortSignal.timeout(timeoutMs) }
    );
  } catch (error) {
    const message = errorMessage(error);
    logger.error('S3 upload failed', { message, key });
    throw new Error(`Upload failed: ${message}`);
  }

  const url = urlForKey(key);
  logger.info('S3 upload successful', { key, bytes: fileBuffer.length });

  return {
    url,
    secureUrl: url,
    publicId: key,
    format,
    resourceType: format === 'pdf' || format === 'doc' || format === 'docx' ? 'raw' : 'image',
    bytes: fileBuffer.length,
  };
}

/** Deletes an object by key. S3 treats deleting a missing key as success. */
export async function deleteFromStorage(key: string, _resourceType: StorageResourceType = 'auto'): Promise<void> {
  const { bucket } = getConfig();
  try {
    await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    logger.info('S3 object deleted', { key });
  } catch (error) {
    const message = errorMessage(error);
    logger.error('S3 delete failed', { message, key });
    throw new Error(`Delete failed: ${message}`);
  }
}

export const StorageService = {
  upload: uploadToStorage,
  delete: deleteFromStorage,
  keyFromUrl,
};
