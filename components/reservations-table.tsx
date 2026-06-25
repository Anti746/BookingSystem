
"use client";

import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Reservation } from "@/lib/types";
import { Check, X, Eye } from "lucide-react";

interface ReservationsTableProps {
  reservations: Reservation[];
  onConfirm?: (id: string) => void | Promise<void>;
  onCancel?: (id: string) => void | Promise<void>;
}

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
  completed: "bg-blue-100 text-blue-800 border-blue-200",
};

export function ReservationsTable({
  reservations,
  onConfirm,
  onCancel,
}: ReservationsTableProps) {
  // ✅ CONFIRM
  const handleConfirm = async (id: string) => {
    if (onConfirm) {
      await onConfirm(id);
      return;
    }

    const res = await fetch(`/api/reservations/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "confirmed" }),
    });

    if (!res.ok) {
      alert("Error updating status");
      return;
    }

    window.location.reload();
  };

  // ✅ CANCEL
  const handleCancel = async (id: string) => {
    if (onCancel) {
      await onCancel(id);
      return;
    }

    const res = await fetch(`/api/reservations/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "cancelled" }),
    });

    if (!res.ok) {
      alert("Error updating status");
      return;
    }

    window.location.reload();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Reservations</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left text-sm text-muted-foreground">
                <th className="pb-3 font-medium">Customer</th>
                <th className="pb-3 font-medium">Service</th>
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">People</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium">Total</th>
                <th className="pb-3 font-medium">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-border">
              {reservations.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-muted-foreground">
                    No reservations found
                  </td>
                </tr>
              ) : (
                reservations.map((reservation) => (
                  <tr key={reservation.id} className="text-sm">
                    <td className="py-3">
                      <p className="font-medium">
                        {reservation.customer?.first_name}{" "}
                        {reservation.customer?.last_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {reservation.customer?.phone}
                      </p>
                    </td>

                    <td className="py-3">
                      {reservation.course?.name || "-"}
                    </td>

                    <td className="py-3">
                      {reservation.course_date
                        ? format(new Date(reservation.course_date), "MMM d, yyyy")
                        : "-"}
                    </td>

                    <td className="py-3">
                      {reservation.number_of_people} person(s)
                    </td>

                    <td className="py-3">
                      <Badge
                        variant="outline"
                        className={statusColors[reservation.status]}
                      >
                        {reservation.status}
                      </Badge>
                    </td>

                    <td className="py-3 font-medium">
                      Rs. {reservation.total_price}
                    </td>

                    <td className="py-3">
                      <div className="flex gap-2">

                        {/* ✅ VIEW (len placeholder) */}
                        <Button size="sm" variant="ghost">
                          <Eye className="h-4 w-4" />
                        </Button>

                        {reservation.status === "pending" && (
                          <>
                            {/* ✅ CONFIRM */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-green-600 hover:text-green-700"
                              onClick={() => handleConfirm(reservation.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>

                            {/* ✅ CANCEL */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleCancel(reservation.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
