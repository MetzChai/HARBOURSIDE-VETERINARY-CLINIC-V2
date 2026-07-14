import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { requireAuth } from "../middleware/auth.js";

const uploadRoot = path.join(process.cwd(), "uploads");

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const folder = (req.body?.folder as string) || "pets";
    const dir = path.join(uploadRoot, folder);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ext = file.originalname.split(".").pop() || "jpg";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith("image/")) {
      cb(new Error("Invalid image file"));
      return;
    }
    cb(null, true);
  },
});

const router = Router();

router.post("/", requireAuth, upload.single("file"), (req, res) => {
  try {
    const file = req.file;
    const folder = (req.body?.folder as string) || "pets";
    if (!file) {
      res.status(400).json({ error: "Invalid image file" });
      return;
    }
    const publicUrl = `/uploads/${folder}/${file.filename}`;
    res.json({ url: publicUrl });
  } catch (e) {
    console.error("upload error:", e);
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
