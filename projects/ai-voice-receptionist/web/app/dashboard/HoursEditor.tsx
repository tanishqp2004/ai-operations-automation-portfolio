"use client";

import { useState } from "react";

type BusinessHour = {
  day_of_week: number;
  opens_at: string | null;
  closes_at: string | null;
  is_closed: boolean;
};

const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime(value?: string | null, fallback = "09:00 AM") {
  if (!value) return fallback;
  const [hourText, minute] = value.slice(0, 5).split(":");
  const hour = Number(hourText);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !minute) return fallback;
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? "PM" : "AM"}`;
}

export default function HoursEditor({
  hours,
  timezone,
  canEdit,
  action
}: {
  hours: BusinessHour[];
  timezone: string;
  canEdit: boolean;
  action: (formData: FormData) => void | Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [closedDays, setClosedDays] = useState<Record<number, boolean>>(
    Object.fromEntries(days.map((_, index) => [index, hours.find((hour) => hour.day_of_week === index)?.is_closed ?? false]))
  );

  function cancelEdit() {
    setClosedDays(Object.fromEntries(days.map((_, index) => [index, hours.find((hour) => hour.day_of_week === index)?.is_closed ?? false])));
    setEditing(false);
  }

  return (
    <div className="card">
      <div className="sectionhead">
        <h2>Business hours</h2>
        {canEdit && !editing && <button type="button" className="btn secondary" onClick={() => setEditing(true)}>Edit timings</button>}
        {editing && <button type="button" className="btn ghost" onClick={cancelEdit}>Cancel</button>}
        {!canEdit && <span className="label">Weekly schedule</span>}
      </div>

      {!editing ? (
        <div>
          {days.map((day, index) => {
            const hour = hours.find((item) => item.day_of_week === index);
            const isClosed = !hour || hour.is_closed;
            return (
              <div className="dayrow" key={day}>
                <strong className="dayname">{day}</strong>
                <span className="muted" style={{marginLeft: "auto"}}>
                  {isClosed ? "Closed" : `${formatTime(hour.opens_at)} – ${formatTime(hour.closes_at, "06:00 PM")}`}
                </span>
              </div>
            );
          })}
          <p className="muted">Times use {timezone}. These hours control patient booking availability.</p>
        </div>
      ) : (
        <form action={action}>
          <div>
            {days.map((day, index) => {
              const hour = hours.find((item) => item.day_of_week === index);
              const isClosed = closedDays[index] ?? false;
              return (
                <div className="dayrow" key={day}>
                  <strong className="dayname">{day}</strong>
                  {!isClosed && <>
                    <label className="timefield">
                      <span>Opens</span>
                      <input type="text" inputMode="text" name={`opens_${index}`} placeholder="09:00 AM" pattern="[0-9]{1,2}:[0-5][0-9] ?[AaPp][Mm]" title="Use 12-hour time, e.g. 09:00 AM" defaultValue={formatTime(hour?.opens_at, "09:00 AM")} required />
                    </label>
                    <label className="timefield">
                      <span>Closes</span>
                      <input type="text" inputMode="text" name={`closes_${index}`} placeholder="06:00 PM" pattern="[0-9]{1,2}:[0-5][0-9] ?[AaPp][Mm]" title="Use 12-hour time, e.g. 06:00 PM" defaultValue={formatTime(hour?.closes_at, "06:00 PM")} required />
                    </label>
                  </>}
                  <label className="closed-toggle">
                    <input
                      type="checkbox"
                      name={`closed_${index}`}
                      checked={isClosed}
                      onChange={(event) => setClosedDays((previous) => ({ ...previous, [index]: event.target.checked }))}
                    />
                    Closed
                  </label>
                </div>
              );
            })}
          </div>
          <p className="muted">Times use {timezone}. Closed days are excluded from patient availability. Use 12-hour time (for example, 09:00 AM).</p>
          <button className="btn" type="submit">Save timings</button>
        </form>
      )}
    </div>
  );
}
