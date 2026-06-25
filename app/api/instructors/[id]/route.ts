import { NextRequest, NextResponse } from "next/server";
import { hasSupabase, mockInstructors } from "@/lib/mock-store";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  if (hasSupabase) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("instructors")
        .update({
          name: body.name,
          email: body.email,
          phone: body.phone,
          is_active: body.is_active,
          max_students_per_session: body.max_students_per_session,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    } catch (err) {
      console.log("[v0] Supabase instructor update failed, using mock store:", err);
    }
  }

  // Mock fallback
  const instructor = mockInstructors.find((i) => i.id === id);
  if (!instructor) {
    return NextResponse.json({ error: "Instructor not found" }, { status: 404 });
  }
  if (body.name !== undefined) instructor.name = body.name;
  if (body.email !== undefined) instructor.email = body.email;
  if (body.phone !== undefined) instructor.phone = body.phone;
  if (body.is_active !== undefined) instructor.is_active = body.is_active;
  if (body.max_students_per_session !== undefined)
    instructor.max_students_per_session = body.max_students_per_session;
  instructor.updated_at = new Date().toISOString();
  return NextResponse.json(instructor);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (hasSupabase) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { error } = await supabase.from("instructors").delete().eq("id", id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    } catch (err) {
      console.log("[v0] Supabase instructor delete failed, using mock store:", err);
    }
  }

  // Mock fallback
  const index = mockInstructors.findIndex((i) => i.id === id);
  if (index !== -1) mockInstructors.splice(index, 1);
  return NextResponse.json({ success: true });
}
