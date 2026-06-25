// Chat step types for chatbot flow
export type ChatStep =
  | "welcome"
  | "booking_type"
  | "group_size"
  | "accommodation_people"
  | "large_acc_people"
  | "surf_people"
  | "large_surf_people"
  | "swimming_ability"
  | "surfed_before"
  | "surf_school"
  | "surf_location"
  | "sessions_count"
  | "course_type"
  | "date_selection"
  | "time_selection"
  | "accommodation_type"
  | "child_check"
  | "extra_bed_choice"
  | "extra_room_type"
  | "check_in_date"
  | "check_out_date"
  | "arrival_time"
  | "large_group_size"
  | "non_swimmer_count"
  | "adults_check"
  | "acc_adults_check"
  | "child_count_pre"
  | "child_count"
  | "room_selection"
  | "contact_name"
  | "contact_phone"
  | "contact_email"
  | "contact_preference"
  | "confirmation"
  | "completed";

// Chatbot form data
export interface ReservationFormData {
  serviceType: "surf" | "accommodation" | "both";
  surfedBefore?: boolean;
  surfSchool?: "SurfWala" | "Other";
  surfLocation?: string;
  sessionsCount?: string;
  courseType?: string;
  numberOfPeople?: number;
  numberOfNonSwimmers?: number;
  isSwimmer?: boolean;
  // Surf + Stay split
  accommodationPeople?: number;
  surfPeople?: number;
  date?: string;
  time?: string;
  accommodationType?: string;
  extraRoomType?: string;
  extraBed?: boolean;
  numberOfExtraRooms?: number;
  numberOfRooms?: number;
  hasChildUnder5?: boolean;
  childrenUnder5?: number;
  extraRoomTypes?: string[];
  roomSelectionsLeft?: number;
  hasExtraPerson?: boolean;
  checkIn?: string;
  checkOut?: string;
  arrivalTime?: string;
  name?: string;
  phone?: string;
  email?: string;
  contactPreference?: "WhatsApp" | "Phone call" | "Email";
}

// Database types
export interface Course {
  id: string;
  name: string;
  name_en: string;
  type: "teaser" | "plunge" | "immerse" | "kids" | "private";
  duration: string;
  price: number;
  max_students_per_instructor: number;
  created_at: string;
}

export interface AccommodationType {
  id: string;
  name: string;
  type: "standard" | "superior" | "premium";
  has_ac: boolean;
  description: string | null;
  price_per_night: number;
  created_at: string;
}

export interface Room {
  id: string;
  name: string;
  type_id: string;
  capacity: number;
  is_active: boolean;
  created_at: string;
  accommodation_type?: AccommodationType;
}

export interface Instructor {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  max_students_per_session: number;
  created_at: string;
}

export interface Customer {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string;
  instagram_id: string | null;
  created_at: string;
}

export interface Reservation {
  id: string;
  customer_id: string;
  // Surf course fields
  course_id: string | null;
  instructor_id: string | null;
  course_date: string | null;
  surf_end_date: string | null; // computed: course_date + (duration_days - 1), null for 1-day courses
  course_time: "08:00" | "10:00" | null;
  number_of_people: number;
  number_of_non_swimmers: number;
  // Accommodation fields
  room_id: string | null;
  accommodation_type: "standard" | "superior" | "premium" | null;
  check_in: string | null;
  check_out: string | null;
  // Meta
  status: "pending" | "confirmed" | "cancelled" | "completed";
  special_requests: string | null;
  total_price: number;
  google_calendar_event_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined relations
  customer?: Customer;
  course?: Course;
  instructor?: Instructor;
  room?: Room;
}

export interface InstructorAvailability {
  id: string;
  instructor_id: string;
  date: string;
  time_slot: "08:00" | "10:00";
  is_available: boolean;
  created_at: string;
  instructor?: Instructor;
}

export interface ConversationState {
  id: string;
  instagram_user_id: string;
  current_step: string;
  data_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// API request/response types
export interface CreateReservationRequest {
  customer: {
    first_name: string;
    last_name: string;
    email?: string;
    phone: string;
    instagram_id?: string;
  };
  // Surf course
  course_id?: string;
  course_date?: string;
  course_time?: "08:00" | "10:00";
  number_of_people?: number;
  number_of_non_swimmers?: number;
  // Accommodation
  accommodation_type?: "standard" | "superior" | "premium";
  check_in?: string;
  check_out?: string;
  // Meta
  special_requests?: string;
}

export interface UpdateReservationRequest {
  status?: "pending" | "confirmed" | "cancelled" | "completed";
  instructor_id?: string;
  room_id?: string;
  special_requests?: string;
  total_price?: number;
}

export interface AvailabilityQuery {
  date: string;
  type: "instructor" | "room";
  accommodation_type?: "standard" | "superior" | "premium";
}
