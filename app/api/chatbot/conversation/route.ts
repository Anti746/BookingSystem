import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// GET conversation state by instagram_user_id
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const instagramUserId = searchParams.get("instagram_user_id");

  if (!instagramUserId) {
    return NextResponse.json(
      { error: "instagram_user_id is required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("conversation_states")
    .select("*")
    .eq("instagram_user_id", instagramUserId)
    .single();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || null);
}

// POST - create or update conversation state
export async function POST(request: Request) {
  const body = await request.json();
  const supabase = await createClient();

  if (!body.instagram_user_id) {
    return NextResponse.json(
      { error: "instagram_user_id is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("conversation_states")
    .upsert(
      {
        instagram_user_id: body.instagram_user_id,
        current_step: body.current_step || "welcome",
        data_json: body.data_json || {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "instagram_user_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// DELETE - clear conversation state
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const instagramUserId = searchParams.get("instagram_user_id");

  if (!instagramUserId) {
    return NextResponse.json(
      { error: "instagram_user_id is required" },
      { status: 400 }
    );
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("conversation_states")
    .delete()
    .eq("instagram_user_id", instagramUserId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
