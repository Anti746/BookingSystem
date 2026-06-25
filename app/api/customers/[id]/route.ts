import { NextResponse } from "next/server";
import { hasSupabase, mockCustomers, mockReservations } from "@/lib/mock-store";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (hasSupabase) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;

      const { data: reservations } = await supabase
        .from("reservations")
        .select(`*, course:courses(*), instructor:instructors(*), room:rooms(*)`)
        .eq("customer_id", id)
        .order("created_at", { ascending: false });

      return NextResponse.json({ ...data, reservations: reservations || [] });
    } catch (err) {
      console.log("[v0] Supabase customer fetch failed, using mock data:", err);
    }
  }

  // Mock fallback
  const customer = mockCustomers.find((c) => c.id === id);
  if (!customer) {
    return NextResponse.json({ error: "Customer not found", reservations: [] }, { status: 404 });
  }
  const reservations = mockReservations.filter((r) => r.customer_id === id);
  return NextResponse.json({ ...customer, reservations });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const updateData: Record<string, unknown> = {};
  if (body.first_name !== undefined) updateData.first_name = body.first_name;
  if (body.last_name !== undefined) updateData.last_name = body.last_name;
  if (body.email !== undefined) updateData.email = body.email;
  if (body.phone !== undefined) updateData.phone = body.phone;
  if (body.instagram_id !== undefined) updateData.instagram_id = body.instagram_id;

  if (hasSupabase) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { data, error } = await supabase
        .from("customers")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    } catch (err) {
      console.log("[v0] Supabase customer update failed, using mock store:", err);
    }
  }

  // Mock fallback
  const customer = mockCustomers.find((c) => c.id === id);
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }
  Object.assign(customer, updateData);
  return NextResponse.json(customer);
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (hasSupabase) {
    try {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
      return NextResponse.json({ success: true });
    } catch (err) {
      console.log("[v0] Supabase customer delete failed, using mock store:", err);
    }
  }

  // Mock fallback
  const index = mockCustomers.findIndex((c) => c.id === id);
  if (index === -1) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }
  mockCustomers.splice(index, 1);
  return NextResponse.json({ success: true });
}
