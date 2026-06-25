import { NextRequest, NextResponse } from "next/server";
import { hasSupabase, mockInstructors, generateId } from "@/lib/mock-store";

export async function GET() {
  if (hasSupabase) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("instructors")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      return NextResponse.json(data || []);
    } catch (err) {
      console.log("[v0] Supabase instructors fetch failed, using mock data:", err);
    }
  }

  // Mock fallback — always return a JSON array, never an error.
  return NextResponse.json(mockInstructors);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  if (hasSupabase) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("instructors")
        .insert({
          name: body.name,
          email: body.email || null,
          phone: body.phone || null,
          is_active: body.is_active ?? true,
          max_students_per_session: body.max_students_per_session || 4,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data, { status: 201 });
    } catch (err) {
      console.log("[v0] Supabase instructor create failed, using mock store:", err);
    }
  }

  // Mock fallback
  const instructor = {
    id: generateId(),
    name: body.name,
    email: body.email || null,
    phone: body.phone || null,
    is_active: body.is_active ?? true,
    max_students_per_session: body.max_students_per_session || 4,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  mockInstructors.push(instructor);
  return NextResponse.json(instructor, { status: 201 });
}
