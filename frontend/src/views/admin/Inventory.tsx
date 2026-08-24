"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus,
  Pencil,
  Printer,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Loader2,
  Trash2,
  Eye,
  Download,
  Search,
  Package,
  History,
  Layers,
  Calendar,
  Layers2,
  Box,
} from "lucide-react";
import { db } from "@/lib/db-client";
import { useRows, useInvalidate } from "@/hooks/useRows";
import { formatDate } from "@/lib/age";
import { todayPH, isBeforeTodayPH, daysFromTodayPH, formatNowPH } from "@/lib/datetime";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { isAdmin } from "@/lib/roles";

// Categories definition
const CATEGORIES = [
  { value: "medication", label: "Medicine" },
  { value: "vaccine", label: "Vaccine" },
  { value: "dewormer", label: "Dewormer" },
  { value: "supply", label: "Medical Supply" },
  { value: "lab_supply", label: "Laboratory Supply" },
  { value: "other", label: "Other" },
] as const;

const CATEGORY_MAP: Record<string, string> = {
  medication: "Medicine",
  medicine: "Medicine",
  vaccine: "Vaccine",
  dewormer: "Dewormer",
  supply: "Medical Supply",
  medical_supply: "Medical Supply",
  lab_supply: "Laboratory Supply",
  laboratory_supply: "Laboratory Supply",
  other: "Other",
};

function getCategoryLabel(category?: string | null): string {
  if (!category) return "Other";
  const key = category.toLowerCase().trim();
  return CATEGORY_MAP[key] ?? category;
}

const STATUS_OPTIONS = ["Available", "Low Stock", "Out of Stock", "Expiring Soon", "Expired"] as const;
type ItemStatus = (typeof STATUS_OPTIONS)[number];

function getStatusBadgeStyle(status: ItemStatus) {
  switch (status) {
    case "Available":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case "Low Stock":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "Out of Stock":
      return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
    case "Expiring Soon":
      return "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30";
    case "Expired":
      return "bg-red-700/15 text-red-800 dark:text-red-400 border-red-700/30 font-semibold";
    default:
      return "bg-secondary text-secondary-foreground";
  }
}

const STOCK_IN_REASONS = [
  "New Purchase",
  "Donation",
  "Inventory Adjustment",
  "Returned Stock",
  "Other",
] as const;

const STOCK_OUT_REASONS = [
  "Used for Treatment",
  "Used for Vaccination",
  "Damaged",
  "Expired",
  "Lost",
  "Inventory Adjustment",
  "Other",
] as const;

export type InventoryBatch = {
  id?: string;
  inventory_item_id?: string;
  batch_no: string;
  expiration_date: string | null;
  initial_quantity: number;
  remaining_quantity: number;
  consumed_quantity: number;
  date_received: string;
  status: ItemStatus;
};

export function getBatchCalculatedStatus(
  remainingQty: number,
  expirationDate?: string | Date | null
): ItemStatus {
  if (remainingQty <= 0) return "Out of Stock";
  if (!expirationDate) return "Available";
  const expStr = String(expirationDate).slice(0, 10);
  const days = daysFromTodayPH(expStr);
  if (days === null) return "Available";
  if (days < 0 || isBeforeTodayPH(expStr)) return "Expired";
  if (days <= 30) return "Expiring Soon";
  return "Available";
}

/**
 * Derives batch breakdown per item from inventory_batches database table and transaction fallback.
 * Calculates dynamic batch status and consumed quantity (initial_quantity - remaining_quantity).
 */
function getItemBatches(item: any, dbBatches: any[] = [], allTxns: any[] = []): InventoryBatch[] {
  if (!item) return [];

  const matchedBatches = (dbBatches || []).filter((b) => b.inventory_item_id === item.id);

  if (matchedBatches.length > 0) {
    return matchedBatches
      .map((b) => {
        const initQty = Number(b.initial_quantity ?? 0);
        const remQty = Number(b.remaining_quantity ?? 0);
        const consQty = Math.max(0, initQty - remQty);
        const expDate = b.expiration_date ? String(b.expiration_date).slice(0, 10) : null;
        const recDate = b.received_date
          ? String(b.received_date).slice(0, 10)
          : b.created_at
          ? String(b.created_at).slice(0, 10)
          : todayPH();

        return {
          id: b.id,
          inventory_item_id: b.inventory_item_id,
          batch_no: String(b.batch_no || "LOT-001").trim(),
          expiration_date: expDate,
          initial_quantity: initQty,
          remaining_quantity: remQty,
          consumed_quantity: consQty,
          date_received: recDate,
          status: getBatchCalculatedStatus(remQty, expDate),
        };
      })
      .sort((a, b) => {
        if (!a.expiration_date) return 1;
        if (!b.expiration_date) return -1;
        return new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime();
      });
  }

  const itemTxns = allTxns
    .filter((t) => t.item_id === item.id)
    .sort((a, b) => {
      const timeA = new Date(a.date || a.created_at || 0).getTime();
      const timeB = new Date(b.date || b.created_at || 0).getTime();
      return timeA - timeB;
    });

  const batchMap: Map<string, InventoryBatch> = new Map();

  for (const txn of itemTxns) {
    if (txn.type === "in") {
      const bNo = (txn.batch_no || item.batch_no || "LEGACY-001").trim();
      const expDate = txn.expiration_date
        ? String(txn.expiration_date).slice(0, 10)
        : item.expiration_date
        ? String(item.expiration_date).slice(0, 10)
        : null;
      const key = `${bNo.toUpperCase()}___${expDate || "NO_EXP"}`;

      const qty = Number(txn.quantity ?? 0);
      const dateRec = txn.date ? String(txn.date).slice(0, 10) : String(txn.created_at || "").slice(0, 10);

      if (batchMap.has(key)) {
        const existing = batchMap.get(key)!;
        existing.initial_quantity += qty;
        existing.remaining_quantity += qty;
      } else {
        batchMap.set(key, {
          batch_no: bNo,
          expiration_date: expDate,
          initial_quantity: qty,
          remaining_quantity: qty,
          consumed_quantity: 0,
          date_received: dateRec,
          status: getBatchCalculatedStatus(qty, expDate),
        });
      }
    }
  }

  // Fallback if no stock in transaction exists yet
  if (batchMap.size === 0) {
    const bNo = (item.batch_no || "LEGACY-001").trim();
    const expDate = item.expiration_date ? String(item.expiration_date).slice(0, 10) : null;
    const key = `${bNo.toUpperCase()}___${expDate || "NO_EXP"}`;
    const qty = Number(item.quantity ?? 0);
    batchMap.set(key, {
      batch_no: bNo,
      expiration_date: expDate,
      initial_quantity: qty,
      remaining_quantity: qty,
      consumed_quantity: 0,
      date_received: item.created_at ? String(item.created_at).slice(0, 10) : todayPH(),
      status: getBatchCalculatedStatus(qty, expDate),
    });
  }

  // Sort batches FEFO: earliest expiring date first
  const batches = Array.from(batchMap.values()).sort((a, b) => {
    if (!a.expiration_date) return 1;
    if (!b.expiration_date) return -1;
    return new Date(a.expiration_date).getTime() - new Date(b.expiration_date).getTime();
  });

  // Apply stock outs
  for (const txn of itemTxns) {
    if (txn.type === "out") {
      let remainingToDeduct = Number(txn.quantity ?? 0);
      const targetBatchNo = txn.batch_no ? String(txn.batch_no).trim().toUpperCase() : null;
      const targetExpDate = txn.expiration_date ? String(txn.expiration_date).slice(0, 10) : null;

      if (targetBatchNo) {
        const match = batches.find(
          (b) => b.batch_no.toUpperCase() === targetBatchNo && (!targetExpDate || b.expiration_date === targetExpDate)
        );
        if (match && match.remaining_quantity > 0) {
          const deduct = Math.min(match.remaining_quantity, remainingToDeduct);
          match.remaining_quantity -= deduct;
          remainingToDeduct -= deduct;
        }
      }

      if (remainingToDeduct > 0) {
        for (const b of batches) {
          if (b.remaining_quantity > 0) {
            const deduct = Math.min(b.remaining_quantity, remainingToDeduct);
            b.remaining_quantity -= deduct;
            remainingToDeduct -= deduct;
            if (remainingToDeduct <= 0) break;
          }
        }
      }
    }
  }

  // Recalculate consumed quantity and status per batch
  for (const b of batches) {
    b.consumed_quantity = Math.max(0, b.initial_quantity - b.remaining_quantity);
    b.status = getBatchCalculatedStatus(b.remaining_quantity, b.expiration_date);
  }

  return batches;
}

