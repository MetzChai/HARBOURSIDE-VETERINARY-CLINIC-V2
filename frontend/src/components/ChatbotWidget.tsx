"use client";

import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, PawPrint } from "lucide-react";
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
        "Hi there! 🐾 I'm PawBot, your Harbourside clinic assistant. Ask me about appointments, vaccines, clinic hours, or pet care tips!",
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
          className="h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90"
          size="icon"
          aria-label="Open PawBot chat"
        >
          <MessageCircle className="h-6 w-6" />
        </Button>
      )}

      {open && (
        <div className="w-[360px] h-[500px] rounded-2xl border bg-card shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-200">
          <div className="flex items-center justify-between px-4 py-3 bg-primary text-primary-foreground">
            <div className="flex items-center gap-2">
              <PawPrint className="h-5 w-5" />
              <span className="font-heading font-semibold text-sm">PawBot</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-primary-foreground hover:bg-primary-foreground/20"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <ScrollArea className="flex-1 p-3" ref={scrollRef}>
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-muted text-foreground rounded-bl-sm"
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role === "user" && (
                <div className="flex justify-start">
                  <div className="bg-muted rounded-xl px-3 py-2 text-sm text-muted-foreground">Typing...</div>
                </div>
              )}
            </div>

            {messages.length <= 1 && (
              <div className="mt-3 space-y-1.5">
                {QUICK_PROMPTS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendMessage(q)}
                    className="block w-full text-left text-xs px-3 py-2 rounded-lg border hover:bg-accent transition-colors text-foreground"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="p-3 border-t flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
              placeholder="Ask about your pets..."
              className="text-sm h-9"
              disabled={isLoading}
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0"
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
