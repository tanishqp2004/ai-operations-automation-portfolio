"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const validSlug = (value: string) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 100;

export async function getPublicAvailableSlots(
  slug: string,
  serviceId: string,
  date: string
): Promise<{ slots: { start: string; end: string }[]; message: string }> {
  if (!validSlug(slug) || !/^[0-9a-f-]{36}$/i.test(serviceId) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { slots: [], message: "Choose a service and date to see available times." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_available_slots", {
    p_slug: slug,
    p_service_id: serviceId,
    p_local_date: date
  });

  if (error) {
    const message = /30 days/i.test(error.message)
      ? "Online appointments can be booked up to 30 days ahead."
      : "We couldn't load availability. Please try again.";
    return { slots: [], message };
  }

  const slots = (data || []).map((slot: { slot_start: string; slot_end: string }) => ({
    start: slot.slot_start,
    end: slot.slot_end
  }));
  return {
    slots,
    message: slots.length ? `${slots.length} available start times.` : "No available times for this service on that date."
  };
}

export async function createPublicBooking(slug: string, formData: FormData): Promise<never> {
  if (!validSlug(slug)) redirect("/");

  // Honeypot field: real patients never see or fill this.
  if (String(formData.get("website") || "").trim()) {
    redirect(`/book/${slug}?error=${encodeURIComponent("We couldn't complete that request. Please try again.")}`);
  }

  const serviceId = String(formData.get("service_id") || "");
  const fullName = String(formData.get("full_name") || "").trim();
  const phoneDigits = String(formData.get("phone") || "").replace(/\D/g, "");
  const phone = `+91${phoneDigits}`;
  const emailRaw = String(formData.get("email") || "").trim();
  const email = emailRaw || null;
  const startsAt = String(formData.get("starts_at") || "");
  const idempotencyKey = String(formData.get("idempotency_key") || "");

  const validStartsAt =
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(startsAt) &&
    Number.isFinite(Date.parse(startsAt));

  let validationMessage = "";
  if (!/^[0-9a-f-]{36}$/i.test(serviceId)) {
    validationMessage = "Please choose a service.";
  } else if (fullName.length < 2 || fullName.length > 120) {
    validationMessage = "Please enter your name (2–120 characters).";
  } else if (!/^[6-9]\d{9}$/.test(phoneDigits)) {
    validationMessage = "Please enter a valid 10-digit Indian mobile number.";
  } else if (email && (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    validationMessage = "Please enter a valid email address.";
  } else if (!validStartsAt) {
    validationMessage = "Please select an available appointment time.";
  } else if (!/^[0-9a-f-]{36}$/i.test(idempotencyKey)) {
    validationMessage = "Your booking session expired. Refresh the page and try again.";
  }

  if (validationMessage) {
    redirect(`/book/${slug}?error=${encodeURIComponent(validationMessage)}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_public_booking", {
    p_slug: slug,
    p_service_id: serviceId,
    p_customer_name: fullName,
    p_customer_phone: phone,
    p_customer_email: email,
    p_starts_at: startsAt,
    p_idempotency_key: idempotencyKey
  });

  if (error || !data || typeof data !== "object" || !("booking_reference" in data)) {
    const source = error?.message || "";
    let message = "We couldn't complete your booking. Please refresh and try again.";
    if (/just been booked|conflicting booking|duplicate request/i.test(source)) {
      message = "That time was just booked. Please choose another available time.";
    } else if (/outside clinic hours|outside business hours|15-minute/i.test(source)) {
      message = "That time is no longer available. Please choose another slot.";
    } else if (/30 days/i.test(source)) {
      message = "Online appointments can be booked up to 30 days ahead.";
    } else if (/valid phone/i.test(source)) {
      message = "Please enter a valid 10-digit Indian mobile number.";
    } else if (/valid email/i.test(source)) {
      message = "Please enter a valid email address.";
    } else if (/clinic or active service/i.test(source)) {
      message = "This clinic or service is no longer available.";
    }
    redirect(`/book/${slug}?error=${encodeURIComponent(message)}`);
  }

  const reference = String((data as { booking_reference: string }).booking_reference);
  redirect(`/book/${slug}?confirmed=${encodeURIComponent(reference)}`);
}