function getItemSummary(item: any, dbBatches: any[] = [], allTxns: any[] = []) {
  const batches = getItemBatches(item, dbBatches, allTxns);
  const activeBatches = batches.filter((b) => b.remaining_quantity > 0);
  const totalQty = activeBatches.reduce((acc, b) => acc + b.remaining_quantity, 0);

  const reorderLevel = Number(item.reorder_level ?? 5);

  let status: ItemStatus = "Available";
  const hasExpiredActive = activeBatches.some((b) => b.status === "Expired");
  const hasExpiringSoonActive = activeBatches.some((b) => b.status === "Expiring Soon");

  if (hasExpiredActive) {
    status = "Expired";
  } else if (hasExpiringSoonActive) {
    status = "Expiring Soon";
  } else if (totalQty <= 0) {
    status = "Out of Stock";
  } else if (totalQty <= reorderLevel) {
    status = "Low Stock";
  } else {
    status = "Available";
  }

  const earliestExpBatch = activeBatches
    .filter((b) => !!b.expiration_date)
    .sort((a, b) => new Date(a.expiration_date!).getTime() - new Date(b.expiration_date!).getTime())[0];

  const earliestExpiration = earliestExpBatch?.expiration_date || item.expiration_date || null;

  return {
    batches,
    activeBatches,
    totalQty,
    status,
    earliestExpiration,
  };
}

type AddItemForm = {
  name: string;
  description: string;
  category: string;
  custom_category: string;
  unit: string;
  quantity: string;
  unit_price: string;
  reorder_level: string;
  expiration_date: string;
  batch_no: string;
};

const emptyAddItemForm: AddItemForm = {
  name: "",
  description: "",
  category: "medication",
  custom_category: "",
  unit: "vial",
  quantity: "0",
  unit_price: "0.00",
  reorder_level: "5",
  expiration_date: "",
  batch_no: "LOT-001",
};

type EditItemForm = {
  name: string;
  description: string;
  category: string;
  custom_category: string;
  unit: string;
  unit_price: string;
  reorder_level: string;
  expiration_date: string;
  batch_no: string;
  quantity: number;
};

type StockInForm = {
  quantity: string;
  unit_price: string;
  batch_no: string;
  expiration_date: string;
  reason: string;
  notes: string;
};

const emptyStockInForm: StockInForm = {
  quantity: "1",
  unit_price: "0.00",
  batch_no: "",
  expiration_date: "",
  reason: STOCK_IN_REASONS[0],
  notes: "",
};

type StockOutForm = {
  batch_key: string;
  quantity: string;
  reason: string;
  notes: string;
};

const emptyStockOutForm: StockOutForm = {
  batch_key: "",
  quantity: "1",
  reason: STOCK_OUT_REASONS[0],
  notes: "",
};

