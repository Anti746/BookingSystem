import { courses, accommodationTypes } from "@/lib/mock-data";
export { ROOM_INVENTORY } from "@/lib/room-inventory";
import { ROOM_INVENTORY } from "@/lib/room-inventory";

// Mutable accommodation store — changes (price edits, adds, deletes) persist
// within the server process so the chatbot always uses up-to-date prices.
export const mockAccommodationTypes: {
  id: string;
  name: string;
  type: string;
  description: string | null;
  has_ac: boolean;
  price_per_night: number;
  created_at?: string;
}[] = accommodationTypes.map((a) => ({
  id: a.id,
  name: a.name,
  type: a.type,
  description: null,
  has_ac: a.hasAC,
  price_per_night: a.pricePerNight,
  created_at: new Date().toISOString(),
}));

export const hasSupabase = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

type MockReservation = {
  id: string;
  customer_id: string;
  customer: { id: string; first_name: string; last_name: string; email: string; phone: string };
  course_id: string | null;
  course: typeof courses[0] | null;
  course_date: string | null;
  surf_end_date: string | null;
  course_time: string | null;
  accommodation_type: string | null;
  room_id: string | null;
  check_in: string | null;
  check_out: string | null;
  number_of_people: number;
  number_of_non_swimmers: number;
  special_requests: string | null;
  total_price: number;
  status: string;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
};

export const mockReservations: MockReservation[] = [];

type MockCustomer = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  instagram_id: string | null;
  created_at: string;
  [key: string]: unknown;
};

export const mockCustomers: MockCustomer[] = [];

type MockInstructor = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  max_students_per_session: number;
  created_at: string;
  updated_at: string;
  [key: string]: unknown;
};

export const mockInstructors: MockInstructor[] = [];

export function generateId(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Count how many rooms of a given type are booked across a date range.
 * A room is booked on a night if check_in <= night < check_out.
 */
export function countBookedRooms(
  roomType: string,
  checkIn: string,
  checkOut: string
): number {
  let maxOverlap = 0;

  const nights: string[] = [];
  const cursor = new Date(checkIn + "T00:00:00");
  const end = new Date(checkOut + "T00:00:00");
  while (cursor < end) {
    nights.push(cursor.toISOString().split("T")[0]);
    cursor.setDate(cursor.getDate() + 1);
  }

  for (const night of nights) {
    const overlap = mockReservations.filter((r) => {
      if (r.status === "cancelled") return false;
      if (r.accommodation_type !== roomType) return false;
      if (!r.check_in || !r.check_out) return false;
      return r.check_in <= night && night < r.check_out;
    }).length;
    if (overlap > maxOverlap) maxOverlap = overlap;
  }

  return maxOverlap;
}

/**
 * Returns the number of rooms still available for the given type and date range.
 */
export function getAvailableRooms(
  roomType: string,
  checkIn: string,
  checkOut: string
): number {
  const total = ROOM_INVENTORY[roomType] ?? 0;
  const booked = countBookedRooms(roomType, checkIn, checkOut);
  return Math.max(0, total - booked);
}
