import { NextRequest, NextResponse } from "next/server";

const hasSupabase = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// GET all rooms with their accommodation types
export async function GET(request: NextRequest) {
  try {
    if (hasSupabase) {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

      const { searchParams } = new URL(request.url);
      const accommodationTypeId = searchParams.get("accommodation_type_id");

      let query = supabase
        .from("rooms")
        .select(`
          *,
          accommodation_type:accommodation_types(*)
        `)
        .order("name", { ascending: true });

      if (accommodationTypeId) {
        query = query.eq("accommodation_type_id", accommodationTypeId);
      }

      const { data, error } = await query;

      if (error) {
        console.error("ROOMS FETCH ERROR:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data ?? []);
    }

    return NextResponse.json([]);
  } catch (err) {
    console.error("SERVER ERROR (GET ROOMS):", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// POST - create a new room
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || !body.accommodation_type_id) {
      return NextResponse.json(
        { error: "Missing required fields: name, accommodation_type_id" },
        { status: 400 }
      );
    }

    if (hasSupabase) {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

      const { data, error } = await supabase
        .from("rooms")
        .insert({
          name: body.name,
          accommodation_type_id: body.accommodation_type_id,
          is_available: body.is_available ?? true,
        })
        .select(`
          *,
          accommodation_type:accommodation_types(*)
        `)
        .single();

      if (error) {
        console.error("ROOM CREATE ERROR:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data, { status: 201 });
    }

    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  } catch (err) {
    console.error("SERVER ERROR (CREATE ROOM):", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
