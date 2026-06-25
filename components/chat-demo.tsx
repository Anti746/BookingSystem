"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Send, Bot, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { courses, accommodationTypes } from "@/lib/mock-data";
import { ChatStep, ReservationFormData } from "@/lib/types";
import { ROOM_INVENTORY } from "@/lib/room-inventory";

interface Message {
  id: string;
  type: "bot" | "user";
  text: string;
  options?: string[];
}

const BOOKING_TYPES = ["Surf Lessons", "Accommodation", "Surf + Stay Package"];
const DEFAULT_TIME: "08:00" | "10:00" = "08:00";
const TIME_SLOTS: ("08:00" | "10:00")[] = ["08:00", "10:00"];

const initialMessages: Message[] = [
  {
    id: "1",
    type: "bot",
    text: "Hey! Welcome to Surf Wala - Goa's premier surf school! What would you like to book?",
    options: BOOKING_TYPES,
  },
];

interface DayAvailability {
  available: boolean;
  remainingCapacity: number;
}

async function safeFetchJson(input: RequestInfo, init?: RequestInit): Promise<{ ok: boolean; data: any }> {
  const res = await fetch(input, init);
  const text = await res.text();
  let data: any = null;
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }
  return { ok: res.ok, data };
}

// Returns rooms needed for a given number of adults (2 per room)
function calcRooms(adults: number): { rooms: number; hasExtra: boolean } {
  // 1 person fits in 1 room alone — no extra person. Extra only applies for 3,5,7...
  if (adults <= 1) return { rooms: 1, hasExtra: false };
  const rooms = Math.floor(adults / 2);
  const hasExtra = adults % 2 !== 0;
  return { rooms, hasExtra };
}

