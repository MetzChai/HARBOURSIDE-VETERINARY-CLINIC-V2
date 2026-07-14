"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Bug, Loader2, Printer, BellRing } from "lucide-react";
import { db } from "@/lib/db-client";
import { useRows, useInvalidate } from "@/hooks/useRows";
import { formatDate } from "@/lib/age";
import { isOnOrBeforeTodayPH, formatNowPH } from "@/lib/datetime";
import { toast } from "sonner";

const STATUSES = ["Scheduled", "Completed", "Due Follow-up"] as const;

const statusVariant = (s: string) =>
  s === "Completed" ? "default" : s === "Due Follow-up" ? "destructive" : "secondary";

export default function Dewormings() {
  const { data: rows = [], isLoading } = useRows<any>("dewormings", { orderBy: "date_given", ascending: false });
  const { data: pets = [] } = useRows<any>("pets", { orderBy: "name" });
  const invalidate = useInvalidate();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ pet_id: "", product: "", date_given: "", next_due: "", vet: "", status: "Scheduled", notes: "" });

  const petName = (id: string) => pets.find((p) => p.id === id)?.name ?? "—";

  // A record is "due" when its follow-up date has arrived and it isn't completed
  const isPastDue = (r: any) => r.next_due && isOnOrBeforeTodayPH(r.next_due) && r.status !== "Completed";
  // Effective status: auto-flag past-due records as follow-up
  const effectiveStatus = (r: any) => (isPastDue(r) ? "Due Follow-up" : r.status ?? "Scheduled");

  const filtered = rows.filter((r) =>
    petName(r.pet_id).toLowerCase().includes(search.toLowerCase()) ||
    (r.product ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const reminders = useMemo(
    () => rows.filter((r) => isPastDue(r) || effectiveStatus(r) === "Due Follow-up"),
    [rows]
  );

  const save = async () => {
    if (!form.pet_id || !form.product.trim()) {
      toast.error("Pet and product are required");
      return;
    }
    setSaving(true);
    const { error } = await db.from("dewormings").insert({
      pet_id: form.pet_id,
      product: form.product.trim(),
      date_given: form.date_given || null,
      next_due: form.next_due || null,
      vet: form.vet || null,
      status: form.status,
      notes: form.notes || null,
    } as any);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Deworming record added");
    setOpen(false);
    setForm({ pet_id: "", product: "", date_given: "", next_due: "", vet: "", status: "Scheduled", notes: "" });
    invalidate("dewormings");
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await db.from("dewormings").update({ status } as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked as ${status}`);
    invalidate("dewormings");
  };

  const printRecord = (r: any) => {
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`
      <html><head><title>Deworming Record</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;color:#222}h1{color:#0d7d6f;margin-bottom:0}
      h2{color:#555;font-weight:normal;margin-top:4px}
      .row{display:flex;padding:8px 0;border-bottom:1px solid #eee}
      .label{width:180px;font-weight:bold;color:#0d7d6f}</style></head>
      <body><h1>Harbourside Veterinary Clinic</h1><h2>Deworming Record</h2>
      <div class="row"><div class="label">Pet</div><div>${petName(r.pet_id)}</div></div>
      <div class="row"><div class="label">Product</div><div>${r.product ?? "—"}</div></div>
      <div class="row"><div class="label">Date Given</div><div>${r.date_given ? formatDate(r.date_given) : "—"}</div></div>
      <div class="row"><div class="label">Next Due / Follow-up</div><div>${r.next_due ? formatDate(r.next_due) : "—"}</div></div>
      <div class="row"><div class="label">Attending Vet</div><div>${r.vet ?? "—"}</div></div>
      <div class="row"><div class="label">Status</div><div>${effectiveStatus(r)}</div></div>
      <div class="row"><div class="label">Notes</div><div>${r.notes ?? "—"}</div></div>
      <br><p style="color:#999;font-size:12px">Generated on ${formatNowPH()} (PH Time)</p></body></html>`);
    w.document.close(); w.print();
  };

  const printAll = () => {
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`
      <html><head><title>Deworming Records</title>
      <style>body{font-family:Arial,sans-serif;padding:40px}h1{color:#0d7d6f}
      table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#e6f4f1;color:#0d7d6f}</style></head>
      <body><h1>Harbourside Veterinary Clinic</h1><h2>Deworming Records</h2>
      <table><tr><th>Pet</th><th>Product</th><th>Date Given</th><th>Next Due</th><th>Vet</th><th>Status</th></tr>
      ${rows.map((r) => `<tr><td>${petName(r.pet_id)}</td><td>${r.product ?? "—"}</td><td>${r.date_given ? formatDate(r.date_given) : "—"}</td><td>${r.next_due ? formatDate(r.next_due) : "—"}</td><td>${r.vet ?? "—"}</td><td>${effectiveStatus(r)}</td></tr>`).join("")}
      </table><br><p style="color:#999;font-size:12px">Generated on ${formatNowPH()} (PH Time)</p></body></html>`);
    w.document.close(); w.print();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-bold flex items-center gap-2"><Bug className="h-6 w-6 text-primary" /> Deworming</h1>
          <p className="text-muted-foreground text-sm">{rows.length} deworming records</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={printAll}><Printer className="h-4 w-4 mr-1" /> Print All</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add Record</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-heading">New Deworming Record</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label>Pet</Label>
                  <Select value={form.pet_id} onValueChange={(v) => setForm((p) => ({ ...p, pet_id: v }))}>
                    <SelectTrigger><SelectValue placeholder="Select pet" /></SelectTrigger>
                    <SelectContent>{pets.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Product</Label><Input value={form.product} onChange={(e) => setForm((p) => ({ ...p, product: e.target.value }))} placeholder="e.g. Drontal Plus" /></div>
                  <div className="space-y-2"><Label>Attending Vet</Label><Input value={form.vet} onChange={(e) => setForm((p) => ({ ...p, vet: e.target.value }))} placeholder="Dr. ..." /></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Date Given</Label><Input type="date" value={form.date_given} onChange={(e) => setForm((p) => ({ ...p, date_given: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>Next Due / Follow-up</Label><Input type="date" value={form.next_due} onChange={(e) => setForm((p) => ({ ...p, next_due: e.target.value }))} /></div>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={form.status} onValueChange={(v) => setForm((p) => ({ ...p, status: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {reminders.length > 0 && (
        <Card className="border-0 shadow-sm bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 font-medium text-destructive mb-2">
              <BellRing className="h-4 w-4" /> Follow-up Reminders ({reminders.length})
            </div>
            <ul className="space-y-1 text-sm">
              {reminders.map((r) => (
                <li key={r.id} className="flex items-center justify-between">
                  <span><strong>{petName(r.pet_id)}</strong> — {r.product} · due {formatDate(r.next_due)}</span>
                  <Button size="sm" variant="ghost" onClick={() => updateStatus(r.id, "Completed")}>Mark done</Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by pet or product..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pet</TableHead><TableHead>Product</TableHead><TableHead>Date Given</TableHead>
                  <TableHead>Next Due</TableHead><TableHead>Vet</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{petName(r.pet_id)}</TableCell>
                    <TableCell>{r.product}</TableCell>
                    <TableCell>{formatDate(r.date_given)}</TableCell>
                    <TableCell>{formatDate(r.next_due)}</TableCell>
                    <TableCell>{r.vet ?? "—"}</TableCell>
                    <TableCell>
                      <Select value={effectiveStatus(r)} onValueChange={(v) => updateStatus(r.id, v)}>
                        <SelectTrigger className="h-8 w-[150px] border-0 bg-transparent p-0 hover:bg-accent/50 focus:ring-1">
                          <Badge variant={statusVariant(effectiveStatus(r))} className="cursor-pointer">{effectiveStatus(r)}</Badge>
                        </SelectTrigger>
                        <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="icon" variant="ghost" onClick={() => printRecord(r)} title="Print record">
                        <Printer className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No records</TableCell></TableRow>}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

