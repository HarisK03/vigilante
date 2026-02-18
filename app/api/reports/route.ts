import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { NextResponse } from "next/server";

// GET: return current user's own reports (optionally filtered by status)
export async function GET(request: Request) {
    // Connect to Supabase server client
    const supabase = await createSupabaseServerClient();

    // Require login because reports.user_id is NOT NULL
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user;

    if (authError || !user) {
        return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    // Optional filter: /api/reports?status=unverified
    const url = new URL(request.url);
    const status = (url.searchParams.get("status") ?? "").trim();

    let query = supabase
        .from("reports")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    if (status) {
        query = query.eq("status", status);
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reports: data ?? [] }, { status: 200 });
}



// creates the POST functionality
export async function POST(request: Request) {
    // read the request sent by the client
    const body = await request.json();
    // Extract fields based on Supabase schema (reports table)
    const type = body.type;
    const description = body.description;

    // Optional coordinates for map display
    const latitude = body.latitude;
    const longitude = body.longitude;


    // Validate required fields (reports.type is NOT NULL in schema)
    if (!type || typeof type !== "string" || type.trim() === "") {
        return NextResponse.json(
            { error: "Type is required" },
            { status: 400 }
        );
    }


    // connects to the Supabase server
    const supabase = await createSupabaseServerClient();

    // Require login because reports.user_id is NOT NULL and references profiles(id)
    const { data: authData, error: authError } = await supabase.auth.getUser();
    const user = authData?.user;

    if (authError || !user) {
        return NextResponse.json(
            { error: "UNAUTHORIZED" },
            { status: 401 }
        );
    }

    // Inputs title, type, location, and description in the Supabase "reports" table
    const { data, error } = await supabase
        .from("reports")
        .insert({
            // Required by schema
            type: type.trim(),

            description: typeof description === "string" ? description : null,
            latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : null,
            longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : null,


            status: "unverified",

            user_id: user.id,
        })


        // returns to either data or error
        .select()
        .single();

    // error if data failed to be recorded in the table
    if (error) {
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
    // if data was recorded successfully, returns the data
    return NextResponse.json(
        { report: data },
        { status: 201 }
    );
}
