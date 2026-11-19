"use server";
import { randomBytes } from "node:crypto";
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
function bookingError(message: string): never {
  redirect("/dashboard?error=" + encodeURIComponent(message));
}
function localDateTimeToIso(dateValue: string, timeValue: string, timeZone: string): string | null {
  const dateMatch = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(dateValue);
  const timeMatch = /^(\\d{2}):(\\d{2})$/.exec(timeValue);
  if (!dateMatch || !timeMatch) return null;
  const [, ys, ms, ds] = dateMatch;
  const [, hs, mins] = timeMatch;
  const parts = [Number(ys), Number(ms), Number(ds), Number(hs), Number(mins)];
  const [year, month, day, hour, minute] = parts;
  const target = Date.UTC(year, month - 1, day, hour, minute);
  const check = new Date(Date.UTC(year, month - 1, day));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day || hour > 23 || minute > 59) return null;
  try {
    const formatter = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    let candidate = target;
    for (let i = 0; i < 4; i++) {
      const values = Object.fromEntries(formatter.formatToParts(new Date(candidate)).map((part) => [part.type, part.value]));
      const represented = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute));
      candidate += target - represented;
    }
    const finalParts = Object.fromEntries(formatter.formatToParts(new Date(candidate)).map((part) => [part.type, part.value]));
    if (Number(finalParts.year) !== year || Number(finalParts.month) !== month || Number(finalParts.day) !== day || Number(finalParts.hour) !== hour || Number(finalParts.minute) !== minute) return null;
    return new Date(candidate).toISOString();
  } catch {
    return null;
  }
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
export async function createAppointment(formData: FormData) {
  const { supabase, membership } = await currentBusiness();
  if (!membership || !["owner","admin","staff"].includes(membership.role)) bookingError("You do not have permission to create appointments.");
  const fullName = String(formData.get("full_name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const emailRaw = String(formData.get("email") || "").trim();
  const email = emailRaw || null;
  const serviceId = String(formData.get("service_id") || "");
  const date = String(formData.get("date") || "");
  const time = String(formData.get("time") || "");
  const notes = String(formData.get("notes") || "").trim().slice(0, 1000) || null;
  if (fullName.length < 2 || fullName.length > 120 || !/^\\+?[0-9 ()-]{7,20}$/.test(phone) || (email && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email))) bookingError("Enter a valid patient name, phone number and email.");
  const [{ data: business }, { data: service }, { data: hours }] = await Promise.all([
    supabase.from("businesses").select("timezone").eq("id", membership.business_id).single(),
    supabase.from("services").select("id,name,duration_minutes").eq("id", serviceId).eq("business_id", membership.business_id).eq("is_active", true).single(),
    supabase.from("business_hours").select("day_of_week,opens_at,closes_at,is_closed").eq("business_id", membership.business_id)
  ]);
  if (!business || !service) bookingError("Choose an active service from your clinic.");
  const startsAt = localDateTimeToIso(date, time, business.timezone);
  if (!startsAt) bookingError("That date or time is invalid for your clinic timezone.");
  const startDate = new Date(startsAt);
  if (startDate.getTime() <= Date.now()) bookingError("Choose a future appointment time.");
  const [year, month, day] = date.split("-").map(Number);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const dayHours = (hours || []).find((item) => item.day_of_week === dayOfWeek);
  if (!dayHours || dayHours.is_closed || !dayHours.opens_at || !dayHours.closes_at) bookingError("The clinic is closed on the selected day.");
  const [openHour, openMinute] = dayHours.opens_at.slice(0, 5).split(":").map(Number);
  const [closeHour, closeMinute] = dayHours.closes_at.slice(0, 5).split(":").map(Number);
  const [startHour, startMinute] = time.split(":").map(Number);
  const startMinutes = startHour * 60 + startMinute;
  const endMinutes = startMinutes + service.duration_minutes;
  if (startMinutes < openHour * 60 + openMinute || endMinutes > closeHour * 60 + closeMinute) bookingError("The appointment must fit inside the clinic's opening hours.");
  const endsAt = new Date(startDate.getTime() + service.duration_minutes * 60_000).toISOString();
  const { data: overlap, error: overlapError } = await supabase.from("appointments").select("id").eq("business_id", membership.business_id).eq("resource_key", "main-calendar").in("status", ["pending", "confirmed"]).lt("starts_at", endsAt).gt("ends_at", startsAt).limit(1);
  if (overlapError) bookingError("Could not check availability. Please try again.");
  if (overlap?.length) bookingError("That time is already booked. Choose another time.");
  let customerId: string;
  const { data: existingCustomer, error: customerLookupError } = await supabase.from("customers").select("id").eq("business_id", membership.business_id).eq("phone", phone).maybeSingle();
  if (customerLookupError) bookingError("Could not look up the patient record.");
  if (existingCustomer) {
    customerId = existingCustomer.id;
    const { error } = await supabase.from("customers").update({ full_name: fullName, email }).eq("id", customerId).eq("business_id", membership.business_id);
    if (error) bookingError("Could not update the patient record.");
  } else {
    const { data: customer, error } = await supabase.from("customers").insert({ business_id: membership.business_id, full_name: fullName, phone, email }).select("id").single();
    if (error || !customer) bookingError("Could not create the patient record. Check whether the phone number is already in use.");
    customerId = customer.id;
  }
  const bookingReference = "CD-" + randomBytes(4).toString("hex").toUpperCase();
  const { error: appointmentError } = await supabase.from("appointments").insert({
    business_id: membership.business_id, customer_id: customerId, service_id: service.id,
    starts_at: startsAt, ends_at: endsAt, status: "confirmed", booking_source: "staff",
    resource_key: "main-calendar", booking_reference: bookingReference, notes
  });
  if (appointmentError) {
    if (appointmentError.code === "23P01" || appointmentError.code === "23505") bookingError("That slot was just booked. Choose another time.");
    bookingError("The appointment could not be saved. Please try again.");
  }
  revalidatePath("/dashboard");
  redirect("/dashboard?booked=" + encodeURIComponent(bookingReference));
}
export async function updateAppointment(formData: FormData) {
  const { supabase, membership } = await currentBusiness();
  if (!membership || !["owner","admin","staff"].includes(membership.role)) throw new Error("Not authorized.");
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "");
  if (!["pending","confirmed","cancelled","completed","no_show"].includes(status)) throw new Error("Invalid appointment status.");
  const { error } = await supabase.from("appointments").update({ status }).eq("id",id).eq("business_id",membership.business_id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}
