"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Send, Loader2, Mail, Phone } from "lucide-react";
import { db } from "@/lib/db-client";
import { useRows, useInvalidate } from "@/hooks/useRows";
import { toast } from "sonner";

export default function Messaging() {
  const { data: owners = [] } = useRows<any>("owners", { orderBy: "name" });
  const { data: messages = [], isLoading } = useRows<any>("messages", { orderBy: "sent_at", ascending: false });
  const invalidate = useInvalidate();

  const ownerName = (id?: string) => owners.find((o) => o.id === id)?.name ?? "—";

  // SMS state
  const [smsOwner, setSmsOwner] = useState("");
  const [phone, setPhone] = useState("");
  const [smsBody, setSmsBody] = useState("");
  const [sendingSms, setSendingSms] = useState(false);

  // Email state
  const [emailOwner, setEmailOwner] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);

  const sendSms = async () => {
    if (!smsBody.trim()) { toast.error("Message body is required"); return; }
    const targetPhone = phone || owners.find((o) => o.id === smsOwner)?.contact || "";
    if (!targetPhone) { toast.error("Provide a phone number or select an owner with a contact"); return; }
    setSendingSms(true);
    const { error } = await db.from("messages").insert({
      owner_id: smsOwner || null, phone: targetPhone, body: smsBody.trim(),
      channel: "sms", status: "simulated",
    } as any);
    setSendingSms(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`SMS simulated to ${targetPhone}`);
    setSmsBody(""); setPhone(""); setSmsOwner("");
    invalidate("messages");
  };

  const sendEmail = async () => {
    if (!emailBody.trim() || !subject.trim()) { toast.error("Subject and message are required"); return; }
    const targetEmail = email || owners.find((o) => o.id === emailOwner)?.email || "";
    if (!targetEmail) { toast.error("Provide an email or select an owner with an email"); return; }
    setSendingEmail(true);
    const { error } = await db.from("messages").insert({
      owner_id: emailOwner || null, email: targetEmail, subject: subject.trim(), body: emailBody.trim(),
      phone: "", channel: "email", status: "simulated",
    } as any);
    setSendingEmail(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Email simulated to ${targetEmail}`);
    setEmailBody(""); setSubject(""); setEmail(""); setEmailOwner("");
    invalidate("messages");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2"><MessageSquare className="h-6 w-6 text-primary" /> Communications</h1>
        <p className="text-muted-foreground text-sm">Send SMS and Email from one place — messages are simulated and logged.</p>
      </div>

      <Tabs defaultValue="sms">
        <TabsList>
          <TabsTrigger value="sms"><Phone className="h-4 w-4 mr-1" /> SMS</TabsTrigger>
          <TabsTrigger value="email"><Mail className="h-4 w-4 mr-1" /> Email</TabsTrigger>
        </TabsList>

        <TabsContent value="sms">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 space-y-4 max-w-xl">
              <h2 className="font-heading font-semibold">Compose SMS</h2>
              <div className="space-y-2"><Label>Owner (optional)</Label>
                <Select value={smsOwner} onValueChange={(v) => { setSmsOwner(v); setPhone(owners.find((o) => o.id === v)?.contact ?? ""); }}>
                  <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                  <SelectContent>{owners.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Phone Number</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09XXXXXXXXX" /></div>
              <div className="space-y-2"><Label>Message</Label><Textarea value={smsBody} onChange={(e) => setSmsBody(e.target.value)} rows={4} maxLength={480} placeholder="Reminder: your pet's vaccination is due..." /></div>
              <Button onClick={sendSms} disabled={sendingSms} className="w-full">{sendingSms ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1" /> Send SMS (Simulated)</>}</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 space-y-4 max-w-xl">
              <h2 className="font-heading font-semibold">Compose Email</h2>
              <div className="space-y-2"><Label>Owner (optional)</Label>
                <Select value={emailOwner} onValueChange={(v) => { setEmailOwner(v); setEmail(owners.find((o) => o.id === v)?.email ?? ""); }}>
                  <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                  <SelectContent>{owners.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Email Address</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="owner@email.com" /></div>
              <div className="space-y-2"><Label>Subject</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Vaccination reminder" /></div>
              <div className="space-y-2"><Label>Message</Label><Textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} rows={5} placeholder="Dear pet owner..." /></div>
              <Button onClick={sendEmail} disabled={sendingEmail} className="w-full">{sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-1" /> Send Email (Simulated)</>}</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="p-4 border-b"><h2 className="font-heading font-semibold">Communication Log</h2></div>
          {isLoading ? <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
            <Table>
              <TableHeader><TableRow><TableHead>Channel</TableHead><TableHead>To</TableHead><TableHead>Subject / Message</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {messages.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell><Badge variant={m.channel === "email" ? "default" : "secondary"}>{m.channel === "email" ? "Email" : "SMS"}</Badge></TableCell>
                    <TableCell className="font-medium">{ownerName(m.owner_id)}<div className="text-xs text-muted-foreground">{m.channel === "email" ? m.email : m.phone}</div></TableCell>
                    <TableCell className="max-w-[260px] truncate">{m.subject ? <span className="font-medium">{m.subject}: </span> : null}{m.body}</TableCell>
                    <TableCell><Badge variant="secondary">{m.status}</Badge></TableCell>
                  </TableRow>
                ))}
                {messages.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No messages yet</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

