"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Search, Phone, Mail, Instagram, User } from "lucide-react";
import type { Customer, Reservation } from "@/lib/types";

// Safe fetcher: never call res.json() directly — guard against empty/invalid bodies.
const fetcher = async (url: string) => {
  const res = await fetch(url);
  const text = await res.text();
  return text ? JSON.parse(text) : [];
};

export default function CustomersPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<
    (Customer & { reservations?: Reservation[] }) | null
  >(null);

  const { data: customers, error } = useSWR<Customer[]>(
    `/api/customers${searchTerm ? `?search=${searchTerm}` : ""}`,
    fetcher
  );

  const handleViewCustomer = async (customerId: string) => {
    const response = await fetch(`/api/customers/${customerId}`);
    const text = await response.text();
    const data = text ? JSON.parse(text) : null;
    setSelectedCustomer(data);
  };

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-destructive">Failed to load customers</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Customers</h1>
        <p className="text-muted-foreground">
          View and manage customer information
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Customers Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {!customers || customers.length === 0 ? (
          <Card className="col-span-full">
            <CardContent className="flex items-center justify-center py-8">
              <p className="text-muted-foreground">No customers found</p>
            </CardContent>
          </Card>
        ) : (
          customers.map((customer) => (
            <Card key={customer.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">
                        {customer.first_name} {customer.last_name}
                      </CardTitle>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Phone className="h-4 w-4" />
                  {customer.phone}
                </div>
                {customer.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    {customer.email}
                  </div>
                )}
                {customer.instagram_id && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Instagram className="h-4 w-4" />
                    @{customer.instagram_id}
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => handleViewCustomer(customer.id)}
                >
                  View Details
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Customer Detail Dialog */}
      <Dialog
        open={!!selectedCustomer}
        onOpenChange={() => setSelectedCustomer(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Customer Details</DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <div className="space-y-4">
              {/* Customer Info */}
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">
                    {selectedCustomer.first_name} {selectedCustomer.last_name}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Customer since{" "}
                    {new Date(selectedCustomer.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>

              {/* Contact Info */}
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{selectedCustomer.phone}</span>
                </div>
                {selectedCustomer.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedCustomer.email}</span>
                  </div>
                )}
                {selectedCustomer.instagram_id && (
                  <div className="flex items-center gap-2">
                    <Instagram className="h-4 w-4 text-muted-foreground" />
                    <span>@{selectedCustomer.instagram_id}</span>
                  </div>
                )}
              </div>

              {/* Reservations History */}
              <div>
                <h4 className="font-medium mb-3">Booking History</h4>
                {!selectedCustomer.reservations ||
                selectedCustomer.reservations.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No bookings yet
                  </p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedCustomer.reservations.map((reservation) => (
                      <div
                        key={reservation.id}
                        className="rounded-lg border p-3 text-sm"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            {reservation.course?.name ||
                              `${reservation.accommodation_type} Room`}
                          </span>
                          <span
                            className={`text-xs px-2 py-1 rounded ${
                              reservation.status === "confirmed"
                                ? "bg-green-100 text-green-800"
                                : reservation.status === "pending"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {reservation.status}
                          </span>
                        </div>
                        <p className="text-muted-foreground">
                          Rs. {reservation.total_price.toLocaleString()}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
