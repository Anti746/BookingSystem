import { NextResponse } from "next/server";
import { hasSupabase, mockCustomers, generateId } from "@/lib/mock-store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");

  if (hasSupabase) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

      let query = supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false });

      if (search) {
        query = query.or(
          `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;
      return NextResponse.json(data || []);
    } catch (err) {
      console.log("[v0] Supabase customers fetch failed, using mock data:", err);
    }
  }

  // Mock fallback — always return a JSON array, never an error.
  let results = mockCustomers;
  if (search) {
    const q = search.toLowerCase();
    results = mockCustomers.filter((c) =>
      [c.first_name, c.last_name, c.email, c.phone]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q))
    );
  }
  return NextResponse.json(results);
}

export async function POST(request: Request) {
  const body = await request.json();

  if (hasSupabase) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("customers")
        .insert({
          first_name: body.first_name,
          last_name: body.last_name,
          email: body.email,
          phone: body.phone,
          instagram_id: body.instagram_id,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data, { status: 201 });
    } catch (err) {
      console.log("[v0] Supabase customer create failed, using mock store:", err);
    }
  }

  // Mock fallback
  const customer = {
    id: generateId(),
    first_name: body.first_name,
    last_name: body.last_name,
    email: body.email || null,
    phone: body.phone || null,
    instagram_id: body.instagram_id || null,
    created_at: new Date().toISOString(),
  };
  mockCustomers.push(customer);
  return NextResponse.json(customer, { status: 201 });
}
