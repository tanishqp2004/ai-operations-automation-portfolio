import { randomUUID } from "node:crypto";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BookingForm from "./BookingForm";

type PublicBookingData = {
  business: {
    name: string;
    slug: string;
    phone: string | null;
    address: string | null;
    timezone: string;
  };
  services: {
    id: string;
    name: string;
    description: string | null;
    duration_minutes: number;
    price: number | null;
  }[];
};

function localDateInTimeZone(timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date()).map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function addDays(dateValue: string, days: number) {
  const [year, month, day] = dateValue.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0")
  ].join("-");
}

export default async function PublicBookingPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ confirmed?: string; error?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_public_booking_page", { p_slug: slug });
  if (error || !data) notFound();

  const booking = data as PublicBookingData;
  if (!booking.business || !Array.isArray(booking.services)) notFound();

  const today = localDateInTimeZone(booking.business.timezone);
  const maxDate = addDays(today, 30);
  const reference = query.confirmed && /^[A-Z0-9-]{4,32}$/.test(query.confirmed) ? query.confirmed : null;

  return (
    <main className="shell" style={{ maxWidth: 760 }}>
      <header className="topbar" style={{ marginBottom: 28 }}>
        <div className="brand">Clinic<span>Desk</span></div>
        <span className="muted">Patient booking</span>
      </header>

      <section className="card" style={{ padding: "clamp(20px, 5vw, 36px)" }}>
        <div className="eyebrow">Appointment booking</div>
        <h1 className="h1" style={{ marginBottom: 4 }}>{booking.business.name}</h1>
        {booking.business.address && <p className="sub" style={{ marginTop: 4 }}>{booking.business.address}</p>}
        {booking.business.phone && <p className="muted">Clinic: {booking.business.phone}</p>}

        {reference ? (
          <div className="notice" role="status" style={{ marginTop: 24, padding: 18 }}>
            <strong>Your appointment is confirmed.</strong>
            <p style={{ margin: "8px 0 4px" }}>Booking reference</p>
            <strong style={{ fontSize: 22, letterSpacing: 1 }}>{reference}</strong>
            <p style={{ marginBottom: 0 }}>Please save this reference. The clinic has received your booking.</p>
            <a className="btn secondary" href={`/book/${slug}`} style={{ marginTop: 16 }}>Book another appointment</a>
          </div>
        ) : (
          <>
            <p className="sub">Choose a treatment and a time that works for you. Your appointment will be confirmed instantly.</p>
            {query.error && <p className="error" role="alert">{query.error}</p>}
            {booking.services.length ? (
              <BookingForm
                slug={slug}
                services={booking.services}
                timezone={booking.business.timezone}
                today={today}
                maxDate={maxDate}
                idempotencyKey={randomUUID()}
              />
            ) : (
              <p className="notice" role="status">Online booking is not available yet. Please contact the clinic directly.</p>
            )}
          </>
        )}
      </section>
      <footer className="muted" style={{ textAlign: "center", marginTop: 22 }}>
        Booking powered by ClinicDesk · Your information is shared with this clinic to arrange your appointment.
      </footer>
    </main>
  );
}
