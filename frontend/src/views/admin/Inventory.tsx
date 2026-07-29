"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Printer, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Loader2, Trash2 } from "lucide-react";
import { db } from "@/lib/db-client";
import { useRows, useInvalidate } from "@/hooks/useRows";
import { formatDate } from "@/lib/age";
import { todayPH, isBeforeTodayPH, formatNowPH } from "@/lib/datetime";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { canManageInventoryItems } from "@/lib/roles";

const CATEGORIES = [
  { value: "vaccine", label: "Vaccine" },
  { value: "medication", label: "Medicine" },
  { value: "dewormer", label: "Dewormer" },
  { value: "supply", label: "Medical Supply" },
] as const;

const STATUS_ORDER = ["In Stock", "Low Stock", "Out of Stock", "Expiring Soon", "Expired"] as const;

function formatCurrency(value: string | number | null | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isNaN(numeric) ? "—" : `₱${numeric.toFixed(2)}`;
}

function getItemStatus(item: any) {
  const quantity = Number(item?.quantity ?? 0);
  const reorderLevel = Number(item?.reorder_level ?? 5);
  const expiration = item?.expiration_date;
  if (expiration && isBeforeTodayPH(expiration)) return "Expired";
  if (expiration && new Date(expiration).getTime() - Date.now() <= 30 * 24 * 60 * 60 * 1000) return "Expiring Soon";
  if (quantity <= 0) return "Out of Stock";
  if (quantity <= reorderLevel) return "Low Stock";
  return "In Stock";
}

function getStatusBadge(status: string) {
  switch (status) {
    case "Out of Stock":
      return "destructive";
    case "Low Stock":
      return "secondary";
    case "Expiring Soon":
      return "outline";
    case "Expired":
      return "destructive";
    default:
      return "default";
  }
}

type ItemForm = {
  name: string;
  description: string;
  category: string;
  unit: string;
  quantity: string;
  reorder_level: string;
  expiration_date: string;
};

const emptyItem: ItemForm = {
  name: "",
  description: "",
  category: "vaccine",
  unit: "vial",
  quantity: "0",
  reorder_level: "5",
  expiration_date: "",
};

type BatchForm = {
  item_id: string;
  type: "in" | "out";
  quantity: string;
  transaction_no: string;
  expiration_date: string;
  reason: string;
  unit_cost: string;
  notes: string;
};

const emptyBatch: BatchForm = {
  item_id: "",
  type: "in",
  quantity: "",
  transaction_no: "",
  expiration_date: "",
  reason: "",
  unit_cost: "",
  notes: "",
};

