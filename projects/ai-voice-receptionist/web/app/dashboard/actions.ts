"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const ACTIVE_BUSINESS_COOKIE = "clinicdesk_active_business";

async function currentBusiness() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login");
  const userId = String(claims.claims.sub);
  const [{ data: memberships, error }, cookieStore] = await Promise.all([
    supabase.from("business_memberships").select("business_id, role").eq("user_id", userId),
    cookies()
  ]);
  if (error) throw new Error(error.message);
  const activeBusinessId = cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value;
  let membership = activeBusinessId
    ? (memberships || []).find((item) => item.business_id === activeBusinessId) || null
    : null;
  if (!membership && (memberships || []).length === 1) membership = memberships![0];
  return { supabase, userId, membership, membershipCount: memberships?.length || 0 };
}

export async function selectActiveBusiness(formData: FormData) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login");
  const userId = String(claims.claims.sub);
  const businessId = String(formData.get("business_id") || "");
  if (!businessId || businessId.length > 100) redirect("/dashboard?error=Choose+a+valid+clinic");
  const { data: membership, error } = await supabase
    .from("business_memberships")
    .select("business_id")
    .eq("user_id", userId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (error || !membership) redirect("/dashboard?error=You+do+not+have+access+to+that+clinic");
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BUSINESS_COOKIE, membership.business_id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
export async function deleteBusiness(formData: FormData) {
  const { supabase, userId, membership } = await currentBusiness();
  const businessId = String(formData.get("business_id") || "");
  const confirmationName = String(formData.get("confirmation_name") || "").trim();

  // The submitted clinic must be the currently selected, verified workspace.
  if (!membership || membership.role !== "owner" || membership.business_id !== businessId) {
    redirect("/dashboard?error=Only+the+owner+of+the+selected+clinic+can+delete+it");
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id,name,created_by")
    .eq("id", businessId)
    .maybeSingle();

  if (businessError || !business || business.created_by !== userId || business.name !== confirmationName) {
    redirect("/dashboard?error=Clinic+name+did+not+match+or+you+are+not+the+creator");
  }

  const { error: deleteError } = await supabase.rpc("delete_business_for_current_user", {
    p_business_id: businessId,
    p_confirmation_name: confirmationName
  });

  if (deleteError) {
    redirect("/dashboard?error=Clinic+could+not+be+deleted.+Please+try+again");
  }

  const cookieStore = await cookies();
  if (cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value === businessId) {
    cookieStore.delete(ACTIVE_BUSINESS_COOKIE);
  }

  // Keep the user in their remaining clinic if only one remains. If several
  // remain, let the existing workspace chooser ask which one to open.
  const { data: remainingMemberships, error: membershipsError } = await supabase
    .from("business_memberships")
    .select("business_id")
    .eq("user_id", userId);

  if (membershipsError) throw new Error(membershipsError.message);
  if (remainingMemberships?.length === 1) {
    cookieStore.set(ACTIVE_BUSINESS_COOKIE, remainingMemberships[0].business_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    });
  }

  revalidatePath("/dashboard");
  redirect("/dashboard?deleted=1");
}

function parseTime12(value: string): string | null {
  const match = /^(1[0-2]|0?[1-9]):([0-5][0-9])\s*(AM|PM)$/i.exec(value.trim());
  if (!match) return null;
  let hour = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hour += 12;
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}
function localDateInTimeZone(value: Date, timeZone: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(value).map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
function bookingError(message: string): never {
  redirect("/dashboard?error=" + encodeURIComponent(message));
}
function localDateTimeToIso(dateValue: string, timeValue: string, timeZone: string): string | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(timeValue);
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
  const { supabase } = await currentBusiness();
  const name = String(formData.get("name") || "").trim();
  const requestKey = String(formData.get("creation_request_key") || "");
  const baseSlug = name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,46);
  const slug = baseSlug && /^[a-f0-9]{32}$/i.test(requestKey) ? `${baseSlug}-${requestKey.slice(0,12).toLowerCase()}` : "";
  const timezone = String(formData.get("timezone") || "Asia/Kolkata");
  if (name.length < 2 || name.length > 120 || !slug) redirect("/dashboard?error=Enter+a+valid+clinic+name");
  const { data, error } = await supabase.rpc("create_business_for_current_user", { p_name: name, p_slug: slug, p_timezone: timezone });
  let createdBusiness = data as { business_id?: string } | null;
  if (error) {
    // A retry with the same request key has the same unique slug. Reuse the
    // clinic created by the first request instead of creating another one.
    if (error.code === "23505" || /duplicate key|already exists/i.test(error.message)) {
      const { data: existing } = await supabase.from("businesses").select("id").eq("slug", slug).maybeSingle();
      if (existing?.id) {
        const { data: existingMembership } = await supabase.from("business_memberships")
          .select("business_id").eq("user_id", (await supabase.auth.getClaims()).data?.claims?.sub || "")
          .eq("business_id", existing.id).maybeSingle();
        if (existingMembership) createdBusiness = { business_id: existingMembership.business_id };
      }
    }
  }
  if (!createdBusiness?.business_id) {
    redirect("/dashboard?error=" + encodeURIComponent(error?.message || "The clinic could not be created. Please try again."));
  }
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BUSINESS_COOKIE, createdBusiness.business_id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
  revalidatePath("/dashboard");
  redirect("/dashboard");
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
    const opensInput = String(formData.get("opens_"+day) || "09:00 AM");
    const closesInput = String(formData.get("closes_"+day) || "06:00 PM");
    const opens = closed ? null : parseTime12(opensInput);
    const closes = closed ? null : parseTime12(closesInput);
    if (!closed && (!opens || !closes || opens >= closes)) bookingError(`Enter valid 12-hour opening and closing times for ${["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][day]}.`);
    const { error } = await supabase.from("business_hours").update({ is_closed: closed, opens_at: opens, closes_at: closes }).eq("business_id", membership.business_id).eq("day_of_week", day);
    if (error) throw new Error(error.message);
  }
  revalidatePath("/dashboard");
}
export async function createAppointment(formData: FormData) {
  const { supabase, membership } = await currentBusiness();
  if (!membership || !["owner", "admin", "staff"].includes(membership.role)) {
    bookingError("You do not have permission to create appointments.");
  }

  const fullName = String(formData.get("full_name") || "").trim();
  const phone = String(formData.get("phone") || "").replace(/\D/g, "");
  const emailRaw = String(formData.get("email") || "").trim();
  const email = emailRaw || null;
  const serviceId = String(formData.get("service_id") || "");
  const date = String(formData.get("date") || "");
  const timeInput = String(formData.get("time") || "");
  const time = parseTime12(timeInput) || "";
  const notes = String(formData.get("notes") || "").trim().slice(0, 1000) || null;
  const idempotencyKey = String(formData.get("idempotency_key") || "");

  if (
    fullName.length < 2 ||
    fullName.length > 120 ||
    !/^\d{10}$/.test(phone) ||
    (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) ||
    idempotencyKey.length < 8 ||
    idempotencyKey.length > 128
  ) {
    bookingError("Enter a valid patient name, 10-digit phone number and email (if supplied).");
  }
  if (!time) bookingError("Choose a valid appointment time.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) bookingError("Choose a valid appointment date.");

  const [{ data: business }, { data: service }, { data: hours }] = await Promise.all([
    supabase.from("businesses").select("timezone").eq("id", membership.business_id).single(),
    supabase.from("services").select("id,duration_minutes").eq("id", serviceId).eq("business_id", membership.business_id).eq("is_active", true).single(),
    supabase.from("business_hours").select("day_of_week,opens_at,closes_at,is_closed").eq("business_id", membership.business_id)
  ]);
  if (!business || !service) bookingError("Choose an active service from your clinic.");

  const startsAt = localDateTimeToIso(date, time, business.timezone);
  if (!startsAt) bookingError("That date or time is invalid for your clinic timezone.");
  if (new Date(startsAt).getTime() <= Date.now()) bookingError("Choose a future appointment time.");

  const localToday = localDateInTimeZone(new Date(), business.timezone);
  const [year, month, day] = date.split("-").map(Number);
  const dateCheck = new Date(Date.UTC(year, month - 1, day));
  if (
    dateCheck.getUTCFullYear() !== year ||
    dateCheck.getUTCMonth() + 1 !== month ||
    dateCheck.getUTCDate() !== day
  ) {
    bookingError("Choose a valid appointment date.");
  }
  const [todayYear, todayMonth, todayDay] = localToday.split("-").map(Number);
  const maxDate = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay));
  maxDate.setUTCDate(maxDate.getUTCDate() + 365);
  const maxDateValue = [maxDate.getUTCFullYear(), String(maxDate.getUTCMonth() + 1).padStart(2, "0"), String(maxDate.getUTCDate()).padStart(2, "0")].join("-");
  if (date < localToday || date > maxDateValue) {
    bookingError("Appointments can be booked up to 365 days in advance.");
  }

  const dayOfWeek = dateCheck.getUTCDay();
  const dayHours = (hours || []).find((item) => item.day_of_week === dayOfWeek);
  if (!dayHours || dayHours.is_closed || !dayHours.opens_at || !dayHours.closes_at) {
    bookingError("The clinic is closed on the selected day.");
  }
  const [openHour, openMinute] = dayHours.opens_at.slice(0, 5).split(":").map(Number);
  const openingMinutes = openHour * 60 + openMinute;
  const [startHour, startMinute] = time.split(":").map(Number);
  const startMinutes = startHour * 60 + startMinute;
  if ((startMinutes - openingMinutes) % 15 !== 0) {
    bookingError("Choose one of the available 15-minute appointment slots.");
  }

  const { data, error } = await supabase.rpc("create_booking", {
    p_business_id: membership.business_id,
    p_service_id: service.id,
    p_customer_name: fullName,
    p_customer_phone: phone,
    p_starts_at: startsAt,
    p_customer_email: email,
    p_notes: notes,
    p_booking_source: "staff",
    p_resource_key: "main-calendar",
    p_idempotency_key: idempotencyKey
  });

  if (error || !data || typeof data !== "object" || !("booking_reference" in data)) {
    const message = error?.message || "The appointment could not be saved. Please try again.";
    if (/slot has just been booked|conflicting booking|outside business hours|future|active service|365 days/i.test(message)) {
      bookingError(message);
    }
    bookingError("The appointment could not be saved. Please try again.");
  }

  const bookingReference = String((data as { booking_reference: string }).booking_reference);
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


