import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import path from "path";
import authRoutes from "./routes/auth.js";
import dataRoutes from "./routes/data.js";
import chatRoutes from "./routes/chat.js";
import uploadRoutes from "./routes/upload.js";
import appointmentRoutes from "./routes/appointments.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";

app.use(
  cors({
    origin: frontendUrl,
    credentials: true,
  })
);
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "harbourside-backend" });
});

app.use("/api/auth", authRoutes);
app.use("/api/data", dataRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/appointments", appointmentRoutes);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(port, () => {
  console.log(`Backend running at http://localhost:${port}`);
  console.log(`Frontend URL: ${frontendUrl}`);
  const gemini = process.env.GEMINI_API_KEY?.trim();
  console.log(`Gemini AI: ${gemini ? "configured" : "not set (PawBot uses local fallback)"}`);
});
