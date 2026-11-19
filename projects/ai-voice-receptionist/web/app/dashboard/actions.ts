"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function currentBusiness() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login");
  const { data: membership, error } = await supabase.from("business_memberships").select("business_id, role").limit(1).maybeSingle();
  if (error) throw new Error(error.message);
  return { supabase, userId: String(claims.claims.sub), membership };
}
export async function createBusiness(formData: FormData) {
  const { supabase, membership } = await currentBusiness();
  if (membership) redirect("/dashboard");
  const name = String(formData.get("name") || "").trim();
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,50);
  const timezone = String(formData.get("timezone") || "Asia/Kolkata");
  if (name.length < 2 || !slug) redirect("/dashboard?error=Enter+a+valid+clinic+name");
  const { error } = await supabase.rpc("create_business_for_current_user", { p_name: name, p_slug: slug, p_timezone: timezone });
  if (error) redirect("/dashboard?error=" + encodeURIComponent(error.message));
  revalidatePath("/dashboard"); redirect("/dashboard");
}
export async function addService(formData: FormData) {
  const { supabase, membership } = await currentBusiness();
  if (!membership || !["owner","admin"].includes(membership.role)) throw new Error("Only clinic owners and admins can edit services.");
  const name = String(formData.get("name") || "").trim();
  const duration = Number(formData.get("duration"));
  const priceRaw = String(formData.get("price") || "").trim();
  const price = priceRaw ? Number(priceRaw) : null;
  if (!name || !Number.isInteger(duration) || duration < 5 || duration > 480 || (price !== null && (!Number.isFinite(price) || price < 0))) throw new Error("Check service name, duration and price.");
  const { error } = await supabase.from("services").insert({ business_id: membership.business_id, name, duration_minutes: duration, price });
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}
export async function saveHours(formData: FormData) {
  const { supabase, membership } = await currentBusiness();
  if (!membership || !["owner","admin"].includes(membership.role)) throw new Error("Only clinic owners and admins can edit hours.");
  for (let day=0; day<7; day++) {
    const closed = formData.get("closed_"+day) === "on";
    const opens = String(formData.get("opens_"+day) || "09:00");
    const closes = String(formData.get("closes_"+day) || "18:00");
    const { error } = await supabase.from("business_hours").update({ is_closed: closed, opens_at: closed ? null : opens, closes_at: closed ? null : closes }).eq("business_id", membership.business_id).eq("day_of_week", day);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/dashboard");
}
export async function updateAppointment(formData: FormData) {
  const { supabase, membership } = await currentBusiness();
  if (!membership || !["owner","admin","staff"].includes(membership.role)) throw new Error("Not authorized.");
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!["confirmed","cancelled","completed","no_show"].includes(status)) throw new Error("Invalid appointment status.");
  const { error } = await supabase.from("appointments").update({ status }).eq("id",id).eq("business_id",membership.business_id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}