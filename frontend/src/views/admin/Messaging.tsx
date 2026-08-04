"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  MessageSquare,
  Send,
  Loader2,
  Mail,
  Phone,
  Bell,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  Eye,
  Calendar,
  Sparkles,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  Info,
} from "lucide-react";
import { db } from "@/lib/db-client";
import { useRows, useInvalidate } from "@/hooks/useRows";
import { toast } from "sonner";
import { formatDate } from "@/lib/age";
import { formatNowPH, todayPH } from "@/lib/datetime";
import { useAuth } from "@/hooks/useAuth";

type MessageRow = {
  id: string;
  owner_id?: string | null;
  pet_id?: string | null;
  phone?: string | null;
  email?: string | null;
  subject?: string | null;
  body: string;
  channel: string;
  message_type?: string | null;
  status: string;
  sent_by?: string | null;
  scheduled_at?: string | null;
  sent_at?: string;
  created_at?: string;
  owners?: { name: string; contact?: string; email?: string } | null;
  pets?: { name: string } | null;
};

const ITEMS_PER_PAGE = 8;

const MESSAGE_TYPES = [
  "Custom Message",
  "Appointment Approved",
  "Appointment Reminder",
  "Appointment Rescheduled",
  "Appointment Cancelled",
  "Vaccination Reminder",
  "Deworming Reminder",
  "General Announcement",
];

const DELIVERY_CHANNELS = [
  { value: "ALL", label: "Email + SMS + In-App (All Channels)" },
  { value: "EMAIL_SMS", label: "Email + SMS" },
  { value: "EMAIL_INAPP", label: "Email + In-App" },
  { value: "SMS_INAPP", label: "SMS + In-App" },
  { value: "IN_APP", label: "In-App Notification Only" },
  { value: "EMAIL", label: "Email Only" },
  { value: "SMS", label: "SMS Only" },
];

