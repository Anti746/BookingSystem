import { NextResponse } from "next/server";
import { courses } from "@/lib/mock-data";
// ── shared mock store ─────────────────────────────────────────────────────────
import {
  hasSupabase,
  mockReservations,
  mockCustomers,
  generateId,
  getAvailableRooms,
} from "@/lib/mock-store";
import { ROOM_INVENTORY } from "@/lib/room-inventory";

// Detect whether a value is a real UUID (vs a mock id like "5" or a type string).
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

// ── GET – list reservations ───────────────────────────────────────────────────
export async function GET(request: Request) {
  try {
    if (hasSupabase) {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

      const { searchParams } = new URL(request.url);
      const status = searchParams.get("status");
      const date = searchParams.get("date");
      const type = searchParams.get("type");

      let query = supabase
        .from("reservations")
        .select(`
          *,
          customer:customers(*),
          course:courses(*),
          instructor:instructors(*),
          room:rooms(*, accommodation_type:accommodation_types(*))
        `)
        .order("created_at", { ascending: false });

      if (status) query = query.eq("status", status);
      if (date) query = query.or(`course_date.eq.${date},check_in.eq.${date}`);
      if (type === "surf") query = query.not("course_id", "is", null);
      else if (type === "accommodation") query = query.not("room_id", "is", null);

      const { data, error } = await query;

      if (error) {
        console.error("GET RESERVATIONS ERROR:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      // Compute surf_end_date in memory
      const enriched = (data ?? []).map((r: any) => {
        if (!r.course_date || !r.course) return { ...r, surf_end_date: null };
        const name: string = r.course.name ?? "";
        let days = 1;
        if (name.includes("3 Day") || r.course.type === "plunge") days = 3;
        else if (name.includes("5 Day") || r.course.type === "immerse") days = 5;
        if (days <= 1) return { ...r, surf_end_date: r.course_date };
        const d = new Date(r.course_date + "T00:00:00");
        d.setDate(d.getDate() + days - 1);
        return { ...r, surf_end_date: d.toISOString().split("T")[0] };
      });

      return NextResponse.json(enriched);
    }

    // Fallback: return mock reservations
    return NextResponse.json(mockReservations);
  } catch (err) {
    console.error("SERVER ERROR (GET):", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

// ── POST – create reservation(s) ─────────────────────────────────────────────
// For serviceType="both", this creates TWO separate reservation records:
//   1. Surf reservation  (course_id, course_date, course_time, number_of_people)
//   2. Accommodation reservation (accommodation_type, check_in, check_out, room_id)
export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.customer) {
      return NextResponse.json(
        { error: "Customer information is required" },
        { status: 400 }
      );
    }

    const wantsSurf = !!(body.course_type || body.course_id || body.course_date);
    const wantsStay = !!(body.accommodation_type || body.check_in || body.check_out);

    // ── Validate accommodation availability before booking ────────────────────
    if (wantsStay && body.check_in && body.check_out && body.accommodation_type) {
      const roomsNeeded = body.rooms_needed ?? 1;
      const available = getAvailableRooms(body.accommodation_type, body.check_in, body.check_out);
      if (available < roomsNeeded) {
        return NextResponse.json(
          {
            error: `Not enough ${body.accommodation_type} rooms available for this period. Needed: ${roomsNeeded}, Available: ${available}`,
          },
          { status: 409 }
        );
      }
    }

    // ── Supabase path ─────────────────────────────────────────────────────────
    if (hasSupabase) {
      const { createClient } = await import("@/lib/supabase/server");
      const supabase = await createClient();

      // Resolve course UUID
      let resolvedCourseId: string | null = null;
      if (wantsSurf) {
        if (body.course_id && isUuid(body.course_id)) {
          resolvedCourseId = body.course_id;
        } else {
          const typeOrName: string | null =
            body.course_type ||
            (body.course_id && !isUuid(body.course_id) ? body.course_id : null);

          if (typeOrName) {
            const { data: courseByType } = await supabase
              .from("courses")
              .select("id")
              .eq("type", typeOrName)
              .maybeSingle();

            if (courseByType) {
              resolvedCourseId = courseByType.id;
            } else {
              const { data: courseByName } = await supabase
                .from("courses")
                .select("id")
                .ilike("name", `%${typeOrName}%`)
                .maybeSingle();
              resolvedCourseId = courseByName?.id ?? null;
            }
          }
        }
      }

      // Upsert customer
      let customerId: string;
      const { data: existingCustomer } = await supabase
        .from("customers")
        .select("id")
        .eq("email", body.customer.email)
        .maybeSingle();

      if (existingCustomer) {
        customerId = existingCustomer.id;
      } else {
        const { data: newCustomer, error: customerError } = await supabase
          .from("customers")
          .insert({
            first_name: body.customer.first_name,
            last_name: body.customer.last_name,
            email: body.customer.email,
            phone: body.customer.phone,
            instagram_id: body.customer.instagram_id,
          })
          .select("id")
          .single();

        if (customerError) {
          console.error("CUSTOMER ERROR:", customerError);
          return NextResponse.json({ error: customerError.message }, { status: 500 });
        }
        customerId = newCustomer.id;
      }

      // Compute surf end date
      let surfEndDate: string | null = null;
      if (body.course_date && resolvedCourseId) {
        const { data: courseForDuration } = await supabase
          .from("courses")
          .select("name, type")
          .eq("id", resolvedCourseId)
          .single();

        if (courseForDuration) {
          let durationDays = 1;
          const name: string = courseForDuration.name ?? "";
          if (name.includes("3 Day") || courseForDuration.type === "plunge") durationDays = 3;
          else if (name.includes("5 Day") || courseForDuration.type === "immerse") durationDays = 5;

          if (durationDays > 1) {
            const startDate = new Date(body.course_date + "T00:00:00");
            startDate.setDate(startDate.getDate() + durationDays - 1);
            surfEndDate = startDate.toISOString().split("T")[0];
          } else {
            surfEndDate = body.course_date;
          }
        }
      }

      const results: any[] = [];

      // ── Create surf reservation ───────────────────────────────────────────
      if (wantsSurf && resolvedCourseId) {
        let surfPrice = 0;
        const { data: course } = await supabase
          .from("courses")
          .select("price")
          .eq("id", resolvedCourseId)
          .single();
        if (course) surfPrice = course.price * (body.number_of_people || 1);

        const { data: surfRes, error: surfErr } = await supabase
          .from("reservations")
          .insert({
            customer_id: customerId,
            course_id: resolvedCourseId,
            course_date: body.course_date || null,
            course_time: body.course_time || null,
            number_of_people: body.number_of_people || 1,
            number_of_non_swimmers: body.number_of_non_swimmers || 0,
            accommodation_type: null,
            check_in: null,
            check_out: null,
            special_requests: body.special_requests || null,
            total_price: surfPrice,
            status: "pending",
          })
          .select(`*, customer:customers(*), course:courses(*)`)
          .single();

        if (surfErr) {
          console.error("SURF RESERVATION ERROR:", surfErr);
          return NextResponse.json({ error: surfErr.message }, { status: 500 });
        }
        results.push({ ...surfRes, surf_end_date: surfEndDate, type: "surf" });
      }

      // ── Create accommodation reservation ──────────────────────────────────
      if (wantsStay && body.check_in && body.check_out) {
        const roomsNeeded: number = body.rooms_needed ?? 1;

        for (let i = 0; i < roomsNeeded; i++) {
          const roomType = i === 0
            ? (body.accommodation_type || null)
            : (body.extra_room_types?.[i - 1] || body.accommodation_type || null);

          const { data: accRes, error: accErr } = await supabase
            .from("reservations")
            .insert({
              customer_id: customerId,
              course_id: null,
              course_date: null,
              course_time: null,
              number_of_people: body.accommodation_people ?? body.number_of_people ?? 1,
              number_of_non_swimmers: 0,
              accommodation_type: roomType,
              check_in: body.check_in,
              check_out: body.check_out,
              special_requests: body.special_requests || null,
              total_price: 0,
              status: "pending",
            })
            .select(`*, customer:customers(*)`)
            .single();

          if (accErr) {
            console.error("ACCOMMODATION RESERVATION ERROR:", accErr);
            return NextResponse.json({ error: accErr.message }, { status: 500 });
          }
          results.push({ ...accRes, type: "accommodation" });
        }
      }

      // Return first result as primary, rest as `linked`
      const primary = results[0] ?? {};
      return NextResponse.json(
        { ...primary, linked: results.slice(1) },
        { status: 201 }
      );
    }

    // ── Mock fallback ─────────────────────────────────────────────────────────
    const email = body.customer.email || null;
    let existing = email
      ? mockCustomers.find((c) => c.email && c.email === email)
      : undefined;

    if (existing) {
      existing.first_name = body.customer.first_name ?? existing.first_name;
      existing.last_name = body.customer.last_name ?? existing.last_name;
      existing.phone = body.customer.phone ?? existing.phone;
      existing.instagram_id = body.customer.instagram_id ?? existing.instagram_id;
    } else {
      existing = {
        id: generateId(),
        first_name: body.customer.first_name || "",
        last_name: body.customer.last_name || "",
        email,
        phone: body.customer.phone || null,
        instagram_id: body.customer.instagram_id || null,
        created_at: new Date().toISOString(),
      };
      mockCustomers.push(existing);
    }

    const customerId = existing.id;

    // Resolve course from mock data
    let course = null;
    const courseKey: string | null = body.course_id || body.course_type || null;
    if (wantsSurf && courseKey) {
      course =
        courses.find(
          (c) =>
            c.id === courseKey ||
            c.type === courseKey ||
            c.name.toLowerCase().includes(String(courseKey).toLowerCase())
        ) || null;
    }

    // Compute surf end date
    const computeSurfEndDate = (courseDate: string | null, c: typeof courses[0] | null): string | null => {
      if (!courseDate || !c) return null;
      let durationDays = 1;
      if (c.name.includes("3 Day") || c.type === "plunge") durationDays = 3;
      else if (c.name.includes("5 Day") || c.type === "immerse") durationDays = 5;
      if (durationDays <= 1) return courseDate;
      const d = new Date(courseDate + "T00:00:00");
      d.setDate(d.getDate() + durationDays - 1);
      return d.toISOString().split("T")[0];
    };

    const createdReservations: any[] = [];

    // ── Create surf reservation ───────────────────────────────────────────────
    if (wantsSurf) {
      const surfPrice = course ? course.price * (body.number_of_people || 1) : 0;
      const surfRes = {
        id: generateId(),
        customer_id: customerId,
        customer: {
          id: customerId,
          first_name: body.customer.first_name,
          last_name: body.customer.last_name,
          email: body.customer.email,
          phone: body.customer.phone || "",
        },
        course_id: course?.id || null,
        course: course,
        course_date: body.course_date || null,
        surf_end_date: computeSurfEndDate(body.course_date || null, course),
        course_time: body.course_time || null,
        // No accommodation on surf record
        accommodation_type: null,
        room_id: null,
        check_in: null,
        check_out: null,
        number_of_people: body.number_of_people || 1,
        number_of_non_swimmers: body.number_of_non_swimmers || 0,
        special_requests: body.special_requests || null,
        total_price: surfPrice,
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      mockReservations.push(surfRes);
      createdReservations.push({ ...surfRes, type: "surf" });
      console.log("MOCK SURF RESERVATION CREATED:", surfRes.id);
    }

    // ── Create accommodation reservation(s) ───────────────────────────────────
    if (wantsStay && body.check_in && body.check_out) {
      const roomsNeeded: number = body.rooms_needed ?? 1;

      for (let i = 0; i < roomsNeeded; i++) {
        const roomType = i === 0
          ? (body.accommodation_type || null)
          : (body.extra_room_types?.[i - 1] || body.accommodation_type || null);

        const roomId = roomType ? `${roomType}-room-${i + 1}` : null;

        const accRes = {
          id: generateId(),
          customer_id: customerId,
          customer: {
            id: customerId,
            first_name: body.customer.first_name,
            last_name: body.customer.last_name,
            email: body.customer.email,
            phone: body.customer.phone || "",
          },
          course_id: null,
          course: null,
          course_date: null,
          surf_end_date: null,
          course_time: null,
          accommodation_type: roomType,
          room_id: roomId,
          check_in: body.check_in,
          check_out: body.check_out,
          number_of_people: body.accommodation_people ?? body.number_of_people ?? 1,
          number_of_non_swimmers: 0,
          special_requests: body.special_requests || null,
          total_price: 0,
          status: "pending",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        mockReservations.push(accRes);
        createdReservations.push({ ...accRes, type: "accommodation" });
        console.log("MOCK ACC RESERVATION CREATED:", accRes.id);
      }
    }

    if (createdReservations.length === 0) {
      return NextResponse.json(
        { error: "No valid booking data provided" },
        { status: 400 }
      );
    }

    const primary = createdReservations[0];
    return NextResponse.json(
      { ...primary, linked: createdReservations.slice(1) },
      { status: 201 }
    );
  } catch (err) {
    console.error("SERVER ERROR (POST):", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
