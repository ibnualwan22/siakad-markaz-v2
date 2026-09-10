import { v2 as cloudinary } from "cloudinary";

// Configure using env vars (already in .env)
cloudinary.config({
  cloud_name: process.env.CLOUDE_NAME,
  api_key: process.env.CLOUDE_API_KEY,
  api_secret: process.env.CLOUDE_API_SECRET,
});

export async function uploadDenahImage(base64Image: string) {
  const result = await cloudinary.uploader.upload(base64Image, {
    folder: "denah-sakan",
    resource_type: "image",
    transformation: [{ quality: "auto:good", fetch_format: "auto", width: 800, crop: "limit" }],
  });
  return { url: result.secure_url, publicId: result.public_id };
}

export async function deleteDenahImage(publicId: string) {
  try {
    if (publicId) {
      await cloudinary.uploader.destroy(publicId);
    }
  } catch (error) {
    console.error(`Failed to delete denah image ${publicId} from Cloudinary:`, error);
  }
}
