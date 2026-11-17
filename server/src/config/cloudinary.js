import { v2 as cloudinary } from "cloudinary";

// Read Cloudinary credentials from the backend environment.
const cloudinaryConfig = {
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
};

// Cloudinary is available only when all three credentials are supplied.
export const isCloudinaryConfigured = Boolean(
  cloudinaryConfig.cloud_name &&
  cloudinaryConfig.api_key &&
  cloudinaryConfig.api_secret
);

// Configure Cloudinary only when all credentials are present.
if (isCloudinaryConfigured) {
  cloudinary.config(cloudinaryConfig);
}

export default cloudinary;
