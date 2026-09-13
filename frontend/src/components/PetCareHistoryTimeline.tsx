"use client";

import { useRows } from "@/hooks/useRows";
import { formatDate } from "@/lib/age";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { Loader2, Calendar, Stethoscope } from "lucide-react";

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
      return "bg-[#E8EEF4] text-[#1B3A5C] border-[#1B3A5C]/30 font-semibold";
    case "treatment":
      return "bg-[#E8F6F6] text-[#1FA8A8] border-[#1FA8A8]/30 font-semibold";
    case "deworming":
      return "bg-amber-50 text-amber-900 border-amber-300 font-semibold";
    case "checkup":
    default:
      return "bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold";
  }
}

function TimelineField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xs text-slate-800 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

export default function PetCareHistoryTimeline({ petId }: { petId: string }) {
  const { data: careRecords = [], isLoading } = useRows<any>("care_records", {
    orderBy: "date",
    ascending: false,
  });

  const petRecords = careRecords.filter((r) => r.pet_id === petId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-[#1FA8A8]" />
      </div>
    );
  }

  if (!petRecords.length) {
    return (
      <EmptyState
        icon={Stethoscope}
        title="No care records yet"
        description="No medical services have been recorded for this pet."
      />
    );
  }

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-gradient-to-b before:from-[#1FA8A8] before:to-[#1B3A5C]/20">
      {petRecords.map((r) => {
        const title =
          r.diagnosis || r.vaccine_used || r.treatment || r.dewormer_used || r.chief_complaint || "Medical Service";

        let parsedMeds: Array<{ name?: string; quantity?: number; unit?: string; notes?: string }> = [];
        try {
          if (r.medications_json) parsedMeds = JSON.parse(r.medications_json);
        } catch {
          parsedMeds = [];
        }

        return (
          <div key={r.id} className="relative group">
            <div className="absolute -left-[23px] top-1.5 h-4 w-4 rounded-full border-2 border-[#1FA8A8] bg-white flex items-center justify-center shadow-xs group-hover:scale-110 transition-transform">
              <div className="h-1.5 w-1.5 rounded-full bg-[#1FA8A8]" />
            </div>

            <div className="bg-card p-4 rounded-xl border border-border/80 shadow-xs hover:shadow-md hover:border-[#1FA8A8]/40 transition-all space-y-3">
              <div className="flex items-center justify-between gap-2 border-b pb-2">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5 text-[#1FA8A8]" /> {r.date ? formatDate(r.date) : "—"}
                </span>
                <Badge variant="outline" className={getCareTypeBadgeClass(r.record_type)}>
                  {formatCareTypeLabel(r.record_type)}
                </Badge>
              </div>

              <p className="font-heading font-bold text-sm text-[#1B3A5C]">{title}</p>

              {r.vet && (
                <p className="text-xs text-muted-foreground">
                  Attending Vet / Staff: <span className="text-[#1B3A5C] font-semibold">{r.vet}</span>
                </p>
              )}

              <div className="grid gap-3 sm:grid-cols-2">
                <TimelineField label="Chief Complaint / Reason" value={r.chief_complaint} />
                <TimelineField label="Symptoms" value={r.symptoms} />
                <TimelineField label="Diagnosis" value={r.diagnosis} />
                <TimelineField label="Clinical Findings" value={r.findings} />
                <TimelineField label="Treatment Notes" value={r.treatment} />
                <TimelineField label="Additional Notes" value={r.notes} />
              </div>

              {r.medication && (
                <p className="text-xs text-muted-foreground bg-slate-50 p-2 rounded-lg border">
                  Medicine prescribed: <span className="text-[#1B3A5C] font-semibold">{r.medication}</span>
                  {r.medication_qty ? ` (Qty: ${r.medication_qty})` : ""}
                </p>
              )}

              {parsedMeds.length > 0 && (
                <div className="rounded-lg bg-[#E8EEF4]/70 p-3 space-y-1.5 border border-[#1B3A5C]/10">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-[#1B3A5C]">
                    Prescribed Medications & Products
                  </p>
                  {parsedMeds.map((med, i) => (
                    <p key={i} className="text-xs text-slate-800 font-medium">
                      • {med.name || "Product"} — {med.quantity ?? 1} {med.unit || "unit"}
                      {med.notes ? ` · ${med.notes}` : ""}
                    </p>
                  ))}
                </div>
              )}

              {r.next_vax_due && (
                <p className="text-xs text-[#1FA8A8] font-bold">
                  Next vaccination due: {formatDate(r.next_vax_due)}
                </p>
              )}

              {r.next_deworming_due && (
                <p className="text-xs text-amber-800 font-bold">
                  Next deworming due: {formatDate(r.next_deworming_due)}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
