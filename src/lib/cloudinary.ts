import { v2 as cloudinary } from "cloudinary";

// Configure using env vars (already in .env)
cloudinary.config({
  cloud_name: process.env.CLOUDE_NAME,
  api_key: process.env.CLOUDE_API_KEY,
  api_secret: process.env.CLOUDE_API_SECRET,
});

export async function uploadSelfie(base64Image: string) {
  // base64Image comes as "data:image/jpeg;base64,..."
  const result = await cloudinary.uploader.upload(base64Image, {
    folder: "perizinan-selfie",
    resource_type: "image",
    transformation: [{ quality: "auto:low", fetch_format: "auto" }],
  });
  return { url: result.secure_url, publicId: result.public_id };
}

export async function deleteSelfie(publicId: string) {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error(`Failed to delete selfie ${publicId} from Cloudinary:`, error);
  }
}

export { cloudinary };