export default function Messaging() {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const { data: owners = [] } = useRows<any>("owners", { orderBy: "name" });
  const { data: pets = [] } = useRows<any>("pets", { orderBy: "name" });
  const { data: messages = [], isLoading } = useRows<MessageRow>("messages", {
    orderBy: "created_at",
    ascending: false,
  });

  const invalidate = useInvalidate();

  const ownerMap = useMemo(() => new Map(owners.map((o) => [o.id, o])), [owners]);
  const petMap = useMemo(() => new Map(pets.map((p) => [p.id, p])), [pets]);

  // Form State
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [selectedPetId, setSelectedPetId] = useState("");
  const [messageType, setMessageType] = useState("Custom Message");
  const [deliveryChannel, setDeliveryChannel] = useState("ALL");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [sending, setSending] = useState(false);

  // History State
  const [search, setSearch] = useState("");
  const [filterChannel, setFilterChannel] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  // View Message Modal
  const [viewMessage, setViewMessage] = useState<MessageRow | null>(null);

  // Filtered Pets for Selected Owner
  const ownerPets = useMemo(() => {
    if (!selectedOwnerId) return pets;
    return pets.filter((p) => p.owner_id === selectedOwnerId);
  }, [pets, selectedOwnerId]);

  // Template Auto-Fill Logic
  const handleMessageTypeChange = (type: string) => {
    setMessageType(type);
    const owner = ownerMap.get(selectedOwnerId);
    const pet = petMap.get(selectedPetId);

    const ownerName = owner?.name || "Valued Pet Owner";
    const petName = pet?.name || "your pet";

    switch (type) {
      case "Appointment Approved":
        setSubject(`Appointment Approved - Harbourside Veterinary Clinic`);
        setBody(
          `Dear ${ownerName},\n\nWe are pleased to inform you that your appointment request for ${petName} has been APPROVED.\n\nPlease arrive 10 minutes prior to your scheduled time.\n\nThank you,\nHarbourside Veterinary Clinic`
        );
        break;

      case "Appointment Reminder":
        setSubject(`Appointment Reminder for ${petName}`);
        setBody(
          `Reminder: ${petName} has an upcoming appointment scheduled at Harbourside Veterinary Clinic.\n\nIf you need to reschedule, please contact us or update via the online portal.\n\nThank you!`
        );
        break;

      case "Appointment Rescheduled":
        setSubject(`Appointment Rescheduled - Harbourside Veterinary Clinic`);
        setBody(
          `Dear ${ownerName},\n\nYour appointment for ${petName} has been rescheduled. Please check your online portal or schedule for updated date and time details.\n\nHarbourside Veterinary Clinic`
        );
        break;

      case "Appointment Cancelled":
        setSubject(`Appointment Cancellation Notice`);
        setBody(
          `Dear ${ownerName},\n\nYour appointment for ${petName} at Harbourside Veterinary Clinic has been cancelled.\n\nPlease contact us if you would like to book a new slot.`
        );
        break;

      case "Vaccination Reminder":
        setSubject(`Vaccination Reminder for ${petName}`);
        setBody(
          `Dear ${ownerName},\n\nThis is a friendly reminder that ${petName} is due for a routine vaccination.\n\nKeeping vaccinations up to date protects ${petName} against preventable diseases. Book an appointment today!\n\nHarbourside Veterinary Clinic`
        );
        break;

      case "Deworming Reminder":
        setSubject(`Deworming Due Reminder for ${petName}`);
        setBody(
          `Dear ${ownerName},\n\nThis is a friendly reminder that ${petName} is due for scheduled deworming treatment.\n\nVisit Harbourside Veterinary Clinic to ensure complete parasite protection.`
        );
        break;

      case "General Announcement":
        setSubject(`Clinic Announcement - Harbourside Veterinary Clinic`);
        setBody(
          `Dear Pet Owners,\n\nHarbourside Veterinary Clinic announces regular operating hours and enhanced pet care services. Visit our portal for updates and scheduling.\n\nWarm regards,\nClinic Staff`
        );
        break;

      default:
        setSubject("");
        setBody("");
        break;
    }
  };

  // Send Message Dispatcher
  const handleSendMessage = async () => {
    if (!body.trim()) {
      toast.error("Message body is required.");
      return;
    }

    const owner = ownerMap.get(selectedOwnerId);
    const targetPhone = owner?.contact || "";
    const targetEmail = owner?.email || "";

    setSending(true);

    const payload = {
      owner_id: selectedOwnerId || null,
      pet_id: selectedPetId || null,
      phone: targetPhone,
      email: targetEmail,
      subject: subject.trim() || `${messageType} - Harbourside Vet`,
      body: body.trim(),
      channel: deliveryChannel,
      message_type: messageType,
      status: "SENT",
      sent_by: isAdmin ? "Admin" : "Staff",
      scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null,
    };

    const { error } = await db.from("messages").insert(payload as any);
    setSending(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Message dispatched via ${deliveryChannel.replace("_", " + ")} successfully.`);

    // Reset Form
    setSelectedOwnerId("");
    setSelectedPetId("");
    setMessageType("Custom Message");
    setSubject("");
    setBody("");
    setScheduledAt("");

    invalidate("messages");
  };

  // Filter & Search Logic for History
  const filteredMessages = useMemo(() => {
    return messages.filter((m) => {
      const q = search.toLowerCase().trim();
      const ownerNameStr = (m.owners?.name || ownerMap.get(m.owner_id || "")?.name || "").toLowerCase();
      const petNameStr = (m.pets?.name || petMap.get(m.pet_id || "")?.name || "").toLowerCase();
      const subjectStr = (m.subject || "").toLowerCase();
      const bodyStr = m.body.toLowerCase();
      const phoneStr = (m.phone || "").toLowerCase();
      const emailStr = (m.email || "").toLowerCase();

      // Search Query
      if (
        q &&
        !ownerNameStr.includes(q) &&
        !petNameStr.includes(q) &&
        !subjectStr.includes(q) &&
        !bodyStr.includes(q) &&
        !phoneStr.includes(q) &&
        !emailStr.includes(q)
      ) {
        return false;
      }

      // Channel Filter
      if (filterChannel !== "all" && m.channel.toLowerCase() !== filterChannel.toLowerCase()) {
        return false;
      }

      // Type Filter
      if (filterType !== "all" && (m.message_type || "").toLowerCase() !== filterType.toLowerCase()) {
        return false;
      }

      // Status Filter
      if (filterStatus !== "all" && m.status.toLowerCase() !== filterStatus.toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [messages, search, filterChannel, filterType, filterStatus, ownerMap, petMap]);

  // Pagination
  const totalPages = Math.ceil(filteredMessages.length / ITEMS_PER_PAGE) || 1;
  const paginatedMessages = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredMessages.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredMessages, currentPage]);

  const getChannelBadge = (ch: string) => {
    switch (ch) {
      case "ALL":
        return <Badge className="bg-purple-600 text-white">Email + SMS + In-App</Badge>;
      case "EMAIL_SMS":
        return <Badge className="bg-blue-600 text-white">Email + SMS</Badge>;
      case "EMAIL_INAPP":
        return <Badge className="bg-indigo-600 text-white">Email + In-App</Badge>;
      case "SMS_INAPP":
        return <Badge className="bg-teal-600 text-white">SMS + In-App</Badge>;
      case "EMAIL":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Email Only</Badge>;
      case "SMS":
        return <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">SMS Only</Badge>;
      default:
        return <Badge variant="secondary">In-App Only</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Top Header */}
      <div>
        <h1 className="font-heading text-2xl font-bold flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" /> Communications Hub
        </h1>
        <p className="text-muted-foreground text-sm">
          Send Email, SMS, and In-App notifications to pet owners with automated reminders and pre-formatted templates
        </p>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="compose" className="space-y-4">
        <TabsList className="bg-muted p-1">
          <TabsTrigger value="compose" className="text-xs font-semibold flex items-center gap-1.5">
            <Send className="h-4 w-4" /> Compose & Send Message
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs font-semibold flex items-center gap-1.5">
            <Clock className="h-4 w-4" /> Communication History Log ({messages.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Compose & Send */}
        <TabsContent value="compose">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-6 space-y-4 max-w-2xl">
              <h2 className="font-heading text-base font-bold flex items-center gap-2">
                <Send className="h-4 w-4 text-primary" /> Compose New Communication
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Recipient Owner */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Select Recipient Owner *</Label>
                  <Select
                    value={selectedOwnerId}
                    onValueChange={(v) => {
                      setSelectedOwnerId(v);
                      setSelectedPetId("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Owner..." />
                    </SelectTrigger>
                    <SelectContent>
                      {owners.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.name} ({o.contact || o.email || "No contact"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Pet Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Target Pet (Optional)</Label>
                  <Select value={selectedPetId} onValueChange={setSelectedPetId}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Owner Pets" />
                    </SelectTrigger>
                    <SelectContent>
                      {ownerPets.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} ({p.species})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Message Type */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Message Type / Template</Label>
                  <Select value={messageType} onValueChange={handleMessageTypeChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MESSAGE_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Delivery Channels */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Delivery Channels *</Label>
                  <Select value={deliveryChannel} onValueChange={setDeliveryChannel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DELIVERY_CHANNELS.map((ch) => (
                        <SelectItem key={ch.value} value={ch.value}>
                          {ch.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Subject Line */}
              <div className="space-y-1.5">
                <Label className="text-xs">Subject Line / Notification Title *</Label>
                <Input
                  placeholder="e.g. Vaccination Due Reminder for Buddy"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              {/* Message Body */}
              <div className="space-y-1.5">
                <Label className="text-xs">Message Body *</Label>
                <Textarea
                  placeholder="Enter message content..."
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={6}
                />
              </div>

              {/* Scheduled Time Option */}
              <div className="space-y-1.5 border-t pt-3">
                <Label className="text-xs">Schedule Delivery Date & Time (Optional)</Label>
                <Input
                  type="datetime-local"
                  value={scheduledAt}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>

              <Button onClick={handleSendMessage} disabled={sending} className="w-full">
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1.5" /> Dispatch Communication
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Communication History */}
        <TabsContent value="history" className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {/* Search */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs">Search History</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search Recipient, Pet, Subject, Body..."
                      className="pl-9"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setCurrentPage(1);
                      }}
                    />
                  </div>
                </div>

                {/* Channel Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Channel</Label>
                  <Select
                    value={filterChannel}
                    onValueChange={(v) => {
                      setFilterChannel(v);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Channels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Channels</SelectItem>
                      <SelectItem value="all_ch">All Three (Email+SMS+In-App)</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="in_app">In-App</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Delivery Status</Label>
                  <Select
                    value={filterStatus}
                    onValueChange={(v) => {
                      setFilterStatus(v);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* History Data Table */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-12 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sent Time</TableHead>
                        <TableHead>Recipient Owner</TableHead>
                        <TableHead>Target Pet</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Subject / Content Preview</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right pr-6">View</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedMessages.length ? (
                        paginatedMessages.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="text-xs">
                              {formatDate(m.sent_at || m.created_at)}
                            </TableCell>
                            <TableCell className="font-semibold text-xs">
                              {m.owners?.name || ownerMap.get(m.owner_id || "")?.name || "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {m.pets?.name || petMap.get(m.pet_id || "")?.name || "General"}
                            </TableCell>
                            <TableCell>{getChannelBadge(m.channel)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {m.message_type || "Custom"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">
                              {m.subject ? <strong>{m.subject}: </strong> : null}
                              {m.body}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  m.status === "FAILED"
                                    ? "bg-rose-50 text-rose-700 border-rose-200"
                                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                                }
                              >
                                {m.status || "SENT"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right pr-4">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={() => setViewMessage(m)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                            No communication logs found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  <div className="p-4 border-t flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Showing {filteredMessages.length ? (currentPage - 1) * ITEMS_PER_PAGE + 1 : 0} to{" "}
                      {Math.min(currentPage * ITEMS_PER_PAGE, filteredMessages.length)} of {filteredMessages.length} logs
                    </span>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      >
                        <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
                      </Button>
                      <span>
                        Page {currentPage} of {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                      >
                        Next <ChevronRight className="h-3.5 w-3.5 ml-1" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* View Message Modal */}
      <Dialog open={!!viewMessage} onOpenChange={() => setViewMessage(null)}>
        <DialogContent className="max-w-lg">
          {viewMessage && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-6">
                  <DialogTitle className="font-heading text-base font-bold">
                    Communication Log Details
                  </DialogTitle>
                  {getChannelBadge(viewMessage.channel)}
                </div>
              </DialogHeader>

              <div className="space-y-3 pt-2 text-xs">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Recipient Owner:</span>
                  <span className="font-bold">{ownerMap.get(viewMessage.owner_id || "")?.name || viewMessage.owners?.name || "—"}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Target Pet:</span>
                  <span>{petMap.get(viewMessage.pet_id || "")?.name || viewMessage.pets?.name || "General"}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Message Type:</span>
                  <span className="font-semibold">{viewMessage.message_type || "Custom Message"}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Sent Time:</span>
                  <span>{formatDate(viewMessage.sent_at || viewMessage.created_at)}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Dispatched By:</span>
                  <span>{viewMessage.sent_by || "System"}</span>
                </div>

                <div className="p-3 rounded-lg border bg-muted/40 space-y-1.5 mt-2">
                  <span className="font-bold text-primary block">{viewMessage.subject || "No Subject"}</span>
                  <p className="whitespace-pre-wrap text-muted-foreground leading-relaxed">{viewMessage.body}</p>
                </div>
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button variant="outline" onClick={() => setViewMessage(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
