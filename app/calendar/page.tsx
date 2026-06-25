"use client";

import { useState } from "react";
import useSWR from "swr";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { Reservation } from "@/lib/types";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  if (data?.error || !Array.isArray(data)) return [];
  return data;
};

// ── Deterministic color from customer name ────────────────────────────────────
const CUSTOMER_COLORS = [
  "bg-blue-100 text-blue-800 border-l-blue-500",
  "bg-purple-100 text-purple-800 border-l-purple-500",
  "bg-emerald-100 text-emerald-800 border-l-emerald-500",
  "bg-orange-100 text-orange-800 border-l-orange-500",
  "bg-rose-100 text-rose-800 border-l-rose-500",
  "bg-teal-100 text-teal-800 border-l-teal-500",
  "bg-yellow-100 text-yellow-800 border-l-yellow-500",
  "bg-indigo-100 text-indigo-800 border-l-indigo-500",
  "bg-pink-100 text-pink-800 border-l-pink-500",
  "bg-cyan-100 text-cyan-800 border-l-cyan-500",
];

function customerColor(r: Reservation): string {
  const key = `${r.customer?.first_name ?? ""}${r.customer?.last_name ?? ""}${r.customer_id ?? ""}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return CUSTOMER_COLORS[hash % CUSTOMER_COLORS.length];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
const getBookingType = (r: Reservation) => {
  const hasCourse = !!r.course_id;
  const hasRoom = !!r.room_id || !!r.accommodation_type;
  if (hasCourse && hasRoom) return "Surf + Stay";
  if (hasCourse) return "Surf";
  if (hasRoom) return "Accommodation";
  return "Unknown";
};

interface DayModalProps {
  date: Date;
  reservations: Reservation[];
  onClose: () => void;
}

function DayModal({ date, reservations, onClose }: DayModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold text-foreground">
            {format(date, "EEEE, MMMM d")}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-2">
          {reservations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No reservations</p>
          ) : (
            reservations.map((r) => (
              <div
                key={r.id}
                className={`rounded-lg border-l-2 p-3 text-sm ${customerColor(r)}`}
              >
                <div className="font-semibold">
                  {r.customer?.first_name} {r.customer?.last_name}
                </div>
                <div className="mt-0.5 text-xs opacity-80">
                  {getBookingType(r)}
                  {r.course_time ? ` · ${r.course_time}` : ""}
                  {/* FIX 5: show people count */}
                  {r.number_of_people ? ` · ${r.number_of_people} people` : ""}
                </div>
                <div className="mt-0.5 text-xs opacity-70">
                  {r.course?.name || (r.accommodation_type ? `${r.accommodation_type} room` : "")}
                  {/* FIX 6: show non-swimmer split in modal */}
                  {(r.number_of_non_swimmers ?? 0) > 0 && r.number_of_people && (
                    <span className="ml-1 text-rose-600">
                      ({r.number_of_people - r.number_of_non_swimmers!} group + {r.number_of_non_swimmers} private)
                    </span>
                  )}
                </div>
                <Badge
                  variant="secondary"
                  className="mt-1 text-[10px] px-1.5 py-0 capitalize"
                >
                  {r.status}
                </Badge>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [modal, setModal] = useState<{ date: Date; reservations: Reservation[] } | null>(null);
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });

  const { data: reservations = [] } = useSWR<Reservation[]>("/api/reservations", fetcher);

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // ── Course duration helpers ──────────────────────────────────────────────────
  const getSurfEndDate = (r: Reservation): string | null => {
    if (r.surf_end_date) return r.surf_end_date;
    if (!r.course_date) return null;
    const name = r.course?.name ?? "";
    let days = 1;
    if (name.includes("3 Day")) days = 3;
    else if (name.includes("5 Day")) days = 5;
    if (days <= 1) return r.course_date;
    const start = new Date(r.course_date + "T00:00:00");
    start.setDate(start.getDate() + days - 1);
    return start.toISOString().split("T")[0];
  };

  // Surf active on date: course_date <= date <= surf_end_date
  const isSurfActiveOnDay = (r: Reservation, dateStr: string): boolean => {
    if (!r.course_id || !r.course_date) return false;
    const end = getSurfEndDate(r) ?? r.course_date;
    return r.course_date <= dateStr && dateStr <= end;
  };

  // Accommodation active on date: check_in <= date < check_out (blocks check_in through day before check_out)
  const isAccActiveOnDay = (r: Reservation, date: Date, dateStr: string): boolean => {
    if (!r.check_in || !r.check_out) return false;
    const ci = new Date(r.check_in + "T00:00:00");
    const co = new Date(r.check_out + "T00:00:00");
    return ci <= date && date < co;
  };

  // Surf reservations: records that have a course_id active on this day
  const getSurfReservationsForDay = (date: Date): Reservation[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    return reservations.filter((r) => r.course_id && isSurfActiveOnDay(r, dateStr));
  };

  // Accommodation reservations: records that have check_in/check_out (regardless of whether they also have a course)
  // This ensures Surf+Stay accommodation records appear in the Stay row.
  const getAccReservationsForDay = (date: Date): Reservation[] => {
    const dateStr = format(date, "yyyy-MM-dd");
    return reservations.filter(
      (r) => !r.course_id && (r.room_id || r.accommodation_type) && isAccActiveOnDay(r, date, dateStr)
    );
  };

  const getReservationsForDay = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    return reservations.filter(
      (r) =>
        (r.course_id && isSurfActiveOnDay(r, dateStr)) ||
        (!r.course_id && (r.room_id || r.accommodation_type) && isAccActiveOnDay(r, date, dateStr))
    );
  };

  const MAX_VISIBLE = 3;
  const timeSlots = ["08:00", "10:00"];

  // FIX 5: show people count; FIX 6: split private/non-swimmers entries
  const ReservationCard = ({ r, overrideLabel, overrideCount }: {
    r: Reservation;
    overrideLabel?: string;
    overrideCount?: number;
  }) => {
    const displayName = `${r.customer?.first_name ?? ""} ${(r.customer?.last_name ?? "").charAt(0)}.`.trim();
    const count = overrideCount ?? r.number_of_people ?? null;
    const label = overrideLabel ?? r.course?.name ?? (r.accommodation_type ? `${r.accommodation_type} room` : "");
    return (
      <div className={`mb-1 p-1.5 rounded text-xs border-l-2 ${customerColor(r)}`}>
        <div className="font-medium truncate">
          {displayName}{count ? ` - ${count}` : ""}
        </div>
        <div className="truncate opacity-70">{label}</div>
      </div>
    );
  };

  // FIX 6: expand a surf reservation into separate group + private entries if mixed
  const expandSurfCards = (r: Reservation): { r: Reservation; label?: string; count?: number }[] => {
    const nonSwimmers = r.number_of_non_swimmers ?? 0;
    const total = r.number_of_people ?? 1;
    const swimmers = total - nonSwimmers;
    if (nonSwimmers > 0 && swimmers > 0) {
      return [
        { r, label: r.course?.name ?? "Group Lesson", count: swimmers },
        { r, label: "Private Lesson (non-swimmers)", count: nonSwimmers },
      ];
    }
    if (nonSwimmers > 0 && swimmers === 0) {
      return [{ r, label: "Private Lesson", count: nonSwimmers }];
    }
    return [{ r, label: r.course?.name, count: total }];
  };

  const MoreButton = ({ date, all }: { date: Date; all: Reservation[] }) => (
    <button
      className="w-full rounded px-1 py-0.5 text-left text-xs font-medium text-primary hover:bg-primary/10"
      onClick={() => setModal({ date, reservations: all })}
    >
      +{all.length - MAX_VISIBLE} more
    </button>
  );

  return (
    <div className="space-y-4 md:space-y-6">
      {modal && (
        <DayModal
          date={modal.date}
          reservations={modal.reservations}
          onClose={() => setModal(null)}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground md:text-2xl">Calendar</h1>
          <p className="text-sm text-muted-foreground">Weekly view of all reservations</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(addDays(currentDate, -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" onClick={() => setCurrentDate(new Date())}>Today</Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(addDays(currentDate, 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base md:text-lg">
            {format(weekStart, "MMMM d")} – {format(addDays(weekStart, 6), "MMMM d, yyyy")}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <div className="grid grid-cols-8 min-w-[640px]">

              {/* Header row */}
              <div className="p-2 border-b border-r text-xs font-medium text-muted-foreground">Time</div>
              {weekDays.map((day) => (
                <div
                  key={day.toISOString()}
                  className={`p-2 border-b text-center ${isSameDay(day, new Date()) ? "bg-primary/10 font-bold" : ""}`}
                >
                  <div className="text-xs text-muted-foreground">{format(day, "EEE")}</div>
                  <div className="text-sm md:text-lg">{format(day, "d")}</div>
                </div>
              ))}

              {/* Time slot rows — surf reservations (multi-day courses block all days) */}
              {timeSlots.map((time) => (
                <>
                  <div key={`time-${time}`} className="p-2 border-r border-b text-xs font-medium">{time}</div>
                  {weekDays.map((day) => {
                    const all = getSurfReservationsForDay(day).filter(
                      (r) => r.course_time === time || !r.course_time
                    );
                    const visible = all.slice(0, MAX_VISIBLE);
                    return (
                      <div
                        key={`${day.toISOString()}-${time}`}
                        className="p-1 border-b min-h-20 cursor-pointer hover:bg-muted/30"
                        onClick={() => all.length > 0 && setModal({ date: day, reservations: all })}
                      >
                        {/* FIX 5&6: expand mixed groups into separate cards */}
                        {visible.flatMap((r) => expandSurfCards(r)).slice(0, MAX_VISIBLE).map((entry, i) => (
                          <ReservationCard key={`${entry.r.id}-${i}`} r={entry.r} overrideLabel={entry.label} overrideCount={entry.count} />
                        ))}
                        {all.length > MAX_VISIBLE && (
                          <MoreButton date={day} all={all} />
                        )}
                      </div>
                    );
                  })}
                </>
              ))}

              {/* Accommodation row — blocks check_in through day before check_out */}
              <div className="p-2 border-r text-xs font-medium">Stay</div>
              {weekDays.map((day) => {
                const all = getAccReservationsForDay(day);
                const visible = all.slice(0, MAX_VISIBLE);
                return (
                  <div
                    key={`acc-${day.toISOString()}`}
                    className="p-1 min-h-14 cursor-pointer hover:bg-muted/30"
                    onClick={() => all.length > 0 && setModal({ date: day, reservations: all })}
                  >
                    {visible.map((r) => <ReservationCard key={r.id} r={r} />)}
                    {all.length > MAX_VISIBLE && (
                      <MoreButton date={day} all={all} />
                    )}
                  </div>
                );
              })}

            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
