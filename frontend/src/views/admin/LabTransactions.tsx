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
  Calendar,
  User,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { db } from "@/lib/db-client";
import { useRows, useInvalidate } from "@/hooks/useRows";
import { formatDate } from "@/lib/age";
import { formatNowPH, todayPH } from "@/lib/datetime";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";

type TransactionRow = {
  id: string;
  transaction_number?: string | null;
  appointment_id?: string | null;
  care_record_id?: string | null;
  pet_id?: string | null;
  owner_id?: string | null;
  date?: string | null;
  services_rendered?: string | null;
  subtotal?: number | null;
  discount?: number | null;
  additional_fees?: number | null;
  total_amount?: number | null;
  total?: number | null;
  amount_paid?: number | null;
  balance?: number | null;
  payment_method?: string | null;
  payment_status?: string | null;
  processed_by?: string | null;
  vet?: string | null;
  status?: string | null;
  notes?: string | null;
  created_at?: string;
  pets?: { name: string; species?: string; breed?: string } | null;
  owners?: { name: string } | null;
};

type TransactionItemRow = {
  id: string;
  transaction_id: string;
  item_id?: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  category?: string | null;
  source?: string | null;
  batch_no?: string | null;
  inventory_transaction_id?: string | null;
};

type LabRecordRow = {
  id: string;
  lab_record_number?: string | null;
  appointment_id?: string | null;
  care_record_id?: string | null;
  pet_id?: string | null;
  owner_id?: string | null;
  test_type: string;
  result?: string | null;
  remarks?: string | null;
  date_conducted?: string | null;
  status?: string | null;
  lab_fee?: number | null;
  performed_by?: string | null;
  notes?: string | null;
  created_at?: string;
  pets?: { name: string } | null;
  owners?: { name: string } | null;
};

