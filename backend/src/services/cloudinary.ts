import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export function isCloudinaryConfigured(): boolean {
  return Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
  );
}

export function extractCloudinaryPublicId(url?: string | null): string | null {
  if (!url || !url.includes("res.cloudinary.com")) return null;
  try {
    const parts = url.split("/upload/");
    if (parts.length < 2) return null;
    let path = parts[1];
    path = path.replace(/^v\d+\//, "");
    const lastDotIndex = path.lastIndexOf(".");
    if (lastDotIndex !== -1) {
      path = path.substring(0, lastDotIndex);
    }
    return path;
  } catch {
    return null;
  }
}

export async function uploadToCloudinary(
  fileBuffer: Buffer,
  folder: string
): Promise<UploadApiResponse> {
  if (!isCloudinaryConfigured()) {
    throw new Error("Cloudinary environment variables are not configured.");
  }

  const cleanFolder = folder.replace(/[^a-zA-Z0-9_-]/g, "") || "pets";
  const cloudinaryFolder = `harbourside/${cleanFolder}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: cloudinaryFolder,
        resource_type: "auto",
        use_filename: false,
        unique_filename: true,
      },
      (error, result) => {
        if (error || !result) {
          return reject(error || new Error("Cloudinary upload failed"));
        }
        resolve(result);
      }
    );
    uploadStream.end(fileBuffer);
  });
}

export async function deleteFromCloudinary(publicId: string): Promise<void> {
  if (!isCloudinaryConfigured() || !publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (err) {
    console.error(`Failed to delete Cloudinary image (${publicId}):`, err);
  }
}
