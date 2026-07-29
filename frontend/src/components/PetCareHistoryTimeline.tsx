"use client";

import { useRows } from "@/hooks/useRows";
import { formatDate } from "@/lib/age";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calendar } from "lucide-react";

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
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "treatment":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "deworming":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "checkup":
    default:
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
  }
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
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (!petRecords.length) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        No medical services recorded for this pet yet.
      </div>
    );
  }

  return (
    <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
      {petRecords.map((r) => {
        const title =
          r.diagnosis || r.vaccine_used || r.treatment || r.dewormer_used || r.chief_complaint || "Medical Service";

        return (
          <div key={r.id} className="relative group">
            {/* Timeline node icon */}
            <div className="absolute -left-[23px] top-0.5 h-4 w-4 rounded-full border-2 border-primary bg-background flex items-center justify-center group-hover:scale-110 transition-transform">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            </div>

            <div className="bg-card p-3 rounded-lg border shadow-2xs space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {r.date ? formatDate(r.date) : "—"}
                </span>
                <Badge variant="outline" className={getCareTypeBadgeClass(r.record_type)}>
                  {formatCareTypeLabel(r.record_type)}
                </Badge>
              </div>

              <p className="font-semibold text-sm text-foreground">{title}</p>

              {r.vet && (
                <p className="text-xs text-muted-foreground">
                  <strong>Vet / Staff:</strong> {r.vet}
                </p>
              )}

              {r.medication && (
                <p className="text-xs text-muted-foreground">
                  <strong>Medicine Prescribed:</strong> {r.medication} (Qty: {r.medication_qty || 1})
                </p>
              )}

              {r.next_vax_due && (
                <p className="text-xs text-blue-700 font-medium">
                  <strong>Next Vaccination Due:</strong> {formatDate(r.next_vax_due)}
                </p>
              )}

              {r.next_deworming_due && (
                <p className="text-xs text-amber-700 font-medium">
                  <strong>Next Deworming Due:</strong> {formatDate(r.next_deworming_due)}
                </p>
              )}

              {r.notes && (
                <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded mt-1 whitespace-pre-wrap">
                  {r.notes}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
