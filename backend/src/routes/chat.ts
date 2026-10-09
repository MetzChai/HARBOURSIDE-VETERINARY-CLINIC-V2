import { Router } from "express";
import type { AuthedRequest } from "../middleware/auth.js";
import { requireAuth } from "../middleware/auth.js";
import { getPool } from "../lib/db.js";
import {
  buildContextPrompt,
  generateGeminiReply,
  generateLocalChatReply,
  getChatContext,
  type SupportedLanguage,
} from "../services/chat-service.js";
import { retrieveKnowledge } from "../services/knowledge-service.js";

const router = Router();

const DEFAULT_GREETING =
  "Welcome to Harbourside Veterinary Services. I'm PawBot, your virtual assistant. How may I assist you today?";

function generateTitleFromMessage(content: string): string {
  const clean = content.trim().replace(/\s+/g, " ");
  if (!clean) return "New Conversation";
  if (clean.length <= 35) return clean;
  return clean.slice(0, 35) + "…";
}

/**
 * GET /api/chat/conversations
 * Retrieve all past chat conversations for the authenticated user only.
 */
router.get("/conversations", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const pool = getPool();
    const { rows } = await pool.query(
      `SELECT c.id, c.title, c.created_at, c.updated_at,
              (SELECT content FROM chat_messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) AS last_message
       FROM chat_conversations c
       WHERE c.user_id = $1
       ORDER BY c.updated_at DESC`,
      [userId]
    );

    res.json({ conversations: rows });
  } catch (err) {
    console.error("GET /api/chat/conversations error:", err);
    res.status(500).json({ error: "Failed to fetch chat history." });
  }
});

/**
 * POST /api/chat/conversations
 * Create a new conversation for the authenticated user.
 */
router.post("/conversations", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const pool = getPool();

    const { rows: convRows } = await pool.query(
      `INSERT INTO chat_conversations (user_id, title)
       VALUES ($1, 'New Conversation')
       RETURNING id, title, created_at, updated_at`,
      [userId]
    );
    const conversation = convRows[0];

    const { rows: msgRows } = await pool.query(
      `INSERT INTO chat_messages (conversation_id, role, content)
       VALUES ($1, 'assistant', $2)
       RETURNING id, role, content, created_at`,
      [conversation.id, DEFAULT_GREETING]
    );

    res.json({ conversation, messages: msgRows });
  } catch (err) {
    console.error("POST /api/chat/conversations error:", err);
    res.status(500).json({ error: "Failed to create new conversation." });
  }
});

/**
 * GET /api/chat/conversations/:id
 * Retrieve messages for a specific conversation belonging to the authenticated user.
 */
