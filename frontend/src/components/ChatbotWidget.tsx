"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  MessageCircle,
  X,
  Send,
  Loader2,
  AlertCircle,
  Plus,
  History,
  Trash2,
  ChevronLeft,
  Bot,
  MessageSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Msg = { id?: string; role: "user" | "assistant"; content: string };

type Conversation = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  last_message?: string;
};

const QUICK_PROMPTS = [
  "Where is the clinic located?",
  "How can I contact the clinic?",
  "What are your operating hours?",
  "When is my pet's next appointment?",
];

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [language, setLanguage] = useState<"auto" | "en" | "tl" | "ceb">("auto");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Welcome to Harbourside Veterinary Services. I'm PawBot, your virtual assistant. How may I assist you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Load user conversation list
  const fetchConversations = useCallback(async () => {
    try {
      const res = await fetch("/api/chat/conversations", { credentials: "include" });
      if (!res.ok) return [];
      const data = (await res.json()) as { conversations?: Conversation[] };
      const list = data.conversations || [];
      setConversations(list);
      return list;
    } catch (_err) {
      return [];
    }
  }, []);

  // Load messages for a conversation
  const loadConversationMessages = useCallback(async (convId: string) => {
    try {
      setIsLoading(true);
      const res = await fetch(`/api/chat/conversations/${convId}`, { credentials: "include" });
      if (res.ok) {
        const data = (await res.json()) as { messages?: Msg[] };
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        }
      }
    } catch (_err) {
      console.error("Failed to load conversation messages");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initialize PawBot on widget open
  useEffect(() => {
    if (!open) return;
    let isSubscribed = true;

    async function init() {
      setIsInitializing(true);
      const list = await fetchConversations();
      if (!isSubscribed) return;

      if (list.length > 0) {
        const latest = list[0];
        setActiveConvId(latest.id);
        await loadConversationMessages(latest.id);
      } else {
        // Create new initial conversation
        await startNewChat();
      }
      setIsInitializing(false);
    }

    init();
    return () => {
      isSubscribed = false;
    };
  }, [open, fetchConversations, loadConversationMessages]);

  const startNewChat = async () => {
    try {
      setIsLoading(true);
      const res = await fetch("/api/chat/conversations", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = (await res.json()) as { conversation?: Conversation; messages?: Msg[] };
        if (data.conversation) {
          setActiveConvId(data.conversation.id);
          setMessages(
            data.messages || [
              {
                role: "assistant",
                content:
                  "Welcome to Harbourside Veterinary Services. I'm PawBot, your virtual assistant. How may I assist you today?",
              },
            ]
          );
          setConversations((prev) => [data.conversation!, ...prev.filter((c) => c.id !== data.conversation!.id)]);
        }
      }
    } catch (err) {
      console.error("Failed to create new chat:", err);
    } finally {
      setIsLoading(false);
      setShowHistory(false);
    }
  };

  const selectConversation = async (conv: Conversation) => {
    setActiveConvId(conv.id);
    setShowHistory(false);
    await loadConversationMessages(conv.id);
  };

  const deleteConversation = async (e: React.MouseEvent, convId: string) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/chat/conversations/${convId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        const remaining = conversations.filter((c) => c.id !== convId);
        setConversations(remaining);
        if (activeConvId === convId) {
          if (remaining.length > 0) {
            setActiveConvId(remaining[0].id);
            await loadConversationMessages(remaining[0].id);
          } else {
            await startNewChat();
          }
        }
      }
    } catch (err) {
      console.error("Failed to delete conversation:", err);
    }
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userText = text.trim();
    const userMsg: Msg = { role: "user", content: userText };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          conversationId: activeConvId,
          message: userText,
          languagePreference: language,
        }),
      });

      const data = (await resp.json().catch(() => ({}))) as {
        reply?: string;
        error?: string;
        conversationId?: string;
        title?: string;
        messages?: Msg[];
      };

      if (!resp.ok) {
        throw new Error(data.error || "Failed to get response");
      }

      if (data.conversationId) {
        setActiveConvId(data.conversationId);
      }

      if (data.messages && data.messages.length > 0) {
        setMessages(data.messages);
      } else if (data.reply) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.reply! }]);
      }

      // Refresh list to update titles and last_message previews
      void fetchConversations();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Sorry, I couldn't process that. ${msg}` },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 no-print">
      {!open && (
        <Button
          onClick={() => setOpen(true)}
          className="h-14 w-14 rounded-full shadow-lg bg-brand-navy hover:bg-brand-navy/90 text-white"
          size="icon"
          data-chat-toggle="true"
          aria-label="Open PawBot chat"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}

      {open && (
        <div className="w-[380px] max-w-[calc(100vw-2rem)] h-[540px] rounded-2xl border border-border/60 bg-card shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-3.5 py-3 bg-brand-navy text-white shrink-0">
            <div className="flex items-center gap-2">
              {showHistory ? (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-white hover:bg-white/20 -ml-1"
                  onClick={() => setShowHistory(false)}
                  aria-label="Back to chat"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              ) : (
                <Image
                  src="/logo.png"
                  alt=""
                  width={28}
                  height={28}
                  className="object-contain rounded-full bg-white/10 p-0.5"
                />
              )}
              <div>
                <span className="font-heading font-semibold text-sm block leading-tight">
                  {showHistory ? "Chat History" : "PawBot"}
                </span>
                <span className="text-[10px] text-white/70 block">
                  {showHistory ? "Previous Conversations" : "Harbourside Assistant"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {!showHistory && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-white hover:bg-white/20"
                    title="New Chat"
                    onClick={() => void startNewChat()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-white hover:bg-white/20"
                    title="Chat History"
                    onClick={() => {
                      setShowHistory(true);
                      void fetchConversations();
                    }}
                  >
                    <History className="h-4 w-4" />
                  </Button>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value as "auto" | "en" | "tl" | "ceb")}
                    className="bg-white/10 hover:bg-white/20 text-white text-[11px] rounded-md px-1 py-1 border border-white/20 outline-none cursor-pointer"
                    aria-label="Select Chat Language"
                  >
                    <option value="auto" className="text-slate-900 bg-white">🌐 Auto</option>
                    <option value="en" className="text-slate-900 bg-white">🇺🇸 EN</option>
                    <option value="tl" className="text-slate-900 bg-white">🇵🇭 Tagalog</option>
                    <option value="ceb" className="text-slate-900 bg-white">🏝️ Cebuano</option>
                  </select>
                </>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-white hover:bg-white/20 ml-1"
                data-chat-toggle="true"
                aria-label="Close PawBot chat"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* History Sidebar / Drawer View */}
          {showHistory ? (
            <div className="flex-1 flex flex-col bg-card overflow-hidden">
              <div className="p-3 border-b flex justify-between items-center bg-muted/30">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Your Conversations
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs gap-1 border-brand-teal text-brand-teal hover:bg-brand-teal/10"
                  onClick={() => void startNewChat()}
                >
                  <Plus className="h-3.5 w-3.5" /> New Chat
                </Button>
              </div>

              <ScrollArea className="flex-1 p-2">
                {conversations.length === 0 ? (
                  <div className="text-center py-10 px-4">
                    <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-50" />
                    <p className="text-sm font-medium">No previous chats</p>
                    <p className="text-xs text-muted-foreground mt-1">Start a new conversation with PawBot!</p>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {conversations.map((conv) => {
                      const isActive = conv.id === activeConvId;
                      return (
                        <div
                          key={conv.id}
                          onClick={() => void selectConversation(conv)}
                          className={cn(
                            "w-full text-left p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between group",
                            isActive
                              ? "bg-brand-navy-light/80 border-brand-teal/50 font-medium"
                              : "border-border/40 hover:bg-muted/50"
                          )}
                        >
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="text-xs font-semibold truncate text-foreground">{conv.title}</p>
                            {conv.last_message && (
                              <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                {conv.last_message}
                              </p>
                            )}
                            <p className="text-[10px] text-muted-foreground/70 mt-1">
                              {new Date(conv.updated_at).toLocaleDateString([], {
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                            onClick={(e) => void deleteConversation(e, conv.id)}
                            title="Delete conversation"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </div>
          ) : (
            /* Active Chat View */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Disclaimer */}
              <div className="px-3 py-2 bg-brand-teal-light/50 border-b border-brand-teal/10 flex items-start gap-2 shrink-0">
                <AlertCircle className="h-3.5 w-3.5 text-brand-teal shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground leading-snug">
                  PawBot provides general information only and does not replace professional veterinary diagnosis or treatment.
                </p>
              </div>

              {/* Messages List */}
              <ScrollArea className="flex-1 p-3" ref={scrollRef}>
                {isInitializing ? (
                  <div className="flex justify-center items-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-brand-teal" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg, i) => (
                      <div
                        key={msg.id || i}
                        className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed shadow-xs",
                            msg.role === "user"
                              ? "bg-brand-navy text-white rounded-br-sm"
                              : "bg-brand-navy-light text-foreground rounded-bl-sm border border-border/40"
                          )}
                        >
                          {msg.content}
                        </div>
                      </div>
                    ))}

                    {isLoading && messages[messages.length - 1]?.role === "user" && (
                      <div className="flex justify-start">
                        <div className="bg-brand-navy-light rounded-2xl rounded-bl-sm px-3.5 py-2.5 text-sm text-muted-foreground flex items-center gap-2 border border-border/40">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          PawBot is thinking...
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {!isInitializing && messages.length <= 1 && (
                  <div className="mt-4 space-y-1.5">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">
                      Suggested questions
                    </p>
                    {QUICK_PROMPTS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => void sendMessage(q)}
                        className="block w-full text-left text-xs px-3 py-2.5 rounded-lg border border-border/60 hover:bg-brand-teal-light/50 hover:border-brand-teal/30 transition-colors text-foreground"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>

              {/* Chat Input */}
              <div className="p-3 border-t bg-card flex gap-2 shrink-0">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void sendMessage(input)}
                  placeholder="Ask about your pets..."
                  className="text-sm h-10 border-border/60"
                  disabled={isLoading}
                />
                <Button
                  size="icon"
                  className="h-10 w-10 shrink-0 bg-brand-teal hover:bg-brand-teal/90 text-white"
                  onClick={() => void sendMessage(input)}
                  disabled={isLoading || !input.trim()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
