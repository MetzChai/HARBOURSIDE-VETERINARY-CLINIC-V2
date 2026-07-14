import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import {
  buildContextPrompt,
  generateGeminiReply,
  generateLocalChatReply,
  getChatContext,
} from "../services/chat-service.js";

const router = Router();

router.post("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const messages = (req.body?.messages ?? []) as { role: string; content: string }[];
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser?.content?.trim()) {
      res.status(400).json({ error: "Message is required." });
      return;
    }

    const user = req.user!;
    const context = await getChatContext(user);
    const contextBlock = buildContextPrompt(context);
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    const userMessage = String(lastUser.content);

    let reply = "";
    let mode: "gemini" | "local" | "fallback" = "local";

    if (apiKey) {
      const geminiReply = await generateGeminiReply(apiKey, messages, contextBlock);
      if (geminiReply) {
        reply = geminiReply;
        mode = "gemini";
      }
    }

    if (!reply) {
      reply = generateLocalChatReply(userMessage, context);
      mode = apiKey ? "fallback" : "local";
    }

    res.json({ reply, mode });
  } catch (e) {
    console.error("chat error:", e);
    res.status(500).json({ error: "Chat failed. Please try again." });
  }
});

export default router;
