"use client";

import { useEffect, useState } from "react";
import { StatsCards } from "@/components/stats-cards";
import { ReservationsTable } from "@/components/reservations-table";
import type { Reservation } from "@/lib/types";

export default function DashboardPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    todayReservations: 0,
    weekReservations: 0,
    pendingReservations: 0,
    occupancyRate: 0,
  });

  const fetchReservations = async () => {
    try {
      const res = await fetch("/api/reservations");
      if (!res.ok) throw new Error("Failed to fetch");
      const text = await res.text();
      const data = text ? JSON.parse(text) : [];
      setReservations(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReservations();
  }, []);

  useEffect(() => {
    if (reservations.length > 0) {
      const today = new Date().toISOString().split("T")[0];
      const weekFromNow = new Date();
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      const weekEnd = weekFromNow.toISOString().split("T")[0];

      const todayCount = reservations.filter(
        (r) => r.course_date === today && r.status !== "cancelled"
      ).length;

      const weekCount = reservations.filter(
        (r) =>
          r.course_date &&
          r.course_date >= today &&
          r.course_date <= weekEnd &&
          r.status !== "cancelled"
      ).length;

      const pendingCount = reservations.filter(
        (r) => r.status === "pending"
      ).length;

      // ✅ Occupancy = (booked rooms / total rooms) * 100
      //    Only CONFIRMED reservations that are not in the past.
      const TOTAL_ROOMS = 10;
      const roomBookings = reservations.filter((r) => {
        const isRoom = Boolean(r.room_id || r.accommodation_type || r.check_in);
        if (!isRoom) return false;
        if (r.status !== "confirmed") return false;
        // Ignore past reservations (checkout/date before today)
        const refDate = r.check_out || r.check_in || r.course_date;
        if (refDate && refDate < today) return false;
        return true;
      }).length;
      const occupancy = Math.min(
        Math.round((roomBookings / TOTAL_ROOMS) * 100),
        100
      );

      setStats({
        todayReservations: todayCount,
        weekReservations: weekCount,
        pendingReservations: pendingCount,
        occupancyRate: occupancy,
      });
    }
  }, [reservations]);

  const handleConfirm = async (id: string) => {
    const res = await fetch(`/api/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "confirmed" }),
    });
    if (!res.ok) {
      alert("Error updating status");
      return;
    }
    fetchReservations();
  };

  const handleCancel = async (id: string) => {
    const res = await fetch(`/api/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "cancelled" }),
    });
    if (!res.ok) {
      alert("Error updating status");
      return;
    }
    fetchReservations();
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">{error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of your surf school and accommodation bookings
        </p>
      </div>

      <StatsCards
        todayReservations={stats.todayReservations}
        weekReservations={stats.weekReservations}
        pendingReservations={stats.pendingReservations}
        occupancyRate={stats.occupancyRate}
      />

      <ReservationsTable
        reservations={reservations}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
}
