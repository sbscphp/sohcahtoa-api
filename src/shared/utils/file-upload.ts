import { uploadToCloudinary } from './cloudinary';

export async function uploadFile(file: Express.Multer.File, options?: { folder?: string }) {
  const result = await uploadToCloudinary(file.buffer, {
    folder: options?.folder || 'tickets',
    resourceType: 'auto',
  });

  return {
    fileUrl: result.secureUrl,
    fileName: file.originalname,
    fileSize: file.size,
    mimeType: file.mimetype,
  };
}
