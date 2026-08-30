"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
import { MessageCircle, X, Send, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const QUICK_PROMPTS = [
  "When is my pet's next appointment?",
  "What vaccines are due?",
  "What are the clinic hours?",
];

export default function ChatbotWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Hi there! I'm PawBot, your Harbourside clinic assistant. Ask me about appointments, vaccines, clinic hours, or general pet care tips.",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Msg = { role: "user", content: text.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsLoading(true);

    try {
      const sessionRes = await fetch("/api/auth/session", { credentials: "include" });
      if (!sessionRes.ok) throw new Error("Please sign in to chat with PawBot.");
      const sessionJson = await sessionRes.json();
      if (!sessionJson.session) throw new Error("Please sign in to chat with PawBot.");

      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ messages: allMessages }),
      });

      const data = (await resp.json().catch(() => ({}))) as { reply?: string; error?: string };

      if (!resp.ok) {
        throw new Error(data.error || "Failed to get response");
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply || "Sorry, I couldn't generate a reply." },
      ]);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Please try again.";
      setMessages((prev) => [...prev, { role: "assistant", content: `Sorry, I couldn't process that. ${msg}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 no-print">
      {!open && (
        <Button
          onClick={() => setOpen(true)}
          className="h-14 w-14 rounded-full shadow-lg bg-brand-navy hover:bg-brand-navy/90"
          size="icon"
          data-chat-toggle="true"
          aria-label="Open PawBot chat"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}

      {open && (
        <div className="w-[360px] max-w-[calc(100vw-2rem)] h-[520px] rounded-2xl border border-border/60 bg-card shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="flex items-center justify-between px-4 py-3 bg-brand-navy text-white">
            <div className="flex items-center gap-2">
              <Image src="/logo.png" alt="" width={28} height={28} className="object-contain rounded-full bg-white/10 p-0.5" />
              <div>
                <span className="font-heading font-semibold text-sm block">PawBot</span>
                <span className="text-[10px] text-white/60">Harbourside Assistant</span>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              data-chat-toggle="true"
              aria-label="Close PawBot chat"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="px-3 py-2 bg-brand-teal-light/50 border-b border-brand-teal/10 flex items-start gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-brand-teal shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground leading-snug">
              PawBot provides general information only and does not replace professional veterinary diagnosis or treatment.
            </p>
          </div>

          <ScrollArea className="flex-1 p-3" ref={scrollRef}>
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap leading-relaxed",
                      msg.role === "user"
                        ? "bg-brand-navy text-white rounded-br-sm"
                        : "bg-brand-navy-light text-foreground rounded-bl-sm border border-border/40",
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

            {messages.length <= 1 && (
              <div className="mt-4 space-y-1.5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Suggested questions</p>
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendMessage(q)}
                    className="block w-full text-left text-xs px-3 py-2.5 rounded-lg border border-border/60 hover:bg-brand-teal-light/50 hover:border-brand-teal/30 transition-colors text-foreground"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="p-3 border-t bg-card flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
              placeholder="Ask about your pets..."
              className="text-sm h-10 border-border/60"
              disabled={isLoading}
            />
            <Button
              size="icon"
              className="h-10 w-10 shrink-0 bg-brand-teal hover:bg-brand-teal/90"
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
