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

// Accepted types: JPEG, PNG, WebP images and PDF documents.
const allowedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/jpg",
  "image/pjpeg",
  "image/x-png",
  "application/pdf",
];

type SniffedFileType = "jpeg" | "png" | "webp" | "pdf";

const sniffedToExt: Record<SniffedFileType, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
  pdf: "pdf",
};

/**
 * Validate the actual file bytes so SVG, GIF, HTML, archives and executables
 * renamed to an allowed extension are rejected regardless of client MIME type.
 */
function sniffFileType(buf: Buffer): SniffedFileType | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "jpeg";
  }
  if (buf.length >= 8 && buf.readUInt32BE(0) === 0x89504e47 && buf.readUInt32BE(4) === 0x0d0a1a0a) {
    return "png";
  }
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return "webp";
  }
  if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    return "pdf";
  }
  return null;
}

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
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
          res.status(400).json({ error: "File size exceeds the 10MB limit." });
          return;
        }
        res.status(400).json({ error: err.message || "Invalid file." });
        return;
      }
      next();
    });
  },
  async (req: any, res) => {
    try {
      const file = req.file;
      const folder = getCleanFolder(req);

      if (folder === "medical_records" && req.user?.role !== "admin" && req.user?.role !== "staff") {
        res.status(403).json({ error: "Only clinic staff may upload medical history records." });
        return;
      }

      if (!file || !file.buffer || !file.buffer.length) {
        res.status(400).json({ error: "Invalid file. Only JPEG, PNG, WebP, and PDF are allowed." });
        return;
      }

      if (!file.mimetype || !allowedMimeTypes.includes(file.mimetype.toLowerCase())) {
        res.status(400).json({ error: "Invalid file type. Only JPEG, PNG, WebP, and PDF documents are allowed." });
        return;
      }

      const sniffed = sniffFileType(file.buffer);
      if (!sniffed) {
        res.status(400).json({ error: "File content does not match allowed types (JPEG, PNG, WebP, PDF)." });
        return;
      }

      const originalName = file.originalname ? path.basename(file.originalname) : `upload.${sniffedToExt[sniffed]}`;

      if (isCloudinaryConfigured()) {
        try {
          const result = await uploadToCloudinary(file.buffer, folder);
          res.json({
            url: result.secure_url,
            public_id: result.public_id,
            file_name: originalName,
            file_size: file.size,
            file_type: file.mimetype,
          });
          return;
        } catch (cloudErr) {
          console.error("Cloudinary upload failed:", cloudErr);
          res.status(500).json({ error: "Unable to upload file to storage. Please try again." });
          return;
        }
      }

      // No Cloudinary: local disk is only used outside production
      if (process.env.NODE_ENV === "production") {
        res.status(503).json({
          error: "File storage is not configured on the server. Please contact the administrator.",
        });
        return;
      }

      const dir = path.resolve(uploadRoot, folder);
      const filename = `${Date.now()}-${crypto.randomBytes(8).toString("hex")}.${sniffedToExt[sniffed]}`;
      const filePath = path.resolve(dir, filename);

      if (filePath !== path.join(dir, path.basename(filePath))) {
        res.status(400).json({ error: "Invalid file path." });
        return;
      }

      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(filePath, file.buffer);

      const publicUrl = `/uploads/${folder}/${filename}`;
      res.json({
        url: publicUrl,
        public_id: null,
        file_name: originalName,
        file_size: file.size,
        file_type: file.mimetype,
      });
    } catch (e) {
      console.error("upload error:", e);
      res.status(500).json({ error: "Unable to upload file. Please try again." });
    }
  }
);

export default router;