export async function getAvailableSlots(date: string, serviceId: string): Promise<{ slots: string[]; message: string }> {
  const { supabase, membership } = await currentBusiness();
  if (!membership || !["owner", "admin", "staff"].includes(membership.role)) {
    return { slots: [], message: "You do not have permission to view appointment availability." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !serviceId) {
    return { slots: [], message: "Choose a service and appointment date to see available times." };
  }
  const [{ data: business }, { data: service }, { data: hours }] = await Promise.all([
    supabase.from("businesses").select("timezone").eq("id", membership.business_id).single(),
    supabase.from("services").select("id,duration_minutes").eq("id", serviceId).eq("business_id", membership.business_id).eq("is_active", true).single(),
    supabase.from("business_hours").select("day_of_week,opens_at,closes_at,is_closed").eq("business_id", membership.business_id)
  ]);
  if (!business || !service) return { slots: [], message: "Choose a valid active service." };
  const [year, month, day] = date.split("-").map(Number);
  const dateCheck = new Date(Date.UTC(year, month - 1, day));
  if (dateCheck.getUTCFullYear() !== year || dateCheck.getUTCMonth() + 1 !== month || dateCheck.getUTCDate() !== day) {
    return { slots: [], message: "Choose a valid date." };
  }
  const localToday = localDateInTimeZone(new Date(), business.timezone);
  const [todayYear, todayMonth, todayDay] = localToday.split("-").map(Number);
  const maxDate = new Date(Date.UTC(todayYear, todayMonth - 1, todayDay));
  maxDate.setUTCDate(maxDate.getUTCDate() + 365);
  const maxDateValue = [maxDate.getUTCFullYear(), String(maxDate.getUTCMonth() + 1).padStart(2, "0"), String(maxDate.getUTCDate()).padStart(2, "0")].join("-");
  if (date < localToday || date > maxDateValue) {
    return { slots: [], message: "Choose a date within the next 365 days." };
  }
  const dayOfWeek = dateCheck.getUTCDay();
  const dayHours = (hours || []).find((item) => item.day_of_week === dayOfWeek);
  if (!dayHours || dayHours.is_closed || !dayHours.opens_at || !dayHours.closes_at) {
    return { slots: [], message: "The clinic is closed on this date." };
  }
  const dayStart = localDateTimeToIso(date, "00:00", business.timezone);
  const nextDate = new Date(Date.UTC(year, month - 1, day + 1));
  const nextDateValue = [nextDate.getUTCFullYear(), String(nextDate.getUTCMonth() + 1).padStart(2, "0"), String(nextDate.getUTCDate()).padStart(2, "0")].join("-");
  const dayEnd = localDateTimeToIso(nextDateValue, "00:00", business.timezone);
  if (!dayStart || !dayEnd) return { slots: [], message: "Could not calculate this clinic date." };
  const { data: existing, error } = await supabase.from("appointments")
    .select("starts_at,ends_at")
    .eq("business_id", membership.business_id)
    .eq("resource_key", "main-calendar")
    .in("status", ["pending", "confirmed"])
    .lt("starts_at", dayEnd)
    .gt("ends_at", dayStart);
  if (error) return { slots: [], message: "Could not load availability. Please try again." };
  const [openHour, openMinute] = dayHours.opens_at.slice(0, 5).split(":").map(Number);
  const [closeHour, closeMinute] = dayHours.closes_at.slice(0, 5).split(":").map(Number);
  const opening = openHour * 60 + openMinute;
  const closing = closeHour * 60 + closeMinute;
  const now = Date.now();
  const slots: string[] = [];
  for (let start = opening; start + service.duration_minutes <= closing; start += 15) {
    const hour = Math.floor(start / 60);
    const minute = start % 60;
    const localTime = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
    const startsAt = localDateTimeToIso(date, localTime, business.timezone);
    if (!startsAt || new Date(startsAt).getTime() <= now) continue;
    const endsAt = new Date(new Date(startsAt).getTime() + service.duration_minutes * 60_000).toISOString();
    const hasConflict = (existing || []).some((appointment) =>
      new Date(appointment.starts_at).getTime() < new Date(endsAt).getTime() &&
      new Date(appointment.ends_at).getTime() > new Date(startsAt).getTime()
    );
    if (hasConflict) continue;
    const displayHour = hour % 12 || 12;
    slots.push(`${displayHour}:${String(minute).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`);
  }
  return { slots, message: slots.length ? `${slots.length} available start times.` : "No available slots for this service on that date." };
}
