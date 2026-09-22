"use client";

import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageSquare, Search, Mail, Eye, Sparkles, Send, Loader2 } from "lucide-react";
import { db } from "@/lib/db-client";
import { useRows, useInvalidate } from "@/hooks/useRows";
import { useMyOwner, useMyPets } from "@/hooks/useOwnerData";
import { formatDateTimePH } from "@/lib/datetime";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";
import { toast } from "sonner";

export default function UserMessages() {
  const { data: owner } = useMyOwner();
  const { data: myPets = [] } = useMyPets();
  const invalidate = useInvalidate();

  const { data: allMessages = [], isLoading } = useRows<any>("messages", {
    orderBy: "created_at",
    ascending: false,
  });

  const [search, setSearch] = useState("");
  const [selectedMessage, setSelectedMessage] = useState<any | null>(null);
  const [replySubject, setReplySubject] = useState("");
  const [replyBody, setReplyBody] = useState("");
  const [replyPetId, setReplyPetId] = useState("NONE");
  const [sending, setSending] = useState(false);

  const myPetIds = useMemo(() => new Set(myPets.map((p: any) => p.id)), [myPets]);

  const userMessages = useMemo(() => {
    return allMessages.filter((m: any) => {
      if (String(m.status || "").toUpperCase() === "PENDING") return false;
      if (!m.owner_id) return true;
      if (owner && m.owner_id === (owner as any).id) return true;
      if (m.pet_id && myPetIds.has(m.pet_id)) return true;
      return false;
    });
  }, [allMessages, owner, myPetIds]);

  const filteredMessages = useMemo(() => {
    return userMessages.filter((m: any) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      const subj = (m.subject || "").toLowerCase();
      const body = (m.body || "").toLowerCase();
      const type = (m.message_type || "").toLowerCase();
      return subj.includes(q) || body.includes(q) || type.includes(q);
    });
  }, [userMessages, search]);

  const petMap = useMemo(() => new Map(myPets.map((p: any) => [p.id, p])), [myPets]);

  const handleSendToClinic = async () => {
    if (!replyBody.trim()) {
      toast.error("Please write a message before sending.");
      return;
    }
    setSending(true);
    const { error } = await db.from("messages").insert({
      owner_id: (owner as any)?.id || null,
      pet_id: replyPetId === "NONE" ? null : replyPetId,
      subject: replySubject.trim() || "Message to clinic",
      body: replyBody.trim(),
      channel: "IN_APP",
      message_type: "Owner Reply",
      status: "SENT",
      sent_by: "Owner",
    } as any);
    setSending(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Message sent to the clinic.");
    setReplySubject("");
    setReplyBody("");
    setReplyPetId("NONE");
    invalidate("messages");
  };

  const getChannelBadge = (ch: string) => {
    switch (ch) {
      case "EMAIL_INAPP":
      case "ALL":
      case "EMAIL_SMS":
      case "SMS_INAPP":
        return <Badge className="bg-[#1FA8A8] text-white">Email + In-App</Badge>;
      case "EMAIL":
        return <Badge variant="outline" className="bg-[#E8EEF4] text-[#1B3A5C] border-[#1B3A5C]/20">Email</Badge>;
      default:
        return <Badge variant="secondary">In-App Notice</Badge>;
    }
  };

  return (
    <div className="page-container w-full max-w-7xl mx-auto space-y-6 pb-10">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#4A0A10] via-[#7F1D1D] to-[#E5192C] p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-rose-200 text-xs font-semibold backdrop-blur-sm border border-white/10">
              <MessageSquare className="h-3.5 w-3.5" /> Direct Communications & Notices
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-heading tracking-tight text-white">
              My Messages & Notices 💬
            </h1>
            <p className="text-sm text-slate-200/90 leading-relaxed">
              Read clinic notices and send a message to Harbourside staff. Email copies are sent when the clinic chooses that channel.
            </p>
          </div>

          <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-3 rounded-xl border border-white/20">
            <div className="h-10 w-10 rounded-lg bg-[#E5192C] text-white flex items-center justify-center font-bold text-lg shadow">
              {userMessages.length}
            </div>
            <div className="text-xs">
              <p className="font-bold text-white">Total Messages</p>
              <p className="text-slate-200 text-[11px]">Inbox and sent notes</p>
            </div>
          </div>
        </div>
      </div>

      <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-3 bg-slate-50/60 border-b">
          <CardTitle className="font-heading text-base font-bold text-[#1B3A5C] flex items-center gap-2">
            <Send className="h-4 w-4 text-[#1FA8A8]" /> Message the clinic
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#1B3A5C]">Related pet (optional)</Label>
              <Select value={replyPetId} onValueChange={setReplyPetId}>
                <SelectTrigger>
                  <SelectValue placeholder="General account message" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">General account message</SelectItem>
                  {myPets.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-[#1B3A5C]">Subject</Label>
              <Input
                value={replySubject}
                onChange={(e) => setReplySubject(e.target.value)}
                placeholder="e.g. Question about Buddy's appointment"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-[#1B3A5C]">Message</Label>
            <Textarea
              rows={4}
              value={replyBody}
              onChange={(e) => setReplyBody(e.target.value)}
              placeholder="Write a note for clinic staff..."
            />
          </div>
          <Button onClick={handleSendToClinic} disabled={sending} className="bg-[#1B3A5C] hover:bg-[#152e4a] text-white">
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Send to clinic
          </Button>
        </CardContent>
      </Card>

      <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
        <CardHeader className="pb-3 bg-slate-50/60 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <CardTitle className="font-heading text-base font-bold text-[#1B3A5C] flex items-center gap-2">
            <Mail className="h-4 w-4 text-[#1FA8A8]" /> Communication History
          </CardTitle>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search messages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs focus-visible:ring-[#1FA8A8]"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <PageSkeleton rows={6} />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-[#E8EEF4] hover:bg-[#E8EEF4]">
                  <TableHead className="text-[#1B3A5C] font-bold text-xs">Date & Time</TableHead>
                  <TableHead className="text-[#1B3A5C] font-bold text-xs">From</TableHead>
                  <TableHead className="text-[#1B3A5C] font-bold text-xs">Target Pet</TableHead>
                  <TableHead className="text-[#1B3A5C] font-bold text-xs">Type</TableHead>
                  <TableHead className="text-[#1B3A5C] font-bold text-xs">Channel</TableHead>
                  <TableHead className="text-[#1B3A5C] font-bold text-xs">Subject / Message Content</TableHead>
                  <TableHead className="text-[#1B3A5C] font-bold text-xs text-right pr-6">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMessages.length ? (
                  filteredMessages.map((m: any) => (
                    <TableRow key={m.id} className="hover:bg-slate-50 transition-colors">
                      <TableCell className="text-xs font-medium text-slate-700 whitespace-nowrap">
                        {formatDateTimePH(m.sent_at || m.created_at)}
                      </TableCell>
                      <TableCell className="text-xs font-semibold text-[#1B3A5C]">
                        {String(m.sent_by || "").toLowerCase() === "owner" ? "You" : m.sent_by || "Clinic"}
                      </TableCell>
                      <TableCell className="font-semibold text-xs text-[#1B3A5C]">
                        {petMap.get(m.pet_id)?.name || "General Notice"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[11px] font-semibold border-[#1FA8A8]/30 text-[#1B3A5C] bg-[#E8F6F6]">
                          {m.message_type || "Notice"}
                        </Badge>
                      </TableCell>
                      <TableCell>{getChannelBadge(m.channel)}</TableCell>
                      <TableCell className="text-xs max-w-[360px]">
                        {m.subject ? <strong className="block text-[#1B3A5C] truncate">{m.subject}</strong> : null}
                        <span className="text-muted-foreground line-clamp-2">{m.body}</span>
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs text-[#1FA8A8] hover:text-[#198a8a] hover:bg-[#E8F6F6]"
                          onClick={() => setSelectedMessage(m)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> Read
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="p-0">
                      <EmptyState
                        icon={MessageSquare}
                        title="No messages found."
                        description="Clinic communications and notifications sent to you will appear here."
                      />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedMessage} onOpenChange={(open) => !open && setSelectedMessage(null)}>
        {selectedMessage && (
          <DialogContent className="sm:max-w-lg rounded-2xl border-0 shadow-2xl overflow-hidden p-0">
            <div className="bg-gradient-to-r from-[#4A0A10] to-[#E5192C] p-5 text-white">
              <div className="flex items-center gap-2 text-xs text-rose-200 font-semibold mb-1">
                <Sparkles className="h-3.5 w-3.5" /> Harbourside Communication Notice
              </div>
              <DialogTitle className="text-xl font-bold font-heading text-white">
                {selectedMessage.subject || selectedMessage.message_type || "Notice Detail"}
              </DialogTitle>
              <p className="text-xs text-slate-200 mt-1">
                Dispatched on {formatDateTimePH(selectedMessage.sent_at || selectedMessage.created_at)}
              </p>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Message Type</span>
                  <span className="font-semibold text-[#1B3A5C]">{selectedMessage.message_type || "Custom Notice"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Target Pet</span>
                  <span className="font-semibold text-[#1FA8A8]">{petMap.get(selectedMessage.pet_id)?.name || "General Account Notice"}</span>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <Label className="text-xs font-bold text-[#1B3A5C]">Message Body</Label>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 leading-relaxed text-slate-800 whitespace-pre-wrap text-sm">
                  {selectedMessage.body}
                </div>
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
