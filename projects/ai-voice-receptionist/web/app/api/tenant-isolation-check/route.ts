import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Temporary, read-only tenant-isolation probe. Available only on Vercel Preview.
const TEST_APPOINTMENT_ID = "bf841d4c-9238-40c8-825b-513c8589fc53";

export async function GET() {
  if (process.env.VERCEL_ENV !== "preview") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !claims?.claims?.sub) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("business_memberships")
    .select("business_id")
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership) {
    return NextResponse.json({ error: "Clinic membership required" }, { status: 403 });
  }

  // RLS should return no row for a user belonging to another clinic.
  const { data: appointment, error } = await supabase
    .from("appointments")
    .select("id")
    .eq("id", TEST_APPOINTMENT_ID)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "Isolation probe failed" }, { status: 500 });
  }

  return NextResponse.json({
    authenticated: true,
    clinicMembershipFound: true,
    crossClinicAppointmentVisible: Boolean(appointment),
    expectedForV6Clinic: false,
  });
}
