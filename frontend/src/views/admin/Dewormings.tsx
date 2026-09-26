"use client";

import { printDocument } from "@/lib/print";
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
import { isOnOrBeforeTodayPH, formatNowPH, todayPH } from "@/lib/datetime";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { PageSkeleton } from "@/components/PageSkeleton";
import { EmptyState } from "@/components/EmptyState";

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

    if (error) {
      setSaving(false);
      toast.error(error.message);
      return;
    }

    // Also store in care_records for pet's complete medical history profile
    await db.from("care_records").insert({
      pet_id: form.pet_id,
      date: form.date_given || todayPH(),
      vet: form.vet || "Clinic Staff",
      record_type: "deworming",
      dewormer_used: form.product.trim(),
      next_deworming_due: form.next_due || null,
      outcome: form.status || "Completed",
      notes: form.notes || null,
    } as any);

    setSaving(false);
    toast.success("Deworming record saved to medical profile");
    setOpen(false);
    setForm({ pet_id: "", product: "", date_given: "", next_due: "", vet: "", status: "Scheduled", notes: "" });
    invalidate("dewormings");
    invalidate("care_records");
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await db.from("dewormings").update({ status } as any).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Marked as ${status}`);
    invalidate("dewormings");
  };

  const printRecord = (r: any) => {
    const bodyHtml = `
      <div class="header-brand">
        <img src="/logo.png" style="height:44px;width:44px;object-fit:contain;border-radius:6px;" alt="HVS" />
        <div>
          <h1>Harbourside Veterinary Clinic</h1>
          <h2>Official Deworming Record</h2>
        </div>
      </div>
      <div style="display:flex;padding:8px 0;border-bottom:1px solid #eee"><div style="width:180px;font-weight:bold;color:#1B3A5C">Pet</div><div>${petName(r.pet_id)}</div></div>
      <div style="display:flex;padding:8px 0;border-bottom:1px solid #eee"><div style="width:180px;font-weight:bold;color:#1B3A5C">Product</div><div>${r.product ?? "—"}</div></div>
      <div style="display:flex;padding:8px 0;border-bottom:1px solid #eee"><div style="width:180px;font-weight:bold;color:#1B3A5C">Date Given</div><div>${r.date_given ? formatDate(r.date_given) : "—"}</div></div>
      <div style="display:flex;padding:8px 0;border-bottom:1px solid #eee"><div style="width:180px;font-weight:bold;color:#1B3A5C">Next Due / Follow-up</div><div>${r.next_due ? formatDate(r.next_due) : "—"}</div></div>
      <div style="display:flex;padding:8px 0;border-bottom:1px solid #eee"><div style="width:180px;font-weight:bold;color:#1B3A5C">Attending Vet</div><div>${r.vet ?? "—"}</div></div>
      <div style="display:flex;padding:8px 0;border-bottom:1px solid #eee"><div style="width:180px;font-weight:bold;color:#1B3A5C">Status</div><div>${effectiveStatus(r)}</div></div>
      <div style="display:flex;padding:8px 0;border-bottom:1px solid #eee"><div style="width:180px;font-weight:bold;color:#1B3A5C">Notes</div><div>${r.notes ?? "—"}</div></div>
      <div class="footer-brand">Generated on ${formatNowPH()} (PH Time) | Harbourside Veterinary Clinic</div>
    `;

    printDocument({
      title: "Deworming Record - Harbourside Veterinary Clinic",
      bodyHtml,
    });
  };

  const printAll = () => {
    const bodyHtml = `
      <div class="header-brand">
        <img src="/logo.png" style="height:44px;width:44px;object-fit:contain;border-radius:6px;" alt="HVS" />
        <div>
          <h1>Harbourside Veterinary Clinic</h1>
          <h2>Master Deworming Records</h2>
        </div>
      </div>
      <table>
        <thead><tr><th>Pet</th><th>Product</th><th>Date Given</th><th>Next Due</th><th>Vet</th><th>Status</th></tr></thead>
        <tbody>
          ${rows.map((r) => `<tr><td>${petName(r.pet_id)}</td><td>${r.product ?? "—"}</td><td>${r.date_given ? formatDate(r.date_given) : "—"}</td><td>${r.next_due ? formatDate(r.next_due) : "—"}</td><td>${r.vet ?? "—"}</td><td>${effectiveStatus(r)}</td></tr>`).join("")}
        </tbody>
      </table>
      <div class="footer-brand">Generated on ${formatNowPH()} (PH Time) | Harbourside Veterinary Clinic</div>
    `;

    printDocument({
      title: "Deworming Records - Harbourside Veterinary Clinic",
      bodyHtml,
    });
  };

  return (
    <div className="page-container">
      <PageHeader
        title="Deworming"
        description={`${rows.length} deworming records`}
        actions={
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
        }
      />

      {reminders.length > 0 && (
        <Card className="border-destructive/20 shadow-sm bg-red-50/60">
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

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8">
              <PageSkeleton rows={6} />
            </div>
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
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="p-0">
                      <EmptyState icon={Bug} title="No records found." description="Add a deworming record or adjust your search." />
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

