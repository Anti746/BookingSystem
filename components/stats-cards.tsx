"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, Users, Clock, Home } from "lucide-react";

interface StatsCardsProps {
  todayReservations: number;
  weekReservations: number;
  pendingReservations: number;
  occupancyRate: number;
}

export function StatsCards({
  todayReservations,
  weekReservations,
  pendingReservations,
  occupancyRate,
}: StatsCardsProps) {
  const stats = [
    {
      title: "Today's Lessons",
      value: todayReservations,
      icon: CalendarDays,
      description: "Scheduled for today",
    },
    {
      title: "This Week",
      value: weekReservations,
      icon: Users,
      description: "Total bookings",
    },
    {
      title: "Pending",
      value: pendingReservations,
      icon: Clock,
      description: "Awaiting confirmation",
    },
    {
      title: "Occupancy",
      value: `${occupancyRate}%`,
      icon: Home,
      description: "Room occupancy rate",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.title}
              </CardTitle>
              <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
              <p className="text-xs text-muted-foreground">{stat.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
