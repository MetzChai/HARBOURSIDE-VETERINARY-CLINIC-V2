"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Printer, Eye, Search, Filter, Heart } from "lucide-react";
import { useRows } from "@/hooks/useRows";
import { formatDate } from "@/lib/age";
import { formatNowPH } from "@/lib/datetime";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { PageSkeleton } from "@/components/PageSkeleton";

function formatCareTypeLabel(type?: string | null) {
  switch (String(type ?? "").toLowerCase()) {
    case "vaccination":
    case "vaccine":
      return "Vaccination";
    case "treatment":
      return "Treatment";
    case "deworming":
      return "Deworming";
    case "checkup":
    default:
      return "Check-up";
  }
}

function getCareTypeBadgeClass(type?: string | null) {
  switch (String(type ?? "").toLowerCase()) {
    case "vaccination":
    case "vaccine":
      return "bg-brand-navy-light text-brand-navy border-brand-navy/20";
    case "treatment":
      return "bg-brand-teal-light text-brand-teal border-brand-teal/30";
    case "deworming":
      return "bg-amber-50 text-amber-800 border-amber-300";
    case "checkup":
    default:
      return "bg-brand-green-light text-brand-green border-brand-green/30";
  }
}

export default function UserCareHistory() {
  const { data: pets = [], isLoading: petsLoading } = useRows<any>("pets", { orderBy: "name" });
  const { data: careRecords = [], isLoading: recordsLoading } = useRows<any>("care_records", {
    orderBy: "date",
    ascending: false,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [filterPetId, setFilterPetId] = useState("all");
  const [filterCareType, setFilterCareType] = useState("all");
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);

  const petMap = new Map(pets.map((p) => [p.id, p]));

  const filteredRecords = careRecords.filter((record) => {
    const pet = petMap.get(record.pet_id);
    const petName = pet?.name || "";
    const diagnosis = record.diagnosis || "";

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        petName.toLowerCase().includes(q) ||
        diagnosis.toLowerCase().includes(q) ||
        (record.notes || "").toLowerCase().includes(q) ||
        (record.treatment || "").toLowerCase().includes(q);
      if (!matchesSearch) return false;
    }

    if (filterPetId !== "all" && record.pet_id !== filterPetId) return false;

    if (filterCareType !== "all") {
      const normRecordType = String(record.record_type || "").toLowerCase();
      const normFilter = filterCareType.toLowerCase();
      if (normFilter === "vaccination") {
        if (normRecordType !== "vaccination" && normRecordType !== "vaccine") return false;
      } else if (normRecordType !== normFilter) {
        return false;
      }
    }

    return true;
  });

  const openViewModal = (record: any) => {
    setSelectedRecord(record);
    setShowViewModal(true);
  };

  const handlePrint = (record?: any) => {
    const recordsToPrint = record ? [record] : filteredRecords;
    const w = window.open("", "_blank");
    if (!w) return;

    const rowsHtml = recordsToPrint
      .map((r) => {
        const pet = petMap.get(r.pet_id);
        return `
          <tr>
            <td>${r.date ? formatDate(r.date) : "—"}</td>
            <td>${pet?.name || "—"}</td>
            <td>${formatCareTypeLabel(r.record_type)}</td>
            <td>${r.vet || "—"}</td>
            <td>${r.diagnosis || r.treatment || r.vaccine_used || r.dewormer_used || "—"}</td>
            <td>${r.notes || "—"}</td>
          </tr>
        `;
      })
      .join("");

    w.document.write(`
      <html>
        <head>
          <title>Medical History — Harbourside Veterinary Clinic</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 30px; color: #333; }
            h1 { color: #1B3A5C; margin-bottom: 4px; }
            h2 { color: #555; font-weight: normal; margin-top: 0; font-size: 16px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
            th, td { border: 1px solid #ddd; padding: 8px 10px; text-align: left; }
            th { background: #E8EEF4; color: #1B3A5C; font-weight: bold; }
            .footer { margin-top: 30px; font-size: 11px; color: #888; border-top: 1px solid #eee; padding-top: 10px; }
          </style>
        </head>
        <body>
          <h1>Harbourside Veterinary Clinic</h1>
          <h2>Pet Medical History Record</h2>
          <table>
            <thead>
              <tr>
                <th>Visit Date</th>
                <th>Pet</th>
                <th>Care Type</th>
                <th>Veterinarian</th>
                <th>Diagnosis / Treatment</th>
                <th>Visit Notes</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || "<tr><td colSpan='6' style='text-align:center'>No records found</td></tr>"}
            </tbody>
          </table>
          <div class="footer">Generated on ${formatNowPH()} (PH Time) | Harbourside Veterinary Clinic</div>
        </body>
      </html>
    `);
    w.document.close();
    w.print();
  };

  if (petsLoading || recordsLoading) {
    return <PageSkeleton rows={8} />;
  }

  return (
    <div className="page-container">
      <PageHeader
        title="My Pets' Care History"
        description="Medical history, visit notes, prescribed medications, and upcoming due dates"
        actions={
          <Button variant="outline" onClick={() => handlePrint()}>
            <Printer className="h-4 w-4 mr-1.5" /> Print Medical History
          </Button>
        }
      />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4 text-primary" /> Filter Medical History
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5 sm:col-span-1">
              <Label className="text-xs">Search</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by Pet Name or Diagnosis..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Filter by Pet</Label>
              <Select value={filterPetId} onValueChange={setFilterPetId}>
                <SelectTrigger>
                  <SelectValue placeholder="All My Pets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All My Pets</SelectItem>
                  {pets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Filter by Care Type</Label>
              <Select value={filterCareType} onValueChange={setFilterCareType}>
                <SelectTrigger>
                  <SelectValue placeholder="All Care Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Care Types</SelectItem>
                  <SelectItem value="checkup">Check-up</SelectItem>
                  <SelectItem value="vaccination">Vaccination</SelectItem>
                  <SelectItem value="treatment">Treatment</SelectItem>
                  <SelectItem value="deworming">Deworming</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Visit Date</TableHead>
                <TableHead>Pet</TableHead>
                <TableHead>Care Type</TableHead>
                <TableHead>Veterinarian</TableHead>
                <TableHead>Diagnosis / Details</TableHead>
                <TableHead className="text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRecords.length ? (
                filteredRecords.map((r) => {
                  const pet = petMap.get(r.pet_id);
                  const detailSnippet =
                    r.diagnosis || r.treatment || r.vaccine_used || r.dewormer_used || r.chief_complaint || "—";

                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.date ? formatDate(r.date) : "—"}</TableCell>
                      <TableCell className="font-semibold text-brand-navy">{pet?.name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getCareTypeBadgeClass(r.record_type)}>
                          {formatCareTypeLabel(r.record_type)}
                        </Badge>
                      </TableCell>
                      <TableCell>{r.vet || "—"}</TableCell>
                      <TableCell className="max-w-[240px] truncate text-muted-foreground">{detailSnippet}</TableCell>
                      <TableCell className="text-right pr-4">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => openViewModal(r)}
                            title="View Record Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handlePrint(r)}
                            title="Print Record"
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="p-0">
                    <EmptyState
                      icon={Filter}
                      title="No care records found."
                      description="Medical visits for your pets will appear here."
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* View Record Details Modal */}
      <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedRecord && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-6">
                  <DialogTitle>
                    {petMap.get(selectedRecord.pet_id)?.name || "Pet"} — Medical Record
                  </DialogTitle>
                  <Badge variant="outline" className={getCareTypeBadgeClass(selectedRecord.record_type)}>
                    {formatCareTypeLabel(selectedRecord.record_type)}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-4 pt-2 text-sm">
                <div className="grid grid-cols-2 gap-4 bg-muted/40 p-3 rounded-lg">
                  <div>
                    <span className="text-xs text-muted-foreground block">Visit Date</span>
                    <span className="font-semibold">{formatDate(selectedRecord.date)}</span>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground block">Veterinarian</span>
                    <span className="font-semibold">{selectedRecord.vet || "—"}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                    Medical Information
                  </h4>
                  {selectedRecord.chief_complaint && (
                    <p>
                      <strong>Chief Complaint:</strong> {selectedRecord.chief_complaint}
                    </p>
                  )}
                  {selectedRecord.symptoms && (
                    <p>
                      <strong>Symptoms:</strong> {selectedRecord.symptoms}
                    </p>
                  )}
                  {selectedRecord.diagnosis && (
                    <p>
                      <strong>Diagnosis:</strong> {selectedRecord.diagnosis}
                    </p>
                  )}
                  {selectedRecord.findings && (
                    <p>
                      <strong>Findings:</strong> {selectedRecord.findings}
                    </p>
                  )}
                  {selectedRecord.treatment && (
                    <p>
                      <strong>Treatment Notes:</strong> {selectedRecord.treatment}
                    </p>
                  )}
                </div>

                {(() => {
                  let medItems: any[] = [];
                  if (selectedRecord.medications_json) {
                    try {
                      medItems = JSON.parse(selectedRecord.medications_json);
                    } catch {
                      medItems = [];
                    }
                  }
                  if (!medItems.length && selectedRecord.medication) {
                    medItems = [
                      {
                        name: selectedRecord.medication,
                        quantity: selectedRecord.medication_qty || 1,
                        unit: "unit",
                      },
                    ];
                  }

                  if (!medItems.length) return null;

                  return (
                    <div className="space-y-1.5 border-t pt-2">
                      <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                        Prescribed Medication & Products
                      </h4>
                      <div className="rounded-md border p-2 bg-muted/20 space-y-1.5 text-xs">
                        {medItems.map((m: any, idx: number) => (
                          <div key={idx} className="flex items-center justify-between py-1 border-b last:border-0">
                            <div>
                              <span className="font-semibold text-foreground">{m.name}</span>
                              {m.notes && <span className="text-muted-foreground text-[11px] block">{m.notes}</span>}
                            </div>
                            <Badge variant="secondary" className="font-mono text-xs">
                              {m.quantity} {m.unit || "unit"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {selectedRecord.vaccine_used && (
                  <div className="space-y-1.5 border-t pt-2">
                    <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                      Vaccination History
                    </h4>
                    <p>
                      <strong>Vaccine Administered:</strong> {selectedRecord.vaccine_used}
                    </p>
                    <p className="text-brand-navy font-medium">
                      <strong>Next Vaccination Due:</strong>{" "}
                      {selectedRecord.next_vax_due ? formatDate(selectedRecord.next_vax_due) : "N/A"}
                    </p>
                  </div>
                )}

                {selectedRecord.dewormer_used && (
                  <div className="space-y-1.5 border-t pt-2">
                    <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                      Deworming History
                    </h4>
                    <p>
                      <strong>Dewormer Administered:</strong> {selectedRecord.dewormer_used}
                    </p>
                    <p className="text-amber-700 font-medium">
                      <strong>Next Deworming Due:</strong>{" "}
                      {selectedRecord.next_deworming_due ? formatDate(selectedRecord.next_deworming_due) : "N/A"}
                    </p>
                  </div>
                )}

                {selectedRecord.notes && (
                  <div className="space-y-1 border-t pt-2">
                    <h4 className="font-semibold text-xs text-muted-foreground uppercase tracking-wider">
                      Visit Notes
                    </h4>
                    <p className="text-muted-foreground whitespace-pre-wrap">{selectedRecord.notes}</p>
                  </div>
                )}
              </div>

              <DialogFooter className="pt-4 border-t">
                <Button variant="outline" onClick={() => setShowViewModal(false)}>
                  Close
                </Button>
                <Button onClick={() => handlePrint(selectedRecord)}>
                  <Printer className="h-4 w-4 mr-1.5" /> Print Record
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
