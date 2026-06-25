import { NextRequest, NextResponse } from "next/server";
import { courses as mockCourses } from "@/lib/mock-data";

// Check if Supabase is configured
const hasSupabase = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// ✅ GET – načítanie kurzov
export async function GET() {
  try {
    // If Supabase is configured, use it
    if (hasSupabase) {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

      const { data, error } = await supabase
        .from("courses")
        .select("*")
        .order("price", { ascending: true });

      if (error) {
        console.error("COURSES FETCH ERROR:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data ?? []);
    }

    // Fallback: return mock courses
    return NextResponse.json(mockCourses);
  } catch (err) {
    console.error("SERVER ERROR (GET COURSES):", err);
    return NextResponse.json(
      { error: "Server error while fetching courses" },
      { status: 500 }
    );
  }
}

// ✅ POST – vytvorenie kurzu (admin)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || !body.price) {
      return NextResponse.json(
        { error: "Missing required fields: name, price" },
        { status: 400 }
      );
    }

    // If Supabase is configured, use it
    if (hasSupabase) {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

      const { data, error } = await supabase
        .from("courses")
        .insert({
          name: body.name,
          name_en: body.name_en || body.name,
          type: body.type || "surf",
          duration: body.duration || null,
          price: body.price,
          max_students_per_instructor: body.max_students_per_instructor || 4,
        })
        .select()
        .single();

      if (error) {
        console.error("COURSE CREATE ERROR:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data, { status: 201 });
    }

    // Fallback: return mock created course
    const newCourse = {
      id: String(mockCourses.length + 1),
      name: body.name,
      type: body.type || "surf",
      duration: body.duration || null,
      price: body.price,
    };

    return NextResponse.json(newCourse, { status: 201 });
  } catch (err) {
    console.error("SERVER ERROR (CREATE COURSE):", err);
    return NextResponse.json(
      { error: "Server error while creating course" },
      { status: 500 }
    );
  }
}
