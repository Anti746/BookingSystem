import { NextRequest, NextResponse } from "next/server";

const hasSupabase = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// GET single room
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (hasSupabase) {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

      const { data, error } = await supabase
        .from("rooms")
        .select(`
          *,
          accommodation_type:accommodation_types(*)
        `)
        .eq("id", id)
        .single();

      if (error) {
        console.error("ROOM FETCH ERROR:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  } catch (err) {
    console.error("SERVER ERROR (GET ROOM):", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PUT - update room
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    if (hasSupabase) {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) updateData.name = body.name;
      if (body.accommodation_type_id !== undefined) updateData.accommodation_type_id = body.accommodation_type_id;
      if (body.is_available !== undefined) updateData.is_available = body.is_available;

      const { data, error } = await supabase
        .from("rooms")
        .update(updateData)
        .eq("id", id)
        .select(`
          *,
          accommodation_type:accommodation_types(*)
        `)
        .single();

      if (error) {
        console.error("ROOM UPDATE ERROR:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  } catch (err) {
    console.error("SERVER ERROR (UPDATE ROOM):", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE room
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (hasSupabase) {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

      const { error } = await supabase
        .from("rooms")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("ROOM DELETE ERROR:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  } catch (err) {
    console.error("SERVER ERROR (DELETE ROOM):", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