export default function Inventory() {
  const { role, user } = useAuth();
  const canManageItems = canManageInventoryItems(role);
  const { data: items = [], isLoading } = useRows<any>("inventory_items", { orderBy: "name" });
  const { data: txns = [] } = useRows<any>("inventory_transactions", { orderBy: "date", ascending: false });
  const invalidate = useInvalidate();

  const [showItem, setShowItem] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItem);
  const [saving, setSaving] = useState(false);

  const [showBatch, setShowBatch] = useState(false);
  const [batch, setBatch] = useState<BatchForm>(emptyBatch);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const pageSize = 8;

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, statusFilter]);

  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? "—";
  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const name = `${item.name ?? ""} ${item.description ?? ""}`.toLowerCase();
      const matchesQuery = !query || name.includes(query);
      const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
      const status = getItemStatus(item);
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      return matchesQuery && matchesCategory && matchesStatus;
    });
  }, [items, search, categoryFilter, statusFilter]);

  const pagedItems = useMemo(() => {
    const offset = (page - 1) * pageSize;
    return filteredItems.slice(offset, offset + pageSize);
  }, [filteredItems, page]);

  const metrics = useMemo(() => {
    const medicineItems = items.filter((item) => item.category === "medication");
    const vaccineItems = items.filter((item) => item.category === "vaccine");
    const dewormerItems = items.filter((item) => item.category === "dewormer");
    const supplyItems = items.filter((item) => item.category === "supply");
    const lowStockItems = items.filter((item) => getItemStatus(item) === "Low Stock");
    const outOfStockItems = items.filter((item) => getItemStatus(item) === "Out of Stock");
    const expiringItems = items.filter((item) => getItemStatus(item) === "Expiring Soon" || getItemStatus(item) === "Expired");

    return {
      total: items.length,
      medicines: medicineItems.length,
      vaccines: vaccineItems.length,
      dewormers: dewormerItems.length,
      supplies: supplyItems.length,
      lowStock: lowStockItems.length,
      outOfStock: outOfStockItems.length,
      expiringSoon: expiringItems.length,
    };
  }, [items]);

  const openAddItem = () => {
    setEditingId(null);
    setItemForm(emptyItem);
    setShowItem(true);
  };

  const openEditItem = (it: any) => {
    setEditingId(it.id);
    setItemForm({
      name: it.name ?? "",
      description: it.description ?? "",
      category: it.category ?? "vaccine",
      unit: it.unit ?? "vial",
      quantity: String(it.quantity ?? 0),
      reorder_level: String(it.reorder_level ?? 5),
      expiration_date: it.expiration_date ? String(it.expiration_date).slice(0, 10) : "",
    });
    setShowItem(true);
  };

  const saveItem = async () => {
    if (!itemForm.name.trim()) {
      toast.error("Item name is required");
      return;
    }
    setSaving(true);
    const payload: any = {
      name: itemForm.name.trim(),
      description: itemForm.description.trim() || null,
      category: itemForm.category,
      unit: itemForm.unit.trim() || "vial",
      quantity: Number(itemForm.quantity || 0),
      reorder_level: Number(itemForm.reorder_level || 5),
      expiration_date: itemForm.expiration_date || null,
      item_code: editingId ? undefined : `INV-${Date.now().toString().slice(-6)}`,
    };
    const { error } = editingId
      ? await db.from("inventory_items").update(payload).eq("id", editingId)
      : await db.from("inventory_items").insert(payload as any);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(editingId ? "Item updated" : "Item added");
    setShowItem(false);
    invalidate("inventory_items");
  };

  const deleteItem = async (id: string) => {
    const { error } = await db.from("inventory_items").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Item deleted");
    invalidate("inventory_items");
  };

  const openBatch = (type: "in" | "out", item_id = "") => {
    setBatch({ ...emptyBatch, type, item_id });
    setShowBatch(true);
  };

  const saveBatch = async () => {
    const qty = parseInt(batch.quantity, 10);
    if (!batch.item_id) {
      toast.error("Select an item");
      return;
    }
    if (!qty || qty <= 0) {
      toast.error("Enter a valid quantity");
      return;
    }
    const item = items.find((i) => i.id === batch.item_id);
    if (batch.type === "out" && item && qty > Number(item.quantity ?? 0)) {
      toast.error(`Only ${item.quantity} ${item.unit ?? "unit"} in stock`);
      return;
    }
    setSaving(true);
    const payload: any = {
      item_id: batch.item_id,
      type: batch.type,
      quantity: qty,
      transaction_no: batch.transaction_no.trim() || `TXN-${Date.now().toString().slice(-6)}`,
      expiration_date: batch.expiration_date || null,
      reason: batch.reason.trim() || null,
      unit_cost: batch.unit_cost ? Number(batch.unit_cost) : 0,
      notes: batch.notes.trim() || null,
      staff_name: user?.user_metadata?.full_name || user?.email || role || "Staff",
      date: todayPH(),
    };
    const { error } = await db.from("inventory_transactions").insert(payload);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`Stock ${batch.type === "in" ? "added" : "released"}`);
    setShowBatch(false);
    invalidate("inventory_items");
    invalidate("inventory_transactions");
  };


  const handlePrint = (type: "all" | "expired") => {
    const list = type === "expired" ? items.filter((i) => getItemStatus(i) === "Expired") : filteredItems;
    const title = type === "expired" ? "Expired Inventory Report" : "Inventory Report";
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>${title}</title><style>body{font-family:Arial,sans-serif;padding:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px}</style></head><body><h1>${title}</h1><table><tr><th>Item</th><th>Category</th><th>Quantity</th><th>Status</th></tr>${list.map((i) => `<tr><td>${i.name}</td><td>${i.category}</td><td>${i.quantity} ${i.unit ?? "unit"}</td><td>${getItemStatus(i)}</td></tr>`).join("")}</table><p>Generated ${formatNowPH()}</p></body></html>`);
    w.document.close();
    w.print();
  };

  const alerts = items.filter((it) => getItemStatus(it) !== "In Stock");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground text-sm">Centralized stock and care-history stock deductions.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => handlePrint("all")}><Printer className="h-4 w-4 mr-1" /> Print</Button>
          <Button variant="outline" onClick={() => openBatch("in")}><ArrowDownToLine className="h-4 w-4 mr-1" /> Stock In</Button>
          <Button variant="outline" onClick={() => openBatch("out")}><ArrowUpFromLine className="h-4 w-4 mr-1" /> Stock Out</Button>
          {canManageItems && <Button onClick={openAddItem}><Plus className="h-4 w-4 mr-1" /> Add Item</Button>}
        </div>
      </div>

      {alerts.length > 0 && (
        <Card className="border-destructive/20 bg-destructive/5 shadow-sm">
          <CardContent className="flex items-start gap-3 p-4">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="space-y-1 text-sm">
              {alerts.map((item) => (
                <div key={item.id}><strong>{item.name}</strong>: {getItemStatus(item)}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Total Items</p><p className="text-2xl font-semibold">{metrics.total}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Medicines</p><p className="text-2xl font-semibold">{metrics.medicines}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Vaccines</p><p className="text-2xl font-semibold">{metrics.vaccines}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Dewormers</p><p className="text-2xl font-semibold">{metrics.dewormers}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Medical Supplies</p><p className="text-2xl font-semibold">{metrics.supplies}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Low Stock</p><p className="text-2xl font-semibold">{metrics.lowStock}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Out of Stock</p><p className="text-2xl font-semibold">{metrics.outOfStock}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-sm text-muted-foreground">Expiring Soon</p><p className="text-2xl font-semibold">{metrics.expiringSoon}</p></CardContent></Card>
      </div>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="history">Transactions</TabsTrigger>
          </TabsList>

        <TabsContent value="items">
          <Card className="border-0 shadow-sm">
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex-1 space-y-2">
                  <Label>Search</Label>
                  <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search item or description" />
                </div>
                <div className="w-full md:w-48 space-y-2">
                  <Label>Category</Label>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {CATEGORIES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full md:w-48 space-y-2">
                  <Label>Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {STATUS_ORDER.map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Expiry</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedItems.map((item) => {
                        const status = getItemStatus(item);
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <div className="font-medium">{item.name}</div>
                              <div className="text-xs text-muted-foreground">{item.description ?? "—"}</div>
                            </TableCell>
                            <TableCell>{CATEGORIES.find((option) => option.value === item.category)?.label ?? item.category}</TableCell>
                            <TableCell>{item.quantity} {item.unit ?? "unit"}</TableCell>
                            <TableCell>{item.expiration_date ? formatDate(item.expiration_date) : "—"}</TableCell>
                            <TableCell><Badge variant={getStatusBadge(status) as any}>{status}</Badge></TableCell>
                            <TableCell className="text-right whitespace-nowrap">
                              <Button variant="ghost" size="icon" onClick={() => openBatch("in", item.id)} aria-label="Stock in"><ArrowDownToLine className="h-4 w-4 text-success" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => openBatch("out", item.id)} aria-label="Stock out"><ArrowUpFromLine className="h-4 w-4 text-destructive" /></Button>
                              {canManageItems && (
                                <>
                                  <Button variant="ghost" size="icon" onClick={() => openEditItem(item)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                                  <Button variant="ghost" size="icon" onClick={() => deleteItem(item.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                                </>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {pagedItems.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">No inventory items found.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  <div className="flex items-center justify-between pt-2">
                    <p className="text-sm text-muted-foreground">Showing {pagedItems.length} of {filteredItems.length} items</p>
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
                      <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page * pageSize >= filteredItems.length}>Next</Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Transaction</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Staff</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {txns.map((txn) => (
                    <TableRow key={txn.id}>
                      <TableCell>{formatDate(txn.date)}</TableCell>
                      <TableCell className="font-medium">{itemName(txn.item_id)}</TableCell>
                      <TableCell>{txn.type === "in" ? "Stock In" : "Stock Out"}</TableCell>
                      <TableCell>{txn.type === "in" ? "+" : "−"}{txn.quantity}</TableCell>
                      <TableCell>{txn.staff_name ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                  {txns.length === 0 && <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">No stock movements yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>

      <Dialog open={showItem} onOpenChange={setShowItem}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="font-heading">{editingId ? "Edit Item" : "Add Item"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2"><Label>Item Name</Label><Input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} /></div>
            <div className="space-y-2"><Label>Description</Label><Input value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} /></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Category</Label><Select value={itemForm.category} onValueChange={(v) => setItemForm({ ...itemForm, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Unit</Label><Input value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} /></div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Current Quantity</Label><Input type="number" min={0} value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: e.target.value })} /></div>
              <div className="space-y-2"><Label>Reorder Level</Label><Input type="number" min={0} value={itemForm.reorder_level} onChange={(e) => setItemForm({ ...itemForm, reorder_level: e.target.value })} /></div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Expiration Date</Label><Input type="date" value={itemForm.expiration_date} onChange={(e) => setItemForm({ ...itemForm, expiration_date: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowItem(false)}>Cancel</Button>
            <Button onClick={saveItem} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Item"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBatch} onOpenChange={setShowBatch}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">{batch.type === "in" ? "Stock In" : "Stock Out"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2"><Label>Inventory Item</Label><Select value={batch.item_id} onValueChange={(v) => setBatch({ ...batch, item_id: v })}><SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger><SelectContent>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name} ({i.quantity} {i.unit ?? "unit"})</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Quantity</Label><Input type="number" min={1} value={batch.quantity} onChange={(e) => setBatch({ ...batch, quantity: e.target.value })} /></div>
              <div className="space-y-2"><Label>Transaction No.</Label><Input value={batch.transaction_no} onChange={(e) => setBatch({ ...batch, transaction_no: e.target.value })} /></div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2"><Label>Unit Cost</Label><Input type="number" step="0.01" value={batch.unit_cost} onChange={(e) => setBatch({ ...batch, unit_cost: e.target.value })} /></div>
              <div className="space-y-2"><Label>Expiration Date</Label><Input type="date" value={batch.expiration_date} onChange={(e) => setBatch({ ...batch, expiration_date: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label>Reason</Label><Input value={batch.reason} onChange={(e) => setBatch({ ...batch, reason: e.target.value })} placeholder={batch.type === "in" ? "Delivery / Adjustment" : "Care History / Damage / Expired"} /></div>
            <div className="space-y-2"><Label>Notes</Label><Input value={batch.notes} onChange={(e) => setBatch({ ...batch, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBatch(false)}>Cancel</Button>
            <Button onClick={saveBatch} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