export default function Inventory() {
  const { role, user } = useAuth();
  const canManageItems = isAdmin(role);
  const { data: items = [], isLoading } = useRows<any>("inventory_items", { orderBy: "name" });
  const { data: dbBatches = [] } = useRows<any>("inventory_batches");
  const { data: txns = [] } = useRows<any>("inventory_transactions", { orderBy: "date", ascending: false });
  const invalidate = useInvalidate();

  // Dialog States
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState<AddItemForm>(emptyAddItemForm);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editForm, setEditForm] = useState<EditItemForm>({
    name: "",
    description: "",
    category: "medication",
    custom_category: "",
    unit: "vial",
    unit_price: "0.00",
    reorder_level: "5",
    expiration_date: "",
    batch_no: "",
    quantity: 0,
  });

  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingItem, setViewingItem] = useState<any>(null);

  // Stock In Modal
  const [showStockInModal, setShowStockInModal] = useState(false);
  const [stockInForm, setStockInForm] = useState<StockInForm>(emptyStockInForm);

  // Stock Out Modal
  const [showStockOutModal, setShowStockOutModal] = useState(false);
  const [stockOutForm, setStockOutForm] = useState<StockOutForm>(emptyStockOutForm);

  // Edit Batch Modal (Admin)
  const [showEditBatchModal, setShowEditBatchModal] = useState(false);
  const [editingBatch, setEditingBatch] = useState<InventoryBatch | null>(null);
  const [editBatchForm, setEditBatchForm] = useState({
    batch_no: "",
    expiration_date: "",
    initial_quantity: "0",
    remaining_quantity: "0",
    reason: "Data Entry Correction",
    notes: "",
  });

  const [targetItem, setTargetItem] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Table Search & Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Transaction History Filters
  const [historySearch, setHistorySearch] = useState("");
  const [historyTypeFilter, setHistoryTypeFilter] = useState("all");

  const pageSize = 10;

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, statusFilter]);

  // Keep viewing/target item fresh on query invalidation
  useEffect(() => {
    if (viewingItem) {
      const refreshed = items.find((i) => i.id === viewingItem.id);
      if (refreshed) setViewingItem(refreshed);
    }
    if (targetItem) {
      const refreshed = items.find((i) => i.id === targetItem.id);
      if (refreshed) setTargetItem(refreshed);
    }
  }, [items]);

  // Pre-calculated batch summaries for all items
  const itemSummaries = useMemo(() => {
    const map: Record<string, ReturnType<typeof getItemSummary>> = {};
    items.forEach((item) => {
      map[item.id] = getItemSummary(item, dbBatches, txns);
    });
    return map;
  }, [items, dbBatches, txns]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const summary = itemSummaries[item.id] || getItemSummary(item, dbBatches, txns);
      const nameAndDesc = `${item.name ?? ""} ${item.description ?? ""} ${item.item_code ?? ""}`.toLowerCase();
      const matchesQuery = !query || nameAndDesc.includes(query);

      let matchesCategory = true;
      if (categoryFilter !== "all") {
        const itemCatLabel = getCategoryLabel(item.category).toLowerCase();
        const selectedCatLabel = getCategoryLabel(categoryFilter).toLowerCase();
        matchesCategory = itemCatLabel === selectedCatLabel || item.category === categoryFilter;
      }

      const matchesStatus = statusFilter === "all" || summary.status === statusFilter;
      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [items, itemSummaries, txns, search, categoryFilter, statusFilter]);

  const pagedItems = useMemo(() => {
    const offset = (page - 1) * pageSize;
    return filteredItems.slice(offset, offset + pageSize);
  }, [filteredItems, page]);

  // Compute 8 Dashboard summary metrics based on batch engine
  const metrics = useMemo(() => {
    const medicinesCount = items.filter((i) => ["medication", "medicine"].includes((i.category ?? "").toLowerCase())).length;
    const vaccinesCount = items.filter((i) => (i.category ?? "").toLowerCase() === "vaccine").length;
    const dewormersCount = items.filter((i) => (i.category ?? "").toLowerCase() === "dewormer").length;
    const suppliesCount = items.filter((i) => ["supply", "medical_supply"].includes((i.category ?? "").toLowerCase())).length;

    let lowStockCount = 0;
    let outOfStockCount = 0;
    let expiringSoonCount = 0;

    items.forEach((item) => {
      const summary = itemSummaries[item.id] || getItemSummary(item, dbBatches, txns);
      if (summary.status === "Low Stock") lowStockCount++;
      if (summary.status === "Out of Stock") outOfStockCount++;
      if (summary.status === "Expiring Soon" || summary.status === "Expired") expiringSoonCount++;
    });

    return {
      total: items.length,
      medicines: medicinesCount,
      vaccines: vaccinesCount,
      dewormers: dewormersCount,
      supplies: suppliesCount,
      lowStock: lowStockCount,
      outOfStock: outOfStockCount,
      expiringSoon: expiringSoonCount,
    };
  }, [items, itemSummaries, dbBatches, txns]);

  // Chronological remaining item stock map for Transaction History
  const remainingStockMap = useMemo(() => {
    const map: Record<string, number> = {};
    const txnsByItem: Record<string, any[]> = {};
    items.forEach((i) => {
      txnsByItem[i.id] = [];
    });

    txns.forEach((txn) => {
      if (txnsByItem[txn.item_id]) {
        txnsByItem[txn.item_id].push(txn);
      }
    });

    Object.keys(txnsByItem).forEach((itemId) => {
      const item = items.find((i) => i.id === itemId);
      const summary = itemSummaries[itemId] || getItemSummary(item, dbBatches, txns);
      const currentStock = summary.totalQty;
      const itemTxns = [...txnsByItem[itemId]];
      itemTxns.reverse(); // newest to oldest for backwards stock calculation

      let running = currentStock;
      itemTxns.forEach((txn) => {
        map[txn.id] = running;
        const q = Number(txn.quantity ?? 0);
        if (txn.type === "in") {
          running = Math.max(0, running - q);
        } else {
          running = running + q;
        }
      });
    });

    return map;
  }, [items, itemSummaries, txns]);

  // Filtered Transaction History
  const filteredTransactions = useMemo(() => {
    const query = historySearch.trim().toLowerCase();
    return txns.filter((txn) => {
      const item = items.find((i) => i.id === txn.item_id);
      const itemNameStr = (item?.name ?? "").toLowerCase();
      const batchStr = (txn.batch_no ?? "").toLowerCase();
      const staffStr = (txn.staff_name ?? txn.recorded_by ?? "").toLowerCase();
      const reasonStr = (txn.reason ?? txn.notes ?? "").toLowerCase();
      const matchesSearch =
        !query ||
        itemNameStr.includes(query) ||
        batchStr.includes(query) ||
        staffStr.includes(query) ||
        reasonStr.includes(query);

      const isAutoDeduction = (txn.reason ?? "").toLowerCase().includes("care history");
      let matchesType = true;
      if (historyTypeFilter === "in") matchesType = txn.type === "in" && !isAutoDeduction;
      else if (historyTypeFilter === "out") matchesType = txn.type === "out" && !isAutoDeduction;
      else if (historyTypeFilter === "auto") matchesType = isAutoDeduction;

      return matchesSearch && matchesType;
    });
  }, [txns, items, historySearch, historyTypeFilter]);

  // Active Alert Items
  const alertItems = useMemo(() => {
    return items.filter((i) => {
      const s = (itemSummaries[i.id] || getItemSummary(i, txns)).status;
      return s !== "Available";
    });
  }, [items, itemSummaries, txns]);

  // ADD ITEM HANDLERS
  const openAddItem = () => {
    setAddForm(emptyAddItemForm);
    setShowAddModal(true);
  };

  const handleSaveAddItem = async () => {
    const name = addForm.name.trim();
    if (!name) {
      toast.error("Item name is required.");
      return;
    }

    const qty = Number(addForm.quantity || 0);
    if (isNaN(qty) || qty < 0) {
      toast.error("Current quantity cannot be negative.");
      return;
    }

    const reorderLevel = Number(addForm.reorder_level || 0);
    if (isNaN(reorderLevel) || reorderLevel < 0) {
      toast.error("Reorder level cannot be negative.");
      return;
    }

    // Check duplicate item name in the same category
    const isDuplicate = items.some(
      (i) => i.category === addForm.category && i.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (isDuplicate) {
      toast.error("An item with this name already exists in the selected category.");
      return;
    }

    // Check past expiration date when adding new inventory
    if (addForm.expiration_date && isBeforeTodayPH(addForm.expiration_date)) {
      toast.error("Expiration date cannot be in the past when adding new inventory.");
      return;
    }

    if (addForm.category === "other" && !addForm.custom_category.trim()) {
      toast.error("Please specify the category name for 'Other'.");
      return;
    }

    const finalCategory = addForm.category === "other" ? addForm.custom_category.trim() : addForm.category;

    setSaving(true);
    const itemCode = `INV-${Date.now().toString().slice(-6)}`;
    const batchNo = addForm.batch_no.trim() || "LOT-001";
    const unitPrice = Math.max(0, parseFloat(addForm.unit_price || "0") || 0);

    const payload: any = {
      name,
      description: addForm.description.trim() || null,
      category: finalCategory,
      unit: addForm.unit.trim() || "unit",
      quantity: qty,
      unit_price: unitPrice,
      reorder_level: reorderLevel,
      expiration_date: addForm.expiration_date || null,
      batch_no: batchNo,
      item_code: itemCode,
      status: "Available",
    };

    const { data: createdItem, error } = await db.from("inventory_items").insert(payload as any).select("*").single();

    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }

    setSaving(false);
    toast.success("Inventory item added successfully.");
    setShowAddModal(false);
    invalidate("inventory_items");
    invalidate("inventory_batches");
    invalidate("inventory_transactions");
  };

  // EDIT ITEM HANDLERS
  const openEditItem = (item: any) => {
    setEditingItem(item);
    const summary = itemSummaries[item.id] || getItemSummary(item, dbBatches, txns);
    const isStandardCat = ["medication", "medicine", "vaccine", "dewormer", "supply", "medical_supply", "lab_supply", "laboratory_supply"].includes((item.category ?? "").toLowerCase());

    setEditForm({
      name: item.name ?? "",
      description: item.description ?? "",
      category: isStandardCat ? (item.category ?? "medication") : "other",
      custom_category: isStandardCat ? "" : (item.category ?? ""),
      unit: item.unit ?? "vial",
      unit_price: String(item.unit_price ?? item.purchase_price ?? "0.00"),
      reorder_level: String(item.reorder_level ?? 5),
      expiration_date: item.expiration_date ? String(item.expiration_date).slice(0, 10) : "",
      batch_no: item.batch_no ?? "",
      quantity: summary.totalQty,
    });
    setShowEditModal(true);
  };

  const handleSaveEditItem = async () => {
    if (!editingItem) return;

    const name = editForm.name.trim();
    if (!name) {
      toast.error("Item name is required.");
      return;
    }

    const reorderLevel = Number(editForm.reorder_level || 0);
    if (isNaN(reorderLevel) || reorderLevel < 0) {
      toast.error("Reorder level cannot be negative.");
      return;
    }

    if (editForm.category === "other" && !editForm.custom_category.trim()) {
      toast.error("Please specify the category name for 'Other'.");
      return;
    }

    const finalCategory = editForm.category === "other" ? editForm.custom_category.trim() : editForm.category;

    // Check duplicate item name in the same category
    const isDuplicate = items.some(
      (i) => i.id !== editingItem.id && i.category === finalCategory && i.name.trim().toLowerCase() === name.toLowerCase()
    );
    if (isDuplicate) {
      toast.error("Another item with this name already exists in the selected category.");
      return;
    }

    setSaving(true);
    const unitPrice = Math.max(0, parseFloat(editForm.unit_price || "0") || 0);
    const payload: any = {
      name,
      description: editForm.description.trim() || null,
      category: finalCategory,
      unit: editForm.unit.trim() || "unit",
      unit_price: unitPrice,
      reorder_level: reorderLevel,
      expiration_date: editForm.expiration_date || null,
      batch_no: editForm.batch_no.trim() || null,
    };

    const { error } = await db.from("inventory_items").update(payload).eq("id", editingItem.id);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Inventory item updated successfully.");
    setShowEditModal(false);
    invalidate("inventory_items");
  };

  // DELETE HANDLER
  const handleDeleteItem = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    const { error } = await db.from("inventory_items").delete().eq("id", deleteTarget.id);
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success(`Deleted item "${deleteTarget.name}".`);
    setDeleteTarget(null);
    invalidate("inventory_items");
    invalidate("inventory_transactions");
  };

  // STOCK IN MODAL OPEN & SUBMIT
  const openStockInModal = (item: any) => {
    setTargetItem(item);
    setStockInForm({
      quantity: "1",
      unit_price: String(item.unit_price ?? item.purchase_price ?? "0.00"),
      batch_no: "",
      expiration_date: item.expiration_date ? String(item.expiration_date).slice(0, 10) : "",
      reason: STOCK_IN_REASONS[0],
      notes: "",
    });
    setShowStockInModal(true);
  };

  const handleSaveStockIn = async () => {
    if (!targetItem) return;

    const qty = parseInt(stockInForm.quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid positive quantity added.");
      return;
    }

    const batchNo = stockInForm.batch_no.trim();
    if (!batchNo) {
      toast.error("Batch / Lot Number is required.");
      return;
    }

    if (!stockInForm.expiration_date) {
      toast.error("Expiration Date is required for Stock In.");
      return;
    }

    if (isBeforeTodayPH(stockInForm.expiration_date)) {
      toast.error("Expiration Date cannot be in the past when stocking in inventory.");
      return;
    }

    if (!stockInForm.reason) {
      toast.error("Please select a reason for Stock In.");
      return;
    }

    setSaving(true);
    const staffName = user?.user_metadata?.full_name || user?.email || role || "Clinic Staff";
    const unitPrice = Math.max(0, parseFloat(stockInForm.unit_price || "0") || 0);
    const totalAmount = Number((qty * unitPrice).toFixed(2));

    const txnPayload: any = {
      item_id: targetItem.id,
      type: "in",
      quantity: qty,
      unit_price: unitPrice,
      unit_cost: unitPrice,
      total_amount: totalAmount,
      batch_no: batchNo,
      expiration_date: stockInForm.expiration_date,
      reason: stockInForm.reason,
      notes: stockInForm.notes.trim() || null,
      staff_name: staffName,
      recorded_by: staffName,
      date: todayPH(),
      transaction_no: `TXN-IN-${Date.now().toString().slice(-6)}`,
    };

    const { error: txnErr } = await db.from("inventory_transactions").insert(txnPayload);
    setSaving(false);

    if (txnErr) {
      toast.error(txnErr.message);
      return;
    }

    toast.success(`Stocked in ${qty} ${targetItem.unit || "unit"} under batch ${batchNo}.`);
    setShowStockInModal(false);
    invalidate("inventory_items");
    invalidate("inventory_batches");
    invalidate("inventory_transactions");
  };

  // STOCK OUT MODAL OPEN & SUBMIT
  const openStockOutModal = (item: any) => {
    setTargetItem(item);
    const summary = itemSummaries[item.id] || getItemSummary(item, txns);
    const firstActive = summary.activeBatches[0];
    const firstBatchKey = firstActive
      ? `${firstActive.batch_no.toUpperCase()}___${firstActive.expiration_date || "NO_EXP"}`
      : "";

    setStockOutForm({
      batch_key: firstBatchKey,
      quantity: "1",
      reason: STOCK_OUT_REASONS[0],
      notes: "",
    });
    setShowStockOutModal(true);
  };

  const handleSaveStockOut = async () => {
    if (!targetItem) return;

    if (!stockOutForm.batch_key) {
      toast.error("Please select an available batch.");
      return;
    }

    const summary = itemSummaries[targetItem.id] || getItemSummary(targetItem, txns);
    const selectedBatch = summary.activeBatches.find(
      (b) => `${b.batch_no.toUpperCase()}___${b.expiration_date || "NO_EXP"}` === stockOutForm.batch_key
    );

    if (!selectedBatch) {
      toast.error("Selected batch is invalid or no longer available.");
      return;
    }

    const qty = parseInt(stockOutForm.quantity, 10);
    if (isNaN(qty) || qty <= 0) {
      toast.error("Please enter a valid positive quantity removed.");
      return;
    }

    if (qty > selectedBatch.remaining_quantity) {
      toast.error(
        `Cannot remove more than available batch quantity (${selectedBatch.remaining_quantity} ${targetItem.unit || "unit"}).`
      );
      return;
    }

    if (!stockOutForm.reason) {
      toast.error("Please select a reason for Stock Out.");
      return;
    }

    setSaving(true);
    const staffName = user?.user_metadata?.full_name || user?.email || role || "Clinic Staff";
    const unitPrice = Math.max(0, Number(targetItem.unit_price ?? targetItem.purchase_price ?? 0));
    const totalAmount = Number((qty * unitPrice).toFixed(2));

    const txnPayload: any = {
      item_id: targetItem.id,
      type: "out",
      quantity: qty,
      unit_price: unitPrice,
      unit_cost: unitPrice,
      total_amount: totalAmount,
      batch_no: selectedBatch.batch_no,
      expiration_date: selectedBatch.expiration_date,
      reason: stockOutForm.reason,
      notes: stockOutForm.notes.trim() || null,
      staff_name: staffName,
      recorded_by: staffName,
      date: todayPH(),
      transaction_no: `TXN-OUT-${Date.now().toString().slice(-6)}`,
    };

    const { error: txnErr } = await db.from("inventory_transactions").insert(txnPayload);
    setSaving(false);

    if (txnErr) {
      toast.error(txnErr.message);
      return;
    }

    toast.success(`Stock out of ${qty} ${targetItem.unit || "unit"} recorded from batch ${selectedBatch.batch_no}.`);
    setShowStockOutModal(false);
    invalidate("inventory_items");
    invalidate("inventory_transactions");
  };

  // EDIT BATCH HANDLERS (ADMIN)
  const openEditBatchModal = (batch: InventoryBatch) => {
    setEditingBatch(batch);
    setEditBatchForm({
      batch_no: batch.batch_no,
      expiration_date: batch.expiration_date ? String(batch.expiration_date).slice(0, 10) : "",
      initial_quantity: String(batch.initial_quantity),
      remaining_quantity: String(batch.remaining_quantity),
      reason: "Data Entry Correction",
      notes: "",
    });
    setShowEditBatchModal(true);
  };

  const handleSaveEditBatch = async () => {
    if (!editingBatch || !editingBatch.id || !viewingItem) return;

    const batchNo = editBatchForm.batch_no.trim();
    if (!batchNo) {
      toast.error("Batch / Lot Number is required.");
      return;
    }

    const initQty = Number(editBatchForm.initial_quantity);
    const remQty = Number(editBatchForm.remaining_quantity);

    if (isNaN(initQty) || initQty < 0) {
      toast.error("Initial quantity cannot be negative.");
      return;
    }
    if (isNaN(remQty) || remQty < 0) {
      toast.error("Remaining quantity cannot be negative.");
      return;
    }
    if (remQty > initQty) {
      toast.error("Remaining quantity cannot exceed Initial quantity.");
      return;
    }

    const expDate = editBatchForm.expiration_date ? editBatchForm.expiration_date.trim() : null;

    setSaving(true);
    try {
      const staffName = user?.user_metadata?.full_name || user?.email || role || "Admin";
      const oldRemQty = editingBatch.remaining_quantity;
      const diff = remQty - oldRemQty;

      // Update batch in DB
      const { error: batchErr } = await db
        .from("inventory_batches")
        .update({
          batch_no: batchNo,
          expiration_date: expDate,
          initial_quantity: initQty,
          remaining_quantity: remQty,
        })
        .eq("id", editingBatch.id);

      if (batchErr) {
        setSaving(false);
        toast.error(batchErr.message);
        return;
      }

      // Insert audit log if remaining quantity changed
      if (diff !== 0) {
        await db.from("inventory_transactions").insert({
          item_id: viewingItem.id,
          inventory_batch_id: editingBatch.id,
          type: diff > 0 ? "in" : "out",
          quantity: Math.abs(diff),
          batch_no: batchNo,
          expiration_date: expDate,
          reason: `Adjustment: ${editBatchForm.reason}`,
          notes: editBatchForm.notes.trim() || `Corrected batch stock from ${oldRemQty} to ${remQty}`,
          recorded_by: staffName,
          staff_name: staffName,
          date: todayPH(),
          transaction_no: `TXN-ADJ-${Date.now().toString().slice(-6)}`,
        });
      }

      invalidate("inventory_items");
      invalidate("inventory_batches");
      invalidate("inventory_transactions");

      toast.success(`Batch ${batchNo} updated successfully.`);
      setShowEditBatchModal(false);
      setEditingBatch(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to update batch.");
    } finally {
      setSaving(false);
    }
  };

  // EXPORT CSV HANDLER
  const handleExportCSV = () => {
    const headers = [
      "Item ID",
      "Item Name",
      "Category",
      "Total Quantity",
      "Unit",
      "Reorder Level",
      "Earliest Expiration Date",
      "Status",
      "Active Batches Count",
      "Description",
    ];
    const rows = filteredItems.map((item) => {
      const summary = itemSummaries[item.id] || getItemSummary(item, txns);
      return [
        item.item_code || item.id?.slice(0, 8) || "—",
        `"${(item.name || "").replace(/"/g, '""')}"`,
        getCategoryLabel(item.category),
        summary.totalQty,
        item.unit || "unit",
        item.reorder_level ?? 5,
        summary.earliestExpiration ? formatDate(summary.earliestExpiration) : "N/A",
        summary.status,
        summary.activeBatches.length,
        `"${(item.description || "").replace(/"/g, '""')}"`,
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `inventory_report_${todayPH()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Inventory report exported to CSV.");
  };

  // PRINT REPORT HANDLER
  const handlePrintReport = () => {
    const list = filteredItems;
    const w = window.open("", "_blank");
    if (!w) return;

    w.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Inventory Report — Harbourside Veterinary Clinic</title>
        <style>
          body { font-family: system-ui, -apple-system, sans-serif; padding: 24px; color: #0f172a; }
          h1 { font-size: 20px; font-weight: 700; margin-bottom: 4px; }
          p { font-size: 12px; color: #64748b; margin-top: 0; }
          .metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 16px 0; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; background: #f8fafc; }
          .metric { font-size: 11px; color: #64748b; }
          .metric-val { font-size: 18px; font-weight: 700; color: #0f172a; margin-top: 2px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: left; }
          th { background: #f1f5f9; font-weight: 600; color: #334155; }
          .status { font-weight: 600; font-size: 11px; }
        </style>
      </head>
      <body>
        <h1>Harbourside Veterinary Clinic — Inventory Report</h1>
        <p>Generated on ${formatNowPH()}</p>
        <div class="metrics">
          <div class="metric">Total Items<div class="metric-val">${metrics.total}</div></div>
          <div class="metric">Medicines<div class="metric-val">${metrics.medicines}</div></div>
          <div class="metric">Vaccines<div class="metric-val">${metrics.vaccines}</div></div>
          <div class="metric">Dewormers<div class="metric-val">${metrics.dewormers}</div></div>
          <div class="metric">Medical Supplies<div class="metric-val">${metrics.supplies}</div></div>
          <div class="metric">Low Stock<div class="metric-val">${metrics.lowStock}</div></div>
          <div class="metric">Out of Stock<div class="metric-val">${metrics.outOfStock}</div></div>
          <div class="metric">Expiring Soon<div class="metric-val">${metrics.expiringSoon}</div></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Item ID</th>
              <th>Item Name</th>
              <th>Category</th>
              <th>Total Quantity</th>
              <th>Reorder Level</th>
              <th>Earliest Expiration</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${list
              .map((i) => {
                const s = itemSummaries[i.id] || getItemSummary(i, txns);
                return `
              <tr>
                <td>${i.item_code || i.id?.slice(0, 8) || "—"}</td>
                <td><strong>${i.name}</strong>${i.description ? `<br><span style="color:#64748b;font-size:11px;">${i.description}</span>` : ""}</td>
                <td>${getCategoryLabel(i.category)}</td>
                <td>${s.totalQty} ${i.unit || "unit"}</td>
                <td>${i.reorder_level ?? 5}</td>
                <td>${s.earliestExpiration ? formatDate(s.earliestExpiration) : "N/A"}</td>
                <td><span class="status">${s.status}</span></td>
              </tr>
            `;
              })
              .join("")}
          </tbody>
        </table>
      </body>
      </html>
    `);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-6 animate-fade-in pb-8">
      {/* TOP HEADER & TOOLBAR */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Package className="h-6 w-6 text-primary" /> Inventory
          </h1>
          <p className="text-muted-foreground text-sm">
            Clinic stock management for medicines, vaccines, dewormers, and medical supplies with batch tracking.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="h-4 w-4 mr-1.5" /> Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrintReport}>
            <Printer className="h-4 w-4 mr-1.5" /> Print Report
          </Button>
          {canManageItems && (
            <Button size="sm" onClick={openAddItem} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
              <Plus className="h-4 w-4 mr-1.5" /> Add Item
            </Button>
          )}
        </div>
      </div>

      {/* DASHBOARD SUMMARY CARDS (8 Cards) */}
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-8">
        <Card className="shadow-xs border bg-card">
          <CardContent className="p-3">
            <p className="text-xs font-medium text-muted-foreground">Total Items</p>
            <p className="text-xl font-bold mt-1 text-foreground">{metrics.total}</p>
          </CardContent>
        </Card>
        <Card className="shadow-xs border bg-card">
          <CardContent className="p-3">
            <p className="text-xs font-medium text-muted-foreground">Medicines</p>
            <p className="text-xl font-bold mt-1 text-foreground">{metrics.medicines}</p>
          </CardContent>
        </Card>
        <Card className="shadow-xs border bg-card">
          <CardContent className="p-3">
            <p className="text-xs font-medium text-muted-foreground">Vaccines</p>
            <p className="text-xl font-bold mt-1 text-foreground">{metrics.vaccines}</p>
          </CardContent>
        </Card>
        <Card className="shadow-xs border bg-card">
          <CardContent className="p-3">
            <p className="text-xs font-medium text-muted-foreground">Dewormers</p>
            <p className="text-xl font-bold mt-1 text-foreground">{metrics.dewormers}</p>
          </CardContent>
        </Card>
        <Card className="shadow-xs border bg-card">
          <CardContent className="p-3">
            <p className="text-xs font-medium text-muted-foreground">Medical Supplies</p>
            <p className="text-xl font-bold mt-1 text-foreground">{metrics.supplies}</p>
          </CardContent>
        </Card>
        <Card className="shadow-xs border border-amber-500/20 bg-amber-500/5">
          <CardContent className="p-3">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Low Stock</p>
            <p className="text-xl font-bold mt-1 text-amber-700 dark:text-amber-400">{metrics.lowStock}</p>
          </CardContent>
        </Card>
        <Card className="shadow-xs border border-rose-500/20 bg-rose-500/5">
          <CardContent className="p-3">
            <p className="text-xs font-medium text-rose-700 dark:text-rose-400">Out of Stock</p>
            <p className="text-xl font-bold mt-1 text-rose-700 dark:text-rose-400">{metrics.outOfStock}</p>
          </CardContent>
        </Card>
        <Card className="shadow-xs border border-orange-500/20 bg-orange-500/5">
          <CardContent className="p-3">
            <p className="text-xs font-medium text-orange-700 dark:text-orange-400">Expiring Soon</p>
            <p className="text-xl font-bold mt-1 text-orange-700 dark:text-orange-400">{metrics.expiringSoon}</p>
          </CardContent>
        </Card>
      </div>

      {/* ALERT BANNER IF STOCK OR EXPIRATION ALERTS EXIST */}
      {alertItems.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/10 shadow-xs">
          <CardContent className="flex items-start gap-3 p-3.5">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1 text-xs">
              <span className="font-semibold text-amber-900 dark:text-amber-200">
                Inventory Alerts Attention Required ({alertItems.length} item{alertItems.length === 1 ? "" : "s"}):
              </span>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-amber-800 dark:text-amber-300">
                {alertItems.slice(0, 5).map((item) => {
                  const summary = itemSummaries[item.id] || getItemSummary(item, txns);
                  return (
                    <span key={item.id} className="inline-flex items-center gap-1">
                      <strong>{item.name}</strong> ({summary.status} — Total: {summary.totalQty} {item.unit || "unit"})
                    </span>
                  );
                })}
                {alertItems.length > 5 && <span>and {alertItems.length - 5} more items...</span>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MAIN TABS (Items & Transactions) */}
      <Tabs defaultValue="items" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 max-w-xs">
          <TabsTrigger value="items" className="flex items-center gap-1.5">
            <Layers className="h-4 w-4" /> Inventory Items
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-1.5">
            <History className="h-4 w-4" /> Transactions
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: ITEM TABLE */}
        <TabsContent value="items">
          <Card className="border shadow-xs">
            <CardContent className="space-y-4 p-4">
              {/* SEARCH & FILTERS */}
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs font-medium">Search Items</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by name, description, or Item ID..."
                    />
                  </div>
                </div>
                <div className="w-full md:w-48 space-y-1.5">
                  <Label className="text-xs font-medium">Category Filter</Label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {CATEGORIES.map((cat) => (
                        <SelectItem key={cat.value} value={cat.value}>
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full md:w-48 space-y-1.5">
                  <Label className="text-xs font-medium">Status Filter</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      {STATUS_OPTIONS.map((st) => (
                        <SelectItem key={st} value={st}>
                          {st}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* ITEM TABLE (ONE ROW PER ITEM) */}
              {isLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/50">
                        <TableRow>
                          <TableHead className="w-[110px]">Item ID</TableHead>
                          <TableHead>Item Name</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead className="w-[80px]">Unit</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Total Qty</TableHead>
                          <TableHead className="text-right">Reorder Level</TableHead>
                          <TableHead>Earliest Expiry</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right whitespace-nowrap">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pagedItems.map((item) => {
                          const summary = itemSummaries[item.id] || getItemSummary(item, txns);
                          const itemCode = item.item_code || `#INV-${item.id?.slice(0, 6)}`;
                          return (
                            <TableRow key={item.id} className="hover:bg-muted/30">
                              <TableCell className="font-mono text-xs font-medium text-muted-foreground">
                                {itemCode}
                              </TableCell>
                              <TableCell>
                                <div className="font-medium text-foreground">{item.name}</div>
                                {item.description && (
                                  <div className="text-xs text-muted-foreground line-clamp-1">{item.description}</div>
                                )}
                                <div className="text-[11px] text-muted-foreground/80 mt-0.5">
                                  {summary.activeBatches.length} active batch{summary.activeBatches.length === 1 ? "" : "es"}
                                </div>
                              </TableCell>
                              <TableCell className="text-xs">
                                <Badge variant="outline" className="font-normal bg-background">
                                  {getCategoryLabel(item.category)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">{item.unit || "unit"}</TableCell>
                              <TableCell className="text-right font-mono text-xs font-semibold text-foreground">
                                ₱{Number(item.unit_price ?? item.purchase_price ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </TableCell>
                              <TableCell className="text-right font-bold text-sm text-foreground">{summary.totalQty}</TableCell>
                              <TableCell className="text-right text-xs text-muted-foreground">{item.reorder_level ?? 5}</TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {summary.earliestExpiration ? formatDate(summary.earliestExpiration) : "—"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={getStatusBadgeStyle(summary.status)}>
                                  {summary.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right whitespace-nowrap">
                                <div className="flex items-center justify-end gap-1">
                                  {/* VIEW DETAILS */}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => {
                                      setViewingItem(item);
                                      setShowViewModal(true);
                                    }}
                                    title="View details & batches"
                                  >
                                    <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                  </Button>

                                  {/* STOCK IN */}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                    onClick={() => openStockInModal(item)}
                                    title="Stock In"
                                  >
                                    <ArrowDownToLine className="h-4 w-4" />
                                  </Button>

                                  {/* STOCK OUT */}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                    onClick={() => openStockOutModal(item)}
                                    title="Stock Out"
                                  >
                                    <ArrowUpFromLine className="h-4 w-4" />
                                  </Button>

                                  {/* EDIT ITEM (Admin Only) */}
                                  {canManageItems && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => openEditItem(item)}
                                      title="Edit item metadata"
                                    >
                                      <Pencil className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                    </Button>
                                  )}

                                  {/* DELETE ITEM (Admin Only) */}
                                  {canManageItems && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => setDeleteTarget(item)}
                                      title="Delete item"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                        {pagedItems.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                              No inventory items found matching your filters.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* PAGINATION */}
                  <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
                    <p>
                      Showing {pagedItems.length} of {filteredItems.length} items
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page * pageSize >= filteredItems.length}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: TRANSACTION HISTORY */}
        <TabsContent value="history">
          <Card className="border shadow-xs">
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex-1 space-y-1.5">
                  <Label className="text-xs font-medium">Search Transactions</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      className="pl-9"
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      placeholder="Search by item, batch number, staff name, or remarks..."
                    />
                  </div>
                </div>
                <div className="w-full md:w-56 space-y-1.5">
                  <Label className="text-xs font-medium">Transaction Type</Label>
                  <Select value={historyTypeFilter} onValueChange={setHistoryTypeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Movement Types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Movement Types</SelectItem>
                      <SelectItem value="in">Stock In</SelectItem>
                      <SelectItem value="out">Manual Stock Out</SelectItem>
                      <SelectItem value="auto">Automatic Care History Deduction</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-md border overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead>Transaction Date</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Batch Number</TableHead>
                      <TableHead>Transaction Type</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total Amount</TableHead>
                      <TableHead className="text-right">Remaining Stock</TableHead>
                      <TableHead>Expiration Date</TableHead>
                      <TableHead>Performed By</TableHead>
                      <TableHead>Reason & Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((txn) => {
                      const item = items.find((i) => i.id === txn.item_id);
                      const isAuto = (txn.reason ?? "").toLowerCase().includes("care history");
                      const remaining = remainingStockMap[txn.id] ?? "—";
                      const dateDisplay = txn.date ? formatDate(txn.date) : formatDate(txn.created_at);
                      const batchDisplay = txn.batch_no || (isAuto ? "FEFO (Auto)" : "DEFAULT-LOT");
                      const expDisplay = txn.expiration_date ? formatDate(txn.expiration_date) : "—";

                      return (
                        <TableRow key={txn.id} className="hover:bg-muted/30">
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{dateDisplay}</TableCell>
                          <TableCell>
                            <div className="font-medium text-foreground">{item?.name ?? "Unknown Item"}</div>
                            <div className="text-xs text-muted-foreground font-mono">{item?.item_code || "—"}</div>
                          </TableCell>
                          <TableCell className="font-mono text-xs font-semibold">{batchDisplay}</TableCell>
                          <TableCell>
                            {isAuto ? (
                              <Badge variant="outline" className="bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30">
                                Automatic Care History Deduction
                              </Badge>
                            ) : txn.type === "in" ? (
                              <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                                Stock In
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30">
                                Manual Stock Out
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell
                            className={`text-right font-semibold ${
                              txn.type === "in"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {txn.type === "in" ? `+${txn.quantity}` : `-${txn.quantity}`} {item?.unit || "unit"}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-medium">
                            ₱{Number(txn.unit_price ?? txn.unit_cost ?? item?.unit_price ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-bold text-foreground">
                            ₱{Number(txn.total_amount ?? (txn.quantity * (txn.unit_price ?? txn.unit_cost ?? item?.unit_price ?? 0))).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs font-semibold">{remaining}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{expDisplay}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{txn.staff_name || txn.recorded_by || "Staff"}</TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                            {txn.reason ?? "—"} {txn.notes ? `(${txn.notes})` : ""}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredTransactions.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="py-12 text-center text-muted-foreground">
                          No stock movement history recorded.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* DIALOG 1: ADD ITEM (ADMIN ONLY) */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">Add Inventory Item</DialogTitle>
            <DialogDescription className="text-xs">
              Add a new medicine, vaccine, dewormer, or medical supply item to clinic inventory.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">
                Item Name <span className="text-destructive">*</span>
              </Label>
              <Input
                value={addForm.name}
                onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                placeholder="e.g. Amoxicillin 250mg Tablets, Rabies Vaccine..."
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input
                value={addForm.description}
                onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                placeholder="Brief description or usage instructions..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={addForm.category} onValueChange={(v) => setAddForm({ ...addForm, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unit</Label>
                <Input
                  value={addForm.unit}
                  onChange={(e) => setAddForm({ ...addForm, unit: e.target.value })}
                  placeholder="vial, tablet, box, bottle, piece..."
                />
              </div>
            </div>
            {addForm.category === "other" && (
              <div className="space-y-1">
                <Label className="text-xs">
                  Specify Category <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={addForm.custom_category}
                  onChange={(e) => setAddForm({ ...addForm, custom_category: e.target.value })}
                  placeholder="e.g. Surgical Equipment, Grooming, Food..."
                />
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Initial Quantity</Label>
                <Input
                  type="number"
                  min={0}
                  value={addForm.quantity}
                  onChange={(e) => setAddForm({ ...addForm, quantity: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unit Price (₱)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={addForm.unit_price}
                  onChange={(e) => setAddForm({ ...addForm, unit_price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reorder Level</Label>
                <Input
                  type="number"
                  min={0}
                  value={addForm.reorder_level}
                  onChange={(e) => setAddForm({ ...addForm, reorder_level: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Initial Batch Number</Label>
                <Input
                  value={addForm.batch_no}
                  onChange={(e) => setAddForm({ ...addForm, batch_no: e.target.value })}
                  placeholder="e.g. LOT-001"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Expiration Date</Label>
                <Input
                  type="date"
                  value={addForm.expiration_date}
                  onChange={(e) => setAddForm({ ...addForm, expiration_date: e.target.value })}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveAddItem} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: EDIT ITEM METADATA (ADMIN ONLY - QUANTITY READ-ONLY) */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg">Edit Inventory Item</DialogTitle>
            <DialogDescription className="text-xs">
              Update item metadata and reorder level. Quantity changes are managed via Stock In / Out.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Item Name</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description</Label>
              <Input
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Category</Label>
                <Select value={editForm.category} onValueChange={(v) => setEditForm({ ...editForm, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unit</Label>
                <Input
                  value={editForm.unit}
                  onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                />
              </div>
            </div>
            {editForm.category === "other" && (
              <div className="space-y-1">
                <Label className="text-xs">
                  Specify Category <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={editForm.custom_category}
                  onChange={(e) => setEditForm({ ...editForm, custom_category: e.target.value })}
                  placeholder="Specify custom category..."
                />
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Total Quantity (Read-only)</Label>
                <Input
                  type="number"
                  disabled
                  value={editForm.quantity}
                  className="bg-muted text-muted-foreground cursor-not-allowed font-bold"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Unit Price (₱)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={editForm.unit_price}
                  onChange={(e) => setEditForm({ ...editForm, unit_price: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Reorder Level</Label>
                <Input
                  type="number"
                  min={0}
                  value={editForm.reorder_level}
                  onChange={(e) => setEditForm({ ...editForm, reorder_level: e.target.value })}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground italic border-t pt-2">
              Note: Current Total Quantity is automatically calculated from active batches. Use Stock In / Out to update quantities.
            </p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveEditItem} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: VIEW ITEM DETAILS & BATCHES BREAKDOWN */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg flex items-center justify-between">
              <span>Item Details: {viewingItem?.name}</span>
              {viewingItem && (
                <Badge
                  variant="outline"
                  className={getStatusBadgeStyle((itemSummaries[viewingItem.id] || getItemSummary(viewingItem, txns)).status)}
                >
                  {(itemSummaries[viewingItem.id] || getItemSummary(viewingItem, txns)).status}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Item ID: <span className="font-mono">{viewingItem?.item_code || viewingItem?.id}</span>
            </DialogDescription>
          </DialogHeader>

          {viewingItem && (() => {
            const summary = itemSummaries[viewingItem.id] || getItemSummary(viewingItem, dbBatches, txns);
            return (
              <div className="space-y-4 py-2">
                {/* METADATA GRID */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 bg-muted/40 p-3 rounded-lg border text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Category</span>
                    <span className="font-medium text-foreground">{getCategoryLabel(viewingItem.category)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Unit Price</span>
                    <span className="font-bold text-foreground text-sm font-mono">
                      ₱{Number(viewingItem.unit_price ?? viewingItem.purchase_price ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Total Quantity</span>
                    <span className="font-bold text-foreground text-sm">
                      {summary.totalQty} {viewingItem.unit || "unit"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Reorder Level</span>
                    <span className="font-medium text-foreground">{viewingItem.reorder_level ?? 5}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Earliest Expiration</span>
                    <span className="font-medium text-foreground">
                      {summary.earliestExpiration ? formatDate(summary.earliestExpiration) : "N/A"}
                    </span>
                  </div>
                  {viewingItem.description && (
                    <div className="col-span-2 sm:col-span-4 border-t pt-2 mt-1">
                      <span className="text-muted-foreground block text-[11px]">Description</span>
                      <span className="text-foreground">{viewingItem.description}</span>
                    </div>
                  )}
                </div>

                {/* BATCHES BREAKDOWN SECTION */}
                <div>
                  <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                    <Box className="h-3.5 w-3.5 text-primary" /> Active & Historical Inventory Batches ({summary.batches.length})
                  </h4>
                  <div className="rounded-md border overflow-hidden max-h-48 overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-muted/60">
                        <TableRow className="text-xs">
                          <TableHead>Batch / Lot Number</TableHead>
                          <TableHead className="text-right">Initial Qty</TableHead>
                          <TableHead className="text-right">Remaining Qty</TableHead>
                          <TableHead className="text-right">Consumed Qty</TableHead>
                          <TableHead>Expiration Date</TableHead>
                          <TableHead>Date Received</TableHead>
                          <TableHead>Status</TableHead>
                          {canManageItems && <TableHead className="text-right">Action</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        {summary.batches.map((batch, idx) => (
                          <TableRow key={`${batch.batch_no}-${idx}`} className="hover:bg-muted/30">
                            <TableCell className="font-mono font-semibold">{batch.batch_no}</TableCell>
                            <TableCell className="text-right text-muted-foreground">{batch.initial_quantity} {viewingItem.unit || "unit"}</TableCell>
                            <TableCell className="text-right font-bold text-foreground">
                              {batch.remaining_quantity} {viewingItem.unit || "unit"}
                            </TableCell>
                            <TableCell className="text-right text-amber-700 dark:text-amber-400 font-medium">
                              {batch.consumed_quantity} {viewingItem.unit || "unit"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {batch.expiration_date ? formatDate(batch.expiration_date) : "N/A"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">{formatDate(batch.date_received)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={getStatusBadgeStyle(batch.status)}>
                                {batch.status}
                              </Badge>
                            </TableCell>
                             {canManageItems && (
                              <TableCell className="text-right whitespace-nowrap">
                                {batch.id ? (
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10"
                                      onClick={() => openEditBatchModal(batch)}
                                      title="Edit batch quantity & expiration"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={async () => {
                                        setSaving(true);
                                        try {
                                          const { error } = await db.from("inventory_batches").delete().eq("id", batch.id);
                                          if (error) {
                                            toast.error(error.message);
                                          } else {
                                            toast.success(`Deleted batch ${batch.batch_no}.`);
                                            invalidate("inventory_batches");
                                            invalidate("inventory_items");
                                          }
                                        } catch (err: any) {
                                          toast.error(err.message || "Failed to delete batch.");
                                        } finally {
                                          setSaving(false);
                                        }
                                      }}
                                      title="Delete batch"
                                    >
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ) : (
                                  "—"
                                )}
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                        {summary.batches.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={8} className="py-6 text-center text-muted-foreground">
                              No inventory batches found.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {/* RECENT MOVEMENTS FOR THIS SPECIFIC ITEM */}
                <div>
                  <h4 className="text-xs font-semibold mb-2 flex items-center gap-1">
                    <History className="h-3.5 w-3.5 text-muted-foreground" /> Movement History ({viewingItem.name})
                  </h4>
                  <div className="rounded-md border overflow-hidden max-h-40 overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-muted/60">
                        <TableRow className="text-xs">
                          <TableHead>Date</TableHead>
                          <TableHead>Batch Number</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead>Performed By</TableHead>
                          <TableHead>Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody className="text-xs">
                        {txns
                          .filter((t) => t.item_id === viewingItem.id)
                          .map((txn) => {
                            const isAuto = (txn.reason ?? "").toLowerCase().includes("care history");
                            return (
                              <TableRow key={txn.id}>
                                <TableCell className="text-muted-foreground">
                                  {txn.date ? formatDate(txn.date) : formatDate(txn.created_at)}
                                </TableCell>
                                <TableCell className="font-mono text-xs">{txn.batch_no || (isAuto ? "FEFO" : "—")}</TableCell>
                                <TableCell>
                                  {isAuto ? (
                                    <span className="text-sky-600 font-medium">Auto Deduction</span>
                                  ) : txn.type === "in" ? (
                                    <span className="text-emerald-600 font-medium">Stock In</span>
                                  ) : (
                                    <span className="text-amber-600 font-medium">Stock Out</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-medium">
                                  {txn.type === "in" ? `+${txn.quantity}` : `-${txn.quantity}`}
                                </TableCell>
                                <TableCell className="text-muted-foreground">{txn.staff_name || txn.recorded_by || "Staff"}</TableCell>
                                <TableCell className="text-muted-foreground">{txn.reason || "—"}</TableCell>
                              </TableRow>
                            );
                          })}
                        {txns.filter((t) => t.item_id === viewingItem.id).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                              No movement history recorded for this item.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            );
          })()}

          <DialogFooter className="flex flex-col sm:flex-row gap-2 justify-between">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-emerald-600 hover:text-emerald-700"
                onClick={() => {
                  setShowViewModal(false);
                  openStockInModal(viewingItem);
                }}
              >
                <ArrowDownToLine className="h-4 w-4 mr-1" /> Stock In
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-rose-600 hover:text-rose-700"
                onClick={() => {
                  setShowViewModal(false);
                  openStockOutModal(viewingItem);
                }}
              >
                <ArrowUpFromLine className="h-4 w-4 mr-1" /> Stock Out
              </Button>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowViewModal(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 4: STOCK IN MODAL */}
      <Dialog open={showStockInModal} onOpenChange={setShowStockInModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg flex items-center gap-2">
              <ArrowDownToLine className="h-5 w-5 text-emerald-600" /> Stock In
            </DialogTitle>
            <DialogDescription className="text-xs">
              Add new stock or receive a batch for <strong>{targetItem?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          {targetItem && (() => {
            const summary = itemSummaries[targetItem.id] || getItemSummary(targetItem, txns);
            return (
              <div className="space-y-3 py-2">
                {/* READ-ONLY ITEM SUMMARY */}
                <div className="grid grid-cols-2 gap-3 bg-muted/40 p-2.5 rounded-md border text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Item Name</span>
                    <span className="font-semibold text-foreground">{targetItem.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Current Total Quantity</span>
                    <span className="font-bold text-foreground">
                      {summary.totalQty} {targetItem.unit || "unit"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Quantity Added <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="number"
                      min={1}
                      value={stockInForm.quantity}
                      onChange={(e) => setStockInForm({ ...stockInForm, quantity: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Unit Price (₱) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={stockInForm.unit_price}
                      onChange={(e) => setStockInForm({ ...stockInForm, unit_price: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {/* AUTOMATIC CALCULATED TOTAL AMOUNT DISPLAY FOR STOCK IN */}
                {(() => {
                  const qtyVal = Math.max(0, parseInt(stockInForm.quantity || "0", 10) || 0);
                  const priceVal = Math.max(0, parseFloat(stockInForm.unit_price || "0") || 0);
                  const calcTotal = Number((qtyVal * priceVal).toFixed(2));
                  return (
                    <div className="bg-emerald-500/10 p-2.5 rounded-md border border-emerald-500/20 text-xs flex justify-between items-center">
                      <span className="text-muted-foreground font-medium">Calculated Total Amount</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 text-sm font-mono">
                        ₱{calcTotal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  );
                })()}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Batch / Lot Number <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={stockInForm.batch_no}
                      onChange={(e) => setStockInForm({ ...stockInForm, batch_no: e.target.value })}
                      placeholder="e.g. LOT-001"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">
                      Expiration Date <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      type="date"
                      value={stockInForm.expiration_date}
                      onChange={(e) => setStockInForm({ ...stockInForm, expiration_date: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">
                    Reason <span className="text-destructive">*</span>
                  </Label>
                  <Select value={stockInForm.reason} onValueChange={(v) => setStockInForm({ ...stockInForm, reason: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {STOCK_IN_REASONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Notes (Optional)</Label>
                  <Input
                    value={stockInForm.notes}
                    onChange={(e) => setStockInForm({ ...stockInForm, notes: e.target.value })}
                    placeholder="PO number, supplier note, or comments..."
                  />
                </div>
              </div>
            );
          })()}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setShowStockInModal(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveStockIn}
              disabled={saving}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record Stock In"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 5: STOCK OUT MODAL (WITH BATCH DROPDOWN SELECTION) */}
      <Dialog open={showStockOutModal} onOpenChange={setShowStockOutModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg flex items-center gap-2">
              <ArrowUpFromLine className="h-5 w-5 text-rose-600" /> Stock Out
            </DialogTitle>
            <DialogDescription className="text-xs">
              Remove stock from a specific batch for <strong>{targetItem?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          {targetItem && (() => {
            const summary = itemSummaries[targetItem.id] || getItemSummary(targetItem, txns);
            const activeBatches = summary.activeBatches;
            const selectedBatch = activeBatches.find(
              (b) => `${b.batch_no.toUpperCase()}___${b.expiration_date || "NO_EXP"}` === stockOutForm.batch_key
            );

            return (
              <div className="space-y-3 py-2">
                {/* READ-ONLY ITEM SUMMARY */}
                <div className="grid grid-cols-2 gap-3 bg-muted/40 p-2.5 rounded-md border text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Item Name</span>
                    <span className="font-semibold text-foreground">{targetItem.name}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Current Total Quantity</span>
                    <span className="font-bold text-foreground">
                      {summary.totalQty} {targetItem.unit || "unit"}
                    </span>
                  </div>
                </div>

                {/* BATCH DROPDOWN */}
                <div className="space-y-1">
                  <Label className="text-xs">
                    Select Batch <span className="text-destructive">*</span>
                  </Label>
                  {activeBatches.length > 0 ? (
                    <Select
                      value={stockOutForm.batch_key}
                      onValueChange={(v) => setStockOutForm({ ...stockOutForm, batch_key: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select available batch" />
                      </SelectTrigger>
                      <SelectContent>
                        {activeBatches.map((b, idx) => {
                          const key = `${b.batch_no.toUpperCase()}___${b.expiration_date || "NO_EXP"}`;
                          const expLabel = b.expiration_date ? formatDate(b.expiration_date) : "No Expiration";
                          return (
                            <SelectItem key={`${key}-${idx}`} value={key}>
                              Batch {b.batch_no} — Exp {expLabel} ({b.remaining_quantity} {targetItem.unit || "unit"})
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="text-xs text-destructive p-2 bg-destructive/10 rounded border border-destructive/20">
                      No available stock batches found for this item.
                    </div>
                  )}
                </div>

                {/* SELECTED BATCH INFO DISPLAY */}
                {selectedBatch && (
                  <div className="grid grid-cols-2 gap-3 bg-emerald-500/10 p-2.5 rounded-md border border-emerald-500/20 text-xs">
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Available Qty in Batch</span>
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        {selectedBatch.remaining_quantity} {targetItem.unit || "unit"}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block text-[11px]">Batch Expiration Date</span>
                      <span className="font-medium text-foreground">
                        {selectedBatch.expiration_date ? formatDate(selectedBatch.expiration_date) : "N/A"}
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <Label className="text-xs">
                    Quantity Removed <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={selectedBatch?.remaining_quantity ?? 1}
                    value={stockOutForm.quantity}
                    onChange={(e) => setStockOutForm({ ...stockOutForm, quantity: e.target.value })}
                  />
                </div>

                {/* AUTOMATIC CALCULATED TOTAL AMOUNT DISPLAY FOR STOCK OUT */}
                {(() => {
                  const qtyVal = Math.max(0, parseInt(stockOutForm.quantity || "0", 10) || 0);
                  const priceVal = Math.max(0, Number(targetItem?.unit_price ?? targetItem?.purchase_price ?? 0));
                  const calcTotal = Number((qtyVal * priceVal).toFixed(2));
                  return (
                    <div className="grid grid-cols-2 gap-3 bg-amber-500/10 p-2.5 rounded-md border border-amber-500/20 text-xs">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Unit Price</span>
                        <span className="font-semibold text-foreground font-mono">
                          ₱{priceVal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">Calculated Total Amount</span>
                        <span className="font-bold text-amber-700 dark:text-amber-400 font-mono">
                          ₱{calcTotal.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                <div className="space-y-1">
                  <Label className="text-xs">
                    Reason <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={stockOutForm.reason}
                    onValueChange={(v) => setStockOutForm({ ...stockOutForm, reason: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {STOCK_OUT_REASONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Notes (Optional)</Label>
                  <Input
                    value={stockOutForm.notes}
                    onChange={(e) => setStockOutForm({ ...stockOutForm, notes: e.target.value })}
                    placeholder="Patient record reference, damage note, or comments..."
                  />
                </div>
              </div>
            );
          })()}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setShowStockOutModal(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveStockOut}
              disabled={saving}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record Stock Out"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 7: EDIT BATCH MODAL (ADMIN ONLY) */}
      <Dialog open={showEditBatchModal} onOpenChange={setShowEditBatchModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg flex items-center gap-2">
              <Pencil className="h-5 w-5 text-primary" /> Edit Batch & Quantity Adjustment
            </DialogTitle>
            <DialogDescription className="text-xs">
              Correct batch number, expiration date, or stock quantities for <strong>{viewingItem?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          {editingBatch && (
            <div className="space-y-3 py-2 text-xs">
              <div className="grid grid-cols-2 gap-3 bg-muted/40 p-2.5 rounded-md border">
                <div>
                  <span className="text-muted-foreground block text-[11px]">Item Name</span>
                  <span className="font-semibold text-foreground">{viewingItem?.name}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[11px]">Unit</span>
                  <span className="font-medium text-foreground">{viewingItem?.unit || "unit"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">
                    Batch / Lot Number <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    value={editBatchForm.batch_no}
                    onChange={(e) => setEditBatchForm({ ...editBatchForm, batch_no: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Expiration Date</Label>
                  <Input
                    type="date"
                    value={editBatchForm.expiration_date}
                    onChange={(e) => setEditBatchForm({ ...editBatchForm, expiration_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">
                    Initial Shipment Quantity <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={editBatchForm.initial_quantity}
                    onChange={(e) => setEditBatchForm({ ...editBatchForm, initial_quantity: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    Current Remaining Quantity <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    value={editBatchForm.remaining_quantity}
                    onChange={(e) => setEditBatchForm({ ...editBatchForm, remaining_quantity: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Reason for Adjustment</Label>
                <Select
                  value={editBatchForm.reason}
                  onValueChange={(v) => setEditBatchForm({ ...editBatchForm, reason: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select reason" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Data Entry Correction">Data Entry Correction</SelectItem>
                    <SelectItem value="Physical Inventory Count Adjustment">Physical Inventory Count Adjustment</SelectItem>
                    <SelectItem value="Damaged / Expired Adjustment">Damaged / Expired Adjustment</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Adjustment Notes (Optional)</Label>
                <Input
                  value={editBatchForm.notes}
                  onChange={(e) => setEditBatchForm({ ...editBatchForm, notes: e.target.value })}
                  placeholder="Reason for data entry correction or audit comment..."
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setShowEditBatchModal(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveEditBatch}
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Batch Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 6: CONFIRM DELETE ITEM (ADMIN ONLY) */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-lg text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Delete Inventory Item
            </DialogTitle>
            <DialogDescription className="text-xs pt-1">
              Are you sure you want to delete <strong>"{deleteTarget?.name}"</strong>? This action will permanently remove the item and its batches.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDeleteItem} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete Item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
