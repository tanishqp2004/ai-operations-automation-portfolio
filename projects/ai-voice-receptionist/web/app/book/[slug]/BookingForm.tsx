"use client";

import { useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { createPublicBooking, getPublicAvailableSlots } from "./actions";

type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number | null;
};
type Slot = { start: string; end: string };

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button className="btn" type="submit" disabled={disabled || pending} style={{ width: "100%", marginTop: 8 }}>
      {pending ? "Confirming appointment…" : "Confirm appointment"}
    </button>
  );
}

function displayTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date(value));
}

export default function BookingForm({
  slug,
  services,
  timezone,
  today,
  maxDate,
  idempotencyKey
}: {
  slug: string;
  services: Service[];
  timezone: string;
  today: string;
  maxDate: string;
  idempotencyKey: string;
}) {
  const router = useRouter();
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [phoneDigits, setPhoneDigits] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [message, setMessage] = useState("Select a service and date to see available times.");
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const lastRefreshAt = useRef(0);
  const action = createPublicBooking.bind(null, slug);

  useEffect(() => {
    const refreshAvailability = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRefreshAt.current < 1500) return;
      lastRefreshAt.current = now;
      router.refresh();
      setRefreshKey((current) => current + 1);
    };

    window.addEventListener("focus", refreshAvailability);
    document.addEventListener("visibilitychange", refreshAvailability);
    return () => {
      window.removeEventListener("focus", refreshAvailability);
      document.removeEventListener("visibilitychange", refreshAvailability);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setStartsAt("");
    setSlots([]);
    if (!serviceId || !date) {
      setMessage("Select a service and date to see available times.");
      setLoading(false);
      return () => { active = false; };
    }

    setLoading(true);
    setMessage("Checking clinic availability…");
    getPublicAvailableSlots(slug, serviceId, date)
      .then((result) => {
        if (!active) return;
        setSlots(result.slots);
        setMessage(result.message);
      })
      .catch(() => {
        if (active) setMessage("We couldn't load availability. Please try again.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [slug, serviceId, date, refreshKey]);

  return (
    <form action={action}>
      <input type="hidden" name="service_id" value={serviceId} />
      <input type="hidden" name="starts_at" value={startsAt} />
      <input type="hidden" name="idempotency_key" value={idempotencyKey} />
      <label aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>

      <div className="field">
        <label htmlFor="booking-service">Choose a service</label>
        <select id="booking-service" value={serviceId} onChange={(event) => setServiceId(event.target.value)} required>
          <option value="">Select a treatment</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {service.name} · {service.duration_minutes} min{service.price == null ? "" : ` · ₹${Number(service.price).toLocaleString("en-IN")}`}
            </option>
          ))}
        </select>
      </div>

      {serviceId && (
        <div className="field">
          <label htmlFor="booking-date">Choose a date</label>
          <input
            id="booking-date"
            type="date"
            name="date"
            min={today}
            max={maxDate}
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
          />
        </div>
      )}

      {serviceId && date && (
        <div className="field">
          <label htmlFor="booking-time">Available appointment times</label>
          <select
            id="booking-time"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            disabled={loading || !slots.length}
            required
          >
            <option value="">{loading ? "Checking availability…" : slots.length ? "Select a time" : "No times available"}</option>
            {slots.map((slot) => (
              <option key={slot.start} value={slot.start}>
                {displayTime(slot.start, timezone)} ({timezone})
              </option>
            ))}
          </select>
          <span className="muted" aria-live="polite">{message}</span>
        </div>
      )}

      <div className="formgrid">
        <div className="field">
          <label htmlFor="patient-name">Your full name</label>
          <input id="patient-name" name="full_name" autoComplete="name" minLength={2} maxLength={120} placeholder="Full name" required />
        </div>
        <div className="field">
          <label htmlFor="patient-phone">Phone number</label>
          <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--line, #d1d5db)", borderRadius: 10, overflow: "hidden" }}>
            <span aria-hidden="true" style={{ padding: "12px 14px", background: "var(--paper, #f8fafc)", fontWeight: 600, whiteSpace: "nowrap" }}>+91</span>
            <input
              id="patient-phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              value={phoneDigits}
              onChange={(event) => setPhoneDigits(event.target.value.replace(/\D/g, "").slice(0, 10))}
              minLength={10}
              maxLength={10}
              pattern="[6-9][0-9]{9}"
              title="Enter a valid 10-digit Indian mobile number."
              placeholder="98765 43210"
              aria-describedby="patient-phone-help"
              required
              style={{ border: 0, borderRadius: 0, boxShadow: "none", flex: 1, minWidth: 0 }}
            />
          </div>
          <span className="muted" id="patient-phone-help">Enter exactly 10 digits after +91.</span>
        </div>
      </div>
      <div className="field">
        <label htmlFor="patient-email">Email address <span className="muted">(optional)</span></label>
        <input id="patient-email" name="email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" />
      </div>
      <p className="muted">No account or payment is required. Appointment times are shown in the clinic&apos;s local timezone. Online bookings are open up to 30 days ahead.</p>
      <SubmitButton disabled={loading || !startsAt || !slots.some((slot) => slot.start === startsAt)} />
    </form>
  );
}
