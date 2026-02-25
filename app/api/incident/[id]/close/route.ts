// usage: POST /api/incident/[id]/close
// body: { description?: string }
// only tier 3 (Authority) can close incidents

import { NextRequest, NextResponse } from "next/server";
import { updateById, getById } from "@/lib/supabase/utils";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { ApiErrors } from "@/lib/api-errors";
import { IncidentStatus, Tier } from "@/lib/types";

interface Incident {
    id: string;
    title: string;
    description?: string | null;
    status: IncidentStatus | string;
    priority: string;
    report_id?: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
    closed_at?: string | null;
}

interface Profile {
    id: string;
    tier: Tier;
}

async function checkAuthority(userId: string): Promise<boolean> {
    const profile = await getById<Profile>("profiles", userId);
    return profile?.tier === Tier.Authority;
}

export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;

        const body = await req.json().catch(() => ({}));
        const description = (body as any)?.description;

        const supabase = await createSupabaseServerClient();
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(ApiErrors.UNAUTHORIZED, {
                status: ApiErrors.UNAUTHORIZED.code,
            });
        }

        // Check if user is Authority (tier 3)
        const isAuthority = await checkAuthority(user.id);
        if (!isAuthority) {
            return NextResponse.json(ApiErrors.UNAUTHORIZED, {
                status: ApiErrors.UNAUTHORIZED.code,
            });
        }

        // Verify incident exists
        const existing = await getById<Incident>("incidents", id);
        if (!existing) {
            return NextResponse.json({ error: "Incident not found" }, { status: 404 });
        }

        // Cannot close a closed incident
        const existingStatusUpper = String((existing as any)?.status ?? "").toUpperCase();
        const closedEnumUpper = String(IncidentStatus.Closed).toUpperCase();
        if (existingStatusUpper === "CLOSED" || existingStatusUpper === closedEnumUpper) {
            return NextResponse.json(
                { error: "Incident is already closed" },
                { status: 400 }
            );
        }

        // Build update object
        const updates: Partial<Incident> = {
            status: IncidentStatus.Closed,
            closed_at: new Date().toISOString(),
        };

        if (description !== undefined) {
            updates.description = typeof description === "string" ? description : null;
        }

        const data = await updateById<Incident>("incidents", id, updates);

        if (!data) {
            return NextResponse.json(ApiErrors.SERVER_ERROR, {
                status: ApiErrors.SERVER_ERROR.code,
            });
        }

        // Return both shapes to avoid breaking either caller
        return NextResponse.json({ data, incident: data }, { status: 200 });
    } catch (err) {
        console.error(err);
        return NextResponse.json(ApiErrors.SERVER_ERROR, {
            status: ApiErrors.SERVER_ERROR.code,
        });
    }
}