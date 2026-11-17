
import multer from "multer";

// Keep uploaded files in memory temporarily.
// Cloudinary will receive the file directly; we won't save it to disk.
const storage = multer.memoryStorage();

// Only allow JPEG, PNG, and WebP images for profile photos.
function imageFileFilter(req, file, callback) {
  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
  ];

  // Reject unsupported formats as client errors (HTTP 400).
  if (!allowedMimeTypes.includes(file.mimetype)) {
    const error = new Error(
      "Only JPEG, PNG, and WebP images are allowed."
    );

    error.statusCode = 400;

    return callback(error);
  }

  // Accept the file when its declared MIME type is allowed.
  callback(null, true);
}

// Configure storage, file validation, and upload limits.
const upload = multer({
  storage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Maximum profile image size: 5 MB.
    files: 1, // Accept only one image per request.
  },
});

// Export middleware that accepts one file using the "avatar" field.
export const uploadProfileImage = upload.single("avatar");
