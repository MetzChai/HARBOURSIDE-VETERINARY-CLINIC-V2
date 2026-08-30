"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, PawPrint } from "lucide-react";
import { formatDatePH, todayPH, toDateOnly } from "@/lib/datetime";
import { getStatusBadgeClass } from "@/lib/appointment-slots";

interface AppointmentCalendarProps {
  appointments: any[];
  pets: any[];
  owners: any[];
  onSelectAppointment: (appointment: any) => void;
}

type CalendarViewMode = "daily" | "weekly" | "monthly";

function getUtcNoonDate(dateOnlyStr: string): Date {
  const [y, m, d] = dateOnlyStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
}

function formatDateIso(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function AppointmentCalendar({
  appointments = [],
  pets = [],
  owners = [],
  onSelectAppointment,
}: AppointmentCalendarProps) {
  const [viewMode, setViewMode] = useState<CalendarViewMode>("monthly");
  const [currentDateStr, setCurrentDateStr] = useState<string>(todayPH());

  const currentDate = useMemo(() => getUtcNoonDate(currentDateStr), [currentDateStr]);

  const petMap = useMemo(() => new Map(pets.map((p) => [p.id, p])), [pets]);
  const ownerMap = useMemo(() => new Map(owners.map((o) => [o.id, o.name])), [owners]);

  const getPetName = (a: any) => {
    if (a.pet_id && petMap.has(a.pet_id)) return petMap.get(a.pet_id)?.name;
    if (a.notes?.startsWith("Walk-in pet: ")) return a.notes.replace("Walk-in pet: ", "").split(" | ")[0];
    return "Walk-in Pet";
  };

  // Calendar Navigation
  const navigate = (direction: "prev" | "next" | "today") => {
    if (direction === "today") {
      setCurrentDateStr(todayPH());
      return;
    }

    const d = new Date(currentDate);
    if (viewMode === "daily") {
      d.setUTCDate(d.getUTCDate() + (direction === "next" ? 1 : -1));
    } else if (viewMode === "weekly") {
      d.setUTCDate(d.getUTCDate() + (direction === "next" ? 7 : -7));
    } else if (viewMode === "monthly") {
      d.setUTCMonth(d.getUTCMonth() + (direction === "next" ? 1 : -1));
    }
    setCurrentDateStr(formatDateIso(d));
  };

  // Monthly Grid Calculation
  const monthGridDays = useMemo(() => {
    const year = currentDate.getUTCFullYear();
    const month = currentDate.getUTCMonth();

    const firstDayOfMonth = new Date(Date.UTC(year, month, 1, 12, 0, 0));
    const startingDayOfWeek = firstDayOfMonth.getUTCDay(); // 0 = Sun

    const startGridDate = new Date(firstDayOfMonth);
    startGridDate.setUTCDate(startGridDate.getUTCDate() - startingDayOfWeek);

    const days: { dateStr: string; dayNumber: number; isCurrentMonth: boolean; isToday: boolean }[] = [];
    const todayStr = todayPH();

    for (let i = 0; i < 35; i++) {
      const d = new Date(startGridDate);
      d.setUTCDate(d.getUTCDate() + i);
      const dateStr = formatDateIso(d);
      days.push({
        dateStr,
        dayNumber: d.getUTCDate(),
        isCurrentMonth: d.getUTCMonth() === month,
        isToday: dateStr === todayStr,
      });
    }
    return days;
  }, [currentDate]);

  // Weekly Grid Days
  const weekGridDays = useMemo(() => {
    const dayOfWeek = currentDate.getUTCDay();
    const startOfWeek = new Date(currentDate);
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - dayOfWeek);

    const days: { dateStr: string; dayName: string; dayNumber: number; isToday: boolean }[] = [];
    const todayStr = todayPH();

    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setUTCDate(d.getUTCDate() + i);
      const dateStr = formatDateIso(d);
      days.push({
        dateStr,
        dayName: d.toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short" }),
        dayNumber: d.getUTCDate(),
        isToday: dateStr === todayStr,
      });
    }
    return days;
  }, [currentDate]);

  // Index appointments by dateStr
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const a of appointments) {
      const d = toDateOnly(a.date);
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(a);
    }
    return map;
  }, [appointments]);

  const monthLabel = currentDate.toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-brand-teal" />
          <CardTitle className="text-lg font-bold font-heading">{monthLabel}</CardTitle>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Navigation Controls */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-md p-1 border">
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navigate("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={() => navigate("today")}>
              Today
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navigate("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-md p-1 border">
            <Button
              variant={viewMode === "daily" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setViewMode("daily")}
            >
              Daily
            </Button>
            <Button
              variant={viewMode === "weekly" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setViewMode("weekly")}
            >
              Weekly
            </Button>
            <Button
              variant={viewMode === "monthly" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setViewMode("monthly")}
            >
              Monthly
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3">
        {/* MONTHLY VIEW */}
        {viewMode === "monthly" && (
          <div className="space-y-1">
            <div className="grid grid-cols-7 text-center text-xs font-semibold text-muted-foreground py-2 border-b">
              <div>Sun</div>
              <div>Mon</div>
              <div>Tue</div>
              <div>Wed</div>
              <div>Thu</div>
              <div>Fri</div>
              <div>Sat</div>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthGridDays.map((day) => {
                const dayApts = appointmentsByDate.get(day.dateStr) || [];
                return (
                  <div
                    key={day.dateStr}
                    className={`min-h-[100px] p-1.5 rounded-lg border text-xs flex flex-col justify-start transition-colors ${
                      day.isToday
                        ? "bg-primary/5 border-primary/40"
                        : day.isCurrentMonth
                        ? "bg-card hover:bg-accent/40"
                        : "bg-muted/20 text-muted-foreground/50 border-muted/50"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span
                        className={`font-semibold rounded-full w-5 h-5 flex items-center justify-center ${
                          day.isToday ? "bg-primary text-primary-foreground" : ""
                        }`}
                      >
                        {day.dayNumber}
                      </span>
                      {dayApts.length > 0 && (
                        <span className="text-[10px] text-muted-foreground font-mono">{dayApts.length} apts</span>
                      )}
                    </div>

                    <div className="space-y-1 overflow-y-auto max-h-[75px] pr-0.5">
                      {dayApts.slice(0, 3).map((a) => (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => onSelectAppointment(a)}
                          className={`w-full text-left p-1 rounded border text-[11px] font-medium leading-tight truncate hover:opacity-80 transition-opacity bg-background shadow-2xs block ${getStatusBadgeClass(a.status)}`}
                        >
                          <span className="font-semibold">{a.time || "—"}</span> {getPetName(a)}
                        </button>
                      ))}
                      {dayApts.length > 3 && (
                        <p className="text-[10px] text-primary font-medium text-center">
                          +{dayApts.length - 3} more
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* WEEKLY VIEW */}
        {viewMode === "weekly" && (
          <div className="grid grid-cols-7 gap-2">
            {weekGridDays.map((day) => {
              const dayApts = appointmentsByDate.get(day.dateStr) || [];
              return (
                <div
                  key={day.dateStr}
                  className={`min-h-[350px] p-2 rounded-lg border flex flex-col space-y-2 ${
                    day.isToday ? "bg-primary/5 border-primary/40" : "bg-card"
                  }`}
                >
                  <div className="text-center border-b pb-1.5">
                    <span className="text-xs text-muted-foreground block">{day.dayName}</span>
                    <span
                      className={`text-base font-bold inline-block rounded-full w-7 h-7 leading-7 text-center ${
                        day.isToday ? "bg-primary text-primary-foreground" : ""
                      }`}
                    >
                      {day.dayNumber}
                    </span>
                  </div>

                  <div className="flex-1 space-y-1.5 overflow-y-auto">
                    {dayApts.length ? (
                      dayApts.map((a) => (
                        <div
                          key={a.id}
                          onClick={() => onSelectAppointment(a)}
                          className="p-2 rounded-md border text-xs bg-background hover:border-primary/50 cursor-pointer shadow-2xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-primary flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {a.time}
                            </span>
                            <Badge variant="outline" className={`text-[10px] px-1 py-0 ${getStatusBadgeClass(a.status)}`}>
                              {a.status}
                            </Badge>
                          </div>
                          <p className="font-semibold text-foreground truncate">{getPetName(a)}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{a.reason || "Visit"}</p>
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                        No appointments
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* DAILY VIEW */}
        {viewMode === "daily" && (
          <div className="space-y-3 max-w-3xl mx-auto">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="font-bold text-base text-primary">
                Schedule for {formatDatePH(currentDateStr)}
              </h3>
              <Badge variant="outline" className="text-xs">
                {(appointmentsByDate.get(currentDateStr) || []).length} Appointments Total
              </Badge>
            </div>

            {(appointmentsByDate.get(currentDateStr) || []).length ? (
              <div className="space-y-2">
                {(appointmentsByDate.get(currentDateStr) || []).map((a) => (
                  <div
                    key={a.id}
                    onClick={() => onSelectAppointment(a)}
                    className="p-3 rounded-lg border bg-card hover:bg-accent/40 cursor-pointer transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-primary/10 text-primary font-bold px-3 py-2 rounded-lg text-sm font-mono">
                        {a.time}
                      </div>
                      <div>
                        <p className="font-semibold text-base flex items-center gap-2">
                          <PawPrint className="h-4 w-4 text-primary" /> {getPetName(a)}
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-2 mt-0.5">
                          <span>{a.reason || "General Visit"}</span>
                          {a.vet && <span>• Vet: {a.vet}</span>}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className={getStatusBadgeClass(a.status)}>
                        {a.status}
                      </Badge>
                      <Button variant="outline" size="sm" onClick={() => onSelectAppointment(a)}>
                        View Details
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-16 text-center text-muted-foreground border rounded-lg bg-muted/10">
                <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No appointments booked for this date.</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
