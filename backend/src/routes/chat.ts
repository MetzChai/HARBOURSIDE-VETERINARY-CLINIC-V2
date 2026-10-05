import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import {
  buildContextPrompt,
  generateGeminiReply,
  generateLocalChatReply,
  getChatContext,
  type SupportedLanguage,
} from "../services/chat-service.js";
import { retrieveKnowledge } from "../services/knowledge-service.js";

const router = Router();

router.post("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const messages = (req.body?.messages ?? []) as { role: string; content: string }[];
    const languagePreference = (req.body?.languagePreference ?? "auto") as SupportedLanguage;

    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser?.content?.trim()) {
      res.status(400).json({ error: "Message is required." });
      return;
    }

    const user = req.user!;
    const userMessage = String(lastUser.content);
    const context = await getChatContext(user);
    const contextBlock = buildContextPrompt(context);
    const retrievedKnowledge = await retrieveKnowledge(userMessage, 4);
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    let reply = "";
    let mode: "gemini" | "local" | "fallback" = "local";

    if (apiKey) {
      const geminiReply = await generateGeminiReply(
        apiKey,
        messages,
        contextBlock,
        languagePreference,
        retrievedKnowledge
      );
      if (geminiReply) {
        reply = geminiReply;
        mode = "gemini";
      }
    }

    if (!reply) {
      reply = generateLocalChatReply(userMessage, context, languagePreference, retrievedKnowledge);
      mode = apiKey ? "fallback" : "local";
    }

    res.json({ reply, mode, languageUsed: languagePreference });
  } catch (e) {
    console.error("chat error:", e);
    res.status(500).json({ error: "Chat failed. Please try again." });
  }
});

export default router;

