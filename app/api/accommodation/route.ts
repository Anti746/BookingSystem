import { NextRequest, NextResponse } from "next/server";
import { hasSupabase, mockAccommodationTypes, generateId } from "@/lib/mock-store";

// Use shared mutable mock store — price edits persist within the session.
const mockAccommodation = mockAccommodationTypes;

export async function GET() {
  if (hasSupabase) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("accommodation_types")
        .select("*")
        .order("price_per_night", { ascending: true });

      if (error) throw error;
      return NextResponse.json(data || []);
    } catch (err) {
      console.log("[v0] Supabase accommodation fetch failed, using mock data:", err);
    }
  }

  // Mock fallback — always return a JSON array, never an error.
  return NextResponse.json(mockAccommodation);
}

// POST - create a new accommodation type
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.name || !body.type || body.price_per_night === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: name, type, price_per_night" },
        { status: 400 }
      );
    }

    if (hasSupabase) {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

      const { data, error } = await supabase
        .from("accommodation_types")
        .insert({
          name: body.name,
          type: body.type,
          description: body.description || null,
          has_ac: body.has_ac ?? false,
          price_per_night: body.price_per_night,
        })
        .select()
        .single();

      if (error) {
        console.error("ACCOMMODATION CREATE ERROR:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data, { status: 201 });
    }

    // Mock fallback: save to shared mutable store
    const newAcc = {
      id: generateId(),
      name: body.name,
      type: body.type,
      description: body.description || null,
      has_ac: body.has_ac ?? false,
      price_per_night: body.price_per_night,
      created_at: new Date().toISOString(),
    };
    mockAccommodationTypes.push(newAcc);
    return NextResponse.json(newAcc, { status: 201 });
  } catch (err) {
    console.error("SERVER ERROR (CREATE ACCOMMODATION):", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
