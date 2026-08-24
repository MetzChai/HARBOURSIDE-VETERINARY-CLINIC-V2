"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  DollarSign,
  FlaskConical,
  Plus,
  Printer,
  Search,
  CheckCircle,
  Clock,
  Pencil,
  Trash2,
  Eye,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CreditCard,
  FileText,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/db-client";
import { useRows, useInvalidate } from "@/hooks/useRows";
import { formatDate } from "@/lib/age";
import { formatNowPH, todayPH } from "@/lib/datetime";
import { useAuth } from "@/hooks/useAuth";

type TransactionRow = {
  id: string;
  transaction_number?: string | null;
  appointment_id?: string | null;
  pet_id?: string | null;
  owner_id?: string | null;
  care_record_id?: string | null;
  date?: string | null;
  services_rendered?: string | null;
  total_amount?: number | null;
  total?: number | null;
  payment_method?: string | null;
  payment_status?: string | null;
  status?: string | null;
  notes?: string | null;
  created_at?: string;
  pets?: { name: string } | null;
  owners?: { name: string } | null;
};

type TransactionItemRow = {
  id: string;
  transaction_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  category?: string | null;
  source?: string | null;
  inventory_transaction_id?: string | null;
};

const formatPeso = (value: number | string | null | undefined) =>
  `₱${Number(value ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type LabRecordRow = {
  id: string;
  lab_record_number?: string | null;
  appointment_id?: string | null;
  pet_id?: string | null;
  owner_id?: string | null;
  test_type: string;
  result?: string | null;
  remarks?: string | null;
  date_conducted?: string | null;
  created_at?: string;
  pets?: { name: string } | null;
  owners?: { name: string } | null;
};

const ITEMS_PER_PAGE = 8;
const TEST_TYPES = ["Blood Test", "Urinalysis", "Fecalysis", "Skin Scraping", "Other"];

export default function LabTransactions() {
  const { role } = useAuth();
  const isAdmin = role === "admin";

  const { data: rawTransactions = [], isLoading: loadingTxns } = useRows<TransactionRow>("lab_transactions", {
    orderBy: "created_at",
    ascending: false,
  });

  const { data: transactionItems = [] } = useRows<TransactionItemRow>("lab_transaction_items");

  const { data: labRecords = [], isLoading: loadingLabs } = useRows<LabRecordRow>("lab_records", {
    orderBy: "created_at",
    ascending: false,
  });

  const { data: pets = [] } = useRows<any>("pets", { orderBy: "name" });
  const { data: owners = [] } = useRows<any>("owners", { orderBy: "name" });
  const { data: appointments = [] } = useRows<any>("appointments", { orderBy: "date", ascending: false });

  const invalidate = useInvalidate();

  // Maps for lookups
  const petMap = useMemo(() => new Map(pets.map((p) => [p.id, p])), [pets]);
  const ownerMap = useMemo(() => new Map(owners.map((o) => [o.id, o])), [owners]);
  const itemsByTxnId = useMemo(() => {
    const map = new Map<string, TransactionItemRow[]>();
    for (const item of transactionItems) {
      const list = map.get(item.transaction_id) ?? [];
      list.push(item);
      map.set(item.transaction_id, list);
    }
    return map;
  }, [transactionItems]);

  // Tab State
  const [activeTab, setActiveTab] = useState("transactions");

  // Search & Filters for Transactions
  const [txnSearch, setTxnSearch] = useState("");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState("all");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState("all");
  const [txnPage, setTxnPage] = useState(1);

  // Search & Filters for Lab Records
  const [labSearch, setLabSearch] = useState("");
  const [filterTestType, setFilterTestType] = useState("all");
  const [labPage, setLabPage] = useState(1);

  // Modals & Forms
  const [viewTxn, setViewTxn] = useState<TransactionRow | null>(null);
  const [showAddTxn, setShowAddTxn] = useState(false);
  const [editTxn, setEditTxn] = useState<TransactionRow | null>(null);
  const [deleteTxnTarget, setDeleteTxnTarget] = useState<TransactionRow | null>(null);

  const [showAddLab, setShowAddLab] = useState(false);
  const [viewLab, setViewLab] = useState<LabRecordRow | null>(null);

  const [saving, setSaving] = useState(false);

  // Transaction Form State
  const emptyTxnForm = {
    transaction_number: "",
    pet_id: "",
    owner_id: "",
    appointment_id: "",
    services_rendered: "General Veterinary Check-up",
    total_amount: "500",
    payment_method: "Cash",
    payment_status: "Pending",
    notes: "",
  };
  const [txnForm, setTxnForm] = useState(emptyTxnForm);

  // Lab Record Form State
  const emptyLabForm = {
    lab_record_number: "",
    pet_id: "",
    owner_id: "",
    appointment_id: "",
    test_type: "Blood Test",
    result: "",
    remarks: "",
    date_conducted: todayPH(),
  };
  const [labForm, setLabForm] = useState(emptyLabForm);

  // Normalization helper for transaction fields
  const transactions = useMemo(() => {
    return rawTransactions.map((t) => ({
      ...t,
      transaction_number: t.transaction_number || `TXN-${t.id.slice(0, 6)}`,
      total_amount: Number(t.total_amount ?? t.total ?? 0),
      payment_status: t.payment_status || (t.status === "Paid" ? "Paid" : "Pending"),
      payment_method: t.payment_method || "Cash",
      services_rendered: t.services_rendered || "Veterinary Medical Service",
    }));
  }, [rawTransactions]);

  // Metric Totals
  const metrics = useMemo(() => {
    const totalRevenue = transactions
      .filter((t) => t.payment_status === "Paid")
      .reduce((sum, t) => sum + (t.total_amount || 0), 0);

    const pendingTxns = transactions.filter((t) => t.payment_status === "Pending");
    const pendingAmount = pendingTxns.reduce((sum, t) => sum + (t.total_amount || 0), 0);

    return {
      totalRevenue,
      pendingCount: pendingTxns.length,
      pendingAmount,
      totalCount: transactions.length,
    };
  }, [transactions]);

  // Open Add Transaction Modal
  const openAddTxn = () => {
    setTxnForm({
      ...emptyTxnForm,
      transaction_number: `TXN-${Date.now().toString().slice(-6)}`,
      pet_id: pets[0]?.id || "",
      owner_id: pets[0]?.owner_id || owners[0]?.id || "",
    });
    setShowAddTxn(true);
  };

  // Open Edit Transaction Modal
  const openEditTxn = (txn: TransactionRow) => {
    setEditTxn(txn);
    setTxnForm({
      transaction_number: txn.transaction_number || `TXN-${txn.id.slice(0, 6)}`,
      pet_id: txn.pet_id || "",
      owner_id: txn.owner_id || "",
      appointment_id: txn.appointment_id || "",
      services_rendered: txn.services_rendered || "Veterinary Medical Service",
      total_amount: String(txn.total_amount || 0),
      payment_method: txn.payment_method || "Cash",
      payment_status: txn.payment_status || "Pending",
      notes: txn.notes || "",
    });
  };

  // Save Transaction
  const handleSaveTxn = async () => {
    if (!txnForm.services_rendered.trim()) {
      toast.error("Services rendered description is required.");
      return;
    }

    setSaving(true);
    const pet = petMap.get(txnForm.pet_id);
    const resolvedOwnerId = txnForm.owner_id || pet?.owner_id || null;
    const code = txnForm.transaction_number || `TXN-${Date.now().toString().slice(-6)}`;

    const payload = {
      transaction_number: code,
      pet_id: txnForm.pet_id || null,
      owner_id: resolvedOwnerId,
      appointment_id: txnForm.appointment_id || null,
      services_rendered: txnForm.services_rendered.trim(),
      total_amount: parseFloat(txnForm.total_amount) || 0,
      total: parseFloat(txnForm.total_amount) || 0,
      payment_method: txnForm.payment_method,
      payment_status: txnForm.payment_status,
      status: txnForm.payment_status,
      notes: txnForm.notes.trim() || null,
    };

    const { error } = editTxn
      ? await db.from("lab_transactions").update(payload as any).eq("id", editTxn.id)
      : await db.from("lab_transactions").insert(payload as any);

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(editTxn ? `Transaction ${code} updated.` : `Transaction ${code} created.`);
    setShowAddTxn(false);
    setEditTxn(null);
    setTxnForm(emptyTxnForm);
    invalidate("lab_transactions");
  };

  // Quick One-Click Mark as Paid
  const handleMarkAsPaid = async (txn: TransactionRow) => {
    setSaving(true);
    const { error } = await db
      .from("lab_transactions")
      .update({ payment_status: "Paid", status: "Paid" } as any)
      .eq("id", txn.id);

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Transaction ${txn.transaction_number} marked as PAID.`);
    invalidate("lab_transactions");
  };

  // Delete Transaction (Admin Only)
  const handleDeleteTxn = async () => {
    if (!deleteTxnTarget || !isAdmin) return;

    setSaving(true);
    const { error } = await db.from("lab_transactions").delete().eq("id", deleteTxnTarget.id);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Transaction ${deleteTxnTarget.transaction_number} deleted.`);
    setDeleteTxnTarget(null);
    invalidate("lab_transactions");
  };

  // Open Add Lab Record Modal
  const openAddLab = () => {
    setLabForm({
      ...emptyLabForm,
      lab_record_number: `LAB-${Date.now().toString().slice(-6)}`,
      pet_id: pets[0]?.id || "",
      owner_id: pets[0]?.owner_id || owners[0]?.id || "",
    });
    setShowAddLab(true);
  };

  // Save Lab Record
  const handleSaveLab = async () => {
    if (!labForm.pet_id || !labForm.test_type) {
      toast.error("Pet and Test Type are required.");
      return;
    }

    setSaving(true);
    const pet = petMap.get(labForm.pet_id);
    const resolvedOwnerId = labForm.owner_id || pet?.owner_id || null;
    const code = labForm.lab_record_number || `LAB-${Date.now().toString().slice(-6)}`;

    const payload = {
      lab_record_number: code,
      pet_id: labForm.pet_id,
      owner_id: resolvedOwnerId,
      appointment_id: labForm.appointment_id || null,
      test_type: labForm.test_type,
      result: labForm.result.trim() || null,
      remarks: labForm.remarks.trim() || null,
      date_conducted: labForm.date_conducted || todayPH(),
    };

    const { error } = await db.from("lab_records").insert(payload as any);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Laboratory record ${code} added.`);
    setShowAddLab(false);
    setLabForm(emptyLabForm);
    invalidate("lab_records");
  };

  // Filtered & Searched Transactions
  const filteredTxns = useMemo(() => {
    return transactions.filter((t) => {
      const q = txnSearch.toLowerCase().trim();
      const codeStr = (t.transaction_number || "").toLowerCase();
      const petNameStr = (t.pets?.name || petMap.get(t.pet_id || "")?.name || "").toLowerCase();
      const ownerNameStr = (t.owners?.name || ownerMap.get(t.owner_id || "")?.name || "").toLowerCase();

      // Search Query
      if (q && !codeStr.includes(q) && !petNameStr.includes(q) && !ownerNameStr.includes(q)) {
        return false;
      }

      // Payment Status Filter
      if (filterPaymentStatus !== "all" && t.payment_status?.toLowerCase() !== filterPaymentStatus.toLowerCase()) {
        return false;
      }

      // Payment Method Filter
      if (filterPaymentMethod !== "all" && t.payment_method?.toLowerCase() !== filterPaymentMethod.toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [transactions, txnSearch, filterPaymentStatus, filterPaymentMethod, petMap, ownerMap]);

  // Paginated Transactions
  const totalTxnPages = Math.ceil(filteredTxns.length / ITEMS_PER_PAGE) || 1;
  const paginatedTxns = useMemo(() => {
    const start = (txnPage - 1) * ITEMS_PER_PAGE;
    return filteredTxns.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTxns, txnPage]);

  // Filtered & Searched Lab Records
  const filteredLabs = useMemo(() => {
    return labRecords.filter((l) => {
      const q = labSearch.toLowerCase().trim();
      const codeStr = (l.lab_record_number || "").toLowerCase();
      const petNameStr = (l.pets?.name || petMap.get(l.pet_id || "")?.name || "").toLowerCase();
      const ownerNameStr = (l.owners?.name || ownerMap.get(l.owner_id || "")?.name || "").toLowerCase();
      const testStr = l.test_type.toLowerCase();

      if (q && !codeStr.includes(q) && !petNameStr.includes(q) && !ownerNameStr.includes(q) && !testStr.includes(q)) {
        return false;
      }

      if (filterTestType !== "all" && l.test_type.toLowerCase() !== filterTestType.toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [labRecords, labSearch, filterTestType, petMap, ownerMap]);

  // Paginated Lab Records
  const totalLabPages = Math.ceil(filteredLabs.length / ITEMS_PER_PAGE) || 1;
  const paginatedLabs = useMemo(() => {
    const start = (labPage - 1) * ITEMS_PER_PAGE;
    return filteredLabs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredLabs, labPage]);

  // Printable Receipt Generator
  const handlePrintReceipt = (txn: TransactionRow) => {
    const pet = petMap.get(txn.pet_id || "") || txn.pets;
    const owner = ownerMap.get(txn.owner_id || "") || txn.owners;
    const lineItems = itemsByTxnId.get(txn.id) ?? [];
    const w = window.open("", "_blank");
    if (!w) return;

    const lineItemsHtml = lineItems.length
      ? lineItems
          .map(
            (item) => `
              <tr>
                <td>${item.category || "Service"}</td>
                <td>${item.description}</td>
                <td style="text-align:center">${item.quantity}</td>
                <td style="text-align:right">${formatPeso(item.unit_price)}</td>
                <td style="text-align:right">${formatPeso(item.line_total)}</td>
                <td>${item.source || "—"}</td>
              </tr>
            `
          )
          .join("")
      : `<tr><td>Service</td><td>${txn.services_rendered || "Veterinary Medical Service"}</td><td style="text-align:center">1</td><td style="text-align:right">${formatPeso(txn.total_amount)}</td><td style="text-align:right">${formatPeso(txn.total_amount)}</td><td>Manual</td></tr>`;

    w.document.write(`
      <html>
        <head>
          <title>Clinic Receipt - ${txn.transaction_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
            h1 { color: #1B3A5C; margin-bottom: 2px; }
            .badge { background: #e8eef4; color: #1B3A5C; padding: 3px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #E8EEF4; color: #1B3A5C; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; font-size: 12px; margin-bottom: 20px; }
            .total-row { font-size: 14px; font-weight: bold; background: #f9f9f9; }
            .footer { margin-top: 30px; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
          </style>
        </head>
        <body>
          <h1>Harbourside Veterinary Clinic</h1>
          <h2>Official Payment Receipt</h2>
          
          <div class="info-grid">
            <div><strong>Receipt / Txn #:</strong> ${txn.transaction_number || "TXN"}</div>
            <div><strong>Date:</strong> ${formatDate(txn.date || txn.created_at)}</div>
            <div><strong>Owner Name:</strong> ${owner?.name || "—"}</div>
            <div><strong>Pet Name:</strong> ${pet?.name || "—"}</div>
            <div><strong>Payment Method:</strong> ${txn.payment_method || "Cash"}</div>
            <div><strong>Payment Status:</strong> ${txn.payment_status || "Pending"}</div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Description</th>
                <th style="text-align:center">Qty</th>
                <th style="text-align:right">Unit Price</th>
                <th style="text-align:right">Amount</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              ${lineItemsHtml}
              <tr class="total-row">
                <td colspan="4">Total Amount</td>
                <td style="text-align:right">${formatPeso(txn.total_amount)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>

          <div class="footer">Thank you for visiting Harbourside Veterinary Clinic! | Generated on ${formatNowPH()} (PH Time)</div>
        </body>
      </html>
    `);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">Lab & Clinic Transactions</h1>
          <p className="text-muted-foreground text-sm">
            Manage billing transactions, payment status, GCash/Cash receipts, and laboratory records
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "transactions" ? (
            <Button onClick={openAddTxn}>
              <Plus className="h-4 w-4 mr-1.5" /> Create Transaction
            </Button>
          ) : (
            <Button onClick={openAddLab}>
              <FlaskConical className="h-4 w-4 mr-1.5" /> Record Lab Test
            </Button>
          )}
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-0 shadow-sm bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Total Revenue (Paid)</p>
              <h3 className="text-2xl font-bold font-heading text-emerald-600">
                ₱{metrics.totalRevenue.toLocaleString()}
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
              <DollarSign className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Pending Payments</p>
              <h3 className="text-2xl font-bold font-heading text-amber-600">
                {metrics.pendingCount} <span className="text-xs text-muted-foreground font-normal">(₱{metrics.pendingAmount.toLocaleString()})</span>
              </h3>
            </div>
            <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm bg-card">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase text-muted-foreground">Total Transactions</p>
              <h3 className="text-2xl font-bold font-heading text-primary">{metrics.totalCount}</h3>
            </div>
            <div className="p-3 rounded-xl bg-primary/10 text-primary">
              <CreditCard className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dual Tab Interface */}
      <Tabs defaultValue="transactions" onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted p-1">
          <TabsTrigger value="transactions" className="text-xs font-semibold flex items-center gap-1.5">
            <DollarSign className="h-4 w-4" /> Transactions & Payment Records
          </TabsTrigger>
          <TabsTrigger value="labs" className="text-xs font-semibold flex items-center gap-1.5">
            <FlaskConical className="h-4 w-4" /> Laboratory Records
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Transactions */}
        <TabsContent value="transactions" className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Search */}
                <div className="space-y-1.5 sm:col-span-1">
                  <Label className="text-xs">Search Transactions</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by Txn #, Pet, or Owner Name..."
                      className="pl-9"
                      value={txnSearch}
                      onChange={(e) => {
                        setTxnSearch(e.target.value);
                        setTxnPage(1);
                      }}
                    />
                  </div>
                </div>

                {/* Status Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Payment Status</Label>
                  <Select
                    value={filterPaymentStatus}
                    onValueChange={(v) => {
                      setFilterPaymentStatus(v);
                      setTxnPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="pending">Pending Only</SelectItem>
                      <SelectItem value="paid">Paid Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Method Filter */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Payment Method</Label>
                  <Select
                    value={filterPaymentMethod}
                    onValueChange={(v) => {
                      setFilterPaymentMethod(v);
                      setTxnPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Methods" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="cash">Cash Only</SelectItem>
                      <SelectItem value="gcash">GCash Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Transactions Table */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {loadingTxns ? (
                <div className="p-12 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Txn #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Pet</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Services Rendered</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTxns.length ? (
                        paginatedTxns.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="font-mono text-xs font-bold text-primary">
                              {t.transaction_number}
                            </TableCell>
                            <TableCell className="text-xs">{formatDate(t.date || t.created_at)}</TableCell>
                            <TableCell className="font-semibold text-xs">
                              {t.pets?.name || petMap.get(t.pet_id || "")?.name || "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {t.owners?.name || ownerMap.get(t.owner_id || "")?.name || "—"}
                            </TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">
                              {t.services_rendered}
                            </TableCell>
                            <TableCell className="font-bold text-xs">
                              ₱{Number(t.total_amount || 0).toLocaleString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {t.payment_method}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  t.payment_status === "Paid"
                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 font-semibold"
                                    : "bg-amber-50 text-amber-700 border-amber-200 font-semibold"
                                }
                              >
                                {t.payment_status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right pr-4">
                              <div className="flex items-center justify-end gap-1">
                                {t.payment_status !== "Paid" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-7 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                    onClick={() => handleMarkAsPaid(t)}
                                    title="Mark as Paid"
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1" /> Paid
                                  </Button>
                                )}

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => setViewTxn(t)}
                                  title="View Details"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => openEditTxn(t)}
                                  title="Edit Transaction"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => handlePrintReceipt(t)}
                                  title="Print Receipt"
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                </Button>

                                {isAdmin && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                    onClick={() => setDeleteTxnTarget(t)}
                                    title="Delete Transaction"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
                            No clinic transactions found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  <div className="p-4 border-t flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Showing {filteredTxns.length ? (txnPage - 1) * ITEMS_PER_PAGE + 1 : 0} to{" "}
                      {Math.min(txnPage * ITEMS_PER_PAGE, filteredTxns.length)} of {filteredTxns.length} transactions
                    </span>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={txnPage === 1}
                        onClick={() => setTxnPage((p) => Math.max(p - 1, 1))}
                      >
                        <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
                      </Button>
                      <span>
                        Page {txnPage} of {totalTxnPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={txnPage >= totalTxnPages}
                        onClick={() => setTxnPage((p) => Math.min(p + 1, totalTxnPages))}
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

        {/* Tab 2: Laboratory Records */}
        <TabsContent value="labs" className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Search */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Search Lab Records</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by Lab #, Pet, Owner, or Test Type..."
                      className="pl-9"
                      value={labSearch}
                      onChange={(e) => {
                        setLabSearch(e.target.value);
                        setLabPage(1);
                      }}
                    />
                  </div>
                </div>

                {/* Filter Test Type */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Test Type Filter</Label>
                  <Select
                    value={filterTestType}
                    onValueChange={(v) => {
                      setFilterTestType(v);
                      setLabPage(1);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All Test Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Test Types</SelectItem>
                      {TEST_TYPES.map((t) => (
                        <SelectItem key={t} value={t.toLowerCase()}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lab Records Table */}
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {loadingLabs ? (
                <div className="p-12 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Lab Record #</TableHead>
                        <TableHead>Date Conducted</TableHead>
                        <TableHead>Pet</TableHead>
                        <TableHead>Owner</TableHead>
                        <TableHead>Test Type</TableHead>
                        <TableHead>Result / Summary</TableHead>
                        <TableHead className="text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLabs.length ? (
                        paginatedLabs.map((l) => (
                          <TableRow key={l.id}>
                            <TableCell className="font-mono text-xs font-bold text-primary">
                              {l.lab_record_number || `LAB-${l.id.slice(0, 6)}`}
                            </TableCell>
                            <TableCell className="text-xs">{formatDate(l.date_conducted || l.created_at)}</TableCell>
                            <TableCell className="font-semibold text-xs">
                              {l.pets?.name || petMap.get(l.pet_id || "")?.name || "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {l.owners?.name || ownerMap.get(l.owner_id || "")?.name || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs bg-teal-50 text-teal-700 border-teal-200">
                                {l.test_type}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs max-w-[250px] truncate">
                              {l.result || l.remarks || "—"}
                            </TableCell>
                            <TableCell className="text-right pr-4">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => setViewLab(l)}
                                  title="View Lab Record Details"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                            No laboratory records found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>

                  {/* Pagination */}
                  <div className="p-4 border-t flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Showing {filteredLabs.length ? (labPage - 1) * ITEMS_PER_PAGE + 1 : 0} to{" "}
                      {Math.min(labPage * ITEMS_PER_PAGE, filteredLabs.length)} of {filteredLabs.length} lab records
                    </span>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={labPage === 1}
                        onClick={() => setLabPage((p) => Math.max(p - 1, 1))}
                      >
                        <ChevronLeft className="h-3.5 w-3.5 mr-1" /> Previous
                      </Button>
                      <span>
                        Page {labPage} of {totalLabPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        disabled={labPage >= totalLabPages}
                        onClick={() => setLabPage((p) => Math.min(p + 1, totalLabPages))}
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

      {/* Add / Edit Transaction Dialog */}
      <Dialog
        open={showAddTxn || !!editTxn}
        onOpenChange={(o) => {
          if (!o) {
            setShowAddTxn(false);
            setEditTxn(null);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">
              {editTxn ? "Edit Transaction Record" : "Create Clinic Transaction"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">Select Pet & Owner *</Label>
              <Select
                value={txnForm.pet_id}
                onValueChange={(v) => {
                  const pet = petMap.get(v);
                  setTxnForm({ ...txnForm, pet_id: v, owner_id: pet?.owner_id || txnForm.owner_id });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Pet" />
                </SelectTrigger>
                <SelectContent>
                  {pets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({ownerMap.get(p.owner_id)?.name || "Owner"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Services Rendered *</Label>
              <Input
                placeholder="e.g. Consultation & Vaccination"
                value={txnForm.services_rendered}
                onChange={(e) => setTxnForm({ ...txnForm, services_rendered: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Total Amount (₱) *</Label>
                <Input
                  type="number"
                  placeholder="500"
                  value={txnForm.total_amount}
                  onChange={(e) => setTxnForm({ ...txnForm, total_amount: e.target.value })}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Payment Method</Label>
                <Select value={txnForm.payment_method} onValueChange={(v) => setTxnForm({ ...txnForm, payment_method: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="GCash">GCash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Payment Status</Label>
              <Select value={txnForm.payment_status} onValueChange={(v) => setTxnForm({ ...txnForm, payment_status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Additional Notes</Label>
              <Textarea
                placeholder="Reference number or payment remarks..."
                value={txnForm.notes}
                onChange={(e) => setTxnForm({ ...txnForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => { setShowAddTxn(false); setEditTxn(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSaveTxn} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : editTxn ? "Save Changes" : "Create Transaction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record New Lab Test Dialog */}
      <Dialog open={showAddLab} onOpenChange={setShowAddLab}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-primary" /> Record Laboratory Test
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label className="text-xs">Select Pet *</Label>
              <Select
                value={labForm.pet_id}
                onValueChange={(v) => {
                  const pet = petMap.get(v);
                  setLabForm({ ...labForm, pet_id: v, owner_id: pet?.owner_id || labForm.owner_id });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select Pet" />
                </SelectTrigger>
                <SelectContent>
                  {pets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({ownerMap.get(p.owner_id)?.name || "Owner"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Test Type *</Label>
                <Select value={labForm.test_type} onValueChange={(v) => setLabForm({ ...labForm, test_type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TEST_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Date Conducted</Label>
                <Input
                  type="date"
                  value={labForm.date_conducted}
                  onChange={(e) => setLabForm({ ...labForm, date_conducted: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Test Result Summary</Label>
              <Textarea
                placeholder="e.g. Normal CBC count, negative for blood parasites"
                value={labForm.result}
                onChange={(e) => setLabForm({ ...labForm, result: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Veterinary Remarks</Label>
              <Textarea
                placeholder="Follow-up recommendations..."
                value={labForm.remarks}
                onChange={(e) => setLabForm({ ...labForm, remarks: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setShowAddLab(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveLab} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : "Save Lab Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Transaction Details Modal */}
      <Dialog open={!!viewTxn} onOpenChange={() => setViewTxn(null)}>
        <DialogContent className="max-w-2xl">
          {viewTxn && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-6">
                  <DialogTitle className="font-heading text-base flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" /> {viewTxn.transaction_number}
                  </DialogTitle>
                  <Badge
                    variant="outline"
                    className={viewTxn.payment_status === "Paid" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}
                  >
                    {viewTxn.payment_status}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-3 pt-2 text-xs">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Date:</span>
                  <span>{formatDate(viewTxn.date || viewTxn.created_at)}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Pet Name:</span>
                  <span className="font-bold">{petMap.get(viewTxn.pet_id || "")?.name || viewTxn.pets?.name || "—"}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Owner Name:</span>
                  <span>{ownerMap.get(viewTxn.owner_id || "")?.name || viewTxn.owners?.name || "—"}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Services Rendered:</span>
                  <span className="font-semibold">{viewTxn.services_rendered}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Payment Method:</span>
                  <span>{viewTxn.payment_method}</span>
                </div>

                {(itemsByTxnId.get(viewTxn.id) ?? []).length > 0 && (
                  <div className="pt-2">
                    <span className="font-semibold block uppercase text-[10px] text-muted-foreground mb-2">Line Items</span>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-[10px]">Category</TableHead>
                          <TableHead className="text-[10px]">Description</TableHead>
                          <TableHead className="text-[10px] text-center">Qty</TableHead>
                          <TableHead className="text-[10px] text-right">Unit Price</TableHead>
                          <TableHead className="text-[10px] text-right">Amount</TableHead>
                          <TableHead className="text-[10px]">Source</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(itemsByTxnId.get(viewTxn.id) ?? []).map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-xs">{item.category || "—"}</TableCell>
                            <TableCell className="text-xs font-medium">{item.description}</TableCell>
                            <TableCell className="text-xs text-center">{item.quantity}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatPeso(item.unit_price)}</TableCell>
                            <TableCell className="text-xs text-right font-mono font-semibold">{formatPeso(item.line_total)}</TableCell>
                            <TableCell className="text-xs">{item.source || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}

                <div className="flex justify-between py-1 border-b font-bold text-sm">
                  <span>Total Amount:</span>
                  <span className="text-primary">{formatPeso(viewTxn.total_amount)}</span>
                </div>
                {viewTxn.notes && (
                  <div className="p-2 rounded bg-muted/40 mt-2">
                    <span className="font-semibold block uppercase text-[10px] text-muted-foreground">Notes</span>
                    <p>{viewTxn.notes}</p>
                  </div>
                )}
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button variant="outline" onClick={() => setViewTxn(null)}>
                  Close
                </Button>
                <Button variant="outline" onClick={() => handlePrintReceipt(viewTxn)}>
                  <Printer className="h-4 w-4 mr-1" /> Print Receipt
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Transaction Dialog */}
      <Dialog open={!!deleteTxnTarget} onOpenChange={() => setDeleteTxnTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 font-heading">
              <AlertTriangle className="h-5 w-5" /> Confirm Delete Transaction
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to permanently delete transaction record <strong>{deleteTxnTarget?.transaction_number}</strong>?
          </p>
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setDeleteTxnTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteTxn} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete Transaction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
