import { NextResponse } from "next/server";
import { accommodationTypes } from "@/lib/mock-data";
import { ROOM_INVENTORY } from "@/lib/room-inventory";
import { getAvailableRooms } from "@/lib/mock-store";

// Check if Supabase is configured
const hasSupabase = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Maximum number of people allowed per day for surf courses
const DAILY_CAPACITY = 20;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date");
  const type = searchParams.get("type"); // 'room' or omit for surf capacity
  const accommodationType = searchParams.get("accommodation_type");
  // For range-based room queries (check-in + check-out)
  const checkIn = searchParams.get("check_in") || date;
  const checkOut = searchParams.get("check_out") || (date ? (() => {
    // Default: treat single date as a 1-night stay (checkOut = date + 1 day)
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  })() : null);

  // For room range queries (check_in + check_out), date is not required
  if (!date && !(type === "room" && checkIn && checkOut)) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  // If Supabase is configured, use it
  if (hasSupabase) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

      // ----- Accommodation (rooms) -----
      if (type === "room") {
        // Build room type filter
        let roomTypesToCheck: string[] = accommodationType
          ? [accommodationType]
          : ["standard", "superior", "premium"];

        // For each room type, count overlapping reservations across the date range
        const result = roomTypesToCheck.flatMap((rt) => {
          // Get total rooms from DB or fall back to ROOM_INVENTORY
          const totalRooms = ROOM_INVENTORY[rt] ?? 0;
          return Array.from({ length: totalRooms }, (_, idx) => ({
            room: {
              id: `${rt}-${idx + 1}`,
              name: `${rt.charAt(0).toUpperCase() + rt.slice(1)} Room ${idx + 1}`,
              accommodation_type: accommodationTypes.find((a) => a.type === rt),
            },
            available: true, // Supabase path: compute properly below
          }));
        });

        // Use real Supabase data for overlap count
        const ci = checkIn!;
        const co = checkOut!;

        const { data: overlapping } = await supabase
          .from("reservations")
          .select("room_id, accommodation_type, check_in, check_out")
          .neq("status", "cancelled")
          .not("check_in", "is", null)
          .not("check_out", "is", null)
          .lt("check_in", co)
          .gt("check_out", ci);

        // Count per type
        const bookedCountByType: Record<string, number> = {};
        for (const r of overlapping ?? []) {
          const t = r.accommodation_type as string;
          if (t) bookedCountByType[t] = (bookedCountByType[t] ?? 0) + 1;
        }

        const finalResult = roomTypesToCheck.flatMap((rt) => {
          const total = ROOM_INVENTORY[rt] ?? 0;
          const booked = bookedCountByType[rt] ?? 0;
          const freeCount = Math.max(0, total - booked);
          const at = accommodationTypes.find((a) => a.type === rt);
          return Array.from({ length: freeCount }, (_, idx) => ({
            room: {
              id: `${rt}-${idx + 1}`,
              name: `${at?.name ?? rt} Room ${idx + 1}`,
              accommodation_type: at,
            },
            available: true,
          }));
        });

        return NextResponse.json(finalResult);
      }

      // ----- Surf courses: simple daily capacity (max 20 people) -----
      const { data: reservations } = await supabase
        .from("reservations")
        .select("number_of_people, course_date")
        .neq("status", "cancelled")
        .not("course_id", "is", null);

      const currentBookings =
        reservations
          ?.filter((r) => r.course_date === date)
          .reduce((sum, r) => sum + (r.number_of_people || 1), 0) || 0;

      const remainingCapacity = Math.max(0, DAILY_CAPACITY - currentBookings);

      return NextResponse.json({
        available: remainingCapacity > 0,
        remainingCapacity,
      });
    } catch (err) {
      console.error("Supabase error in availability:", err);
      // Fall through to mock response
    }
  }

  // ── Mock fallback ─────────────────────────────────────────────────────────
  if (type === "room") {
    const ci = checkIn!;
    const co = checkOut!;
    const typesToCheck = accommodationType
      ? [accommodationType]
      : Object.keys(ROOM_INVENTORY);

    const mockResult = typesToCheck.flatMap((rt) => {
      const available = getAvailableRooms(rt, ci, co);
      const at = accommodationTypes.find((a) => a.type === rt);
      return Array.from({ length: available }, (_, idx) => ({
        room: {
          id: `${rt}-${idx + 1}`,
          name: `${at?.name ?? rt} Room ${idx + 1}`,
          accommodation_type: at,
        },
        available: true,
      }));
    });

    return NextResponse.json(mockResult);
  }

  // Mock surf availability — use real bookings to count
  const { mockReservations } = await import("@/lib/mock-store");
  const bookedPeople = mockReservations
    .filter((r) => r.status !== "cancelled" && r.course_id && r.course_date === date)
    .reduce((sum, r) => sum + (r.number_of_people || 1), 0);

  const remainingCapacity = Math.max(0, DAILY_CAPACITY - bookedPeople);

  return NextResponse.json({
    available: remainingCapacity > 0,
    remainingCapacity,
  });
}
