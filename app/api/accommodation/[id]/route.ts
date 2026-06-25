import { NextRequest, NextResponse } from "next/server";

import { hasSupabase } from "@/lib/mock-store";

// GET single accommodation type
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
        .from("accommodation_types")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        console.error("ACCOMMODATION FETCH ERROR:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }

    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  } catch (err) {
    console.error("SERVER ERROR (GET ACCOMMODATION):", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// PUT - update accommodation type
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
      if (body.type !== undefined) updateData.type = body.type;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.has_ac !== undefined) updateData.has_ac = body.has_ac;
      if (body.price_per_night !== undefined) updateData.price_per_night = body.price_per_night;

      const { data, error } = await supabase
        .from("accommodation_types")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("ACCOMMODATION UPDATE ERROR:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data);
    }

    // Mock fallback
    const { mockAccommodationTypes } = await import("@/lib/mock-store");
    const idx = mockAccommodationTypes.findIndex((a: { id: string }) => a.id === id);
    if (idx === -1) return NextResponse.json({ error: "Not found" }, { status: 404 });
    Object.assign(mockAccommodationTypes[idx], updateData);
    return NextResponse.json(mockAccommodationTypes[idx]);
  } catch (err) {
    console.error("SERVER ERROR (UPDATE ACCOMMODATION):", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// DELETE accommodation type
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
        .from("accommodation_types")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("ACCOMMODATION DELETE ERROR:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // Mock fallback
    const { mockAccommodationTypes } = await import("@/lib/mock-store");
    const idx = mockAccommodationTypes.findIndex((a: { id: string }) => a.id === id);
    if (idx !== -1) mockAccommodationTypes.splice(idx, 1);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("SERVER ERROR (DELETE ACCOMMODATION):", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
