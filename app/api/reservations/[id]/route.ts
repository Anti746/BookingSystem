import { NextResponse } from "next/server";

// ── shared mock store (same instance as /api/reservations/route.ts) ──────────
// Because Next.js bundles each route separately, we keep the store in a module
// that both routes import so they share the same in-memory array.
import { hasSupabase, mockReservations } from "@/lib/mock-store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (hasSupabase) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reservations")
      .select(`*, customer:customers(*), course:courses(*), instructor:instructors(*), room:rooms(*, accommodation_type:accommodation_types(*))`)
      .eq("id", id)
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json(data);
  }

  const reservation = mockReservations.find((r) => r.id === id);
  if (!reservation) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(reservation);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (body.status !== undefined) updateData.status = body.status;
  if (body.instructor_id !== undefined) updateData.instructor_id = body.instructor_id;
  if (body.room_id !== undefined) updateData.room_id = body.room_id;
  if (body.special_requests !== undefined) updateData.special_requests = body.special_requests;
  if (body.total_price !== undefined) updateData.total_price = body.total_price;
  if (body.google_calendar_event_id !== undefined)
    updateData.google_calendar_event_id = body.google_calendar_event_id;

  console.log("PATCH ID:", id);
  console.log("UPDATE DATA:", updateData);

  // ── Try Supabase first (only if configured) ──────────────────────────────
  if (hasSupabase) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("reservations")
        .update(updateData)
        .eq("id", id)
        .select(`*, customer:customers(*), course:courses(*), instructor:instructors(*), room:rooms(*, accommodation_type:accommodation_types(*))`)
        .single();

      if (error) throw error;

      if (body.status === "confirmed") await sendConfirmationEmail(data);
      return NextResponse.json(data);
    } catch (err) {
      // Supabase failed → fall through to the in-memory mock store
      console.log("[v0] Supabase PATCH failed, falling back to mock store:", err);
    }
  }

  // ── Mock fallback (no Supabase, or Supabase failed) ──────────────────────
  const reservation = mockReservations.find((r) => r.id === id);
  if (!reservation) {
    console.log("[v0] Reservation not found in mock store:", id);
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  Object.assign(reservation, updateData);
  if (body.status === "confirmed") await sendConfirmationEmail(reservation);
  return NextResponse.json(reservation);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (hasSupabase) {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { error } = await supabase.from("reservations").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const index = mockReservations.findIndex((r) => r.id === id);
  if (index === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
  mockReservations.splice(index, 1);
  return NextResponse.json({ success: true });
}

async function sendConfirmationEmail(reservation: any) {
  const toEmail = reservation?.customer?.email;
  const apiKey = process.env.RESEND_API_KEY;
  if (!toEmail || !apiKey) return;

  const firstName = reservation?.customer?.first_name || "there";
  const courseName = reservation?.course?.name || "your course";
  const courseDate = reservation?.course_date || "TBD";
  const people = reservation?.number_of_people ?? 1;

  const text = `Hello ${firstName},\n\nYour booking has been confirmed.\n\nCourse: ${courseName}\nDate: ${courseDate}\nPeople: ${people}\n\nThank you!`;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "Surf Wala <onboarding@resend.dev>",
        to: toEmail,
        subject: "Booking Confirmed",
        text,
      }),
    });
  } catch (err) {
    console.log("[v0] Failed to send confirmation email:", err);
  }
}
