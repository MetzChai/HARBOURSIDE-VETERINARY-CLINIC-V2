import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth } from "../middleware/auth.js";
import { isCloudinaryConfigured, uploadToCloudinary } from "../services/cloudinary.js";

const uploadRoot = path.join(process.cwd(), "uploads");

function getCleanFolder(req: any): string {
  const raw = (req.query?.folder as string) || (req.body?.folder as string) || "pets";
  const sanitized = raw.replace(/[^a-zA-Z0-9_-]/g, "");
  return sanitized || "pets";
}

const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || (!file.mimetype.startsWith("image/") && !allowedMimeTypes.includes(file.mimetype.toLowerCase()))) {
      cb(new Error("Invalid image type. Only JPEG, PNG, and WebP are allowed."));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

router.post("/", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const file = req.file;
    const folder = getCleanFolder(req);

    if (!file || !file.buffer) {
      res.status(400).json({ error: "Please select a valid image file." });
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

    // Fallback for local development if Cloudinary env variables are missing
    const dir = path.join(uploadRoot, folder);
    fs.mkdirSync(dir, { recursive: true });
    const ext = file.originalname?.split(".").pop() || "jpg";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, file.buffer);

    const publicUrl = `/uploads/${folder}/${filename}`;
    res.json({ url: publicUrl });
  } catch (e) {
    console.error("upload error:", e);
    res.status(500).json({ error: "Unable to upload image. Please try again." });
  }
});

export default router;
