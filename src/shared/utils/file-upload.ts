import axios from "axios";

export async function uploadFile(file: Express.Multer.File, options?: { folder?: string }) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary configuration missing");
  }

  const endpoint = `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`;

  const form = new URLSearchParams();
  form.append("upload_preset", uploadPreset);
  form.append("folder", options?.folder || "tickets");
  form.append("resource_type", "auto");

  const base64 = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
  form.append("file", base64);

  const resp = await axios.post(endpoint, form);
  const data = resp.data;

  return {
    fileUrl: data.secure_url,
    fileName: file.originalname,
    fileSize: file.size,
    mimeType: file.mimetype,
  };
}
