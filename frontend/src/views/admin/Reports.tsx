"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  FileText,
  Printer,
  Loader2,
  Calendar,
  Heart,
  PawPrint,
  Users,
  Package,
  Receipt,
  MessageSquare,
  UserCheck,
  Search,
  Download,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Activity,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useRows } from "@/hooks/useRows";
import { formatDate, formatAge } from "@/lib/age";
import { formatNowPH, todayPH, daysFromTodayPH, isBeforeTodayPH } from "@/lib/datetime";
import { useAuth } from "@/hooks/useAuth";
import { canViewReports } from "@/lib/roles";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";

type ReportType =
  | "appointment"
  | "care"
  | "pet"
  | "owner"
  | "inventory"
  | "transaction"
  | "communication"
  | "staff";

const ITEMS_PER_PAGE = 8;
const COLORS = ["#1B3A5C", "#1FA8A8", "#2E7D32", "#C62828", "#8E24AA", "#F57C00", "#0284C7"];

export default function Reports() {
  const router = useRouter();
  const { role, user, loading: authLoading } = useAuth();
  const isAdmin = role === "admin";

  // Data fetching
  const { data: pets = [], isLoading: petsLoading } = useRows<any>("pets", { orderBy: "name" });
  const { data: owners = [], isLoading: ownersLoading } = useRows<any>("owners", { orderBy: "name" });
  const { data: appointments = [], isLoading: apptLoading } = useRows<any>("appointments", { orderBy: "date", ascending: false });
  const { data: careRecords = [], isLoading: careLoading } = useRows<any>("care_records", { orderBy: "date", ascending: false });
  const { data: inventory = [], isLoading: invLoading } = useRows<any>("inventory_items", { orderBy: "name" });
  const { data: transactions = [], isLoading: txnLoading } = useRows<any>("lab_transactions", { orderBy: "created_at", ascending: false });
  const { data: messages = [], isLoading: msgLoading } = useRows<any>("messages", { orderBy: "created_at", ascending: false });
  const { data: profiles = [], isLoading: staffLoading } = useRows<any>("profiles", { orderBy: "created_at", ascending: false });

  // Access Guard
  useEffect(() => {
    if (!authLoading && !canViewReports(role)) {
      router.replace("/admin");
    }
  }, [authLoading, role, router]);

  // Active Report View
  const [selectedReport, setSelectedReport] = useState<ReportType | null>(null);

  // Search & Filters
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [subFilter, setSubFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  if (authLoading || !canViewReports(role)) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const isLoading =
    petsLoading ||
    ownersLoading ||
    apptLoading ||
    careLoading ||
    invLoading ||
    txnLoading ||
    msgLoading ||
    staffLoading;

  const ownerMap = new Map(owners.map((o) => [o.id, o]));
  const petMap = new Map(pets.map((p) => [p.id, p]));

  // Report Cards Configuration
  const reportCards = [
    {
      type: "appointment" as ReportType,
      title: "Appointment Reports",
      desc: "Historical analysis of scheduled, walk-in, completed, and cancelled appointments",
      count: appointments.length,
      icon: Calendar,
      color: "text-brand-navy bg-brand-navy-light",
    },
    {
      type: "care" as ReportType,
      title: "Care History Reports",
      desc: "Check-ups, Vaccinations, Treatments, and Dewormings trends & medical logs",
      count: careRecords.length,
      icon: Heart,
      color: "text-brand-green bg-brand-green-light",
    },
    {
      type: "pet" as ReportType,
      title: "Pet Reports",
      desc: "Species distribution, pet health status, recovered & deceased pet records",
      count: pets.length,
      icon: PawPrint,
      color: "text-brand-teal bg-brand-teal-light",
    },
    {
      type: "owner" as ReportType,
      title: "Owner Reports",
      desc: "Registered vs Walk-in client demographics, active accounts, and visit history",
      count: owners.length,
      icon: Users,
      color: "text-brand-navy bg-brand-navy-light",
    },
    {
      type: "inventory" as ReportType,
      title: "Inventory Reports",
      desc: "Medicines, Vaccines, Dewormers stock summary, low stock, and expiring items",
      count: inventory.length,
      icon: Package,
      color: "text-amber-600 bg-amber-50",
    },
    {
      type: "transaction" as ReportType,
      title: "Transaction Reports",
      desc: "Paid vs Pending payments, Cash vs GCash revenue breakdown & financial logs",
      count: transactions.length,
      icon: Receipt,
      color: "text-brand-green bg-brand-green-light",
    },
    {
      type: "communication" as ReportType,
      title: "Communication Reports",
      desc: "Email, SMS, and In-App notification distribution and delivery status logs",
      count: messages.length,
      icon: MessageSquare,
      color: "text-brand-teal bg-brand-teal-light",
    },
    {
      type: "staff" as ReportType,
      title: "Staff Activity Reports",
      desc: "Staff performance tracking across appointments, care records, and transactions",
      count: profiles.length,
      icon: UserCheck,
      color: "text-brand-navy bg-brand-navy-light",
    },
  ];

  // Date Filter Helper
  const filterByDate = (dateStr?: string | null) => {
    if (!dateStr) return true;
    const d = dateStr.slice(0, 10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  };

  // CSV Exporter
  const exportCSV = (data: any[], filename: string) => {
    if (!data.length) {
      toast.error("No data available to export.");
      return;
    }
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((row) =>
      Object.values(row)
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}_${todayPH()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${filename}.csv successfully.`);
  };

  // Official Report Print Renderer
  const printOfficialReport = (title: string, tableHeaders: string[], tableRows: string[][]) => {
    const w = window.open("", "_blank");
    if (!w) return;

    w.document.write(`
      <html>
        <head>
          <title>${title} - Harbourside Veterinary Clinic</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
            h1 { color: #1B3A5C; margin: 0 0 4px; }
            h2 { color: #1FA8A8; margin: 0 0 16px; font-size: 16px; border-bottom: 2px solid #1B3A5C; padding-bottom: 8px; }
            .header-info { display: flex; justify-content: space-between; font-size: 11px; color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 11px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #E8EEF4; color: #1B3A5C; font-weight: bold; }
            .footer { margin-top: 30px; font-size: 10px; color: #888; border-top: 1px solid #eee; padding-top: 10px; text-align: center; }
          </style>
        </head>
        <body>
          <h1>🩺 Harbourside Veterinary Clinic</h1>
          <h2>${title}</h2>

          <div class="header-info">
            <div>
              <p><strong>Generated By:</strong> ${user?.email || "Clinic Staff"}</p>
              <p><strong>Date Generated:</strong> ${formatNowPH()} (PH Time)</p>
            </div>
            <div>
              <p><strong>Applied Date Range:</strong> ${dateFrom || "Beginning"} to ${dateTo || "Present"}</p>
              <p><strong>Total Records:</strong> ${tableRows.length}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>${tableHeaders.map((h) => `<th>${h}</th>`).join("")}</tr>
            </thead>
            <tbody>
              ${
                tableRows
                  .map((row) => `<tr>${row.map((cell) => `<td>${cell || "—"}</td>`).join("")}</tr>`)
                  .join("") || "<tr><td colSpan='10'>No records found.</td></tr>"
              }
            </tbody>
          </table>

          <div class="footer">Confidential Internal Clinic Report | Harbourside Veterinary Clinic</div>
        </body>
      </html>
    `);
    w.document.close();
    w.print();
  };

  // --- FILTERED DATASETS FOR ALL 8 REPORTS ---

  // 1. Appointments
  const filteredAppointments = useMemo(() => {
    if (selectedReport !== "appointment") return [];
    return appointments.filter((a) => {
      const q = search.toLowerCase().trim();
      const codeStr = (a.appointment_number || "").toLowerCase();
      const petNameStr = (a.pets?.name || petMap.get(a.pet_id)?.name || "").toLowerCase();
      const ownerNameStr = (a.owners?.name || ownerMap.get(a.owner_id)?.name || "").toLowerCase();

      if (q && !codeStr.includes(q) && !petNameStr.includes(q) && !ownerNameStr.includes(q)) return false;
      if (!filterByDate(a.date)) return false;
      if (subFilter !== "all" && (a.status || "").toLowerCase() !== subFilter.toLowerCase()) return false;
      return true;
    });
  }, [selectedReport, appointments, search, dateFrom, dateTo, subFilter, petMap, ownerMap]);

  // 2. Care History
  const filteredCareRecords = useMemo(() => {
    if (selectedReport !== "care") return [];
    return careRecords.filter((c) => {
      const q = search.toLowerCase().trim();
      const petNameStr = (petMap.get(c.pet_id)?.name || "").toLowerCase();
      const diagStr = (c.diagnosis || c.chief_complaint || "").toLowerCase();
      const vetStr = (c.vet || "").toLowerCase();

      if (q && !petNameStr.includes(q) && !diagStr.includes(q) && !vetStr.includes(q)) return false;
      if (!filterByDate(c.date)) return false;
      if (subFilter !== "all" && (c.care_type || c.record_type || "").toLowerCase() !== subFilter.toLowerCase())
        return false;
      return true;
    });
  }, [selectedReport, careRecords, search, dateFrom, dateTo, subFilter, petMap]);

  // 3. Pets
  const filteredPets = useMemo(() => {
    if (selectedReport !== "pet") return [];
    return pets.filter((p) => {
      const q = search.toLowerCase().trim();
      const codeStr = (p.pet_code || "").toLowerCase();
      const petNameStr = p.name.toLowerCase();
      const speciesStr = (p.species || "").toLowerCase();
      const breedStr = (p.breed || "").toLowerCase();
      const ownerNameStr = (ownerMap.get(p.owner_id)?.name || "").toLowerCase();

      if (q && !codeStr.includes(q) && !petNameStr.includes(q) && !speciesStr.includes(q) && !breedStr.includes(q) && !ownerNameStr.includes(q))
        return false;
      if (!filterByDate(p.created_at)) return false;
      if (subFilter !== "all" && (p.status || "healthy").toLowerCase() !== subFilter.toLowerCase()) return false;
      return true;
    });
  }, [selectedReport, pets, search, dateFrom, dateTo, subFilter, ownerMap]);

  // 4. Owners
  const filteredOwners = useMemo(() => {
    if (selectedReport !== "owner") return [];
    return owners.filter((o) => {
      const q = search.toLowerCase().trim();
      const codeStr = (o.owner_code || "").toLowerCase();
      const nameStr = o.name.toLowerCase();
      const contactStr = (o.contact || "").toLowerCase();
      const emailStr = (o.email || "").toLowerCase();

      if (q && !codeStr.includes(q) && !nameStr.includes(q) && !contactStr.includes(q) && !emailStr.includes(q))
        return false;
      if (!filterByDate(o.created_at)) return false;
      if (subFilter === "walk_in" && !o.is_walk_in) return false;
      if (subFilter === "online" && o.is_walk_in) return false;
      if (subFilter === "active" && (o.account_status || "Active") !== "Active") return false;
      return true;
    });
  }, [selectedReport, owners, search, dateFrom, dateTo, subFilter]);

  // 5. Inventory
  const filteredInventory = useMemo(() => {
    if (selectedReport !== "inventory") return [];
    return inventory.filter((i) => {
      const q = search.toLowerCase().trim();
      const nameStr = (i.name || "").toLowerCase();
      const categoryStr = (i.category || "").toLowerCase();
      const itemCodeStr = (i.item_code || "").toLowerCase();

      if (q && !nameStr.includes(q) && !categoryStr.includes(q) && !itemCodeStr.includes(q)) return false;

      const qty = Number(i.quantity ?? 0);
      const reorderLevel = Number(i.reorder_level ?? 5);

      if (subFilter === "low_stock") return qty > 0 && qty <= reorderLevel;
      if (subFilter === "out_of_stock") return qty <= 0;
      if (subFilter === "expiring") {
        const days = i.expiration_date ? daysFromTodayPH(i.expiration_date) : null;
        return days !== null && (days <= 30 || isBeforeTodayPH(i.expiration_date));
      }
      if (["medicine", "medication", "vaccine", "dewormer", "supply"].includes(subFilter)) {
        return categoryStr.includes(subFilter);
      }
      return true;
    });
  }, [selectedReport, inventory, search, subFilter]);

  // 6. Transactions
  const filteredTransactions = useMemo(() => {
    if (selectedReport !== "transaction") return [];
    return transactions.filter((t) => {
      const q = search.toLowerCase().trim();
      const codeStr = (t.transaction_number || "").toLowerCase();
      const petNameStr = (t.pets?.name || petMap.get(t.pet_id)?.name || "").toLowerCase();
      const ownerNameStr = (t.owners?.name || ownerMap.get(t.owner_id)?.name || "").toLowerCase();

      if (q && !codeStr.includes(q) && !petNameStr.includes(q) && !ownerNameStr.includes(q)) return false;
      if (!filterByDate(t.date || t.created_at)) return false;
      if (subFilter !== "all" && (t.payment_status || t.status || "").toLowerCase() !== subFilter.toLowerCase())
        return false;
      return true;
    });
  }, [selectedReport, transactions, search, dateFrom, dateTo, subFilter, petMap, ownerMap]);

  // 7. Communications
  const filteredMessages = useMemo(() => {
    if (selectedReport !== "communication") return [];
    return messages.filter((m) => {
      const q = search.toLowerCase().trim();
      const ownerNameStr = (ownerMap.get(m.owner_id)?.name || "").toLowerCase();
      const subjectStr = (m.subject || "").toLowerCase();
      const bodyStr = m.body.toLowerCase();

      if (q && !ownerNameStr.includes(q) && !subjectStr.includes(q) && !bodyStr.includes(q)) return false;
      if (!filterByDate(m.sent_at || m.created_at)) return false;
      if (subFilter !== "all" && m.channel.toLowerCase() !== subFilter.toLowerCase()) return false;
      return true;
    });
  }, [selectedReport, messages, search, dateFrom, dateTo, subFilter, ownerMap]);

  // 8. Staff Activity
  const filteredStaff = useMemo(() => {
    if (selectedReport !== "staff") return [];
    return profiles.filter((s) => {
      const q = search.toLowerCase().trim();
      const nameStr = (s.full_name || s.email || "").toLowerCase();
      const roleStr = (s.role || "").toLowerCase();
      if (q && !nameStr.includes(q) && !roleStr.includes(q)) return false;
      return true;
    });
  }, [selectedReport, profiles, search]);

  // --- RECHARTS CHART DATA COMPUTATIONS ---
  const apptChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredAppointments.forEach((a) => {
      const s = a.status || "Other";
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.keys(counts).map((name) => ({ name, count: counts[name] }));
  }, [filteredAppointments]);

  const careChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredCareRecords.forEach((c) => {
      const t = (c.care_type || c.record_type || "Check-up").toUpperCase();
      counts[t] = (counts[t] || 0) + 1;
    });
    return Object.keys(counts).map((name) => ({ name, value: counts[name] }));
  }, [filteredCareRecords]);

  const petStatusChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredPets.forEach((p) => {
      const s = p.status || "Healthy";
      counts[s] = (counts[s] || 0) + 1;
    });
    return Object.keys(counts).map((name) => ({ name, value: counts[name] }));
  }, [filteredPets]);

  const txnChartData = useMemo(() => {
    const counts: Record<string, number> = { Cash: 0, GCash: 0 };
    filteredTransactions.forEach((t) => {
      const m = t.payment_method === "GCash" ? "GCash" : "Cash";
      counts[m] = (counts[m] || 0) + Number(t.total_amount || t.total || 0);
    });
    return Object.keys(counts).map((name) => ({ name, Revenue: counts[name] }));
  }, [filteredTransactions]);

  if (isLoading) {
    return <PageSkeleton rows={8} showStats />;
  }

  return (
    <div className="page-container pb-10">
      <PageHeader
        title="Reports"
        description="Generate, filter, export, and print clinic operational reports from existing data"
        actions={
          selectedReport ? (
            <Button variant="outline" size="sm" onClick={() => setSelectedReport(null)}>
              <ArrowLeft className="h-4 w-4 mr-1.5" /> Back to Reports Home
            </Button>
          ) : undefined
        }
      />

      {/* REPORTS HOME (NAVIGATION CENTER CARDS GRID) */}
      {!selectedReport && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {reportCards.map((r) => {
            const IconComponent = r.icon;
            return (
              <Card key={r.type} className="border-0 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className={`p-2.5 rounded-xl ${r.color}`}>
                      <IconComponent className="h-5 w-5" />
                    </div>
                    <Badge variant="secondary" className="font-bold text-xs">
                      {r.count} Records
                    </Badge>
                  </div>
                  <CardTitle className="text-base font-heading font-bold mt-3">{r.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-0">
                  <p className="text-xs text-muted-foreground leading-relaxed">{r.desc}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs font-semibold"
                    onClick={() => {
                      setSelectedReport(r.type);
                      setSubFilter("all");
                      setSearch("");
                      setCurrentPage(1);
                    }}
                  >
                    View Report & Analytics →
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* SELECTED REPORT ANALYTICAL VIEW */}
      {selectedReport && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Search */}
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs">Search Records</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search pet, owner, ID, or keywords..."
                      className="pl-9"
                      value={search}
                      onChange={(e) => {
                        setSearch(e.target.value);
                        setCurrentPage(1);
                      }}
                    />
                  </div>
                </div>

                {/* Date From */}
                <div className="space-y-1">
                  <Label className="text-xs">Date From</Label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>

                {/* Date To */}
                <div className="space-y-1">
                  <Label className="text-xs">Date To</Label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setCurrentPage(1);
                    }}
                  />
                </div>

                {/* Sub Filter Dropdown */}
                <div className="space-y-1">
                  <Label className="text-xs">Filter Category</Label>
                  <Select
                    value={subFilter}
                    onValueChange={(v) => {
                      setSubFilter(v);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Records" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Records</SelectItem>
                      {selectedReport === "appointment" && (
                        <>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </>
                      )}
                      {selectedReport === "care" && (
                        <>
                          <SelectItem value="checkup">Check-ups</SelectItem>
                          <SelectItem value="vaccination">Vaccinations</SelectItem>
                          <SelectItem value="treatment">Treatments</SelectItem>
                          <SelectItem value="deworming">Dewormings</SelectItem>
                        </>
                      )}
                      {selectedReport === "pet" && (
                        <>
                          <SelectItem value="healthy">Healthy</SelectItem>
                          <SelectItem value="under_treatment">Under Treatment</SelectItem>
                          <SelectItem value="recovered">Recovered</SelectItem>
                          <SelectItem value="deceased">Deceased</SelectItem>
                        </>
                      )}
                      {selectedReport === "transaction" && (
                        <>
                          <SelectItem value="paid">Paid Only</SelectItem>
                          <SelectItem value="pending">Pending Only</SelectItem>
                        </>
                      )}
                      {selectedReport === "inventory" && (
                        <>
                          <SelectItem value="low_stock">Low Stock Report</SelectItem>
                          <SelectItem value="out_of_stock">Out-of-Stock Report</SelectItem>
                          <SelectItem value="expiring">Expiring Items Report</SelectItem>
                          <SelectItem value="medicine">Medicines Only</SelectItem>
                          <SelectItem value="vaccine">Vaccines Only</SelectItem>
                          <SelectItem value="dewormer">Dewormers Only</SelectItem>
                          <SelectItem value="supply">Medical Supplies Only</SelectItem>
                        </>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Action Buttons: Export & Print */}
              <div className="flex items-center justify-end gap-2 border-t pt-3">
                {isAdmin && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      if (selectedReport === "appointment") exportCSV(filteredAppointments, "Appointment_Report");
                      else if (selectedReport === "care") exportCSV(filteredCareRecords, "Care_History_Report");
                      else if (selectedReport === "pet") exportCSV(filteredPets, "Pet_Report");
                      else if (selectedReport === "owner") exportCSV(filteredOwners, "Owner_Report");
                      else if (selectedReport === "inventory") exportCSV(filteredInventory, "Inventory_Report");
                      else if (selectedReport === "transaction") exportCSV(filteredTransactions, "Transaction_Report");
                      else if (selectedReport === "communication") exportCSV(filteredMessages, "Communication_Report");
                      else if (selectedReport === "staff") exportCSV(filteredStaff, "Staff_Activity_Report");
                    }}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" /> Export CSV / Excel
                  </Button>
                )}

                <Button
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    if (selectedReport === "appointment") {
                      printOfficialReport(
                        "Historical Appointment Report",
                        ["Apt #", "Pet", "Owner", "Date", "Status"],
                        filteredAppointments.map((a) => [
                          a.appointment_number || a.id.slice(0, 6),
                          a.pets?.name || petMap.get(a.pet_id)?.name || "—",
                          a.owners?.name || ownerMap.get(a.owner_id)?.name || "—",
                          formatDate(a.date),
                          a.status,
                        ])
                      );
                    } else if (selectedReport === "care") {
                      printOfficialReport(
                        "Care History Medical Report",
                        ["Date", "Pet Name", "Care Type", "Diagnosis", "Vet"],
                        filteredCareRecords.map((c) => [
                          formatDate(c.date),
                          petMap.get(c.pet_id)?.name || "—",
                          c.care_type || c.record_type,
                          c.diagnosis || c.chief_complaint || "—",
                          c.vet || "Clinic Staff",
                        ])
                      );
                    } else if (selectedReport === "pet") {
                      printOfficialReport(
                        "Pet Demographics & Status Report",
                        ["Pet Code", "Pet Name", "Species", "Breed", "Owner", "Health Status"],
                        filteredPets.map((p) => [
                          p.pet_code || p.id.slice(0, 6),
                          p.name,
                          p.species || "—",
                          p.breed || "Crossbreed",
                          ownerMap.get(p.owner_id)?.name || "—",
                          p.status || "Healthy",
                        ])
                      );
                    } else if (selectedReport === "transaction") {
                      printOfficialReport(
                        "Clinic Financial & Transaction Report",
                        ["Txn #", "Date", "Pet", "Owner", "Method", "Status", "Amount"],
                        filteredTransactions.map((t) => [
                          t.transaction_number || t.id.slice(0, 6),
                          formatDate(t.date || t.created_at),
                          petMap.get(t.pet_id)?.name || "—",
                          ownerMap.get(t.owner_id)?.name || "—",
                          t.payment_method || "Cash",
                          t.payment_status || "Pending",
                          `₱${Number(t.total_amount || 0).toLocaleString()}`,
                        ])
                      );
                    } else if (selectedReport === "inventory") {
                      printOfficialReport(
                        "Inventory Stock & Expiration Report",
                        ["Item Code", "Item Name", "Category", "Quantity", "Reorder Level", "Expiration Date", "Status"],
                        filteredInventory.map((i) => {
                          const qty = Number(i.quantity ?? 0);
                          const reorder = Number(i.reorder_level ?? 5);
                          let status = "Available";
                          if (i.expiration_date && isBeforeTodayPH(i.expiration_date)) status = "Expired";
                          else if (qty <= 0) status = "Out of Stock";
                          else if (qty <= reorder) status = "Low Stock";

                          return [
                            i.item_code || i.id.slice(0, 8),
                            i.name,
                            i.category || "Supply",
                            `${qty} ${i.unit || "unit"}`,
                            String(reorder),
                            i.expiration_date ? formatDate(i.expiration_date) : "N/A",
                            status,
                          ];
                        })
                      );
                    } else if (selectedReport === "communication") {
                      printOfficialReport(
                        "Communications History Log",
                        ["Sent Date", "Channel", "Type", "Subject"],
                        filteredMessages.map((m) => [
                          formatDate(m.sent_at || m.created_at),
                          m.channel,
                          m.message_type || "Custom",
                          m.subject || m.body.slice(0, 30),
                        ])
                      );
                    }
                  }}
                >
                  <Printer className="h-3.5 w-3.5 mr-1" /> Print Official Report
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* VISUALIZATION CHART BANNER */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold font-heading flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" /> Visual Analytics Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[220px]">
                {selectedReport === "appointment" && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={apptChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#1B3A5C" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}

                {selectedReport === "care" && (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={careChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                        {careChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend fontSize={11} />
                    </PieChart>
                  </ResponsiveContainer>
                )}

                {selectedReport === "pet" && (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={petStatusChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>
                        {petStatusChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend fontSize={11} />
                    </PieChart>
                  </ResponsiveContainer>
                )}

                {selectedReport === "transaction" && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={txnChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip />
                      <Bar dataKey="Revenue" fill="#2E7D32" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}

                {selectedReport !== "appointment" &&
                  selectedReport !== "care" &&
                  selectedReport !== "pet" &&
                  selectedReport !== "transaction" && (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-xs">
                      Visual chart breakdown prepared for current report dataset.
                    </div>
                  )}
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm flex flex-col justify-between">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold font-heading flex items-center gap-2">
                  <Activity className="h-4 w-4 text-brand-teal" /> Report Summary & Highlights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Active Filter Category:</span>
                  <span className="font-bold capitalize">{subFilter}</span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Date Range Applied:</span>
                  <span>{dateFrom || "Beginning"} to {dateTo || "Present"}</span>
                </div>
                <div className="flex justify-between py-2 border-b font-bold text-sm">
                  <span>Filtered Record Count:</span>
                  <span className="text-primary">
                    {selectedReport === "appointment"
                      ? filteredAppointments.length
                      : selectedReport === "care"
                      ? filteredCareRecords.length
                      : selectedReport === "pet"
                      ? filteredPets.length
                      : selectedReport === "owner"
                      ? filteredOwners.length
                      : selectedReport === "inventory"
                      ? filteredInventory.length
                      : selectedReport === "transaction"
                      ? filteredTransactions.length
                      : selectedReport === "communication"
                      ? filteredMessages.length
                      : filteredStaff.length}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* REPORT DATA TABLES */}
          {selectedReport === "appointment" && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-base font-bold">
                  Historical Appointment Analytics ({filteredAppointments.length} Records)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Apt #</TableHead>
                      <TableHead>Pet Name</TableHead>
                      <TableHead>Owner Name</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAppointments.slice(0, 10).map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="font-mono text-xs font-bold text-primary">
                          {a.appointment_number || `APT-${a.id.slice(0, 6)}`}
                        </TableCell>
                        <TableCell className="font-semibold text-xs">
                          {a.pets?.name || petMap.get(a.pet_id)?.name || "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {a.owners?.name || ownerMap.get(a.owner_id)?.name || "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {formatDate(a.date)} at {a.time}
                        </TableCell>
                        <TableCell className="text-xs">{a.appointment_type || a.care_type || "Check-up"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {a.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredAppointments.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No appointment records match filters.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {selectedReport === "care" && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-base font-bold">
                  Care History Medical Records ({filteredCareRecords.length} Records)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Pet Name</TableHead>
                      <TableHead>Care Type</TableHead>
                      <TableHead>Diagnosis / Symptoms</TableHead>
                      <TableHead>Veterinarian / Staff</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCareRecords.slice(0, 10).map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="text-xs">{formatDate(c.date)}</TableCell>
                        <TableCell className="font-semibold text-xs text-primary">
                          {petMap.get(c.pet_id)?.name || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize text-xs">
                            {c.care_type || c.record_type}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{c.diagnosis || c.chief_complaint || "—"}</TableCell>
                        <TableCell className="text-xs">{c.vet || "Clinic Staff"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {selectedReport === "pet" && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-base font-bold">
                  Pet Demographics & Status Records ({filteredPets.length} Records)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pet Code</TableHead>
                      <TableHead>Pet Name</TableHead>
                      <TableHead>Species & Breed</TableHead>
                      <TableHead>Gender / Age</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPets.slice(0, 10).map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-mono text-xs font-bold text-primary">
                          {p.pet_code || `PET-${p.id.slice(0, 6)}`}
                        </TableCell>
                        <TableCell className="font-semibold text-xs">{p.name}</TableCell>
                        <TableCell className="text-xs">
                          {p.species || "—"} ({p.breed || "Crossbreed"})
                        </TableCell>
                        <TableCell className="text-xs">
                          {p.gender || "—"} • {p.dob ? formatAge(p.dob) : p.estimated_age || "—"}
                        </TableCell>
                        <TableCell className="text-xs">{ownerMap.get(p.owner_id)?.name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {p.status || "Healthy"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {selectedReport === "owner" && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-base font-bold">
                  Owner Demographics & Accounts ({filteredOwners.length} Records)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Owner Code</TableHead>
                      <TableHead>Full Name</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Client Type</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOwners.slice(0, 10).map((o) => (
                      <TableRow key={o.id}>
                        <TableCell className="font-mono text-xs font-bold text-primary">
                          {o.owner_code || `OWN-${o.id.slice(0, 6)}`}
                        </TableCell>
                        <TableCell className="font-semibold text-xs">{o.name}</TableCell>
                        <TableCell className="text-xs">{o.contact || "—"}</TableCell>
                        <TableCell className="text-xs">{o.email || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {o.is_walk_in ? "Walk-in" : "Online"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {o.account_status || "Active"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {selectedReport === "inventory" && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-base font-bold">
                  Inventory Stock Reports ({filteredInventory.length} Items)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Expiration Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventory.slice(0, 10).map((i) => (
                      <TableRow key={i.id}>
                        <TableCell className="font-semibold text-xs">{i.name}</TableCell>
                        <TableCell className="text-xs capitalize">{i.category || "Supply"}</TableCell>
                        <TableCell className="font-bold text-xs">{i.quantity ?? 0} {i.unit || "units"}</TableCell>
                        <TableCell className="text-xs">{i.expiration_date ? formatDate(i.expiration_date) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {selectedReport === "transaction" && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-base font-bold">
                  Clinic Financial Transaction Records ({filteredTransactions.length} Records)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Txn #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Pet</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>Services</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right pr-6">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.slice(0, 10).map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs font-bold text-primary">
                          {t.transaction_number || `TXN-${t.id.slice(0, 6)}`}
                        </TableCell>
                        <TableCell className="text-xs">{formatDate(t.date || t.created_at)}</TableCell>
                        <TableCell className="font-semibold text-xs">{petMap.get(t.pet_id)?.name || "—"}</TableCell>
                        <TableCell className="text-xs">{ownerMap.get(t.owner_id)?.name || "—"}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{t.services_rendered}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {t.payment_method || "Cash"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              t.payment_status === "Paid"
                                ? "bg-brand-green-light text-brand-green border-brand-green/30"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                            }
                          >
                            {t.payment_status || "Pending"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-bold text-xs pr-6">
                          ₱{Number(t.total_amount || 0).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {selectedReport === "communication" && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-base font-bold">
                  Communication History Logs ({filteredMessages.length} Messages)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sent Date</TableHead>
                      <TableHead>Recipient Owner</TableHead>
                      <TableHead>Channel</TableHead>
                      <TableHead>Message Type</TableHead>
                      <TableHead>Subject / Body</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMessages.slice(0, 10).map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="text-xs">{formatDate(m.sent_at || m.created_at)}</TableCell>
                        <TableCell className="font-semibold text-xs">{ownerMap.get(m.owner_id)?.name || "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">{m.channel}</Badge>
                        </TableCell>
                        <TableCell className="text-xs">{m.message_type || "Custom"}</TableCell>
                        <TableCell className="text-xs max-w-[250px] truncate">{m.subject || m.body}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {selectedReport === "staff" && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="font-heading text-base font-bold">
                  Staff Activity & Performance Reports ({filteredStaff.length} Accounts)
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Registered Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaff.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-semibold text-xs">{s.full_name || "Staff Member"}</TableCell>
                        <TableCell className="text-xs">{s.email || "—"}</TableCell>
                        <TableCell><Badge variant="outline" className="capitalize text-xs">{s.role || "staff"}</Badge></TableCell>
                        <TableCell className="text-xs">{formatDate(s.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
