"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Printer, Loader2 } from "lucide-react";
import { useRows } from "@/hooks/useRows";
import { formatDate } from "@/lib/age";
import { formatNowPH } from "@/lib/datetime";

export default function Reports() {
  const { data: pets = [], isLoading: petsLoading } = useRows<any>("pets", { orderBy: "name" });
  const { data: owners = [], isLoading: ownersLoading } = useRows<any>("owners", { orderBy: "name" });
  const { data: vaccinations = [], isLoading: vaxLoading } = useRows<any>("vaccinations", { orderBy: "date_given", ascending: false });
  const { data: appointments = [], isLoading: apptLoading } = useRows<any>("appointments", { orderBy: "date", ascending: false });
  const { data: inventory = [], isLoading: invLoading } = useRows<any>("inventory_items", { orderBy: "name" });

  const loading = petsLoading || ownersLoading || vaxLoading || apptLoading || invLoading;

  const petName = (id: string) => pets.find((p) => p.id === id)?.name ?? "—";
  const ownerName = (id: string) => owners.find((o) => o.id === id)?.name ?? "—";

  const reports = [
    { title: "Pet Registry Report", desc: "Complete list of all registered pets", count: pets.length, key: "pets" },
    { title: "Owner Directory", desc: "All registered pet owners", count: owners.length, key: "owners" },
    { title: "Vaccination Report", desc: "All vaccination records", count: vaccinations.length, key: "vaccinations" },
    { title: "Appointment Report", desc: "All scheduled appointments", count: appointments.length, key: "appointments" },
    { title: "Inventory Report", desc: "Current inventory stock", count: inventory.length, key: "inventory" },
  ];

  const handlePrint = (key: string, title: string) => {
    const w = window.open("", "_blank");
    if (!w) return;
    let content = `<h1>Harbourside Veterinary Clinic</h1><h2>${title}</h2>`;

    if (key === "pets") {
      content += `<table><tr><th>Name</th><th>Species</th><th>Breed</th><th>Gender</th><th>DOB</th><th>Owner</th></tr>
      ${pets.map((p) => `<tr><td>${p.name}</td><td>${p.species ?? "—"}</td><td>${p.breed ?? "—"}</td><td>${p.gender ?? "—"}</td><td>${p.dob ? formatDate(p.dob) : "—"}</td><td>${ownerName(p.owner_id)}</td></tr>`).join("")}</table>`;
    } else if (key === "owners") {
      content += `<table><tr><th>Name</th><th>Contact</th><th>Email</th><th>Address</th></tr>
      ${owners.map((o) => `<tr><td>${o.name}</td><td>${o.contact ?? "—"}</td><td>${o.email ?? "—"}</td><td>${o.address ?? "—"}</td></tr>`).join("")}</table>`;
    } else if (key === "vaccinations") {
      content += `<table><tr><th>Pet</th><th>Vaccine</th><th>Date</th><th>Next Due</th></tr>
      ${vaccinations.map((v) => `<tr><td>${petName(v.pet_id)}</td><td>${v.vaccine_type}</td><td>${v.date_given ? formatDate(v.date_given) : "—"}</td><td>${v.next_due ? formatDate(v.next_due) : "—"}</td></tr>`).join("")}</table>`;
    } else if (key === "appointments") {
      content += `<table><tr><th>Pet</th><th>Owner</th><th>Date</th><th>Time</th><th>Status</th></tr>
      ${appointments.map((a) => `<tr><td>${petName(a.pet_id)}</td><td>${ownerName(a.owner_id)}</td><td>${formatDate(a.date)}</td><td>${a.time}</td><td>${a.status}</td></tr>`).join("")}</table>`;
    } else if (key === "inventory") {
      content += `<table><tr><th>Item</th><th>Category</th><th>Qty</th><th>Expiration</th></tr>
      ${inventory.map((i) => `<tr><td>${i.name}</td><td>${i.category}</td><td>${i.quantity} ${i.unit ?? ""}</td><td>${i.expiration_date ? formatDate(i.expiration_date) : "—"}</td></tr>`).join("")}</table>`;
    }

    w.document.write(`<html><head><title>${title}</title>
    <style>body{font-family:Arial,sans-serif;padding:40px}h1{color:#ff2400}
    table{width:100%;border-collapse:collapse;margin-top:16px}
    th,td{border:1px solid #ddd;padding:8px;text-align:left}th{background:#fff0ee;color:#ff2400}</style></head>
    <body>${content}<br><p style="color:#999;font-size:12px">Generated on ${formatNowPH()} (PH Time)</p></body></html>`);
    w.document.close();
    w.print();
  };

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="font-heading text-2xl font-bold">Reports</h1>
        <p className="text-muted-foreground text-sm">Generate and print clinic reports</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reports.map((r) => (
          <Card key={r.key} className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> {r.title}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">{r.desc}</p>
              <p className="text-2xl font-bold text-primary">{r.count}</p>
              <Button variant="outline" size="sm" onClick={() => handlePrint(r.key, r.title)}>
                <Printer className="h-3 w-3 mr-1" /> Print Report
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
