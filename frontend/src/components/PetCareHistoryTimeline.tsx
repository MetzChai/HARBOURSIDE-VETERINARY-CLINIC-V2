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

function TimelineField({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-xs text-foreground whitespace-pre-wrap">{value}</p>
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
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-brand-teal" />
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
    <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-brand-navy/15">
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
          <div key={r.id} className="relative">
            <div className="absolute -left-[23px] top-1.5 h-4 w-4 rounded-full border-2 border-brand-teal bg-card flex items-center justify-center">
              <div className="h-1.5 w-1.5 rounded-full bg-brand-teal" />
            </div>

            <div className="bg-card p-4 rounded-lg border border-border/60 shadow-sm space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {r.date ? formatDate(r.date) : "—"}
                </span>
                <Badge variant="outline" className={getCareTypeBadgeClass(r.record_type)}>
                  {formatCareTypeLabel(r.record_type)}
                </Badge>
              </div>

              <p className="font-heading font-semibold text-sm text-brand-navy">{title}</p>

              {r.vet && (
                <p className="text-xs text-muted-foreground">
                  Veterinarian / Staff: <span className="text-foreground font-medium">{r.vet}</span>
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
                <p className="text-xs text-muted-foreground">
                  Medicine prescribed: <span className="text-foreground">{r.medication}</span>
                  {r.medication_qty ? ` (Qty: ${r.medication_qty})` : ""}
                </p>
              )}

              {parsedMeds.length > 0 && (
                <div className="rounded-md bg-brand-navy-light/50 p-2.5 space-y-1.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-navy">
                    Medication / Products
                  </p>
                  {parsedMeds.map((med, i) => (
                    <p key={i} className="text-xs">
                      {med.name || "Product"} — {med.quantity ?? 1} {med.unit || "unit"}
                      {med.notes ? ` · ${med.notes}` : ""}
                    </p>
                  ))}
                </div>
              )}

              {r.next_vax_due && (
                <p className="text-xs text-brand-navy font-medium">
                  Next vaccination due: {formatDate(r.next_vax_due)}
                </p>
              )}

              {r.next_deworming_due && (
                <p className="text-xs text-amber-800 font-medium">
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
