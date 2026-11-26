"use client";

import { useEffect, useState } from "react";
import { createAppointment, getAvailableSlots } from "./actions";

type Service = { id: string; name: string; duration_minutes: number; price: number | null };
export default function AppointmentForm({ services, today, timezone, idempotencyKey }: { services: Service[]; today: string; timezone: string; idempotencyKey: string }) {
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [message, setMessage] = useState("Choose a service and date to see available times.");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let active = true;
    setTime("");
    setSlots([]);
    if (!serviceId || !date) {
      setMessage("Choose a service and date to see available times.");
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    setMessage("Checking available times…");
    getAvailableSlots(date, serviceId).then((result) => {
      if (!active) return;
      setSlots(result.slots);
      setMessage(result.message);
    }).catch(() => {
      if (active) setMessage("Could not load available times. Please try again.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [serviceId, date]);

  return <form action={createAppointment}>
    <input type="hidden" name="idempotency_key" value={idempotencyKey}/>
    <div className="formgrid">
      <div className="field"><label>Patient full name</label><input name="full_name" placeholder="Patient name" required minLength={2} maxLength={120}/></div>
      <div className="field"><label>Phone number</label><input name="phone" type="tel" inputMode="numeric" pattern="[0-9]{10}" minLength={10} maxLength={10} placeholder="9876543210" title="Enter a 10-digit phone number" required/></div>
      <div className="field"><label>Email (optional)</label><input name="email" type="email" placeholder="patient@example.com"/></div>
      <div className="field"><label>Service</label><select name="service_id" required value={serviceId} onChange={(event) => setServiceId(event.target.value)}><option value="">Select a service</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name} · {service.duration_minutes} min{service.price == null ? "" : " · ₹" + Number(service.price).toLocaleString("en-IN")}</option>)}</select></div>
      <div className="field"><label>Appointment date</label><input name="date" type="date" min={today} value={date} onChange={(event) => setDate(event.target.value)} required/></div>
      <div className="field"><label>Available time</label><select name="time" required value={time} onChange={(event) => setTime(event.target.value)} disabled={loading || !slots.length}><option value="">{loading ? "Checking slots…" : slots.length ? "Select an available time" : "No slots available"}</option>{slots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}</select><span className="muted" aria-live="polite">{message}</span></div>
    </div>
    <div className="field"><label>Notes (optional)</label><textarea name="notes" rows={2} maxLength={1000} placeholder="Reason for visit or front-desk notes"/></div>
    <p className="muted">Times are shown in {timezone}. Slots update when you change the service or date.</p>
    <button className="btn" disabled={loading || !time || !slots.includes(time)}>Create appointment</button>
  </form>;
}
