"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Printer, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Loader2 } from "lucide-react";
import { db } from "@/lib/db-client";
import { useRows, useInvalidate } from "@/hooks/useRows";
import { formatDate } from "@/lib/age";
import { todayPH, isBeforeTodayPH, formatNowPH } from "@/lib/datetime";
import { toast } from "sonner";

const CATEGORIES = ["vaccine", "medication", "dewormer", "supply"] as const;

const itemStatus = (qty: number, exp: string | null) => {
  if (exp && isBeforeTodayPH(exp)) return "Expired";
  if (qty <= 5) return "Low Stock";
  return "Available";
};

type ItemForm = { name: string; brand: string; dosage: string; category: string; unit: string; expiration_date: string };
const emptyItem: ItemForm = { name: "", brand: "", dosage: "", category: "vaccine", unit: "pcs", expiration_date: "" };

type BatchForm = { item_id: string; type: "in" | "out"; quantity: string; batch_no: string; expiration_date: string; reason: string };
const emptyBatch: BatchForm = { item_id: "", type: "in", quantity: "", batch_no: "", expiration_date: "", reason: "" };

export default function Inventory() {
  const { data: items = [], isLoading } = useRows<any>("inventory_items", { orderBy: "name" });
  const { data: txns = [] } = useRows<any>("inventory_transactions", { orderBy: "date", ascending: false });
  const invalidate = useInvalidate();

  const [showItem, setShowItem] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItem);
  const [saving, setSaving] = useState(false);

  const [showBatch, setShowBatch] = useState(false);
  const [batch, setBatch] = useState<BatchForm>(emptyBatch);

  const itemName = (id: string) => items.find((i) => i.id === id)?.name ?? "—";

  const openAddItem = () => { setEditingId(null); setItemForm(emptyItem); setShowItem(true); };
  const openEditItem = (it: any) => {
    setEditingId(it.id);
    setItemForm({
      name: it.name,
      brand: it.brand ?? "",
      dosage: it.dosage ?? "",
      category: it.category,
      unit: it.unit ?? "pcs",
      expiration_date: it.expiration_date ?? "",
    });
    setShowItem(true);
  };

  const saveItem = async () => {
    if (!itemForm.name.trim()) { toast.error("Item name is required"); return; }
    setSaving(true);
    const payload: any = {
      name: itemForm.name.trim(),
      brand: itemForm.brand.trim() || null,
      dosage: itemForm.dosage.trim() || null,
      category: itemForm.category,
      unit: itemForm.unit.trim() || "pcs",
      expiration_date: itemForm.expiration_date || null,
    };
    const { error } = editingId
      ? await db.from("inventory_items").update(payload).eq("id", editingId)
      : await db.from("inventory_items").insert({ ...payload, quantity: 0 });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editingId ? "Item updated" : "Item added");
    setShowItem(false);
    invalidate("inventory_items");
  };

  const openBatch = (type: "in" | "out", item_id = "") => { setBatch({ ...emptyBatch, type, item_id }); setShowBatch(true); };

  const saveBatch = async () => {
    const qty = parseInt(batch.quantity, 10);
    if (!batch.item_id) { toast.error("Select an item"); return; }
    if (!qty || qty <= 0) { toast.error("Enter a valid quantity"); return; }
    const item = items.find((i) => i.id === batch.item_id);
    if (batch.type === "out" && item && qty > item.quantity) {
      toast.error(`Only ${item.quantity} ${item.unit} in stock`); return;
    }
    setSaving(true);
    const { error } = await db.from("inventory_transactions").insert({
      item_id: batch.item_id,
      type: batch.type,
      quantity: qty,
      batch_no: batch.batch_no.trim() || null,
      expiration_date: batch.expiration_date || null,
      reason: batch.reason.trim() || null,
      date: todayPH(),
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`Stock ${batch.type === "in" ? "added" : "released"}: ${qty} ${item?.unit ?? ""} of ${item?.name ?? ""}`);
    setShowBatch(false);
    invalidate("inventory_items");
    invalidate("inventory_transactions");
  };

  const handlePrint = (type: "all" | "expired") => {
    const list = type === "expired" ? items.filter((i) => itemStatus(i.quantity, i.expiration_date) === "Expired") : items;
    const title = type === "expired" ? "Expired Items Report" : "Inventory Report";
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`
      <html><head><title>${title}</title>
      <style>body{font-family:Arial,sans-serif;padding:40px}h1{color:#1B3A5C}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#E8EEF4;color:#1B3A5C}</style></head>
      <body><h1>Harbourside Veterinary Clinic</h1><h2>${title}</h2>
      <table><tr><th>Item</th><th>Brand</th><th>Dosage</th><th>Category</th><th>Quantity</th><th>Expiration</th><th>Status</th></tr>
      ${list.map((i) => `<tr><td>${i.name}</td><td>${i.brand ?? "—"}</td><td>${i.dosage ?? "—"}</td><td>${i.category}</td><td>${i.quantity} ${i.unit ?? ""}</td><td>${i.expiration_date ? formatDate(i.expiration_date) : "—"}</td><td>${itemStatus(i.quantity, i.expiration_date)}</td></tr>`).join("")}
      </table><br><p style="color:#999;font-size:12px">Generated on ${formatNowPH()} (PH Time)</p></body></html>`);
    w.document.close(); w.print();
  };

  const alerts = items.filter((i) => itemStatus(i.quantity, i.expiration_date) !== "Available");

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold">Inventory</h1>
          <p className="text-muted-foreground text-sm">Batch stock in/out — also auto-decreases on lab transactions</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => handlePrint("all")}><Printer className="h-4 w-4 mr-1" /> Print</Button>
          <Button variant="outline" onClick={() => openBatch("in")}><ArrowDownToLine className="h-4 w-4 mr-1" /> Stock In</Button>
          <Button variant="outline" onClick={() => openBatch("out")}><ArrowUpFromLine className="h-4 w-4 mr-1" /> Stock Out</Button>
          <Button onClick={openAddItem}><Plus className="h-4 w-4 mr-1" /> New Item</Button>
        </div>
      </div>

      {alerts.length > 0 && (
        <Card className="border-destructive/20 bg-destructive/5 shadow-sm">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div className="space-y-1">
              {alerts.map((i) => (
                <p key={i.id} className="text-sm">
                  <strong>{i.name}</strong>: {itemStatus(i.quantity, i.expiration_date) === "Expired" ? "EXPIRED" : `LOW STOCK (${i.quantity} ${i.unit ?? ""} left)`}
                </p>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="history">Batch History</TabsTrigger>
        </TabsList>

        <TabsContent value="items">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              {isLoading ? <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Item</TableHead><TableHead>Brand</TableHead><TableHead>Dosage</TableHead>
                    <TableHead>Category</TableHead><TableHead>Quantity</TableHead><TableHead>Expiration</TableHead>
                    <TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {items.map((item) => {
                      const status = itemStatus(item.quantity, item.expiration_date);
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>{item.brand ?? "—"}</TableCell>
                          <TableCell>{item.dosage ?? "—"}</TableCell>
                          <TableCell className="capitalize">{item.category}</TableCell>
                          <TableCell>{item.quantity} {item.unit}</TableCell>
                          <TableCell>{item.expiration_date ? formatDate(item.expiration_date) : "—"}</TableCell>
                          <TableCell>
                            <Badge variant={status === "Available" ? "default" : status === "Low Stock" ? "secondary" : "destructive"}>
                              {status === "Low Stock" && "⚠️ "}{status === "Expired" && "❌ "}{status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap">
                            <Button variant="ghost" size="icon" onClick={() => openBatch("in", item.id)} aria-label="Stock in"><ArrowDownToLine className="h-4 w-4 text-success" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => openBatch("out", item.id)} aria-label="Stock out"><ArrowUpFromLine className="h-4 w-4 text-destructive" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => openEditItem(item)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {items.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No items yet</TableCell></TableRow>}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Date</TableHead><TableHead>Item</TableHead><TableHead>Type</TableHead>
                  <TableHead>Quantity</TableHead><TableHead>Batch No.</TableHead><TableHead>Expiration</TableHead><TableHead>Reason</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {txns.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{formatDate(t.date)}</TableCell>
                      <TableCell className="font-medium">{itemName(t.item_id)}</TableCell>
                      <TableCell>
                        <Badge variant={t.type === "in" ? "default" : "destructive"}>{t.type === "in" ? "Stock In" : "Stock Out"}</Badge>
                      </TableCell>
                      <TableCell>{t.type === "in" ? "+" : "−"}{t.quantity}</TableCell>
                      <TableCell>{t.batch_no ?? "—"}</TableCell>
                      <TableCell>{t.expiration_date ? formatDate(t.expiration_date) : "—"}</TableCell>
                      <TableCell>{t.reason ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                  {txns.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No batch movements yet</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={showItem} onOpenChange={setShowItem}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">{editingId ? "Edit Item" : "New Item"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2"><Label>Item Name</Label><Input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="e.g. Rabies Vaccine" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Brand</Label><Input value={itemForm.brand} onChange={(e) => setItemForm({ ...itemForm, brand: e.target.value })} placeholder="e.g. Nobivac" /></div>
              <div className="space-y-2"><Label>Dosage</Label><Input value={itemForm.dosage} onChange={(e) => setItemForm({ ...itemForm, dosage: e.target.value })} placeholder="e.g. 1 mL" /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><Label>Category</Label>
                <Select value={itemForm.category} onValueChange={(v) => setItemForm({ ...itemForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Unit</Label><Input value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} placeholder="pcs / mL" /></div>
              <div className="space-y-2"><Label>Expiration</Label><Input type="date" value={itemForm.expiration_date} onChange={(e) => setItemForm({ ...itemForm, expiration_date: e.target.value })} /></div>
            </div>
            {!editingId && <p className="text-xs text-muted-foreground">New items start at 0 stock. Use &quot;Stock In&quot; to add a batch.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowItem(false)}>Cancel</Button>
            <Button onClick={saveItem} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? "Update" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showBatch} onOpenChange={setShowBatch}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-heading">{batch.type === "in" ? "Stock In (Batch)" : "Stock Out (Batch)"}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2"><Label>Item</Label>
              <Select value={batch.item_id} onValueChange={(v) => setBatch({ ...batch, item_id: v })}>
                <SelectTrigger><SelectValue placeholder="Select item" /></SelectTrigger>
                <SelectContent>{items.map((i) => <SelectItem key={i.id} value={i.id}>{i.name} ({i.quantity} {i.unit})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Quantity</Label><Input type="number" min={1} value={batch.quantity} onChange={(e) => setBatch({ ...batch, quantity: e.target.value })} placeholder="0" /></div>
              <div className="space-y-2"><Label>Batch No.</Label><Input value={batch.batch_no} onChange={(e) => setBatch({ ...batch, batch_no: e.target.value })} placeholder="e.g. LOT-2026-A" /></div>
            </div>
            {batch.type === "in" && (
              <div className="space-y-2"><Label>Batch Expiration</Label><Input type="date" value={batch.expiration_date} onChange={(e) => setBatch({ ...batch, expiration_date: e.target.value })} /></div>
            )}
            <div className="space-y-2"><Label>Reason / Note</Label><Input value={batch.reason} onChange={(e) => setBatch({ ...batch, reason: e.target.value })} placeholder={batch.type === "in" ? "e.g. New delivery" : "e.g. Used on patient"} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBatch(false)}>Cancel</Button>
            <Button onClick={saveBatch} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Record Batch"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
