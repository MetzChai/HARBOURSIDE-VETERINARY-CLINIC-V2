import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { requireAuth } from "../middleware/auth.js";
import { isCloudinaryConfigured, uploadToCloudinary } from "../services/cloudinary.js";

const uploadRoot = path.join(process.cwd(), "uploads");

function getCleanFolder(req: any): string {
  const raw = (req.query?.folder as string) || (req.body?.folder as string) || "pets";
  const sanitized = raw.replace(/[^a-zA-Z0-9_-]/g, "");
  return sanitized || "pets";
}

// Only these image types are accepted (client-declared MIME and real file bytes).
const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
  "image/pjpeg",
  "image/x-png",
];

type SniffedImageType = "jpeg" | "png" | "webp";

const sniffedToExt: Record<SniffedImageType, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

/**
 * Validate the actual file bytes so SVG, GIF, HTML, archives and executables
 * renamed to an allowed extension are rejected regardless of client MIME type.
 */
function sniffImageType(buf: Buffer): SniffedImageType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "jpeg";
  }
  if (buf.length >= 8 && buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a) {
    return "png";
  }
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return "webp";
  }
  return null;
}

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
      cb(null, false);
      return;
    }
    cb(null, true);
  },
});

const router = Router();

router.post(
  "/",
  requireAuth,
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
          res.status(400).json({ error: "File size exceeds the 5MB limit." });
          return;
        }
        res.status(400).json({ error: err.message || "Invalid image file." });
        return;
      }
      next();
    });
  },
  async (req, res) => {
    try {
      const file = req.file;
      const folder = getCleanFolder(req);

      if (!file || !file.buffer || !file.buffer.length) {
        res.status(400).json({ error: "Invalid image type. Only JPEG, PNG, and WebP are allowed." });
        return;
      }

      if (!file.mimetype || !allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
        res.status(400).json({ error: "Invalid image type. Only JPEG, PNG, and WebP are allowed." });
        return;
      }

      const sniffed = sniffImageType(file.buffer);
      if (!sniffed) {
        res.status(400).json({ error: "File is not a valid JPEG, PNG, or WebP image." });
        return;
      }

      if (isCloudinaryConfigured()) {
        try {
          const result = await uploadToCloudinary(file.buffer, folder);
          res.json({ url: result.secure_url, public_id: result.public_id });
          return;
        } catch (cloudErr) {
          console.error("Cloudinary upload failed:", cloudErr);
          res.status(500).json({ error: "Unable to upload image. Please try again." });
          return;
        }
      }

      // No Cloudinary: local disk is only used outside production (Render's filesystem
      // is ephemeral, so permanent images must come from Cloudinary).
      if (process.env.NODE_ENV === "production") {
        res.status(503).json({
          error: "Image storage is not configured on the server. Please contact the administrator.",
        });
        return;
      }

      const dir = path.resolve(uploadRoot, folder);
      // Extension comes from validated file bytes — never from the original filename.
      const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${sniffedToExt[sniffed]}`;
      const filePath = path.resolve(dir, filename);

      // Guard against any path escaping the uploads directory.
      if (filePath !== path.join(dir, path.basename(filePath))) {
        res.status(400).json({ error: "Invalid file path." });
        return;
      }

      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, file.buffer);

      const publicUrl = `/uploads/${folder}/${filename}`;
      res.json({ url: publicUrl });
    } catch (e) {
      console.error("upload error:", e);
      res.status(500).json({ error: "Unable to upload image. Please try again." });
    }
  }
);

export default router;