router.get("/conversations/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const convId = String(req.params.id);
    const pool = getPool();

    const { rows: convRows } = await pool.query(
      `SELECT id, title, created_at, updated_at FROM chat_conversations WHERE id = $1 AND user_id = $2`,
      [convId, userId]
    );

    if (convRows.length === 0) {
      res.status(44).json({ error: "Conversation not found." });
      return;
    }

    const { rows: msgRows } = await pool.query(
      `SELECT id, role, content, created_at FROM chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
      [convId]
    );

    res.json({ conversation: convRows[0], messages: msgRows });
  } catch (err) {
    console.error("GET /api/chat/conversations/:id error:", err);
    res.status(500).json({ error: "Failed to load conversation." });
  }
});

/**
 * DELETE /api/chat/conversations/:id
 * Delete a specific conversation belonging to the authenticated user.
 */
router.delete("/conversations/:id", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const userId = req.user!.id;
    const convId = String(req.params.id);
    const pool = getPool();

    const { rowCount } = await pool.query(
      `DELETE FROM chat_conversations WHERE id = $1 AND user_id = $2`,
      [convId, userId]
    );

    if (rowCount === 0) {
      res.status(404).json({ error: "Conversation not found." });
      return;
    }

    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/chat/conversations/:id error:", err);
    res.status(500).json({ error: "Failed to delete conversation." });
  }
});

/**
 * POST /api/chat
 * Send a message in active conversation (or auto-create one if none provided).
 * Persists both user message and assistant reply into chat_messages table.
 */
router.post("/", requireAuth, async (req: AuthedRequest, res) => {
  try {
    const user = req.user!;
    const pool = getPool();
    const languagePreference = (req.body?.languagePreference ?? "auto") as SupportedLanguage;
    let conversationId = req.body?.conversationId ? String(req.body.conversationId) : null;
    let userMessage = "";

    // Support both direct message text and messages array format
    if (req.body?.message && typeof req.body.message === "string") {
      userMessage = req.body.message.trim();
    } else if (Array.isArray(req.body?.messages)) {
      const lastUser = [...req.body.messages].reverse().find((m: { role: string; content: string }) => m.role === "user");
      userMessage = lastUser?.content ? String(lastUser.content).trim() : "";
    }

    if (!userMessage) {
      res.status(400).json({ error: "Message is required." });
      return;
    }

    // 1. Verify or create active conversation for this user
    let conversationTitle = "New Conversation";
    if (conversationId) {
      const { rows: checkRows } = await pool.query(
        `SELECT id, title FROM chat_conversations WHERE id = $1 AND user_id = $2`,
        [conversationId, user.id]
      );
      if (checkRows.length === 0) {
        conversationId = null;
      } else {
        conversationTitle = checkRows[0].title;
      }
    }

    if (!conversationId) {
      const newTitle = generateTitleFromMessage(userMessage);
      const { rows: newConvRows } = await pool.query(
        `INSERT INTO chat_conversations (user_id, title)
         VALUES ($1, $2)
         RETURNING id, title`,
        [user.id, newTitle]
      );
      conversationId = newConvRows[0].id;
      conversationTitle = newConvRows[0].title;

      // Add default assistant greeting to brand new conversation
      await pool.query(
        `INSERT INTO chat_messages (conversation_id, role, content) VALUES ($1, 'assistant', $2)`,
        [conversationId, DEFAULT_GREETING]
      );
    } else if (conversationTitle === "New Conversation") {
      // Auto update title based on first user message
      const updatedTitle = generateTitleFromMessage(userMessage);
      await pool.query(
        `UPDATE chat_conversations SET title = $1, updated_at = now() WHERE id = $2`,
        [updatedTitle, conversationId]
      );
      conversationTitle = updatedTitle;
    }

    // 2. Save user message to database
    await pool.query(
      `INSERT INTO chat_messages (conversation_id, role, content) VALUES ($1, 'user', $2)`,
      [conversationId, userMessage]
    );

    // 3. Retrieve conversation history for context (up to last 15 messages)
    const { rows: historyRows } = await pool.query(
      `SELECT role, content FROM chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
      [conversationId]
    );
    const messagesHistory = historyRows.map((r) => ({ role: String(r.role), content: String(r.content) }));

    // 4. Load clinic RAG context & knowledge base
    const context = await getChatContext(user);
    const contextBlock = buildContextPrompt(context);
    const retrievedKnowledge = await retrieveKnowledge(userMessage, 4);
    const apiKey = process.env.GEMINI_API_KEY?.trim();

    let reply = "";
    let mode: "gemini" | "local" | "fallback" = "local";

    // 5. Call Gemini AI or Graceful Fallback
    if (apiKey) {
      const { text: geminiReply, is503Error } = await generateGeminiReply(
        apiKey,
        messagesHistory,
        contextBlock,
        languagePreference,
        retrievedKnowledge,
        user.role
      );
      if (geminiReply) {
        reply = geminiReply;
        mode = "gemini";
      } else if (is503Error) {
        reply =
          "PawBot is temporarily unavailable because the AI service is experiencing high demand. Please try again in a moment.\n\n" +
          generateLocalChatReply(userMessage, context, languagePreference, retrievedKnowledge);
        mode = "fallback";
      }
    }

    if (!reply) {
      reply = generateLocalChatReply(userMessage, context, languagePreference, retrievedKnowledge);
      mode = apiKey ? "fallback" : "local";
    }

    // 6. Save assistant reply to database and update conversation timestamp
    await pool.query(
      `INSERT INTO chat_messages (conversation_id, role, content) VALUES ($1, 'assistant', $2)`,
      [conversationId, reply]
    );
    await pool.query(`UPDATE chat_conversations SET updated_at = now() WHERE id = $1`, [conversationId]);

    // 7. Return complete conversation response to frontend
    const { rows: updatedMsgRows } = await pool.query(
      `SELECT id, role, content, created_at FROM chat_messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
      [conversationId]
    );

    res.json({
      reply,
      mode,
      languageUsed: languagePreference,
      conversationId,
      title: conversationTitle,
      messages: updatedMsgRows,
    });
  } catch (e) {
    console.error("chat error:", e);
    res.status(500).json({ error: "Chat failed. Please try again." });
  }
});

export default router;
