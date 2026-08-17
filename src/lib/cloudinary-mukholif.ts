import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDE_NAME,
  api_key: process.env.CLOUDE_API_KEY,
  api_secret: process.env.CLOUDE_API_SECRET,
});

export async function uploadBuktiMukholif(base64Image: string) {
  const result = await cloudinary.uploader.upload(base64Image, {
    folder: "mukholif-bukti",
    resource_type: "image",
    transformation: [{ quality: "auto:low", fetch_format: "auto" }],
  });
  return { url: result.secure_url, publicId: result.public_id };
}

export async function deleteBuktiMukholif(publicId: string) {
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.error(`Failed to delete bukti ${publicId} from Cloudinary:`, error);
  }
}