const formatPeso = (value: number | string | null | undefined) =>
  `₱${Number(value ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const ITEMS_PER_PAGE = 8;
const TEST_TYPES = ["Blood Test", "Urinalysis", "Fecalysis", "Skin Scraping", "X-Ray / Ultrasound", "Other"];
const LAB_STATUSES = ["Requested", "In Progress", "Completed", "Cancelled"];

export default function LabTransactions() {
  const { role, user } = useAuth();
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
  const { data: careRecords = [] } = useRows<any>("care_records", { orderBy: "date", ascending: false });

  const invalidate = useInvalidate();

  // Maps for quick relational lookups
  const petMap = useMemo(() => new Map(pets.map((p) => [p.id, p])), [pets]);
  const ownerMap = useMemo(() => new Map(owners.map((o) => [o.id, o])), [owners]);
  const apptMap = useMemo(() => new Map(appointments.map((a) => [a.id, a])), [appointments]);
  const careMap = useMemo(() => new Map(careRecords.map((c) => [c.id, c])), [careRecords]);

  const itemsByTxnId = useMemo(() => {
    const map = new Map<string, TransactionItemRow[]>();
    for (const item of transactionItems) {
      const list = map.get(item.transaction_id) ?? [];
      list.push(item);
      map.set(item.transaction_id, list);
    }
    return map;
  }, [transactionItems]);

  // Active Tab State
  const [activeTab, setActiveTab] = useState("transactions");

  // Search & Filters for Transactions
  const [txnSearch, setTxnSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState("all");
  const [filterPaymentMethod, setFilterPaymentMethod] = useState("all");
  const [txnPage, setTxnPage] = useState(1);

  // Search & Filters for Lab Records
  const [labSearch, setLabSearch] = useState("");
  const [filterTestType, setFilterTestType] = useState("all");
  const [filterLabStatus, setFilterLabStatus] = useState("all");
  const [labPage, setLabPage] = useState(1);

  // Modals & Form States
  const [viewTxn, setViewTxn] = useState<TransactionRow | null>(null);
  const [showAddTxn, setShowAddTxn] = useState(false);
  const [editTxn, setEditTxn] = useState<TransactionRow | null>(null);
  const [deleteTxnTarget, setDeleteTxnTarget] = useState<TransactionRow | null>(null);

  // Payment Recording State inside View Modal
  const [payAmountInput, setPayAmountInput] = useState("");
  const [payMethodInput, setPayMethodInput] = useState("Cash");

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
    subtotal: "500",
    discount: "0",
    additional_fees: "0",
    total_amount: "500",
    amount_paid: "0",
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
    care_record_id: "",
    test_type: "Blood Test",
    result: "",
    remarks: "",
    status: "Completed",
    lab_fee: "500",
    performed_by: "",
    notes: "",
    date_conducted: todayPH(),
  };
  const [labForm, setLabForm] = useState(emptyLabForm);

  // Normalize transactions dataset with monetary precision
  const transactions = useMemo(() => {
    return rawTransactions.map((t) => {
      const subtotal = Number(t.subtotal ?? t.total_amount ?? t.total ?? 0);
      const discount = Number(t.discount ?? 0);
      const fees = Number(t.additional_fees ?? 0);
      const totalAmount = Number((subtotal - discount + fees).toFixed(2));
      const amountPaid = Number(t.amount_paid ?? (t.payment_status === "Paid" ? totalAmount : 0));
      const balance = Math.max(0, Number((totalAmount - amountPaid).toFixed(2)));

      let status = t.payment_status || t.status || "Pending";
      if (amountPaid >= totalAmount && totalAmount > 0) status = "Paid";
      else if (amountPaid > 0 && amountPaid < totalAmount) status = "Partially Paid";
      else if (amountPaid === 0) status = "Unpaid";

      return {
        ...t,
        transaction_number: t.transaction_number || `TXN-${t.id.slice(0, 6)}`,
        subtotal,
        discount,
        additional_fees: fees,
        total_amount: totalAmount,
        amount_paid: amountPaid,
        balance,
        payment_status: status,
        payment_method: t.payment_method || "Cash",
        services_rendered: t.services_rendered || "Veterinary Medical Service",
      };
    });
  }, [rawTransactions]);

  // Metric Totals
  const metrics = useMemo(() => {
    const totalCount = transactions.length;
    const totalRevenue = transactions.reduce((sum, t) => sum + (t.amount_paid || 0), 0);

    const paidTxns = transactions.filter((t) => t.payment_status === "Paid");
    const paidAmount = paidTxns.reduce((sum, t) => sum + (t.amount_paid || 0), 0);

    const partialTxns = transactions.filter((t) => t.payment_status === "Partially Paid");
    const partialAmount = partialTxns.reduce((sum, t) => sum + (t.amount_paid || 0), 0);

    const unpaidTxns = transactions.filter((t) => t.payment_status === "Unpaid" || t.payment_status === "Pending");
    const unpaidBalance = unpaidTxns.reduce((sum, t) => sum + (t.balance || 0), 0);

    return {
      totalCount,
      totalRevenue,
      paidCount: paidTxns.length,
      paidAmount,
      partialCount: partialTxns.length,
      partialAmount,
      unpaidCount: unpaidTxns.length,
      unpaidBalance,
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
      subtotal: String(txn.subtotal || 0),
      discount: String(txn.discount || 0),
      additional_fees: String(txn.additional_fees || 0),
      total_amount: String(txn.total_amount || 0),
      amount_paid: String(txn.amount_paid || 0),
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

    const sub = parseFloat(txnForm.subtotal) || 0;
    const disc = parseFloat(txnForm.discount) || 0;
    const fees = parseFloat(txnForm.additional_fees) || 0;
    const tot = Number((sub - disc + fees).toFixed(2));
    const paid = parseFloat(txnForm.amount_paid) || 0;

    let status = txnForm.payment_status;
    if (paid >= tot && tot > 0) status = "Paid";
    else if (paid > 0 && paid < tot) status = "Partially Paid";
    else if (paid === 0) status = "Unpaid";

    const payload = {
      transaction_number: code,
      pet_id: txnForm.pet_id || null,
      owner_id: resolvedOwnerId,
      appointment_id: txnForm.appointment_id || null,
      services_rendered: txnForm.services_rendered.trim(),
      subtotal: sub,
      discount: disc,
      additional_fees: fees,
      total_amount: tot,
      total: tot,
      amount_paid: paid,
      payment_method: txnForm.payment_method,
      payment_status: status,
      status: status,
      processed_by: user?.email || "Clinic Staff",
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

  // Record Payment for a transaction
  const handleRecordPayment = async (txn: TransactionRow, addPaidAmount: number, method: string) => {
    if (addPaidAmount <= 0) {
      toast.error("Please enter a valid payment amount.");
      return;
    }

    setSaving(true);
    const newAmountPaid = Number(((txn.amount_paid || 0) + addPaidAmount).toFixed(2));
    const totalAmount = Number(txn.total_amount || 0);

    let newStatus = "Pending";
    if (newAmountPaid >= totalAmount && totalAmount > 0) newStatus = "Paid";
    else if (newAmountPaid > 0 && newAmountPaid < totalAmount) newStatus = "Partially Paid";
    else if (newAmountPaid === 0) newStatus = "Unpaid";

    const { error } = await db
      .from("lab_transactions")
      .update({
        amount_paid: newAmountPaid,
        payment_method: method,
        payment_status: newStatus,
        status: newStatus,
        processed_by: user?.email || "Clinic Staff",
      } as any)
      .eq("id", txn.id);

    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Payment of ${formatPeso(addPaidAmount)} recorded for ${txn.transaction_number}.`);
    setPayAmountInput("");
    setViewTxn(null);
    invalidate("lab_transactions");
  };

  // Quick Mark as Fully Paid
  const handleMarkAsPaid = async (txn: TransactionRow) => {
    await handleRecordPayment(txn, txn.balance || txn.total_amount || 0, txn.payment_method || "Cash");
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
      performed_by: user?.email || "Clinic Staff",
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
    const fee = parseFloat(labForm.lab_fee) || 0;

    const payload = {
      lab_record_number: code,
      pet_id: labForm.pet_id,
      owner_id: resolvedOwnerId,
      appointment_id: labForm.appointment_id || null,
      care_record_id: labForm.care_record_id || null,
      test_type: labForm.test_type,
      result: labForm.result.trim() || null,
      remarks: labForm.remarks.trim() || null,
      status: labForm.status,
      lab_fee: fee,
      performed_by: labForm.performed_by || user?.email || "Clinic Staff",
      notes: labForm.notes.trim() || null,
      date_conducted: labForm.date_conducted || todayPH(),
    };

    const { error } = await db.from("lab_records").insert(payload as any);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Laboratory record ${code} recorded.`);
    setShowAddLab(false);
    setLabForm(emptyLabForm);
    invalidate("lab_records");
  };

  // Date Filter Helper
  const filterByDate = (dateStr?: string | null) => {
    if (!dateStr) return true;
    const d = dateStr.slice(0, 10);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo && d > dateTo) return false;
    return true;
  };

  // Filtered Transactions
  const filteredTxns = useMemo(() => {
    return transactions.filter((t) => {
      const q = txnSearch.toLowerCase().trim();
      const codeStr = (t.transaction_number || "").toLowerCase();
      const apptIdStr = (t.appointment_id || "").toLowerCase();
      const petNameStr = (t.pets?.name || petMap.get(t.pet_id || "")?.name || "").toLowerCase();
      const ownerNameStr = (t.owners?.name || ownerMap.get(t.owner_id || "")?.name || "").toLowerCase();

      if (q && !codeStr.includes(q) && !apptIdStr.includes(q) && !petNameStr.includes(q) && !ownerNameStr.includes(q)) {
        return false;
      }

      if (!filterByDate(t.date || t.created_at)) return false;

      if (filterPaymentStatus !== "all" && t.payment_status?.toLowerCase() !== filterPaymentStatus.toLowerCase()) {
        return false;
      }

      if (filterPaymentMethod !== "all" && t.payment_method?.toLowerCase() !== filterPaymentMethod.toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [transactions, txnSearch, dateFrom, dateTo, filterPaymentStatus, filterPaymentMethod, petMap, ownerMap]);

  // Paginated Transactions
  const totalTxnPages = Math.ceil(filteredTxns.length / ITEMS_PER_PAGE) || 1;
  const paginatedTxns = useMemo(() => {
    const start = (txnPage - 1) * ITEMS_PER_PAGE;
    return filteredTxns.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredTxns, txnPage]);

  // Filtered Lab Records
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

      if (!filterByDate(l.date_conducted || l.created_at)) return false;

      if (filterTestType !== "all" && l.test_type.toLowerCase() !== filterTestType.toLowerCase()) {
        return false;
      }

      if (filterLabStatus !== "all" && (l.status || "Completed").toLowerCase() !== filterLabStatus.toLowerCase()) {
        return false;
      }

      return true;
    });
  }, [labRecords, labSearch, dateFrom, dateTo, filterTestType, filterLabStatus, petMap, ownerMap]);

  // Paginated Lab Records
  const totalLabPages = Math.ceil(filteredLabs.length / ITEMS_PER_PAGE) || 1;
  const paginatedLabs = useMemo(() => {
    const start = (labPage - 1) * ITEMS_PER_PAGE;
    return filteredLabs.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredLabs, labPage]);

  // Official Printable Transaction Receipt Generator
  const handlePrintReceipt = (txn: TransactionRow) => {
    const pet = petMap.get(txn.pet_id || "") || txn.pets;
    const owner = ownerMap.get(txn.owner_id || "") || txn.owners;
    const appt = apptMap.get(txn.appointment_id || "");
    const lineItems = itemsByTxnId.get(txn.id) ?? [];
    const w = window.open("", "_blank");
    if (!w) return;

    const lineItemsHtml = lineItems.length
      ? lineItems
          .map(
            (item) => `
              <tr>
                <td><strong>${item.category || "Service"}</strong></td>
                <td>${item.description} ${item.batch_no ? `<span style="font-size:10px;color:#666;">(Batch: ${item.batch_no})</span>` : ""}</td>
                <td style="text-align:center">${item.quantity}</td>
                <td style="text-align:right">${formatPeso(item.unit_price)}</td>
                <td style="text-align:right">${formatPeso(item.line_total)}</td>
              </tr>
            `
          )
          .join("")
      : `<tr><td>Service</td><td>${txn.services_rendered || "Veterinary Medical Service"}</td><td style="text-align:center">1</td><td style="text-align:right">${formatPeso(txn.total_amount)}</td><td style="text-align:right">${formatPeso(txn.total_amount)}</td></tr>`;

    w.document.write(`
      <html>
        <head>
          <title>Clinic Receipt - ${txn.transaction_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
            h1 { color: #7F1D1D; margin: 0 0 2px; font-size: 22px; }
            h2 { color: #E5192C; margin: 0 0 16px; font-size: 14px; border-bottom: 2px solid #7F1D1D; padding-bottom: 6px; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px; margin-bottom: 20px; background: #f9fafb; padding: 12px; border-radius: 6px; border: 1px solid #e5e7eb; }
            table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; text-align: left; }
            th { background: #FEE2E2; color: #7F1D1D; font-weight: bold; }
            .summary-table { width: 300px; margin-left: auto; margin-top: 16px; font-size: 11px; }
            .summary-table td { border: none; padding: 4px 8px; }
            .summary-table tr.total-row { font-size: 13px; font-weight: bold; border-top: 2px solid #7F1D1D; color: #7F1D1D; }
            .footer { margin-top: 30px; font-size: 10px; color: #888; border-top: 1px solid #eee; padding-top: 10px; text-align: center; }
          </style>
        </head>
        <body>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
            <img src="/logo.png" style="height:44px;width:44px;object-fit:contain;border-radius:6px;" alt="HVS" />
            <div>
              <h1>Harbourside Veterinary Clinic</h1>
              <h2>Official Payment Statement & Summary Receipt</h2>
            </div>
          </div>
          
          <div class="info-grid">
            <div><strong>Transaction #:</strong> ${txn.transaction_number || "TXN"}</div>
            <div><strong>Date:</strong> ${formatDate(txn.date || txn.created_at)}</div>
            <div><strong>Owner Name:</strong> ${owner?.name || "—"}</div>
            <div><strong>Pet Name:</strong> ${pet?.name || "—"} ${pet?.species ? `(${pet.species} - ${pet.breed || "Crossbreed"})` : ""}</div>
            <div><strong>Appointment Ref:</strong> ${appt ? `APT-${appt.id.slice(0, 6)} (${formatDate(appt.date)})` : "Direct Walk-in / Medical Record"}</div>
            <div><strong>Veterinarian / Staff:</strong> ${txn.vet || txn.processed_by || "Clinic Staff"}</div>
            <div><strong>Payment Method:</strong> ${txn.payment_method || "Cash"}</div>
            <div><strong>Payment Status:</strong> <strong>${txn.payment_status || "Pending"}</strong></div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Category</th>
                <th>Description / Product Used</th>
                <th style="text-align:center">Qty</th>
                <th style="text-align:right">Unit Price</th>
                <th style="text-align:right">Total</th>
              </tr>
            </thead>
            <tbody>
              ${lineItemsHtml}
            </tbody>
          </table>

          <table class="summary-table">
            <tr>
              <td>Subtotal:</td>
              <td style="text-align:right">${formatPeso(txn.subtotal)}</td>
            </tr>
            ${txn.discount ? `<tr><td>Discount:</td><td style="text-align:right">-${formatPeso(txn.discount)}</td></tr>` : ""}
            ${txn.additional_fees ? `<tr><td>Additional Fees:</td><td style="text-align:right">+${formatPeso(txn.additional_fees)}</td></tr>` : ""}
            <tr class="total-row">
              <td>Total Charge:</td>
              <td style="text-align:right">${formatPeso(txn.total_amount)}</td>
            </tr>
            <tr>
              <td>Amount Paid:</td>
              <td style="text-align:right;color:#16A34A;font-weight:bold;">${formatPeso(txn.amount_paid)}</td>
            </tr>
            <tr>
              <td>Remaining Balance:</td>
              <td style="text-align:right;color:#D97706;font-weight:bold;">${formatPeso(txn.balance)}</td>
            </tr>
          </table>

          <div class="footer">Confidential Clinic Billing Record | Harbourside Veterinary Clinic | Generated on ${formatNowPH()}</div>
        </body>
      </html>
    `);
    w.document.close();
    w.print();
  };

  return (
    <div className="page-container pb-10">
      <PageHeader
        title="Lab & Transactions"
        description="Comprehensive clinic billing, medication charges, laboratory records, and payment tracking"
        actions={
          <div className="flex items-center gap-2">
            {activeTab === "transactions" ? (
              <Button onClick={openAddTxn} className="bg-[#1B3A5C] hover:bg-[#152e4a]">
                <Plus className="h-4 w-4 mr-1.5" /> Create Transaction
              </Button>
            ) : (
              <Button onClick={openAddLab} className="bg-[#1FA8A8] hover:bg-[#188787]">
                <FlaskConical className="h-4 w-4 mr-1.5" /> Record Lab Test
              </Button>
            )}
          </div>
        }
      />

      {/* Top Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard
          title="Total Transactions"
          value={metrics.totalCount}
          subtitle="Clinic Customer Records"
          icon={CreditCard}
          variant="default"
        />
        <StatCard
          title="Total Collected Revenue"
          value={formatPeso(metrics.totalRevenue)}
          subtitle="Customer Payments Received"
          icon={DollarSign}
          variant="success"
        />
        <StatCard
          title="Paid Transactions"
          value={metrics.paidCount}
          subtitle={formatPeso(metrics.paidAmount)}
          icon={CheckCircle}
          variant="success"
        />
        <StatCard
          title="Partially Paid"
          value={metrics.partialCount}
          subtitle={formatPeso(metrics.partialAmount)}
          icon={Clock}
          variant="warning"
        />
        <StatCard
          title="Unpaid Balance"
          value={metrics.unpaidCount}
          subtitle={`Remaining ${formatPeso(metrics.unpaidBalance)}`}
          icon={AlertTriangle}
          variant="danger"
        />
      </div>

      {/* Dual Tab Interface */}
      <Tabs defaultValue="transactions" onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted p-1">
          <TabsTrigger value="transactions" className="text-xs font-semibold flex items-center gap-1.5">
            <DollarSign className="h-4 w-4 text-[#1B3A5C]" /> Transactions & Payment Records
          </TabsTrigger>
          <TabsTrigger value="labs" className="text-xs font-semibold flex items-center gap-1.5">
            <FlaskConical className="h-4 w-4 text-[#1FA8A8]" /> Laboratory Records
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Transactions */}
        <TabsContent value="transactions" className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {/* Search */}
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-xs font-semibold">Search Records</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by Txn #, Pet, Owner, or Apt ID..."
                      className="pl-9 text-xs"
                      value={txnSearch}
                      onChange={(e) => {
                        setTxnSearch(e.target.value);
                        setTxnPage(1);
                      }}
                    />
                  </div>
                </div>

                {/* Date From */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Date From</Label>
                  <Input
                    type="date"
                    className="text-xs"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setTxnPage(1);
                    }}
                  />
                </div>

                {/* Date To */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Date To</Label>
                  <Input
                    type="date"
                    className="text-xs"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setTxnPage(1);
                    }}
                  />
                </div>

                {/* Payment Status Filter */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Payment Status</Label>
                  <Select
                    value={filterPaymentStatus}
                    onValueChange={(v) => {
                      setFilterPaymentStatus(v);
                      setTxnPage(1);
                    }}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="paid">Paid Only</SelectItem>
                      <SelectItem value="partially paid">Partially Paid Only</SelectItem>
                      <SelectItem value="unpaid">Unpaid Only</SelectItem>
                      <SelectItem value="pending">Pending Only</SelectItem>
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
                      <TableRow className="bg-[#E8EEF4] hover:bg-[#E8EEF4]">
                        <TableHead className="text-[#1B3A5C] font-bold text-xs">Txn #</TableHead>
                        <TableHead className="text-[#1B3A5C] font-bold text-xs">Date</TableHead>
                        <TableHead className="text-[#1B3A5C] font-bold text-xs">Pet Name</TableHead>
                        <TableHead className="text-[#1B3A5C] font-bold text-xs">Owner Name</TableHead>
                        <TableHead className="text-[#1B3A5C] font-bold text-xs">Services / Line Items</TableHead>
                        <TableHead className="text-[#1B3A5C] font-bold text-xs text-right">Total Amount</TableHead>
                        <TableHead className="text-[#1B3A5C] font-bold text-xs text-right">Paid</TableHead>
                        <TableHead className="text-[#1B3A5C] font-bold text-xs text-right">Balance</TableHead>
                        <TableHead className="text-[#1B3A5C] font-bold text-xs">Status</TableHead>
                        <TableHead className="text-[#1B3A5C] font-bold text-xs text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedTxns.length ? (
                        paginatedTxns.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="font-mono text-xs font-bold text-[#1B3A5C]">
                              {t.transaction_number}
                            </TableCell>
                            <TableCell className="text-xs">{formatDate(t.date || t.created_at)}</TableCell>
                            <TableCell className="font-semibold text-xs text-[#1B3A5C]">
                              {t.pets?.name || petMap.get(t.pet_id || "")?.name || "—"}
                            </TableCell>
                            <TableCell className="text-xs">
                              {t.owners?.name || ownerMap.get(t.owner_id || "")?.name || "—"}
                            </TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">
                              {t.services_rendered}
                            </TableCell>
                            <TableCell className="font-bold text-xs text-right font-mono">
                              {formatPeso(t.total_amount)}
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono font-semibold text-emerald-700">
                              {formatPeso(t.amount_paid)}
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono font-bold text-amber-700">
                              {formatPeso(t.balance)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  t.payment_status === "Paid"
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold text-xs"
                                    : t.payment_status === "Partially Paid"
                                    ? "bg-amber-50 text-amber-900 border-amber-300 font-bold text-xs"
                                    : "bg-rose-50 text-rose-800 border-rose-200 font-semibold text-xs"
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
                                    className="h-7 text-xs bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 font-semibold"
                                    onClick={() => handleMarkAsPaid(t)}
                                    title="Mark Fully Paid"
                                  >
                                    <CheckCircle className="h-3 w-3 mr-1" /> Pay
                                  </Button>
                                )}

                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => setViewTxn(t)}
                                  title="View Details & Line Items"
                                >
                                  <Eye className="h-3.5 w-3.5 text-[#1B3A5C]" />
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
                                  title="Print Official Summary Receipt"
                                >
                                  <Printer className="h-3.5 w-3.5 text-slate-700" />
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
                          <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                            No clinic transactions match current filters.
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
            <CardContent className="p-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Search */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Search Lab Records</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search by Lab #, Pet, Owner, or Test Type..."
                      className="pl-9 text-xs"
                      value={labSearch}
                      onChange={(e) => {
                        setLabSearch(e.target.value);
                        setLabPage(1);
                      }}
                    />
                  </div>
                </div>

                {/* Filter Test Type */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Test Type</Label>
                  <Select
                    value={filterTestType}
                    onValueChange={(v) => {
                      setFilterTestType(v);
                      setLabPage(1);
                    }}
                  >
                    <SelectTrigger className="text-xs">
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

                {/* Filter Status */}
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Lab Status</Label>
                  <Select
                    value={filterLabStatus}
                    onValueChange={(v) => {
                      setFilterLabStatus(v);
                      setLabPage(1);
                    }}
                  >
                    <SelectTrigger className="text-xs">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {LAB_STATUSES.map((s) => (
                        <SelectItem key={s} value={s.toLowerCase()}>
                          {s}
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
                      <TableRow className="bg-[#E8EEF4] hover:bg-[#E8EEF4]">
                        <TableHead className="text-[#1B3A5C] font-bold text-xs">Lab Record #</TableHead>
                        <TableHead className="text-[#1B3A5C] font-bold text-xs">Date Conducted</TableHead>
                        <TableHead className="text-[#1B3A5C] font-bold text-xs">Pet Name</TableHead>
                        <TableHead className="text-[#1B3A5C] font-bold text-xs">Owner Name</TableHead>
                        <TableHead className="text-[#1B3A5C] font-bold text-xs">Test Type</TableHead>
                        <TableHead className="text-[#1B3A5C] font-bold text-xs">Status</TableHead>
                        <TableHead className="text-[#1B3A5C] font-bold text-xs text-right">Fee (₱)</TableHead>
                        <TableHead className="text-[#1B3A5C] font-bold text-xs">Performed By</TableHead>
                        <TableHead className="text-[#1B3A5C] font-bold text-xs text-right pr-6">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLabs.length ? (
                        paginatedLabs.map((l) => (
                          <TableRow key={l.id}>
                            <TableCell className="font-mono text-xs font-bold text-[#1FA8A8]">
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
                              <Badge variant="outline" className="text-xs bg-[#E8F6F6] text-[#1B3A5C] border-[#1FA8A8]/30 font-semibold">
                                {l.test_type}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={
                                  l.status === "Completed"
                                    ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold text-xs"
                                    : l.status === "In Progress"
                                    ? "bg-sky-50 text-sky-800 border-sky-300 font-semibold text-xs"
                                    : l.status === "Requested"
                                    ? "bg-amber-50 text-amber-800 border-amber-300 font-semibold text-xs"
                                    : "bg-slate-100 text-slate-700 font-semibold text-xs"
                                }
                              >
                                {l.status || "Completed"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-right font-mono font-bold">
                              {formatPeso(l.lab_fee)}
                            </TableCell>
                            <TableCell className="text-xs">{l.performed_by || "Clinic Staff"}</TableCell>
                            <TableCell className="text-right pr-4">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => setViewLab(l)}
                                  title="View Details"
                                >
                                  <Eye className="h-3.5 w-3.5 text-[#1B3A5C]" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-12 text-muted-foreground">
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-base font-bold text-[#1B3A5C] flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[#1FA8A8]" />
              {editTxn ? "Edit Transaction Record" : "Create Clinic Transaction"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-[#1B3A5C]">Select Pet & Owner *</Label>
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
              <Label className="text-xs font-bold text-[#1B3A5C]">Services & Items Description *</Label>
              <Input
                placeholder="e.g. General Consultation, Vaccination, Antibiotics"
                value={txnForm.services_rendered}
                onChange={(e) => setTxnForm({ ...txnForm, services_rendered: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-[#1B3A5C]">Subtotal (₱) *</Label>
                <Input
                  type="number"
                  placeholder="500"
                  value={txnForm.subtotal}
                  onChange={(e) => setTxnForm({ ...txnForm, subtotal: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-[#1B3A5C]">Discount (₱)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={txnForm.discount}
                  onChange={(e) => setTxnForm({ ...txnForm, discount: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-[#1B3A5C]">Additional Fees (₱)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={txnForm.additional_fees}
                  onChange={(e) => setTxnForm({ ...txnForm, additional_fees: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-[#1B3A5C]">Amount Paid (₱)</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={txnForm.amount_paid}
                  onChange={(e) => setTxnForm({ ...txnForm, amount_paid: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-bold text-[#1B3A5C]">Payment Method</Label>
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
              <Label className="text-xs font-bold text-[#1B3A5C]">Additional Notes</Label>
              <Textarea
                placeholder="Reference number or billing remarks..."
                value={txnForm.notes}
                onChange={(e) => setTxnForm({ ...txnForm, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button variant="outline" onClick={() => { setShowAddTxn(false); setEditTxn(null); }}>
              Cancel
            </Button>
            <Button onClick={handleSaveTxn} disabled={saving} className="bg-[#1B3A5C] hover:bg-[#152e4a]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : editTxn ? "Save Changes" : "Create Transaction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record New Lab Test Dialog */}
      <Dialog open={showAddLab} onOpenChange={setShowAddLab}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-heading text-base font-bold text-[#1B3A5C] flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-[#1FA8A8]" /> Record Laboratory Test
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2 text-xs">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-[#1B3A5C]">Select Pet & Owner *</Label>
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
                <Label className="text-xs font-bold text-[#1B3A5C]">Test Type *</Label>
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
                <Label className="text-xs font-bold text-[#1B3A5C]">Date Conducted</Label>
                <Input
                  type="date"
                  value={labForm.date_conducted}
                  onChange={(e) => setLabForm({ ...labForm, date_conducted: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-bold text-[#1B3A5C]">Status</Label>
                <Select value={labForm.status} onValueChange={(v) => setLabForm({ ...labForm, status: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LAB_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-bold text-[#1B3A5C]">Laboratory Fee (₱)</Label>
                <Input
                  type="number"
                  value={labForm.lab_fee}
                  onChange={(e) => setLabForm({ ...labForm, lab_fee: e.target.value })}
                  placeholder="500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-[#1B3A5C]">Performed By / Staff</Label>
              <Input
                value={labForm.performed_by}
                onChange={(e) => setLabForm({ ...labForm, performed_by: e.target.value })}
                placeholder="Dr. Santos / Clinic Staff"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-[#1B3A5C]">Test Result Summary</Label>
              <Textarea
                placeholder="e.g. Normal CBC count, negative for blood parasites"
                value={labForm.result}
                onChange={(e) => setLabForm({ ...labForm, result: e.target.value })}
                rows={2}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-[#1B3A5C]">Veterinary Remarks</Label>
              <Textarea
                placeholder="Follow-up recommendations..."
                value={labForm.remarks}
                onChange={(e) => setLabForm({ ...labForm, remarks: e.target.value })}
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="pt-3 border-t">
            <Button variant="outline" onClick={() => setShowAddLab(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveLab} disabled={saving} className="bg-[#1FA8A8] hover:bg-[#188787]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : "Save Lab Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Detailed Transaction & Record Payment Modal */}
      <Dialog open={!!viewTxn} onOpenChange={() => setViewTxn(null)}>
        <DialogContent className="max-w-2xl">
          {viewTxn && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-6">
                  <DialogTitle className="font-heading text-base font-bold text-[#1B3A5C] flex items-center gap-2">
                    <FileText className="h-5 w-5 text-[#1FA8A8]" /> Transaction Details — {viewTxn.transaction_number}
                  </DialogTitle>
                  <Badge
                    variant="outline"
                    className={
                      viewTxn.payment_status === "Paid"
                        ? "bg-emerald-50 text-emerald-800 border-emerald-300 font-bold"
                        : viewTxn.payment_status === "Partially Paid"
                        ? "bg-amber-50 text-amber-900 border-amber-300 font-bold"
                        : "bg-rose-50 text-rose-800 border-rose-200 font-semibold"
                    }
                  >
                    {viewTxn.payment_status}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-4 pt-2 text-xs">
                {/* 1. Patient & Owner Info */}
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Patient Information</span>
                    <p className="font-bold text-[#1B3A5C] text-sm">
                      {petMap.get(viewTxn.pet_id || "")?.name || viewTxn.pets?.name || "Pet"}
                    </p>
                    <p className="text-muted-foreground">
                      {petMap.get(viewTxn.pet_id || "")?.species || "Species"} • {petMap.get(viewTxn.pet_id || "")?.breed || "Crossbreed"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase font-bold">Owner Information</span>
                    <p className="font-bold text-[#1B3A5C] text-sm">
                      {ownerMap.get(viewTxn.owner_id || "")?.name || viewTxn.owners?.name || "Owner"}
                    </p>
                    <p className="text-muted-foreground">{ownerMap.get(viewTxn.owner_id || "")?.contact || "—"}</p>
                  </div>
                </div>

                {/* 2. Reference & Staff */}
                <div className="grid grid-cols-3 gap-2 py-2 border-b">
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Transaction Date</span>
                    <span className="font-medium">{formatDate(viewTxn.date || viewTxn.created_at)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Appointment / Care Ref</span>
                    <span className="font-medium">{viewTxn.appointment_id ? `APT-${viewTxn.appointment_id.slice(0, 6)}` : "Direct Entry"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px] uppercase">Processed / Vet</span>
                    <span className="font-medium">{viewTxn.vet || viewTxn.processed_by || "Clinic Staff"}</span>
                  </div>
                </div>

                {/* 3. Line Items Breakdown */}
                <div className="space-y-2">
                  <span className="font-bold text-[#1B3A5C] block text-xs uppercase">Services & Medication Line Items</span>
                  {(itemsByTxnId.get(viewTxn.id) ?? []).length > 0 ? (
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-[#E8EEF4]">
                          <TableHead className="text-[10px] font-bold text-[#1B3A5C]">Category</TableHead>
                          <TableHead className="text-[10px] font-bold text-[#1B3A5C]">Description / Product</TableHead>
                          <TableHead className="text-[10px] font-bold text-[#1B3A5C] text-center">Batch #</TableHead>
                          <TableHead className="text-[10px] font-bold text-[#1B3A5C] text-center">Qty</TableHead>
                          <TableHead className="text-[10px] font-bold text-[#1B3A5C] text-right">Unit Price</TableHead>
                          <TableHead className="text-[10px] font-bold text-[#1B3A5C] text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(itemsByTxnId.get(viewTxn.id) ?? []).map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="text-xs font-semibold text-[#1B3A5C]">{item.category || "Service"}</TableCell>
                            <TableCell className="text-xs">{item.description}</TableCell>
                            <TableCell className="text-xs text-center font-mono text-slate-600">{item.batch_no || "—"}</TableCell>
                            <TableCell className="text-xs text-center">{item.quantity}</TableCell>
                            <TableCell className="text-xs text-right font-mono">{formatPeso(item.unit_price)}</TableCell>
                            <TableCell className="text-xs text-right font-mono font-bold text-[#1B3A5C]">{formatPeso(item.line_total)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="p-3 bg-slate-50 border rounded text-xs">
                      <p className="font-medium text-slate-800">{viewTxn.services_rendered}</p>
                    </div>
                  )}
                </div>

                {/* 4. Payment Summary Breakdown */}
                <div className="bg-[#E8EEF4]/60 p-4 rounded-xl space-y-2 border border-[#1B3A5C]/10">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Subtotal Amount:</span>
                    <span className="font-mono font-bold">{formatPeso(viewTxn.subtotal)}</span>
                  </div>
                  {Number(viewTxn.discount ?? 0) > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Discount Applied:</span>
                      <span className="font-mono font-bold">-{formatPeso(viewTxn.discount)}</span>
                    </div>
                  )}
                  {Number(viewTxn.additional_fees ?? 0) > 0 && (
                    <div className="flex justify-between text-slate-700">
                      <span>Additional Fees:</span>
                      <span className="font-mono font-bold">+{formatPeso(viewTxn.additional_fees)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold text-[#1B3A5C] border-t pt-2">
                    <span>Total Amount Due:</span>
                    <span className="font-mono">{formatPeso(viewTxn.total_amount)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-emerald-800 font-semibold">
                    <span>Amount Paid:</span>
                    <span className="font-mono font-bold">{formatPeso(viewTxn.amount_paid)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-amber-800 font-bold border-t pt-1">
                    <span>Remaining Balance:</span>
                    <span className="font-mono">{formatPeso(viewTxn.balance)}</span>
                  </div>
                </div>

                {/* 5. Record Payment Form */}
                {viewTxn.payment_status !== "Paid" && (
                  <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl space-y-3">
                    <span className="font-bold text-emerald-900 block text-xs uppercase flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4 text-emerald-700" /> Record Payment
                    </span>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1 col-span-2">
                        <Label className="text-[11px] font-semibold text-emerald-900">Payment Amount (₱)</Label>
                        <Input
                          type="number"
                          placeholder={String(viewTxn.balance || viewTxn.total_amount || 0)}
                          value={payAmountInput}
                          onChange={(e) => setPayAmountInput(e.target.value)}
                          className="bg-white text-xs border-emerald-300"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px] font-semibold text-emerald-900">Method</Label>
                        <Select value={payMethodInput} onValueChange={setPayMethodInput}>
                          <SelectTrigger className="bg-white text-xs border-emerald-300">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Cash">Cash</SelectItem>
                            <SelectItem value="GCash">GCash</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleRecordPayment(viewTxn, parseFloat(payAmountInput) || 0, payMethodInput)}
                      disabled={saving || !parseFloat(payAmountInput)}
                      className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs h-8"
                    >
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Payment Record"}
                    </Button>
                  </div>
                )}
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button variant="outline" onClick={() => setViewTxn(null)}>
                  Close
                </Button>
                <Button variant="outline" onClick={() => handlePrintReceipt(viewTxn)}>
                  <Printer className="h-4 w-4 mr-1" /> Print Summary Receipt
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* View Lab Record Details Modal */}
      <Dialog open={!!viewLab} onOpenChange={() => setViewLab(null)}>
        <DialogContent className="max-w-md">
          {viewLab && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-6">
                  <DialogTitle className="font-heading text-base font-bold text-[#1B3A5C] flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 text-[#1FA8A8]" /> {viewLab.lab_record_number}
                  </DialogTitle>
                  <Badge variant="outline" className="bg-[#E8F6F6] text-[#1B3A5C] border-[#1FA8A8]/30 font-semibold">
                    {viewLab.test_type}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-3 pt-2 text-xs">
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Date Conducted:</span>
                  <span>{formatDate(viewLab.date_conducted || viewLab.created_at)}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Pet Name:</span>
                  <span className="font-bold">{petMap.get(viewLab.pet_id || "")?.name || viewLab.pets?.name || "—"}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Owner Name:</span>
                  <span>{ownerMap.get(viewLab.owner_id || "")?.name || viewLab.owners?.name || "—"}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-semibold">{viewLab.status || "Completed"}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Laboratory Fee:</span>
                  <span className="font-bold text-[#1B3A5C] font-mono">{formatPeso(viewLab.lab_fee)}</span>
                </div>
                <div className="flex justify-between py-1 border-b">
                  <span className="text-muted-foreground">Performed By:</span>
                  <span>{viewLab.performed_by || "Clinic Staff"}</span>
                </div>

                {viewLab.result && (
                  <div className="p-3 bg-slate-50 border rounded-lg space-y-1">
                    <span className="font-bold text-[#1B3A5C] uppercase text-[10px]">Test Result Summary</span>
                    <p className="leading-relaxed">{viewLab.result}</p>
                  </div>
                )}

                {viewLab.remarks && (
                  <div className="p-3 bg-[#E8F6F6]/50 border border-[#1FA8A8]/20 rounded-lg space-y-1">
                    <span className="font-bold text-[#1B3A5C] uppercase text-[10px]">Veterinary Remarks</span>
                    <p className="leading-relaxed">{viewLab.remarks}</p>
                  </div>
                )}
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button variant="outline" onClick={() => setViewLab(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Transaction Confirmation Modal */}
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
