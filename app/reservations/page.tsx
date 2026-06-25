"use client";

import { useState } from "react";
import useSWR from "swr";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, X, Eye, Search, Filter } from "lucide-react";
import type { Reservation } from "@/lib/types";

const fetcher = async (url: string) => {
  const res = await fetch(url);
  const data = await res.json();
  // If the API returns an error object, return empty array
  if (data?.error || !Array.isArray(data)) {
    return [];
  }
  return data;
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200",
  completed: "bg-blue-100 text-blue-800 border-blue-200",
};

export default function ReservationsPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedReservation, setSelectedReservation] =
    useState<Reservation | null>(null);

  const queryParams = new URLSearchParams();
  if (statusFilter !== "all") {
    queryParams.set("status", statusFilter);
  }

  const {
    data: reservations,
    error,
    mutate,
  } = useSWR<Reservation[]>(
    `/api/reservations?${queryParams.toString()}`,
    fetcher
  );

  const filteredReservations = reservations?.filter((r) => {
    if (!searchTerm) return true;
    const customerName =
      `${r.customer?.first_name} ${r.customer?.last_name}`.toLowerCase();
    const phone = r.customer?.phone?.toLowerCase() || "";
    return (
      customerName.includes(searchTerm.toLowerCase()) ||
      phone.includes(searchTerm.toLowerCase())
    );
  });

  const handleStatusChange = async (id: string, newStatus: string) => {
    await fetch(`/api/reservations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    mutate();
    setSelectedReservation(null);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Failed to load reservations</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reservations</h1>
        <p className="text-muted-foreground">
          Manage all surf lessons and accommodation bookings
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by customer name or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Reservations List */}
      <Card>
        <CardHeader>
          <CardTitle>
            All Reservations ({filteredReservations?.length || 0})
          </CardTitle>
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
                {!filteredReservations || filteredReservations.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="py-8 text-center text-muted-foreground"
                    >
                      No reservations found
                    </td>
                  </tr>
                ) : (
                  filteredReservations.map((reservation) => (
                    <tr key={reservation.id} className="text-sm">
                      <td className="py-3">
                        <div>
                          <p className="font-medium">
                            {reservation.customer?.first_name}{" "}
                            {reservation.customer?.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {reservation.customer?.phone}
                          </p>
                        </div>
                      </td>
                      <td className="py-3">
                        <div>
                          {reservation.course && (
                            <p className="font-medium">
                              {reservation.course.name}
                            </p>
                          )}
                          {reservation.accommodation_type && (
                            <p className="text-xs text-muted-foreground capitalize">
                              + {reservation.accommodation_type} room
                            </p>
                          )}
                          {!reservation.course &&
                            reservation.accommodation_type && (
                              <p className="font-medium capitalize">
                                {reservation.accommodation_type} room
                              </p>
                            )}
                        </div>
                      </td>
                      <td className="py-3">
                        {reservation.course_date && (
                          <div>
                            <p>
                              {format(
                                new Date(reservation.course_date),
                                "MMM d, yyyy"
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {reservation.course_time}
                            </p>
                          </div>
                        )}
                        {!reservation.course_date && reservation.check_in && (
                          <div>
                            <p>
                              {format(new Date(reservation.check_in), "MMM d")}{" "}
                              -{" "}
                              {format(
                                new Date(reservation.check_out!),
                                "MMM d"
                              )}
                            </p>
                          </div>
                        )}
                      </td>
                      <td className="py-3">
                        <p>{reservation.number_of_people} person(s)</p>
                        {reservation.number_of_non_swimmers > 0 && (
                          <p className="text-xs text-orange-600">
                            {reservation.number_of_non_swimmers} non-swimmer(s)
                          </p>
                        )}
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
                        Rs. {reservation.total_price.toLocaleString()}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setSelectedReservation(reservation)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {reservation.status === "pending" && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-green-600 hover:text-green-700"
                                onClick={() =>
                                  handleStatusChange(
                                    reservation.id,
                                    "confirmed"
                                  )
                                }
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700"
                                onClick={() =>
                                  handleStatusChange(
                                    reservation.id,
                                    "cancelled"
                                  )
                                }
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

      {/* Reservation Detail Dialog */}
      <Dialog
        open={!!selectedReservation}
        onOpenChange={() => setSelectedReservation(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reservation Details</DialogTitle>
          </DialogHeader>
          {selectedReservation && (
            <div className="space-y-4">
              {/* Customer Info */}
              <div className="rounded-lg bg-muted p-4">
                <h4 className="font-medium mb-2">Customer</h4>
                <p>
                  {selectedReservation.customer?.first_name}{" "}
                  {selectedReservation.customer?.last_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedReservation.customer?.phone}
                </p>
                {selectedReservation.customer?.email && (
                  <p className="text-sm text-muted-foreground">
                    {selectedReservation.customer.email}
                  </p>
                )}
              </div>

              {/* Service Info */}
              <div className="rounded-lg bg-muted p-4">
                <h4 className="font-medium mb-2">Service</h4>
                {selectedReservation.course && (
                  <div>
                    <p className="font-medium">
                      {selectedReservation.course.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {selectedReservation.course.duration} -{" "}
                      {selectedReservation.course_date &&
                        format(
                          new Date(selectedReservation.course_date),
                          "MMMM d, yyyy"
                        )}{" "}
                      at {selectedReservation.course_time}
                    </p>
                  </div>
                )}
                {selectedReservation.accommodation_type && (
                  <div className="mt-2">
                    <p className="capitalize">
                      {selectedReservation.accommodation_type} Accommodation
                    </p>
                    {selectedReservation.check_in && (
                      <p className="text-sm text-muted-foreground">
                        {format(
                          new Date(selectedReservation.check_in),
                          "MMM d"
                        )}{" "}
                        -{" "}
                        {format(
                          new Date(selectedReservation.check_out!),
                          "MMM d, yyyy"
                        )}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Booking Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-muted p-4">
                  <h4 className="font-medium mb-1">People</h4>
                  <p>{selectedReservation.number_of_people} person(s)</p>
                  {selectedReservation.number_of_non_swimmers > 0 && (
                    <p className="text-sm text-orange-600">
                      {selectedReservation.number_of_non_swimmers}{" "}
                      non-swimmer(s)
                    </p>
                  )}
                </div>
                <div className="rounded-lg bg-muted p-4">
                  <h4 className="font-medium mb-1">Total</h4>
                  <p className="text-lg font-bold">
                    Rs. {selectedReservation.total_price.toLocaleString()}
                  </p>
                </div>
              </div>

              {/* Special Requests */}
              {selectedReservation.special_requests && (
                <div className="rounded-lg bg-muted p-4">
                  <h4 className="font-medium mb-2">Special Requests</h4>
                  <p className="text-sm">
                    {selectedReservation.special_requests}
                  </p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-4">
                {selectedReservation.status === "pending" && (
                  <>
                    <Button
                      className="flex-1"
                      onClick={() =>
                        handleStatusChange(selectedReservation.id, "confirmed")
                      }
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Confirm
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() =>
                        handleStatusChange(selectedReservation.id, "cancelled")
                      }
                    >
                      <X className="mr-2 h-4 w-4" />
                      Cancel
                    </Button>
                  </>
                )}
                {selectedReservation.status === "confirmed" && (
                  <Button
                    className="flex-1"
                    onClick={() =>
                      handleStatusChange(selectedReservation.id, "completed")
                    }
                  >
                    Mark as Completed
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
