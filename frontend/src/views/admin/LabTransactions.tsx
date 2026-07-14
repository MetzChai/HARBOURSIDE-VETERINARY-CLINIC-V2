"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Receipt, Loader2, Trash2, Eye, Printer } from "lucide-react";
import { db } from "@/lib/db-client";
import { useRows, useInvalidate } from "@/hooks/useRows";
import { formatDate } from "@/lib/age";
import { todayPH, formatNowPH } from "@/lib/datetime";
import { toast } from "sonner";

interface LineItem { description: string; quantity: number; unit_price: number; }

const peso = (n: number) => `₱${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;

export default function LabTransactions() {
  const { data: txns = [], isLoading } = useRows<any>("lab_transactions", { orderBy: "date", ascending: false });
  const { data: pets = [] } = useRows<any>("pets", { orderBy: "name" });
  const { data: owners = [] } = useRows<any>("owners", { orderBy: "name" });
  const { data: inventoryItems = [] } = useRows<any>("inventory_items", { orderBy: "name" });
  const { data: txnItems = [] } = useRows<any>("lab_transaction_items");
  const invalidate = useInvalidate();

  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<any>(null);
  const [header, setHeader] = useState({ pet_id: "", owner_id: "", date: "", vet: "", status: "Unpaid" });
  const [lines, setLines] = useState<LineItem[]>([{ description: "", quantity: 1, unit_price: 0 }]);

  const petName = (id: string) => pets.find((p) => p.id === id)?.name ?? "—";
  const ownerName = (id: string) => owners.find((o) => o.id === id)?.name ?? "—";
  const itemsFor = (tid: string) => txnItems.filter((i) => i.transaction_id === tid);

  const filtered = txns.filter((t) =>
    petName(t.pet_id).toLowerCase().includes(search.toLowerCase()) ||
    ownerName(t.owner_id).toLowerCase().includes(search.toLowerCase())
  );

  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0);

  const updateLine = (i: number, patch: Partial<LineItem>) =>
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const save = async () => {
    const valid = lines.filter((l) => l.description.trim());
    if (valid.length === 0) { toast.error("Add at least one line item"); return; }
    setSaving(true);
    const { data: txn, error } = await db.from("lab_transactions").insert({
      pet_id: header.pet_id || null,
      owner_id: header.owner_id || null,
      date: header.date || todayPH(),
      vet: header.vet || null,
      status: header.status,
      total,
    }).select().single() as { data: { id: string } | null; error: { message: string } | null };
    if (error || !txn) { setSaving(false); toast.error(error?.message ?? "Failed"); return; }
    const { error: iErr } = await db.from("lab_transaction_items").insert(
      valid.map((l) => ({
        transaction_id: txn.id,
        description: l.description.trim(),
        quantity: Number(l.quantity) || 1,
        unit_price: Number(l.unit_price) || 0,
        line_total: (Number(l.quantity) || 0) * (Number(l.unit_price) || 0),
      }))
    );
    if (iErr) { setSaving(false); toast.error(iErr.message); return; }

    // Auto-decrease inventory for matching items
    let stockAdjusted = 0;
    for (const line of valid) {
      const desc = line.description.trim().toLowerCase();
      const match = inventoryItems.find((inv) => inv.name.toLowerCase() === desc || inv.name.toLowerCase().includes(desc) || desc.includes(inv.name.toLowerCase()));
      if (match) {
        const qty = Number(line.quantity) || 1;
        const { error: stockErr } = await db.from("inventory_transactions").insert({
          item_id: match.id,
          type: "out",
          quantity: qty,
          reason: `Lab transaction #${txn.id.slice(0, 8)}`,
          pet_id: header.pet_id || null,
          date: header.date || todayPH(),
        } as any);
        if (!stockErr) stockAdjusted++;
      }
    }

    setSaving(false);
    toast.success(stockAdjusted > 0
      ? `Transaction recorded — ${stockAdjusted} inventory item(s) deducted`
      : "Transaction recorded");
    setOpen(false);
    setHeader({ pet_id: "", owner_id: "", date: "", vet: "", status: "Unpaid" });
    setLines([{ description: "", quantity: 1, unit_price: 0 }]);
    invalidate("lab_transactions");
    invalidate("lab_transaction_items");
    invalidate("inventory_items");
    invalidate("inventory_transactions");
  };

  const printTxn = (t: any) => {
    const its = itemsFor(t.id);
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<html><head><title>Invoice</title><style>body{font-family:Arial;padding:40px}h1{color:#c0392b}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#fdecea;color:#c0392b}</style></head><body>
      <h1>Harbourside Veterinary Clinic</h1><p>Lab / Transaction Invoice</p>
      <p><strong>Pet:</strong> ${petName(t.pet_id)} &nbsp; <strong>Owner:</strong> ${ownerName(t.owner_id)}<br/>
      <strong>Date:</strong> ${formatDate(t.date)} &nbsp; <strong>Vet:</strong> ${t.vet ?? "—"} &nbsp; <strong>Status:</strong> ${t.status}</p>
      <table><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr>
      ${its.map((i) => `<tr><td>${i.description}</td><td>${i.quantity}</td><td>${peso(i.unit_price)}</td><td>${peso(i.line_total)}</td></tr>`).join("")}
      <tr><td colspan="3" style="text-align:right"><strong>TOTAL</strong></td><td><strong>${peso(t.total)}</strong></td></tr></table>
      </body></html>`);
    w.document.close(); w.print();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2"><Receipt className="h-6 w-6 text-primary" /> Lab & Transactions</h1>
          <p className="text-muted-foreground text-sm">{txns.length} itemized transactions</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New Transaction</Button></DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle className="font-heading">New Transaction</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2"><Label>Pet</Label>
                  <Select value={header.pet_id} onValueChange={(v) => setHeader((h) => ({ ...h, pet_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select pet" /></SelectTrigger>
                    <SelectContent>{pets.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Owner</Label>
                  <Select value={header.owner_id} onValueChange={(v) => setHeader((h) => ({ ...h, owner_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select owner" /></SelectTrigger>
                    <SelectContent>{owners.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2"><Label>Date</Label><Input type="date" value={header.date} onChange={(e) => setHeader((h) => ({ ...h, date: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Vet</Label><Input value={header.vet} onChange={(e) => setHeader((h) => ({ ...h, vet: e.target.value }))} /></div>
                <div className="space-y-2"><Label>Status</Label>
                  <Select value={header.status} onValueChange={(v) => setHeader((h) => ({ ...h, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Unpaid">Unpaid</SelectItem><SelectItem value="Paid">Paid</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Line Items</Label>
                <p className="text-xs text-muted-foreground">Use inventory item names to auto-deduct stock</p>
                {lines.map((l, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Select value="" onValueChange={(v) => updateLine(i, { description: v })}>
                      <SelectTrigger className="w-36 shrink-0"><SelectValue placeholder="Inventory" /></SelectTrigger>
                      <SelectContent>
                        {inventoryItems.map((inv) => (
                          <SelectItem key={inv.id} value={inv.name}>{inv.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input className="flex-1" placeholder="Description" value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} />
                    <Input className="w-16" type="number" min={1} value={l.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} />
                    <Input className="w-24" type="number" min={0} placeholder="Price" value={l.unit_price} onChange={(e) => updateLine(i, { unit_price: Number(e.target.value) })} />
                    <Button variant="ghost" size="icon" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setLines((p) => [...p, { description: "", quantity: 1, unit_price: 0 }])}><Plus className="h-3 w-3 mr-1" /> Add item</Button>
              </div>
              <div className="text-right font-semibold">Total: {peso(total)}</div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by pet or owner..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Date</TableHead><TableHead>Pet</TableHead><TableHead>Owner</TableHead>
                <TableHead>Items</TableHead><TableHead>Total</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell>{formatDate(t.date)}</TableCell>
                    <TableCell className="font-medium">{petName(t.pet_id)}</TableCell>
                    <TableCell>{ownerName(t.owner_id)}</TableCell>
                    <TableCell>{itemsFor(t.id).length}</TableCell>
                    <TableCell>{peso(t.total)}</TableCell>
                    <TableCell><Badge className={t.status === "Paid" ? "bg-success text-success-foreground" : ""} variant={t.status === "Paid" ? "default" : "secondary"}>{t.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => setView(t)}><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => printTxn(t)}><Printer className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No transactions</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!view} onOpenChange={() => setView(null)}>
        <DialogContent>
          {view && (<>
            <DialogHeader><DialogTitle className="font-heading">Transaction Details</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">{petName(view.pet_id)} • {ownerName(view.owner_id)} • {formatDate(view.date)}</p>
            <Table>
              <TableHeader><TableRow><TableHead>Description</TableHead><TableHead>Qty</TableHead><TableHead>Price</TableHead><TableHead>Total</TableHead></TableRow></TableHeader>
              <TableBody>
                {itemsFor(view.id).map((i) => (
                  <TableRow key={i.id}><TableCell>{i.description}</TableCell><TableCell>{i.quantity}</TableCell><TableCell>{peso(i.unit_price)}</TableCell><TableCell>{peso(i.line_total)}</TableCell></TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-right font-semibold">Total: {peso(view.total)}</p>
          </>)}
        </DialogContent>
      </Dialog>
    </div>
  );
}

