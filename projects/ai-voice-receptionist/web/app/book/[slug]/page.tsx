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
  hours: {
    day_of_week: number;
    opens_at: string | null;
    closes_at: string | null;
    is_closed: boolean;
  }[];
};

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

function displayClinicTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC"
  }).format(new Date(Date.UTC(2020, 0, 1, hour, minute)));
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
  const hours = Array.isArray(booking.hours) ? booking.hours : [];
  const hasHours = hours.length > 0;

  return (
    <main className="booking-shell">
      <header className="booking-topbar">
        <a className="brand" href="#top" aria-label="ClinicDesk home">Clinic<span>Desk</span></a>
        <div className="booking-topbar-right">
          <span className="booking-secure"><span aria-hidden="true">✦</span> Secure online booking</span>
          <a className="booking-top-link" href="#booking">Book a visit <span aria-hidden="true">↗</span></a>
        </div>
      </header>

      {reference ? (
        <section className="booking-confirmed card" role="status">
          <div className="booking-confirmed-icon" aria-hidden="true">✓</div>
          <div className="eyebrow">Booking complete</div>
          <h1 className="booking-title">Your appointment is confirmed.</h1>
          <p className="sub">Thanks for choosing {booking.business.name}. The clinic has received your booking.</p>
          <div className="booking-reference">
            <span>YOUR BOOKING REFERENCE</span>
            <strong>{reference}</strong>
            <small>Keep this reference handy if you need to contact the clinic.</small>
          </div>
          <div className="booking-confirmed-actions">
            {booking.business.phone && <a className="btn secondary" href={`tel:${booking.business.phone}`}>Call the clinic</a>}
            <a className="btn" href={`/book/${slug}`}>Book another appointment</a>
          </div>
        </section>
      ) : (
        <>
          <section className="booking-hero" id="top">
            <div className="booking-hero-copy">
              <div className="booking-kicker"><span className="booking-kicker-dot" /> PATIENT APPOINTMENTS</div>
              <h1 className="booking-title">A healthier smile starts with <em>a simple visit.</em></h1>
              <p className="booking-lede">Welcome to <strong>{booking.business.name}</strong>. Explore the clinic&apos;s available dental services, find a time that suits you, and book your visit online.</p>
              <div className="booking-hero-points">
                <span><b>01</b> Choose your treatment</span>
                <span><b>02</b> Pick a convenient time</span>
                <span><b>03</b> Get instant confirmation</span>
              </div>
            </div>
            <div className="booking-hero-art" aria-label="Decorative illustration of a smiling tooth">
              <div className="booking-art-orbit booking-art-orbit-one" />
              <div className="booking-art-orbit booking-art-orbit-two" />
              <div className="booking-art-spark spark-one">✳</div>
              <div className="booking-art-spark spark-two">✦</div>
              <div className="booking-tooth" aria-hidden="true">
                <svg viewBox="0 0 180 190" role="img" aria-label="">
                  <path d="M90 22C69 9 39 17 29 43C17 74 37 107 48 145C55 170 67 177 77 153L88 124C91 115 99 115 102 124L113 153C123 177 135 170 142 145C153 107 173 74 161 43C151 17 121 9 100 22C96 25 94 26 90 22Z" fill="#fffdf7" stroke="#d5e7dc" strokeWidth="5" strokeLinejoin="round"/>
                  <path d="M57 75C64 65 77 64 84 73M96 73C104 64 117 65 124 75" fill="none" stroke="#397b63" strokeWidth="6" strokeLinecap="round"/>
                  <path d="M76 96C84 108 99 108 107 96" fill="none" stroke="#397b63" strokeWidth="6" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="booking-art-caption"><span>☺</span> Your visit, made easy</div>
            </div>
          </section>

          <div className="booking-content-grid">
            <div className="booking-main-column">
              <section className="booking-section" id="about">
                <div className="booking-section-heading">
                  <div>
                    <div className="eyebrow">A LITTLE ABOUT US</div>
                    <h2>Care begins with feeling informed.</h2>
                  </div>
                  <span className="booking-section-mark">01 / 03</span>
                </div>
                <p className="booking-about-copy">{booking.business.name} welcomes patients to arrange dental appointments with less back-and-forth. This page brings the essentials together in one place: available services, appointment durations, pricing where provided, and live appointment times.</p>
                <div className="booking-info-strip">
                  <div><span className="booking-info-icon">⌖</span><span><small>CLINIC LOCATION</small><strong>{booking.business.address || "Contact the clinic for location details"}</strong></span></div>
                  <div><span className="booking-info-icon">◷</span><span><small>LOCAL TIME</small><strong>{booking.business.timezone.replaceAll("_", " ")}</strong></span></div>
                  {booking.business.phone && <div><span className="booking-info-icon">☎</span><span><small>GET IN TOUCH</small><strong><a href={`tel:${booking.business.phone}`}>{booking.business.phone}</a></strong></span></div>}
                </div>
              </section>

              <section className="booking-section" id="services">
                <div className="booking-section-heading">
                  <div>
                    <div className="eyebrow">AVAILABLE TREATMENTS</div>
                    <h2>Explore the services.</h2>
                    <p className="sub">Choose the appointment that best matches what you need.</p>
                  </div>
                  <span className="booking-section-mark">02 / 03</span>
                </div>
                {booking.services.length ? (
                  <div className="booking-service-list">
                    {booking.services.map((service, index) => (
                      <article className="booking-service-card" key={service.id}>
                        <div className="booking-service-number">{String(index + 1).padStart(2, "0")}</div>
                        <div className="booking-service-details">
                          <h3>{service.name}</h3>
                          <p>{service.description || `Book a dedicated ${service.name.toLowerCase()} appointment with the clinic.`}</p>
                          <div className="booking-service-meta"><span>◷ {service.duration_minutes} min</span>{service.price == null ? <span>Price confirmed by clinic</span> : <strong>₹{Number(service.price).toLocaleString("en-IN")}</strong>}</div>
                        </div>
                        <a className="booking-service-arrow" href="#booking" aria-label={`Book ${service.name}`}>↗</a>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="notice">Online booking is not available yet. Please contact the clinic directly.</p>
                )}
              </section>

              <section className="booking-section" id="hours">
                <div className="booking-section-heading">
                  <div>
                    <div className="eyebrow">PLAN YOUR VISIT</div>
                    <h2>Clinic hours.</h2>
                    <p className="sub">Appointment times are shown in the clinic&apos;s local timezone.</p>
                  </div>
                  <span className="booking-section-mark">03 / 03</span>
                </div>
                {hasHours ? (
                  <div className="booking-hours-card">
                    {weekdays.map((day, index) => {
                      const dayHours = hours.find((item) => item.day_of_week === index);
                      const closed = !dayHours || dayHours.is_closed || !dayHours.opens_at || !dayHours.closes_at;
                      return <div className="booking-hours-row" key={day}><span>{day}</span><strong className={closed ? "is-closed" : ""}>{closed ? "Closed" : `${displayClinicTime(dayHours.opens_at!)} – ${displayClinicTime(dayHours.closes_at!)}`}</strong></div>;
                    })}
                  </div>
                ) : (
                  <p className="booking-muted-note">Clinic hours are confirmed when you choose an appointment date and view live availability.</p>
                )}
              </section>

              <section className="booking-faq">
                <div className="eyebrow">GOOD TO KNOW</div>
                <h2>Before you book.</h2>
                <div className="booking-faq-item"><strong>Do I need to pay online?</strong><p>No. You can request an appointment without an online payment.</p></div>
                <div className="booking-faq-item"><strong>When is my appointment confirmed?</strong><p>Your booking is confirmed instantly on this page once the request is accepted.</p></div>
                <div className="booking-faq-item"><strong>Can I book for a later date?</strong><p>Online availability is shown up to 30 days ahead and updates based on the clinic&apos;s schedule.</p></div>
              </section>
            </div>

            <aside className="booking-sidebar" id="booking">
              <div className="booking-form-card card">
                <div className="booking-form-card-top">
                  <div className="eyebrow">BOOK ONLINE</div>
                  <span className="booking-live-pill"><i /> LIVE SLOTS</span>
                </div>
                <h2>Make an appointment.</h2>
                <p className="sub">A few details and you&apos;re all set.</p>
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
                  <p className="notice">Online booking is not available yet. Please contact the clinic directly.</p>
                )}
                <div className="booking-form-assurance"><span>✓</span> No account or payment required</div>
                <div className="booking-form-assurance"><span>✓</span> Your details are shared only with this clinic to arrange your visit</div>
              </div>
              <div className="booking-help-card">
                <span className="booking-help-icon">✉</span>
                <div><strong>Need help before booking?</strong><p>{booking.business.phone ? <>Call the clinic at <a href={`tel:${booking.business.phone}`}>{booking.business.phone}</a>.</> : "Please use the clinic&apos;s usual contact channel for questions before booking."}</p></div>
              </div>
            </aside>
          </div>
        </>
      )}

      <footer className="booking-footer">
        <a className="brand" href="#top">Clinic<span>Desk</span></a>
        <span>Thoughtful booking, less waiting around.</span>
        <span>Booking powered by ClinicDesk</span>
      </footer>
    </main>
  );
}
