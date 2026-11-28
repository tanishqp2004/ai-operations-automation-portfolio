"use client";

import { useMemo, useState } from "react";
import { updateAppointment } from "./actions";

type Appointment = {
  id: string;
  booking_reference: string;
  starts_at: string;
  status: string;
  customers: { full_name: string; phone: string } | null;
  services: { name: string } | null;
};

export default function AppointmentsManager({
  upcoming,
  recent,
  timezone
}: {
  upcoming: Appointment[];
  recent: Appointment[];
  timezone: string;
}) {
  const [view, setView] = useState<"upcoming" | "recent">("upcoming");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const source = view === "upcoming" ? upcoming : recent;
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return source.filter((appointment) => {
      const matchesStatus = status === "all" || appointment.status === status;
      const haystack = [
        appointment.customers?.full_name,
        appointment.customers?.phone,
        appointment.services?.name,
        appointment.booking_reference
      ].join(" ").toLowerCase();
      return matchesStatus && (!term || haystack.includes(term));
    });
  }, [source, search, status]);

  return (
    <section className="section card">
      <div className="sectionhead">
        <h2>Appointments</h2>
        <span className="label">{view === "upcoming" ? "Next 20 scheduled" : "Most recent past 20"}</span>
      </div>
      <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:14}}>
        <button type="button" className={view === "upcoming" ? "btn" : "btn secondary"} onClick={() => {setView("upcoming");setStatus("all");}}>Upcoming ({upcoming.length})</button>
        <button type="button" className={view === "recent" ? "btn" : "btn secondary"} onClick={() => {setView("recent");setStatus("all");}}>Recent ({recent.length})</button>
      </div>
      <div className="formgrid" style={{marginBottom:14}}>
        <div className="field">
          <label htmlFor="appointment-search">Search appointments</label>
          <input id="appointment-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Patient, phone, service or reference"/>
        </div>
        <div className="field">
          <label htmlFor="appointment-status">Filter by status</label>
          <select id="appointment-status" value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="cancelled">Cancelled</option>
            <option value="completed">Completed</option>
            <option value="no_show">No-show</option>
          </select>
        </div>
      </div>
      <div className="tablewrap">
        <table className="table">
          <thead><tr><th>Patient</th><th>Service</th><th>Date & time</th><th>Reference</th><th>Status</th><th>Update</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} className="muted">{source.length === 0 ? (view === "upcoming" ? "No upcoming appointments." : "No recent appointments.") : "No appointments match these filters."}</td></tr>
            ) : filtered.map((appointment) => (
              <tr key={appointment.id}>
                <td>{appointment.customers?.full_name || "—"}<div className="muted">{appointment.customers?.phone || ""}</div></td>
                <td>{appointment.services?.name || "—"}</td>
                <td>{new Date(appointment.starts_at).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short",hour12:true,timeZone:timezone})}</td>
                <td>{appointment.booking_reference}</td>
                <td><span className="pill">{appointment.status.replace("_"," ")}</span></td>
                <td>
                  <form action={updateAppointment} style={{display:"flex",gap:5}}>
                    <input type="hidden" name="id" value={appointment.id}/>
                    <select name="status" defaultValue={appointment.status} aria-label={`Status for ${appointment.customers?.full_name || "appointment"}`} style={{border:"1px solid var(--line)",borderRadius:8,padding:6}}>
                      <option value="pending">Pending</option>
                      <option value="confirmed">Confirm</option>
                      <option value="cancelled">Cancel</option>
                      <option value="completed">Complete</option>
                      <option value="no_show">No-show</option>
                    </select>
                    <button className="btn secondary" style={{padding:"7px 9px"}}>Save</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted" style={{marginTop:10}}>Showing up to 20 {view === "upcoming" ? "upcoming" : "most recent past"} appointments for this clinic. Times use {timezone}.</p>
    </section>
  );
}