export function ChatDemo() {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputValue, setInputValue] = useState("");
  const [currentStep, setCurrentStep] = useState<ChatStep>("booking_type");
  const [formData, setFormData] = useState<Partial<ReservationFormData>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [monthOffset, setMonthOffset] = useState(0);
  const [availabilityMap, setAvailabilityMap] = useState<Record<string, DayAvailability>>({});
  // Stores per-type availability for the selected date range: { standard: 2, superior: 1, ... }
  const [rangeRoomAvailability, setRangeRoomAvailability] = useState<Record<string, number>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Live accommodation types from API
  const { data: liveAccTypes } = useSWR<{ id: string; name: string; type: string; price_per_night: number; has_ac: boolean }[]>(
    "/api/accommodation",
    async (url: string) => { const r = await fetch(url); return r.json(); }
  );
  const accTypes = liveAccTypes ?? accommodationTypes.map((a) => ({
    id: a.id, name: a.name, type: a.type, price_per_night: a.pricePerNight, has_ac: a.hasAC,
  }));

  const addMessage = (message: Omit<Message, "id">) => {
    setMessages((prev) => [...prev, { ...message, id: `${Date.now()}-${Math.random()}` }]);
  };

  const resetChat = () => {
    setMessages(initialMessages);
    setCurrentStep("booking_type");
    setFormData({});
    setInputValue("");
    setAvailabilityMap({});
    setRangeRoomAvailability({});
    setMonthOffset(0);
  };

  const getCalendarDates = () => {
    const dates: string[] = [];
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const daysInMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    for (let i = 0; i < daysInMonth; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      if (d >= new Date(now.getFullYear(), now.getMonth(), now.getDate())) {
        dates.push(d.toISOString().split("T")[0]);
      }
    }
    return dates;
  };

  const loadCalendarAvailability = async (mode: "surf" | "room", accommodationType?: string) => {
    setIsLoadingCalendar(true);
    const dates = getCalendarDates();
    try {
      const results = await Promise.all(
        dates.map(async (date) => {
          try {
            if (mode === "room") {
              const url = `/api/availability?type=room&date=${date}${accommodationType ? `&accommodation_type=${accommodationType}` : ""}`;
              const { data } = await safeFetchJson(url);
              const rooms = Array.isArray(data) ? data : [];
              const freeRooms = rooms.filter((r: any) => r?.available).length;
              return [date, { available: freeRooms > 0, remainingCapacity: freeRooms }] as const;
            }
            const { data } = await safeFetchJson(`/api/availability?date=${date}`);
            return [date, { available: data?.available ?? true, remainingCapacity: data?.remainingCapacity ?? 20 }] as const;
          } catch {
            return [date, { available: true, remainingCapacity: 20 }] as const;
          }
        })
      );
      setAvailabilityMap(Object.fromEntries(results));
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  /**
   * After both check-in and check-out are selected, fetch real availability
   * for that date range and decide which room types to show.
   * roomsRequired = total rooms needed by the group.
   */
  const checkRangeAvailabilityAndShowRooms = async (
    checkIn: string,
    checkOut: string,
    roomsRequired: number
  ) => {
    setIsLoadingCalendar(true);
    try {
      const { data } = await safeFetchJson(
        `/api/availability?type=room&check_in=${checkIn}&check_out=${checkOut}`
      );
      const rooms = Array.isArray(data) ? data : [];

      // Count available rooms per type
      const availByType: Record<string, number> = {};
      for (const entry of rooms) {
        const t: string = entry?.room?.accommodation_type?.type ?? "";
        if (t) availByType[t] = (availByType[t] ?? 0) + 1;
      }

      // If API returned nothing (empty DB / fetch error), fall back to full inventory
      const hasAnyData = Object.keys(availByType).length > 0;
      if (!hasAnyData) {
        // No reservations exist — all room types at full capacity
        const { ROOM_INVENTORY } = await import("@/lib/room-inventory");
        for (const [rt, count] of Object.entries(ROOM_INVENTORY)) {
          availByType[rt] = count as number;
        }
      }

      setRangeRoomAvailability(availByType);

      // Filter types that have enough rooms for the group
      const typesWithEnough = accTypes.filter((at) => (availByType[at.type] ?? 0) >= roomsRequired);
      const typesWithAny = accTypes.filter((at) => (availByType[at.type] ?? 0) > 0);

      if (typesWithAny.length === 0) {
        addMessage({
          type: "bot",
          text: "Unfortunately we are fully booked for this period. Please choose different dates.",
          options: ["← Choose different dates"],
        });
        setCurrentStep("check_in_date");
        loadCalendarAvailability("room");
        return;
      }

      if (typesWithEnough.length === 0) {
        // No single type has enough rooms for the whole group
        addMessage({
          type: "bot",
          text: `We don't have enough rooms of any single type for ${roomsRequired} rooms. Please contact us directly for a group booking, or choose different dates.`,
          options: ["← Choose different dates"],
        });
        setCurrentStep("check_in_date");
        loadCalendarAvailability("room");
        return;
      }

      // Show available room types
      const availableOptions = typesWithEnough.map((a) => `${a.name} - ${a.price_per_night.toLocaleString()} Rs/night`);
      if (hasAnyData && typesWithEnough.length === 1) {
        const only = typesWithEnough[0];
        setCurrentStep("accommodation_type");
        addMessage({
          type: "bot",
          text: `We are almost fully booked. Only ${only.name} is available for this period.`,
          options: [`${only.name} - ${only.price_per_night.toLocaleString()} Rs/night`, "← Choose different dates"],
        });
      } else {
        setCurrentStep("accommodation_type");
        addMessage({
          type: "bot",
          text: "Which type of room would you like?",
          options: [...availableOptions, "← Choose different dates"],
        });
      }
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  const isValidEmail = (email: string) => email.includes("@") && email.includes(".");
  const getMonthLabel = (dateStr: string) => new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const getMonthLabelFromOffset = () => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  };
  const getTodayDate = () => new Date().toISOString().split("T")[0];

  // ─── Ask helpers ─────────────────────────────────────────────────────────────

  const askCourse = (isSwimmer?: boolean, nonSwimmerCount?: number, totalCount?: number) => {
    const resolvedNonSwimmers = nonSwimmerCount ?? formData.numberOfNonSwimmers ?? 0;
    const resolvedTotal = totalCount ?? (formData.serviceType === "both" ? formData.surfPeople : formData.numberOfPeople) ?? 1;
    const swimmerCount = resolvedTotal - resolvedNonSwimmers;

    if (resolvedNonSwimmers > 0 && swimmerCount > 0) {
      setCurrentStep("course_type");
      addMessage({
        type: "bot",
        text: `Your group has ${resolvedNonSwimmers} non-swimmer${resolvedNonSwimmers > 1 ? "s" : ""} (Private Lesson only) and ${swimmerCount} swimmer${swimmerCount > 1 ? "s" : ""}. Which course for the swimmers?`,
        options: courses.filter((c) => c.type !== "private").map((c) => `${c.name} - ${c.price.toLocaleString()} Rs`),
      });
    } else if (isSwimmer === false || resolvedNonSwimmers === resolvedTotal) {
      setCurrentStep("course_type");
      addMessage({
        type: "bot",
        text: "Since none of you are swimmers yet, we can only offer a Private Lesson for your safety.",
        options: courses.filter((c) => c.type === "private").map((c) => `${c.name} - ${c.price.toLocaleString()} Rs`),
      });
    } else {
      setCurrentStep("course_type");
      addMessage({
        type: "bot",
        text: "Which course would you like?",
        options: courses.map((c) => `${c.name} - ${c.price.toLocaleString()} Rs`),
      });
    }
  };

  const askArrivalTime = () => {
    setCurrentStep("arrival_time");
    addMessage({
      type: "bot",
      text: "What's your estimated arrival time?",
      options: ["15:00 - 18:00", "After 18:00"],
    });
  };

  const askSwimmer = (count: number) => {
    setCurrentStep("swimming_ability");
    addMessage({
      type: "bot",
      text: count > 1 ? `Are all ${count} people in your group swimmers?` : "Are you a swimmer?",
      options: ["Yes", "No", "← Back"],
    });
  };

  const askGroupSize = (text = "How many people will be joining?") => {
    setCurrentStep("group_size");
    addMessage({
      type: "bot",
      text,
      options: ["1 person", "2 people", "3 people", "4 people", "5+ people (group)"],
    });
  };


  const askChildrenUnder5 = (totalPeople: number, backStep: ChatStep) => {
    setCurrentStep("child_count_pre");
    const options = ["0", ...Array.from({ length: totalPeople }, (_, i) => String(i + 1))];
    addMessage({
      type: "bot",
      text: `How many of the ${totalPeople} guests are children under 5 years old?`,
      options: [...options, "← Back"],
    });
  };
  const askContactName = () => {
    setCurrentStep("contact_name");
    addMessage({ type: "bot", text: "Great! What name should I book this under?" });
  };

  /**
   * Called after we know: accType (first room type), adults count, children under 5.
   * Starts the room-by-room selection loop with progress text.
   * roomsRequired = total rooms needed by the group.
   */
  const startRoomSelectionLoop = (
    accType: string | undefined,
    adults: number,
    roomsRequired: number
  ) => {
    // 1 person fits alone in 1 room — no extra. Extra only for 3,5,7...
    const hasExtra = adults > 1 && adults % 2 !== 0;

    if (roomsRequired <= 1) {
      // Only 1 room needed — already selected accType
      setFormData((prev) => ({ ...prev, numberOfRooms: 1, roomSelectionsLeft: 0, extraRoomTypes: [], hasExtraPerson: hasExtra }));
      if (hasExtra) {
        // FIX 1&4: odd number of adults — always ask extra bed/room
        askExtraBedOrRoom();
      } else {
        askArrivalTime();
      }
      return;
    }

    // Need rooms 2..N — ask each in sequence with progress text
    const additionalRooms = roomsRequired - 1;
    setFormData((prev) => ({
      ...prev,
      numberOfRooms: roomsRequired,
      roomSelectionsLeft: additionalRooms,
      hasExtraPerson: hasExtra,
      extraRoomTypes: [],
    }));
    // Use same filtered pool as checkRangeAvailabilityAndShowRooms computed
    const loopPool = accTypes.filter((at) => (rangeRoomAvailability[at.type] ?? 0) >= roomsRequired);
    const loopOptions = (loopPool.length > 0 ? loopPool : accTypes).map((a) => `${a.name} - ${a.price_per_night.toLocaleString()} Rs/night`);
    setCurrentStep("room_selection");
    addMessage({
      type: "bot",
      text: `You need ${roomsRequired} rooms total. Selecting room 1 of ${roomsRequired} (already set). Which room type for room 2 of ${roomsRequired}?`,
      options: [...loopOptions, "← Back"],
    });
  };

  const askExtraBedOrRoom = () => {
    setCurrentStep("extra_bed_choice");
    addMessage({
      type: "bot",
      text: "You have 1 extra person. Would you like:\n- Extra bed in one room (+1000 Rs/night)\n- A separate additional room",
      options: ["Extra Bed (+1000 Rs/night)", "Second Room", "← Back"],
    });
  };

  // ─── submitReservation ────────────────────────────────────────────────────────
  const submitReservation = async (current: Partial<ReservationFormData>) => {
    setIsSubmitting(true);

    const wantsSurf = current.serviceType === "surf" || current.serviceType === "both";
    const wantsStay = current.serviceType === "accommodation" || current.serviceType === "both";

    if (!current.name?.trim()) {
      addMessage({ type: "bot", text: "Name is required. Please try again.", options: ["Try Again", "Start Over"] });
      setIsSubmitting(false); return;
    }
    if (!current.email || !isValidEmail(current.email)) {
      addMessage({ type: "bot", text: "A valid email is required. Please try again.", options: ["Try Again", "Start Over"] });
      setIsSubmitting(false); return;
    }
    if (wantsSurf && !current.courseType) {
      addMessage({ type: "bot", text: "Course type is required. Please try again.", options: ["Try Again", "Start Over"] });
      setIsSubmitting(false); return;
    }
    if (wantsStay && (!current.checkIn || !current.checkOut)) {
      addMessage({ type: "bot", text: "Check-in and check-out dates are required. Please try again.", options: ["Try Again", "Start Over"] });
      setIsSubmitting(false); return;
    }

    const nameParts = (current.name || "").trim().split(" ");
    const firstName = nameParts[0] || "";
    const lastName = nameParts.slice(1).join(" ") || firstName;

    const notes: string[] = [];
    if (wantsSurf) {
      if (current.surfedBefore) {
        const school = current.surfSchool === "Other" ? `Other (${current.surfLocation || "unknown"})` : "SurfWala";
        notes.push(`Surfed before: Yes | School: ${school} | Sessions: ${current.sessionsCount || "unknown"}`);
      } else {
        notes.push("Surfed before: No");
      }
      if ((current.numberOfNonSwimmers ?? 0) > 0) {
        const total = current.serviceType === "both" ? current.surfPeople ?? 1 : current.numberOfPeople ?? 1;
        const swimmers = total - (current.numberOfNonSwimmers ?? 0);
        notes.push(`Non-swimmers: ${current.numberOfNonSwimmers} (Private Lesson) | Swimmers: ${swimmers}`);
      }
    }
    if (current.serviceType === "both") {
      notes.push(`Accommodation people: ${current.accommodationPeople ?? "?"} | Surf people: ${current.surfPeople ?? "?"}`);
    }
    if (current.extraRoomType) notes.push(`Extra room: ${current.extraRoomType}`);
    if (current.extraBed) notes.push("Extra bed: Yes (1000 Rs)");
    if (current.hasChildUnder5) notes.push(`Children under 5: ${current.childrenUnder5 ?? 1} (free)`);
    if (current.arrivalTime) notes.push(`Arrival: ${current.arrivalTime}`);
    if (current.contactPreference) notes.push(`Preferred contact: ${current.contactPreference}`);

    const experienceNote = notes.length ? notes.join(" | ") : null;

    // Surf people count
    const surfPeople =
      current.serviceType === "both"
        ? current.surfPeople || 1
        : current.numberOfPeople || 1;

    // Accommodation people count
    const accPeople =
      current.serviceType === "both"
        ? current.accommodationPeople || 1
        : current.numberOfPeople || 1;

    // Total rooms needed
    const adultsForRooms = accPeople - ((current.childrenUnder5 as number) ?? 0);
    const roomsNeeded = current.numberOfRooms ?? Math.ceil(adultsForRooms / 2);

    // Build extra_room_types array
    const extraRoomTypesArr: string[] = (current.extraRoomTypes as string[]) ?? [];
    if (current.extraRoomType) extraRoomTypesArr.push(current.extraRoomType);

    try {
      let courseType: string | null = null;
      if (wantsSurf && current.courseType) {
        const selectedCourse = courses.find(
          (c) => c.type === current.courseType || c.name.toLowerCase().includes((current.courseType || "").toLowerCase())
        );
        courseType = selectedCourse?.type ?? current.courseType ?? null;
      }

      const rawTime = current.time;
      const courseTime: string | null = wantsSurf ? (rawTime === "10:00" ? "10:00" : "08:00") : null;

      const payload = {
        // Surf fields (only set when surf)
        course_type: wantsSurf ? courseType : null,
        course_date: wantsSurf ? (current.date || current.checkIn || null) : null,
        course_time: courseTime,
        number_of_people: typeof surfPeople === "number" ? surfPeople : 1,
        number_of_non_swimmers: current.numberOfNonSwimmers ?? 0,
        // Accommodation fields (only set when stay)
        accommodation_type: wantsStay ? (current.accommodationType || null) : null,
        check_in: wantsStay ? (current.checkIn || null) : null,
        check_out: wantsStay ? (current.checkOut || null) : null,
        accommodation_people: wantsStay ? accPeople : undefined,
        rooms_needed: wantsStay ? roomsNeeded : undefined,
        extra_room_types: extraRoomTypesArr.length > 0 ? extraRoomTypesArr : undefined,
        // Customer
        customer: { first_name: firstName, last_name: lastName, email: current.email || "", phone: current.phone || "" },
        special_requests: experienceNote,
      };

      const { ok, data } = await safeFetchJson("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!ok) {
        const err = (data as any)?.error || (data as any)?.message || JSON.stringify(data) || "Unknown server error";
        addMessage({ type: "bot", text: `Sorry, there was an error: ${err}. Please try again.`, options: ["Try Again", "Start Over"] });
        setIsSubmitting(false); return;
      }

      const reservation = data as { id?: string } | null;
      if (!reservation?.id) {
        addMessage({ type: "bot", text: "Reservation created but no confirmation ID received. Please contact us.", options: ["Start Over"] });
        setIsSubmitting(false); return;
      }

      addMessage({
        type: "bot",
        text: `Reservation request sent! Your booking reference is #${reservation.id.slice(0, 8).toUpperCase()}. You'll receive a confirmation email once it's approved. See you at Surf Wala!`,
      });
      setCurrentStep("completed");
      setTimeout(() => {
        addMessage({ type: "bot", text: "Would you like to make another booking?", options: ["Yes, start over", "No, thanks"] });
      }, 2000);
    } catch (error) {
      addMessage({ type: "bot", text: "Sorry, something went wrong. Please try again or contact us directly.", options: ["Try Again", "Start Over"] });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOptionClick = (option: string) => {
    addMessage({ type: "user", text: option });
    setTimeout(() => processResponse(option), 400);
  };

  const handleSelectDate = (date: string) => {
    const info = availabilityMap[date];
    if (info && !info.available) {
      addMessage({ type: "bot", text: "No availability for this date." });
      return;
    }

    if (currentStep === "date_selection") {
      addMessage({ type: "user", text: date });
      setFormData((prev) => ({ ...prev, date }));
      const isPrivate = formData.courseType === "private";
      const isNonSwimmer = (formData.numberOfNonSwimmers ?? 0) === (formData.serviceType === "both" ? formData.surfPeople ?? 1 : formData.numberOfPeople ?? 1);
      if (isPrivate || isNonSwimmer) {
        setFormData((prev) => ({ ...prev, date, time: DEFAULT_TIME }));
        addMessage({ type: "bot", text: `Surf lesson booked for ${date}.` });
        askContactName();
      } else {
        setCurrentStep("time_selection");
        addMessage({ type: "bot", text: `${date} is available. Which time slot works for you?`, options: TIME_SLOTS.map((t) => t) });
      }
      return;
    }

    if (currentStep === "check_in_date") {
      addMessage({ type: "user", text: `Check-in: ${date}` });
      setFormData((prev) => ({ ...prev, checkIn: date }));
      setCurrentStep("check_out_date");
      addMessage({ type: "bot", text: "Now pick your check-out date." });
      loadCalendarAvailability("room");
      return;
    }

    if (currentStep === "check_out_date") {
      if (formData.checkIn && date <= formData.checkIn) {
        addMessage({ type: "bot", text: "Check-out must be after check-in." });
        return;
      }
      addMessage({ type: "user", text: `Check-out: ${date}` });

      // Calculate rooms needed before fetching availability
      const accPeople = formData.serviceType === "both" ? formData.accommodationPeople ?? 1 : formData.numberOfPeople ?? 1;
      const children = (formData.childrenUnder5 as number) ?? 0;
      const adults = accPeople - children;
      const { rooms: roomsNeededRaw } = calcRooms(adults > 0 ? adults : 1);
      // At least 1 room always needed (floor(1/2)=0 would break availability filter)
      const roomsNeeded = Math.max(1, roomsNeededRaw);

      setFormData((prev) => ({ ...prev, checkOut: date, numberOfRooms: roomsNeeded }));

      // Now fetch availability for this range and show room options
      checkRangeAvailabilityAndShowRooms(formData.checkIn!, date, roomsNeeded);
      return;
    }
  };

  // ─── Build summary ────────────────────────────────────────────────────────────
  const buildSummary = (data: Partial<ReservationFormData>) => {
    const wantsSurf = data.serviceType === "surf" || data.serviceType === "both";
    const wantsStay = data.serviceType === "accommodation" || data.serviceType === "both";
    let s = "Here's your booking summary:\n\n";

    if (wantsSurf) {
      const total = data.serviceType === "both" ? data.surfPeople ?? 1 : data.numberOfPeople ?? 1;
      const nonSwimmers = data.numberOfNonSwimmers ?? 0;
      const swimmers = total - nonSwimmers;

      if (nonSwimmers > 0 && swimmers > 0) {
        const privateCourse = courses.find((c) => c.type === "private");
        const mainCourse = courses.find((c) => c.type === data.courseType);
        if (privateCourse) s += `Non-swimmers (${nonSwimmers}): ${privateCourse.name} - ${privateCourse.price.toLocaleString()} Rs\n`;
        if (mainCourse) s += `Swimmers (${swimmers}): ${mainCourse.name} - ${mainCourse.price.toLocaleString()} Rs\n`;
      } else {
        const course = courses.find((c) => c.type === data.courseType);
        if (course) s += `Course: ${course.name} - ${course.price.toLocaleString()} Rs\n`;
      }
      if (data.date) s += `Lesson date: ${data.date}\n`;
      if (data.time) s += `Lesson time: ${data.time}\n`;
      if (nonSwimmers > 0) s += `Non-swimmers: ${nonSwimmers}\n`;
      s += `Surfed before: ${data.surfedBefore ? "Yes" : "No"}\n`;
      if (data.surfedBefore && data.surfSchool) {
        s += `School: ${data.surfSchool === "Other" ? `Other (${data.surfLocation})` : "SurfWala"}, ${data.sessionsCount}\n`;
      }
    }

    if (wantsStay) {
      const acc = accTypes.find((a) => a.type === data.accommodationType);
      if (acc) s += `Room 1: ${acc.name} - ${acc.price_per_night.toLocaleString()} Rs/night\n`;
      const extraTypes: string[] = (data as any).extraRoomTypes ?? [];
      if (extraTypes.length > 0) {
        extraTypes.forEach((t, i) => {
          const et = accTypes.find((a) => a.type === t);
          if (et) s += `Room ${i + 2}: ${et.name} - ${et.price_per_night.toLocaleString()} Rs/night\n`;
        });
      }
      if (data.extraRoomType) {
        const extra = accTypes.find((a) => a.type === data.extraRoomType);
        if (extra) s += `Extra room: ${extra.name} - ${extra.price_per_night.toLocaleString()} Rs/night\n`;
      }
      if (data.extraBed) s += `Extra bed: +1000 Rs/night\n`;
      if (data.hasChildUnder5) s += `Child under 5: free\n`;
      s += `Check-in: ${data.checkIn}\nCheck-out: ${data.checkOut}\n`;
      if (data.arrivalTime) s += `Arrival: ${data.arrivalTime}\n`;
    }

    if (data.serviceType === "both") {
      s += `Accommodation guests: ${data.accommodationPeople}\nSurf participants: ${data.surfPeople}\n`;
    } else {
      s += `People: ${data.numberOfPeople}\n`;
    }
    s += `\nName: ${data.name}\nPhone: ${data.phone}\nEmail: ${data.email}`;
    if (data.contactPreference) s += `\nPreferred contact: ${data.contactPreference}`;
    return s;
  };

  // ─── Main router ──────────────────────────────────────────────────────────────
  const processResponse = (userInput: string) => {
    const input = userInput.toLowerCase();

    if (currentStep === "completed") {
      if (input.includes("yes") || input.includes("start")) resetChat();
      return;
    }

    switch (currentStep) {

      // ── STEP 1 ──────────────────────────────────────────────────────────────
      case "booking_type": {
        if (input.includes("accommodation")) {
          setFormData({ serviceType: "accommodation" });
          askGroupSize("How many people need accommodation?");
        } else if (input.includes("package") || input.includes("stay")) {
          setFormData({ serviceType: "both" });
          setCurrentStep("accommodation_people");
          addMessage({
            type: "bot",
            text: "Great choice! Let's start with accommodation. How many people need a room?",
            options: ["1 person", "2 people", "3 people", "4 people", "5+ people (group)"],
          });
        } else {
          setFormData({ serviceType: "surf" });
          askGroupSize("How many people are joining the surf lesson?");
        }
        break;
      }

      // ── GROUP SIZE (surf-only / accommodation-only) ──────────────────────────
      case "group_size": {
        if (input.includes("back")) {
          setCurrentStep("booking_type");
          addMessage({ type: "bot", text: "What would you like to book?", options: BOOKING_TYPES });
          break;
        }
        const m = input.match(/(\d+)/);
        const n = m ? parseInt(m[1]) : 1;
        if (n >= 5) {
          setFormData((prev) => ({ ...prev, numberOfPeople: n }));
          setCurrentStep("large_group_size");
          addMessage({
            type: "bot",
            text: "How many people exactly?",
            options: ["5", "6", "7", "8", "9", "10", "11", "12", "← Back"],
          });
        } else {
          setFormData((prev) => ({ ...prev, numberOfPeople: n }));
          if (formData.serviceType === "surf") {
            askSwimmer(n);
          } else if (n === 1) {
            // 1 person: no children question, go straight to dates
            setFormData((prev) => ({ ...prev, numberOfPeople: 1, hasChildUnder5: false, childrenUnder5: 0 }));
            setCurrentStep("check_in_date");
            addMessage({ type: "bot", text: "Pick your check-in date. Fully booked days are shown in red." });
            loadCalendarAvailability("room");
          } else {
            // Ask children under 5 before dates
            askChildrenUnder5(n, "group_size");
          }
        }
        break;
      }

      case "large_group_size": {
        if (input.includes("back")) {
          askGroupSize(formData.serviceType === "surf" ? "How many people are joining the surf lesson?" : "How many people need accommodation?");
          break;
        }
        const m = input.match(/(\d+)/);
        const n = m ? parseInt(m[1]) : 5;
        setFormData((prev) => ({ ...prev, numberOfPeople: n }));
        if (formData.serviceType === "surf") {
          askSwimmer(n);
        } else {
          askChildrenUnder5(n, "large_group_size");
        }
        break;
      }

      // ── SURF + STAY — ACCOMMODATION HEADCOUNT ────────────────────────────────
      case "accommodation_people": {
        if (input.includes("back")) {
          setCurrentStep("booking_type");
          addMessage({ type: "bot", text: "What would you like to book?", options: BOOKING_TYPES });
          break;
        }
        const m = input.match(/(\d+)/);
        const n = m ? parseInt(m[1]) : 1;
        if (n >= 5) {
          setFormData((prev) => ({ ...prev, accommodationPeople: n }));
          setCurrentStep("large_acc_people");
          addMessage({
            type: "bot",
            text: "How many people exactly need accommodation?",
            options: ["5", "6", "7", "8", "9", "10", "11", "12", "← Back"],
          });
        } else {
          setFormData((prev) => ({ ...prev, accommodationPeople: n }));
          if (n === 1) {
            setFormData((prev) => ({ ...prev, accommodationPeople: 1, hasChildUnder5: false, childrenUnder5: 0 }));
            setCurrentStep("check_in_date");
            addMessage({ type: "bot", text: "Pick your check-in date. Fully booked days are shown in red." });
            loadCalendarAvailability("room");
          } else {
            askChildrenUnder5(n, "accommodation_people");
          }
        }
        break;
      }

      case "large_acc_people": {
        if (input.includes("back")) {
          setCurrentStep("accommodation_people");
          addMessage({
            type: "bot",
            text: "How many people need accommodation?",
            options: ["1 person", "2 people", "3 people", "4 people", "5+ people (group)", "← Back"],
          });
          break;
        }
        const m = input.match(/(\d+)/);
        const n = m ? parseInt(m[1]) : 5;
        setFormData((prev) => ({ ...prev, accommodationPeople: n }));
        askChildrenUnder5(n, "large_acc_people");
        break;
      }

      // ── HOW MANY CHILDREN UNDER 5? (asked BEFORE date selection) ───────────
      case "child_count_pre": {
        if (input.includes("back")) {
          if (formData.serviceType === "both") {
            const accP = formData.accommodationPeople ?? 1;
            if (accP >= 5) {
              setCurrentStep("large_acc_people");
              addMessage({ type: "bot", text: "How many people exactly need accommodation?", options: ["5","6","7","8","9","10","11","12","← Back"] });
            } else {
              setCurrentStep("accommodation_people");
              addMessage({ type: "bot", text: "How many people need accommodation?", options: ["1 person","2 people","3 people","4 people","5+ people (group)","← Back"] });
            }
          } else {
            const accP = formData.numberOfPeople ?? 1;
            if (accP >= 5) {
              setCurrentStep("large_group_size");
              addMessage({ type: "bot", text: "How many people exactly?", options: ["5","6","7","8","9","10","11","12","← Back"] });
            } else {
              askGroupSize("How many people need accommodation?");
            }
          }
          break;
        }
        const mCp = input.match(/(\d+)/);
        const children = mCp ? parseInt(mCp[1]) : 0;
        setFormData((prev) => ({ ...prev, hasChildUnder5: children > 0, childrenUnder5: children }));
        setCurrentStep("check_in_date");
        addMessage({ type: "bot", text: "Pick your check-in date. Fully booked days are shown in red." });
        loadCalendarAvailability("room");
        break;
      }

      // ── HOW MANY CHILDREN UNDER 5? ───────────────────────────────────────────
      // (Now reached after date selection via checkRangeAvailabilityAndShowRooms)
      case "child_count": {
        if (input.includes("back")) {
          setCurrentStep("check_out_date");
          addMessage({ type: "bot", text: "Pick your check-out date." });
          loadCalendarAvailability("room");
          break;
        }
        const m = input.match(/(\d+)/);
        const children = m ? parseInt(m[1]) : 0;
        const accPeople = formData.serviceType === "both" ? formData.accommodationPeople ?? 1 : formData.numberOfPeople ?? 1;
        setFormData((prev) => ({ ...prev, hasChildUnder5: children > 0, childrenUnder5: children }));
        const adults = accPeople - children;
        const { rooms: roomsNeededRaw2 } = calcRooms(adults > 0 ? adults : 1);
        const roomsNeeded = Math.max(1, roomsNeededRaw2);
        setFormData((prev) => ({ ...prev, numberOfRooms: roomsNeeded }));
        checkRangeAvailabilityAndShowRooms(formData.checkIn!, formData.checkOut!, roomsNeeded);
        break;
      }

      // ── ACCOMMODATION TYPE (shown AFTER date selection) ───────────────────────
      case "accommodation_type": {
        if (input.includes("back") || input.includes("different dates")) {
          setCurrentStep("check_in_date");
          addMessage({ type: "bot", text: "Pick your check-in date." });
          loadCalendarAvailability("room");
          break;
        }
        const sel = accTypes.find((a) => input.includes(a.name.toLowerCase()));
        if (!sel) {
          addMessage({ type: "bot", text: "Please select a room type from the options." });
          break;
        }
        const accType = sel.type;
        setFormData((prev) => ({ ...prev, accommodationType: accType }));

        const accPeople = formData.serviceType === "both" ? formData.accommodationPeople ?? 1 : formData.numberOfPeople ?? 1;
        // Children already asked before dates (child_count_pre), use stored value
        const children = (formData.childrenUnder5 as number) ?? 0;
        const adults = accPeople - children;
        const { rooms: roomsNeededRaw3 } = calcRooms(adults > 0 ? adults : 1);
        const roomsNeeded = Math.max(1, roomsNeededRaw3);
        setFormData((prev) => ({ ...prev, numberOfRooms: roomsNeeded }));
        startRoomSelectionLoop(accType, adults > 0 ? adults : 1, roomsNeeded);
        break;
      }

      // ── ROOM SELECTION LOOP (rooms 2..N) ────────────────────────────────────
      case "room_selection": {
        if (input.includes("back")) {
          setCurrentStep("accommodation_type");
          const roomsNeeded = formData.numberOfRooms ?? 1;
          // FIX 3: strictly limit to available types
          const typesWithEnough = accTypes.filter((at) => (rangeRoomAvailability[at.type] ?? 0) >= roomsNeeded);
          const opts = (typesWithEnough.length > 0 ? typesWithEnough : accTypes).map((a) => `${a.name} - ${a.price_per_night.toLocaleString()} Rs/night`);
          addMessage({
            type: "bot",
            text: "Which type of room would you like?",
            options: [...opts, "← Choose different dates"],
          });
          break;
        }
        // FIX 3: only accept options that are actually available
        const roomsNeededNow = formData.numberOfRooms ?? 1;
        const availTypes = accTypes.filter((at) => (rangeRoomAvailability[at.type] ?? 0) >= roomsNeededNow);
        const selPool = availTypes.length > 0 ? availTypes : accTypes;
        const sel = selPool.find((a) => input.includes(a.name.toLowerCase()));
        if (!sel) {
          addMessage({ type: "bot", text: "Please select a room type from the available options." });
          break;
        }

        const existingTypes: string[] = (formData as any).extraRoomTypes ?? [];
        const newTypes = [...existingTypes, sel.type];
        const left = ((formData as any).roomSelectionsLeft ?? 1) - 1;
        const totalRooms = formData.numberOfRooms ?? 1;
        const roomIndex = newTypes.length + 1; // +1 because room 1 already chosen

        setFormData((prev) => ({ ...prev, extraRoomTypes: newTypes, roomSelectionsLeft: left }));

        if (left > 0) {
          const nextRoom = roomIndex + 1;
          // Use same filtered pool — types that had enough rooms for the full group
          const loopAvailTypes = accTypes.filter((at) => (rangeRoomAvailability[at.type] ?? 0) >= totalRooms);
          const loopPool2 = loopAvailTypes.length > 0 ? loopAvailTypes : accTypes;
          setCurrentStep("room_selection");
          addMessage({
            type: "bot",
            text: `You need ${totalRooms} rooms total. Selecting room ${roomIndex} of ${totalRooms} done. Which room type for room ${nextRoom} of ${totalRooms}?`,
            options: [...loopPool2.map((a) => `${a.name} - ${a.price_per_night.toLocaleString()} Rs/night`), "← Back"],
          });
        } else {
          // All rooms configured — derive hasExtra from adults count to avoid stale closure
          const accPeopleLocal = formData.serviceType === "both" ? formData.accommodationPeople ?? 1 : formData.numberOfPeople ?? 1;
          const childrenLocal = (formData.childrenUnder5 as number) ?? 0;
          const adultsLocal = Math.max(1, accPeopleLocal - childrenLocal);
          const stillHasExtra = adultsLocal > 1 && adultsLocal % 2 !== 0;
          if (stillHasExtra) {
            askExtraBedOrRoom();
          } else {
            askArrivalTime();
          }
        }
        break;
      }

      // ── EXTRA BED OR EXTRA ROOM ──────────────────────────────────────────────
      case "extra_bed_choice": {
        if (input.includes("back")) {
          setCurrentStep("accommodation_type");
          const roomsNeeded = formData.numberOfRooms ?? 1;
          const typesWithEnough = accTypes.filter((at) => (rangeRoomAvailability[at.type] ?? 0) >= roomsNeeded);
          addMessage({
            type: "bot",
            text: "Which type of room would you like?",
            options: [
              ...(typesWithEnough.length > 0 ? typesWithEnough : accTypes).map((a) => `${a.name} - ${a.price_per_night.toLocaleString()} Rs/night`),
              "← Choose different dates",
            ],
          });
          break;
        }
        if (input.includes("extra bed")) {
          setFormData((prev) => ({ ...prev, extraBed: true }));
          askArrivalTime();
        } else {
          // FIX 3: restrict to available types
          const extraAvailTypes = accTypes.filter((at) => (rangeRoomAvailability[at.type] ?? 0) > 0);
          const extraPool = extraAvailTypes.length > 0 ? extraAvailTypes : accTypes;
          setCurrentStep("extra_room_type");
          addMessage({
            type: "bot",
            text: "Which room type for the additional room?",
            options: [...extraPool.map((a) => `${a.name} - ${a.price_per_night.toLocaleString()} Rs/night`), "← Back"],
          });
        }
        break;
      }

      case "extra_room_type": {
        if (input.includes("back")) {
          askExtraBedOrRoom();
          break;
        }
        const sel = accTypes.find((a) => input.includes(a.name.toLowerCase()));
        setFormData((prev) => ({ ...prev, extraRoomType: sel?.type }));
        askArrivalTime();
        break;
      }

      // ── ARRIVAL TIME ─────────────────────────────────────────────────────────
      case "arrival_time": {
        if (input.includes("back")) {
          // Back to last room step
          const totalRooms = formData.numberOfRooms ?? 1;
          if (totalRooms > 1) {
            setCurrentStep("room_selection");
            addMessage({
              type: "bot",
              text: "Which room type would you like?",
              options: [...accTypes.map((a) => `${a.name} - ${a.price_per_night.toLocaleString()} Rs/night`), "← Back"],
            });
          } else {
            setCurrentStep("accommodation_type");
            const roomsNeeded = formData.numberOfRooms ?? 1;
            const typesWithEnough = accTypes.filter((at) => (rangeRoomAvailability[at.type] ?? 0) >= roomsNeeded);
            addMessage({
              type: "bot",
              text: "Which type of room would you like?",
              options: [
                ...(typesWithEnough.length > 0 ? typesWithEnough : accTypes).map((a) => `${a.name} - ${a.price_per_night.toLocaleString()} Rs/night`),
                "← Choose different dates",
              ],
            });
          }
          break;
        }
        setFormData((prev) => ({ ...prev, arrivalTime: userInput }));
        if (formData.serviceType === "both") {
          // Accommodation done — now surf
          setCurrentStep("surf_people");
          addMessage({
            type: "bot",
            text: "Accommodation sorted! Now for surf lessons — how many people want to join?",
            options: ["1 person", "2 people", "3 people", "4 people", "5+ people (group)", "← Back"],
          });
        } else {
          askContactName();
        }
        break;
      }

      // ── SURF + STAY — SURF HEADCOUNT ─────────────────────────────────────────
      case "surf_people": {
        if (input.includes("back")) {
          askArrivalTime();
          break;
        }
        const m = input.match(/(\d+)/);
        const n = m ? parseInt(m[1]) : 1;
        if (n >= 5) {
          setFormData((prev) => ({ ...prev, surfPeople: n }));
          setCurrentStep("large_surf_people");
          addMessage({
            type: "bot",
            text: "How many people exactly want surf lessons?",
            options: ["5", "6", "7", "8", "9", "10", "11", "12", "← Back"],
          });
        } else {
          setFormData((prev) => ({ ...prev, surfPeople: n }));
          askSwimmer(n);
        }
        break;
      }

      case "large_surf_people": {
        if (input.includes("back")) {
          setCurrentStep("surf_people");
          addMessage({
            type: "bot",
            text: "How many people want surf lessons?",
            options: ["1 person", "2 people", "3 people", "4 people", "5+ people (group)", "← Back"],
          });
          break;
        }
        const m = input.match(/(\d+)/);
        const n = m ? parseInt(m[1]) : 5;
        setFormData((prev) => ({ ...prev, surfPeople: n }));
        askSwimmer(n);
        break;
      }

      // ── SWIMMER CHECK ────────────────────────────────────────────────────────
      case "swimming_ability": {
        if (input.includes("back")) {
          if (formData.serviceType === "both") {
            const surfP = formData.surfPeople ?? 1;
            if (surfP >= 5) {
              setCurrentStep("large_surf_people");
              addMessage({ type: "bot", text: "How many people exactly want surf lessons?", options: ["5","6","7","8","9","10","11","12","← Back"] });
            } else {
              setCurrentStep("surf_people");
              addMessage({ type: "bot", text: "How many people want surf lessons?", options: ["1 person","2 people","3 people","4 people","5+ people (group)","← Back"] });
            }
          } else {
            const n = formData.numberOfPeople ?? 1;
            if (n >= 5) {
              setCurrentStep("large_group_size");
              addMessage({ type: "bot", text: "How many people exactly?", options: ["5","6","7","8","9","10","11","12","← Back"] });
            } else {
              askGroupSize("How many people are joining the surf lesson?");
            }
          }
          break;
        }

        const total = formData.serviceType === "both" ? formData.surfPeople ?? 1 : formData.numberOfPeople ?? 1;

        if (input.includes("yes")) {
          setFormData((prev) => ({ ...prev, isSwimmer: true, numberOfNonSwimmers: 0 }));
          setCurrentStep("surfed_before");
          addMessage({ type: "bot", text: "Awesome! Have you surfed before?", options: ["Yes", "No", "← Back"] });
        } else {
          if (total > 1) {
            setCurrentStep("non_swimmer_count");
            addMessage({
              type: "bot",
              text: `Out of ${total} people, how many are non-swimmers?`,
              options: Array.from({ length: total }, (_, i) => String(i + 1)),
            });
          } else {
            setFormData((prev) => ({ ...prev, isSwimmer: false, numberOfNonSwimmers: 1 }));
            setCurrentStep("surfed_before");
            addMessage({ type: "bot", text: "No problem! Have you surfed before?", options: ["Yes", "No", "← Back"] });
          }
        }
        break;
      }

      // ── NON-SWIMMER COUNT ────────────────────────────────────────────────────
      case "non_swimmer_count": {
        if (input.includes("back")) {
          const total = formData.serviceType === "both" ? formData.surfPeople ?? 1 : formData.numberOfPeople ?? 1;
          askSwimmer(total);
          break;
        }
        const count = parseInt(userInput, 10);
        if (isNaN(count) || count < 1) {
          addMessage({ type: "bot", text: "Please select how many people are non-swimmers." });
          break;
        }
        const total = formData.serviceType === "both" ? formData.surfPeople ?? 1 : formData.numberOfPeople ?? 1;
        const swimmers = total - count;
        // FIX 2: store nonSwimmers explicitly so it survives through all subsequent steps
        setFormData((prev) => ({ ...prev, numberOfNonSwimmers: count, isSwimmer: swimmers > 0 }));

        if (swimmers > 0) {
          setCurrentStep("surfed_before");
          addMessage({
            type: "bot",
            text: `Got it — ${count} non-swimmer${count > 1 ? "s" : ""} (Private Lesson) and ${swimmers} swimmer${swimmers > 1 ? "s" : ""}. Have you surfed before?`,
            options: ["Yes", "No", "← Back"],
          });
        } else {
          setCurrentStep("surfed_before");
          addMessage({ type: "bot", text: "No problem! Have you surfed before?", options: ["Yes", "No", "← Back"] });
        }
        break;
      }

      // ── SURF EXPERIENCE ──────────────────────────────────────────────────────
      case "surfed_before": {
        if (input.includes("back")) {
          const total = formData.serviceType === "both" ? formData.surfPeople ?? 1 : formData.numberOfPeople ?? 1;
          if (total > 1 && (formData.numberOfNonSwimmers ?? 0) > 0) {
            setCurrentStep("non_swimmer_count");
            addMessage({ type: "bot", text: `Out of ${total} people, how many are non-swimmers?`, options: Array.from({ length: total }, (_, i) => String(i + 1)) });
          } else {
            askSwimmer(total);
          }
          break;
        }
        if (input.includes("yes")) {
          setFormData((prev) => ({ ...prev, surfedBefore: true }));
          setCurrentStep("surf_school");
          addMessage({ type: "bot", text: "Was it with SurfWala?", options: ["Yes", "No", "← Back"] });
        } else {
          setFormData((prev) => ({ ...prev, surfedBefore: false }));
          // FIX 2: read nonSwimmers from formData at time of call (not closure)
          const snapIsSwimmer = formData.isSwimmer;
          const snapNonSwim = formData.numberOfNonSwimmers ?? 0;
          const snapTot = formData.serviceType === "both" ? formData.surfPeople ?? 1 : formData.numberOfPeople ?? 1;
          askCourse(snapIsSwimmer, snapNonSwim, snapTot);
        }
        break;
      }

      case "surf_school": {
        if (input.includes("back")) {
          setCurrentStep("surfed_before");
          addMessage({ type: "bot", text: "Have you surfed before?", options: ["Yes", "No", "← Back"] });
          break;
        }
        if (input.includes("yes")) {
          setFormData((prev) => ({ ...prev, surfSchool: "SurfWala" }));
          setCurrentStep("sessions_count");
          addMessage({ type: "bot", text: "How many sessions have you completed?", options: ["1-2 sessions", "3+ sessions", "← Back"] });
        } else {
          setFormData((prev) => ({ ...prev, surfSchool: "Other" }));
          setCurrentStep("surf_location");
          addMessage({ type: "bot", text: "Where did you take your surf course?" });
        }
        break;
      }

      case "surf_location":
        if (input.includes("back")) {
          setCurrentStep("surf_school");
          addMessage({ type: "bot", text: "Was it with SurfWala?", options: ["Yes", "No", "← Back"] });
          break;
        }
        setFormData((prev) => ({ ...prev, surfLocation: userInput }));
        setCurrentStep("sessions_count");
        addMessage({ type: "bot", text: "How many sessions have you completed?", options: ["1-2 sessions", "3+ sessions", "← Back"] });
        break;

      case "sessions_count": {
        if (input.includes("back")) {
          if (formData.surfSchool === "Other") {
            setCurrentStep("surf_location");
            addMessage({ type: "bot", text: "Where did you take your surf course?" });
          } else {
            setCurrentStep("surf_school");
            addMessage({ type: "bot", text: "Was it with SurfWala?", options: ["Yes", "No", "← Back"] });
          }
          break;
        }
        setFormData((prev) => ({ ...prev, sessionsCount: userInput }));
        // FIX 2: explicit snapshot to avoid stale closure
        const snapIsSwimmer2 = formData.isSwimmer;
        const snapNonSwim2 = formData.numberOfNonSwimmers ?? 0;
        const snapTot2 = formData.serviceType === "both" ? formData.surfPeople ?? 1 : formData.numberOfPeople ?? 1;
        askCourse(snapIsSwimmer2, snapNonSwim2, snapTot2);
        break;
      }

      // ── COURSE SELECTION ─────────────────────────────────────────────────────
      case "course_type": {
        if (input.includes("back")) {
          const snap = formData.isSwimmer;
          const nonSwim = formData.numberOfNonSwimmers ?? 0;
          const tot = formData.serviceType === "both" ? formData.surfPeople ?? 1 : formData.numberOfPeople ?? 1;
          askCourse(snap, nonSwim, tot);
          break;
        }
        const sel = courses.find((c) => input.includes(c.name.toLowerCase()));
        if (sel) setFormData((prev) => ({ ...prev, courseType: sel.type }));
        setCurrentStep("date_selection");
        addMessage({ type: "bot", text: "Pick a date for your surf lesson. Fully booked days are shown in red." });
        loadCalendarAvailability("surf");
        break;
      }

      // ── TIME SELECTION ───────────────────────────────────────────────────────
      case "time_selection": {
        const selTime = TIME_SLOTS.find((t) => input.includes(t));
        const time = selTime || DEFAULT_TIME;
        setFormData((prev) => ({ ...prev, time }));
        addMessage({ type: "bot", text: `Perfect! Surf lesson on ${formData.date} at ${time}.` });
        askContactName();
        break;
      }

      // ── CONTACT ──────────────────────────────────────────────────────────────
      case "contact_name":
        if (input.includes("back")) {
          if (formData.serviceType === "accommodation" || formData.serviceType === "both") {
            askArrivalTime();
          } else {
            const isPrivate = formData.courseType === "private";
            const allNonSwim = (formData.numberOfNonSwimmers ?? 0) === (formData.numberOfPeople ?? 1);
            if (isPrivate || allNonSwim) {
              setCurrentStep("date_selection");
              addMessage({ type: "bot", text: "Pick a date for your surf lesson." });
              loadCalendarAvailability("surf");
            } else {
              setCurrentStep("time_selection");
              addMessage({ type: "bot", text: "Which time slot works for you?", options: TIME_SLOTS.map((t) => t) });
            }
          }
          break;
        }
        setFormData((prev) => ({ ...prev, name: userInput }));
        setCurrentStep("contact_phone");
        addMessage({ type: "bot", text: `Thanks ${userInput}! What's your phone number?` });
        break;

      case "contact_phone":
        if (input.includes("back")) {
          setCurrentStep("contact_name");
          addMessage({ type: "bot", text: "What name should I book this under?" });
          break;
        }
        setFormData((prev) => ({ ...prev, phone: userInput }));
        setCurrentStep("contact_email");
        addMessage({ type: "bot", text: "And your email address? (Required - we'll send your confirmation here)" });
        break;

      case "contact_email": {
        if (input.includes("back")) {
          setCurrentStep("contact_phone");
          addMessage({ type: "bot", text: "What's your phone number?" });
          break;
        }
        if (!isValidEmail(userInput)) {
          addMessage({ type: "bot", text: "Please enter a valid email." });
          return;
        }
        setFormData((prev) => ({ ...prev, email: userInput }));
        setCurrentStep("contact_preference");
        addMessage({ type: "bot", text: "What is your preferred contact method?", options: ["WhatsApp", "Phone call", "Email"] });
        break;
      }

      case "contact_preference": {
        if (input.includes("back")) {
          setCurrentStep("contact_email");
          addMessage({ type: "bot", text: "And your email address?" });
          break;
        }
        let pref: "WhatsApp" | "Phone call" | "Email" = "Email";
        if (input.includes("whatsapp")) pref = "WhatsApp";
        else if (input.includes("phone")) pref = "Phone call";
        const updated = { ...formData, contactPreference: pref };
        setFormData(updated);
        setCurrentStep("confirmation");
        addMessage({ type: "bot", text: buildSummary(updated), options: ["Confirm Booking", "Cancel"] });
        break;
      }

      case "confirmation":
        if (input.includes("confirm")) submitReservation(formData);
        else if (input.includes("cancel")) resetChat();
        break;

      default:
        addMessage({ type: "bot", text: "I didn't quite get that. Could you try again?" });
    }
  };

  const handleSend = () => {
    if (!inputValue.trim() || isSubmitting) return;
    addMessage({ type: "user", text: inputValue });
    const value = inputValue;
    setInputValue("");
    setTimeout(() => processResponse(value), 400);
  };

  const calendarDates = getCalendarDates();
  const isCalendarStep = currentStep === "date_selection" || currentStep === "check_in_date" || currentStep === "check_out_date";

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader className="border-b bg-primary">
        <div className="flex flex-col items-center text-center">
          <CardTitle className="text-primary-foreground text-lg font-bold">Surf Wala</CardTitle>
          <p className="text-primary-foreground/80 text-sm">booking system</p>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-96 space-y-4 overflow-y-auto bg-gray-50 p-4">
          {messages.map((message, msgIdx) => {
            const isLastMessage = msgIdx === messages.length - 1;
            const buttonsActive = isLastMessage && !isSubmitting;
            return (
            <div key={message.id} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${message.type === "user" ? "bg-primary text-primary-foreground" : "bg-white text-gray-900 shadow-sm border border-gray-200"}`}>
                <p className="whitespace-pre-line text-sm">{message.text}</p>
                {message.options && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.options.map((option) => (
                      <Button key={option} size="sm" disabled={!buttonsActive} className={`h-auto whitespace-normal py-2 px-4 text-xs font-medium shadow-sm ${buttonsActive ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-primary/40 text-primary-foreground cursor-not-allowed"}`} onClick={() => { if (buttonsActive) handleOptionClick(option); }}>
                        {option}
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            );
          })}
          <div ref={messagesEndRef} />
          {isSubmitting && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-2xl bg-white shadow-sm border border-gray-200 px-4 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                <span className="text-sm text-gray-700">Creating your reservation...</span>
              </div>
            </div>
          )}
        </div>

        {isCalendarStep ? (
          <div className="border-t p-4">
            {isLoadingCalendar ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading availability...
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <Button variant="ghost" size="sm" onClick={() => setMonthOffset((p) => Math.max(0, p - 1))} disabled={monthOffset === 0} className="h-8 w-8 p-0">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <h3 className="text-sm font-semibold">
                    {calendarDates.length > 0 ? getMonthLabel(calendarDates[0]) : getMonthLabelFromOffset()}
                  </h3>
                  <Button variant="ghost" size="sm" onClick={() => setMonthOffset((p) => Math.min(11, p + 1))} disabled={monthOffset >= 11} className="h-8 w-8 p-0">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {calendarDates.map((date) => {
                    const info = availabilityMap[date];
                    const remaining = info?.remainingCapacity ?? 20;
                    let isFull = info ? !info.available : false;
                    if (currentStep === "check_out_date" && formData.checkIn && date <= formData.checkIn) isFull = true;
                    const isLow = !isFull && remaining <= 3;
                    const isCheckIn = currentStep === "check_out_date" && date === formData.checkIn;
                    const isToday = date === getTodayDate();
                    const day = new Date(date + "T00:00:00").getDate();
                    let cls = "flex h-9 items-center justify-center rounded-md border text-sm transition-colors ";
                    if (isCheckIn) cls += "border-primary bg-primary font-bold text-primary-foreground";
                    else if (isFull) cls += "cursor-not-allowed border-destructive/40 bg-destructive/10 text-destructive line-through";
                    else if (isToday) cls += "border-blue-500 ring-2 ring-blue-500 ring-offset-1 bg-blue-50 font-bold text-blue-700 hover:bg-blue-100";
                    else if (isLow) cls += "border-orange-400 bg-orange-50 font-bold text-orange-600 hover:bg-orange-100";
                    else cls += "border-green-300 bg-green-50 text-green-700 hover:bg-green-100";
                    return (
                      <button key={date} type="button" disabled={isFull} onClick={() => handleSelectDate(date)} className={cls}>{day}</button>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border-2 border-blue-500 bg-blue-50" /> Today</span>
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-green-300 bg-green-50" /> Available</span>
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-orange-400 bg-orange-50" /><span className="font-medium text-orange-600">Few left</span></span>
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-destructive/40 bg-destructive/10" /> Booked</span>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="flex gap-2 border-t p-4">
            <Input placeholder="Type a message..." value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSend()} disabled={isSubmitting} />
            <Button size="icon" onClick={handleSend} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
