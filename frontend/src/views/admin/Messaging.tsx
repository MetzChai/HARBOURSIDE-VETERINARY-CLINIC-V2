"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
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
import { PageHeader } from "@/components/PageHeader";

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
  const [activeTab, setActiveTab] = useState("compose");
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [selectedPetId, setSelectedPetId] = useState("NONE");
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

  const searchParams = useSearchParams();

  // URL Params Pre-fill
  useEffect(() => {
    const pOwner = searchParams.get("ownerId");
    const pPet = searchParams.get("petId");
    const pType = searchParams.get("type");

    if (pOwner) setSelectedOwnerId(pOwner);
    if (pPet) setSelectedPetId(pPet);
    if (pType) {
      setMessageType(pType);
    }
  }, [searchParams]);

  // Filtered Pets for Selected Owner
  const ownerPets = useMemo(() => {
    if (!selectedOwnerId || selectedOwnerId === "ALL_OWNERS") return [];
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

    const isBroadcast = selectedOwnerId === "ALL_OWNERS" || (!selectedOwnerId && messageType === "General Announcement");
    if (!selectedOwnerId && messageType !== "General Announcement") {
      toast.error("Please select a pet owner, or choose a general announcement to broadcast.");
      return;
    }

    const owner = isBroadcast ? null : ownerMap.get(selectedOwnerId);
    const targetPhone = owner?.contact || "";
    const targetEmail = owner?.email || "";

    setSending(true);

    let scheduledIso: string | null = null;
    if (scheduledAt) {
      const when = new Date(scheduledAt);
      if (!Number.isNaN(when.getTime())) scheduledIso = when.toISOString();
    }

    const payload = {
      owner_id: isBroadcast ? null : selectedOwnerId || null,
      pet_id: isBroadcast || selectedPetId === "NONE" ? null : selectedPetId || null,
      phone: targetPhone || null,
      email: targetEmail || null,
      subject: subject.trim() || `${messageType} - Harbourside Vet`,
      body: body.trim(),
      channel: deliveryChannel,
      message_type: messageType,
      status: "SENT",
      sent_by: isAdmin ? "Admin" : "Staff",
      scheduled_at: scheduledIso,
    };

    const { error } = await db.from("messages").insert(payload as any);
    setSending(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    const channelLabel = DELIVERY_CHANNELS.find((c) => c.value === deliveryChannel)?.label || deliveryChannel;
    toast.success(
      scheduledAt
        ? `Message scheduled for ${channelLabel}.`
        : isBroadcast
          ? `Broadcast saved and delivered via ${channelLabel}.`
          : `Message delivered to ${owner?.name || "the pet owner"} via ${channelLabel}.`
    );

    // Reset Form
    setSelectedOwnerId("");
    setSelectedPetId("NONE");
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
      if (filterChannel !== "all") {
        const ch = (m.channel || "").toUpperCase();
        const want = filterChannel.toUpperCase();
        if (want === "ALL" && ch !== "ALL") return false;
        if (want !== "ALL" && ch !== want && !ch.includes(want)) return false;
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
        return <Badge className="bg-brand-navy text-white">Email + SMS + In-App</Badge>;
      case "EMAIL_SMS":
        return <Badge className="bg-brand-navy text-white">Email + SMS</Badge>;
      case "EMAIL_INAPP":
        return <Badge className="bg-brand-teal text-white">Email + In-App</Badge>;
      case "SMS_INAPP":
        return <Badge className="bg-brand-teal text-white">SMS + In-App</Badge>;
      case "EMAIL":
        return <Badge variant="outline" className="bg-brand-navy-light text-brand-navy border-brand-navy/20">Email Only</Badge>;
      case "SMS":
        return <Badge variant="outline" className="bg-brand-teal-light text-brand-teal border-brand-teal/30">SMS Only</Badge>;
      default:
        return <Badge variant="secondary">In-App Only</Badge>;
    }
  };

  return (
    <div className="page-container w-full max-w-7xl mx-auto space-y-6 pb-10">
      {/* Harbourside Branded Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#4A0A10] via-[#7F1D1D] to-[#E5192C] p-6 sm:p-8 text-white shadow-xl">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-rose-200 text-xs font-semibold backdrop-blur-sm border border-white/10">
              <MessageSquare className="h-3.5 w-3.5" /> Harbourside Communication Hub
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold font-heading tracking-tight text-white">
              Communications & Client Outreach 💬
            </h1>
            <p className="text-sm text-slate-200/90 leading-relaxed">
              Dispatch multi-channel automated notices, appointment reminders, vaccination alerts, and custom broadcast messages to pet owners.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 shrink-0">
            <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/20 text-center">
              <p className="text-2xl font-extrabold text-white">{messages.length}</p>
              <p className="text-[11px] text-slate-200 font-medium">Dispatched Logs</p>
            </div>
            <div className="bg-white/10 backdrop-blur-md px-4 py-2.5 rounded-xl border border-white/20 text-center">
              <p className="text-2xl font-extrabold text-brand-teal">{owners.length}</p>
              <p className="text-[11px] text-slate-200 font-medium">Active Pet Owners</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-slate-200/70 p-1 rounded-xl">
          <TabsTrigger value="compose" className="text-xs font-bold flex items-center gap-2 data-[state=active]:bg-[#1B3A5C] data-[state=active]:text-white rounded-lg px-4 py-2">
            <Send className="h-4 w-4 text-[#1FA8A8]" /> Compose & Dispatch Message
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs font-bold flex items-center gap-2 data-[state=active]:bg-[#1B3A5C] data-[state=active]:text-white rounded-lg px-4 py-2">
            <Clock className="h-4 w-4 text-[#1FA8A8]" /> History & Audit Logs ({messages.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Wide 2-Column Compose Grid */}
        <TabsContent value="compose">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Form Column (lg:col-span-7) */}
            <div className="lg:col-span-7 space-y-6">
              <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
                <CardHeader className="pb-3 bg-slate-50/60 border-b">
                  <CardTitle className="font-heading text-base font-bold text-[#1B3A5C] flex items-center gap-2">
                    <Send className="h-4 w-4 text-[#1FA8A8]" /> Message Dispatcher
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Recipient Owner */}
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-[#1B3A5C]">Recipient Pet Owner *</Label>
                      <Select
                        value={selectedOwnerId}
                        onValueChange={(v) => {
                          setSelectedOwnerId(v);
                          setSelectedPetId("NONE");
                        }}
                      >
                        <SelectTrigger className="focus:ring-[#1FA8A8]">
                          <SelectValue placeholder="Select Pet Owner..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ALL_OWNERS">All pet owners (broadcast)</SelectItem>
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
                      <Label className="text-xs font-bold text-[#1B3A5C]">Target Pet (Optional)</Label>
                      <Select value={selectedPetId} onValueChange={setSelectedPetId} disabled={!ownerPets.length}>
                        <SelectTrigger className="focus:ring-[#1FA8A8]">
                          <SelectValue placeholder="All Owner Pets" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NONE">General (no specific pet)</SelectItem>
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
                      <Label className="text-xs font-bold text-[#1B3A5C]">Message Template</Label>
                      <Select value={messageType} onValueChange={handleMessageTypeChange}>
                        <SelectTrigger className="focus:ring-[#1FA8A8]">
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
                      <Label className="text-xs font-bold text-[#1B3A5C]">Delivery Channels *</Label>
                      <Select value={deliveryChannel} onValueChange={setDeliveryChannel}>
                        <SelectTrigger className="focus:ring-[#1FA8A8]">
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
                    <Label className="text-xs font-bold text-[#1B3A5C]">Notification Title / Subject *</Label>
                    <Input
                      placeholder="e.g. Upcoming Vaccination Notice for Buddy"
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="focus-visible:ring-[#1FA8A8]"
                    />
                  </div>

                  {/* Message Body */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-[#1B3A5C]">Message Content *</Label>
                    <Textarea
                      placeholder="Enter detailed message text..."
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={5}
                      className="focus-visible:ring-[#1FA8A8]"
                    />
                  </div>

                  {/* Scheduled Time Option */}
                  <div className="space-y-1.5 border-t pt-3">
                    <Label className="text-xs font-bold text-[#1B3A5C]">Schedule Delivery Date & Time (Optional)</Label>
                    <Input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(e) => setScheduledAt(e.target.value)}
                      className="focus-visible:ring-[#1FA8A8]"
                    />
                  </div>

                  <Button onClick={handleSendMessage} disabled={sending} className="w-full bg-[#1B3A5C] hover:bg-[#152e4a] text-white font-semibold shadow-md py-5 text-sm">
                    {sending ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2 text-[#1FA8A8]" /> {scheduledAt ? "Schedule Communication" : "Dispatch Communication Now"}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Live Message Preview Column (lg:col-span-5) */}
            <div className="lg:col-span-5 space-y-6">
              <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden sticky top-6">
                <CardHeader className="pb-3 bg-slate-50/60 border-b">
                  <CardTitle className="font-heading text-base font-bold text-[#1B3A5C] flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#1FA8A8]" /> Live Client Preview
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <p className="text-xs text-muted-foreground">
                    This is how your message will appear in the pet owner&apos;s portal & notification inbox:
                  </p>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-lg space-y-3">
                    <div className="flex items-center justify-between border-b pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-[#1B3A5C] text-white flex items-center justify-center font-bold text-xs">
                          HVC
                        </div>
                        <div>
                          <p className="text-xs font-bold text-[#1B3A5C]">Harbourside Vet Clinic</p>
                          <p className="text-[10px] text-muted-foreground">Automated Notification</p>
                        </div>
                      </div>
                      <Badge className="bg-[#E8F6F6] text-[#1FA8A8] border-[#1FA8A8]/30 text-[10px] font-semibold">
                        {deliveryChannel}
                      </Badge>
                    </div>

                    <div>
                      <p className="text-xs font-bold text-slate-800">
                        {subject || "Subject Title Preview"}
                      </p>
                      <div className="mt-2 text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">
                        {body || "Message content will appear here..."}
                      </div>
                    </div>

                    <div className="pt-1 flex items-center justify-between text-[11px] text-muted-foreground border-t">
                      <span>Recipient: {selectedOwnerId === "ALL_OWNERS" ? "All pet owners" : selectedOwnerId ? ownerMap.get(selectedOwnerId)?.name : "Selected Owner"}</span>
                      <span>{scheduledAt ? "Scheduled" : "Instant Delivery"}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Communication History Table */}
        <TabsContent value="history" className="space-y-4">
          <Card className="border border-border/80 shadow-sm rounded-xl overflow-hidden">
            <CardHeader className="pb-3 bg-slate-50/60 border-b">
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                {/* Search */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-bold text-[#1B3A5C]">Search History</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search Recipient, Pet, Subject, Body..."
                      className="pl-9 text-xs focus-visible:ring-[#1FA8A8]"
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
                  <Label className="text-xs font-bold text-[#1B3A5C]">Channel</Label>
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
                      <SelectItem value="ALL">Email + SMS + In-App</SelectItem>
                      <SelectItem value="EMAIL">Email</SelectItem>
                      <SelectItem value="SMS">SMS</SelectItem>
                      <SelectItem value="IN_APP">In-App</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-[#1B3A5C]">Delivery Status</Label>
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
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-12 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-[#1FA8A8]" />
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-[#E8EEF4] hover:bg-[#E8EEF4]">
                        <TableHead className="text-[#1B3A5C] font-bold text-xs">Sent Time</TableHead>
                        <TableHead className="text-[#1B3A5C] font-bold text-xs">From</TableHead>
                        <TableHead className="text-[#1B3A5C] font-bold text-xs">Recipient Owner</TableHead>
                        <TableHead className="text-[#1B3A5C] font-bold text-xs">Target Pet</TableHead>
                        <TableHead className="text-[#1B3A5C] font-bold text-xs">Channel</TableHead>
                        <TableHead className="text-[#1B3A5C] font-bold text-xs">Type</TableHead>
                        <TableHead className="text-[#1B3A5C] font-bold text-xs">Subject / Content Preview</TableHead>
                        <TableHead className="text-[#1B3A5C] font-bold text-xs">Status</TableHead>
                        <TableHead className="text-[#1B3A5C] font-bold text-xs text-right pr-6">View</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedMessages.length ? (
                        paginatedMessages.map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="text-xs">
                              {formatDate(m.sent_at || m.created_at)}
                            </TableCell>
                            <TableCell className="text-xs font-semibold text-[#1B3A5C]">
                              {String(m.sent_by || "").toLowerCase() === "owner"
                                ? ownerMap.get(m.owner_id || "")?.name || "Owner"
                                : m.sent_by || "Clinic"}
                            </TableCell>
                            <TableCell className="font-semibold text-xs">
                              {m.owners?.name || ownerMap.get(m.owner_id || "")?.name || (m.owner_id ? "—" : "All owners")}
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
                                    ? "bg-red-50 text-red-800 border-red-200"
                                    : m.status === "PENDING"
                                      ? "bg-amber-50 text-amber-800 border-amber-200"
                                      : "bg-brand-green-light text-brand-green border-brand-green/30"
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
                          <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
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

              <DialogFooter className="pt-4 border-t gap-2">
                {viewMessage.owner_id && String(viewMessage.sent_by || "").toLowerCase() === "owner" && (
                  <Button
                    className="bg-[#1B3A5C] text-white"
                    onClick={() => {
                      setSelectedOwnerId(viewMessage.owner_id || "");
                      setSelectedPetId(viewMessage.pet_id || "NONE");
                      setMessageType("Custom Message");
                      setSubject(viewMessage.subject ? `Re: ${viewMessage.subject}` : "Reply from clinic");
                      setBody("");
                      setViewMessage(null);
                      setActiveTab("compose");
                    }}
                  >
                    Reply to owner
                  </Button>
                )}
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
