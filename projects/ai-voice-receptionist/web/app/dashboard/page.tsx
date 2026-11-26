/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase nested relation inference is currently wider than the generated database types. */
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { addService, createBusiness, saveHours, updateAppointment, selectActiveBusiness } from "./actions";
import AppointmentForm from "./AppointmentForm";
import CreateClinicForm from "./CreateClinicForm";
import { signOut } from "@/app/auth/actions";
import { cookies } from "next/headers";

const dayNames = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
function formatTime12(value?: string | null, fallback = "09:00 AM") {
  if (!value) return fallback;
  const [hourText, minute] = value.slice(0, 5).split(":");
  const hour = Number(hourText);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !minute) return fallback;
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? "PM" : "AM"}`;
}
export default async function Dashboard({ searchParams }: { searchParams: Promise<{error?:string;booked?:string}> }) {
  const q = await searchParams;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) redirect("/login");
  const email = String(claims.claims.email || "");
  const userId = String(claims.claims.sub);
  const { data: memberships, error: membershipError } = await supabase
    .from("business_memberships")
    .select("business_id,role")
    .eq("user_id", userId);
  if (membershipError) throw new Error(membershipError.message);
  const memberRows = memberships || [];
  if (memberRows.length === 0) return <main className="shell"><header className="topbar"><div className="brand">Clinic<span>Desk</span></div><form action={signOut}><button className="btn ghost">Sign out</button></form></header><section className="card" style={{maxWidth:650,margin:"8vh auto"}}><div className="eyebrow">One last step</div><h1 className="h1">Set up your clinic</h1><p className="sub">Create your workspace to start managing appointments. Your timezone defaults to India.</p>{q.error&&<p className="error">{q.error}</p>}<form action={createBusiness}><div className="field"><label>Clinic name</label><input name="name" placeholder="e.g. Smile Dental Studio" required minLength={2}/></div><div className="field"><label>Timezone</label><select name="timezone" defaultValue="Asia/Kolkata"><option value="Asia/Kolkata">India (Asia/Kolkata)</option><option value="Asia/Dubai">Dubai</option><option value="Europe/London">London</option><option value="America/New_York">New York</option></select></div><button className="btn">Create clinic workspace</button></form></section></main>;
  const cookieStore = await cookies();
  const requestedBusinessId = cookieStore.get("clinicdesk_active_business")?.value;
  let membership = requestedBusinessId ? memberRows.find((item) => item.business_id === requestedBusinessId) || null : null;
  if (!membership && memberRows.length === 1) membership = memberRows[0];
  if (!membership && memberRows.length > 1) {
    const { data: clinics, error: clinicsError } = await supabase
      .from("businesses")
      .select("id,name")
      .in("id", memberRows.map((item) => item.business_id));
    if (clinicsError) throw new Error(clinicsError.message);
    const clinicNames = new Map((clinics || []).map((clinic) => [clinic.id, clinic.name]));
    return <main className="shell"><header className="topbar"><div className="brand">Clinic<span>Desk</span></div><nav className="nav"><span>{email}</span><form action={signOut}><button className="btn ghost">Sign out</button></form></nav></header><section className="card" style={{maxWidth:650,margin:"8vh auto"}}><div className="eyebrow">Workspace selection</div><h1 className="h1">Choose your clinic</h1><p className="sub">Select the clinic workspace you want to manage. Your access is checked against your account.</p>{q.error&&<p className="error">{q.error}</p>}<form action={selectActiveBusiness}><div className="field"><label htmlFor="business_id">Clinic workspace</label><select id="business_id" name="business_id" required defaultValue=""><option value="" disabled>Select a clinic</option>{memberRows.map((item) => <option key={item.business_id} value={item.business_id}>{clinicNames.get(item.business_id) || "Clinic workspace"} · {item.role}</option>)}</select></div><button className="btn">Open clinic workspace</button></form></section></main>;
  }
  if (!membership) redirect("/dashboard?error=Could+not+resolve+your+clinic+membership");
  const businessId = membership.business_id;
  const { data: availableClinics, error: availableClinicsError } = memberRows.length > 1
    ? await supabase.from("businesses").select("id,name").in("id", memberRows.map((item) => item.business_id))
    : { data: [], error: null };
  if (availableClinicsError) throw new Error(availableClinicsError.message);
  const [{data:business},{data:services},{data:hours},{data:appointments},{count:upcomingCount}] = await Promise.all([
    supabase.from("businesses").select("id,name,timezone,phone,email,address").eq("id",businessId).single(),
    supabase.from("services").select("id,name,duration_minutes,price,is_active").eq("business_id",businessId).order("name"),
    supabase.from("business_hours").select("day_of_week,opens_at,closes_at,is_closed").eq("business_id",businessId).order("day_of_week"),
    supabase.from("appointments").select("id,booking_reference,starts_at,ends_at,status,customers(full_name,phone),services(name)").eq("business_id",businessId).order("starts_at",{ascending:false}).limit(20),
    supabase.from("appointments").select("id",{count:"exact",head:true}).eq("business_id",businessId).gte("starts_at",new Date().toISOString()).in("status",["pending","confirmed"])
  ]);
  if (!business) redirect("/dashboard?error=Could+not+load+clinic");
  const upcoming = upcomingCount ?? 0;
  const today = new Intl.DateTimeFormat("en-CA",{timeZone:business.timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  return <main className="shell"><header className="topbar"><div className="brand">Clinic<span>Desk</span></div><nav className="nav">{memberRows.length > 1&&<form action={selectActiveBusiness} style={{display:"flex",gap:6,alignItems:"center"}}><label className="muted" htmlFor="switch_business_id">Clinic</label><select id="switch_business_id" name="business_id" defaultValue={businessId} aria-label="Switch clinic workspace" style={{border:"1px solid var(--line)",borderRadius:8,padding:7,maxWidth:190}}>{(availableClinics||[]).map((clinic:any)=><option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</select><button className="btn secondary" style={{padding:"7px 9px"}}>Switch</button></form>}<span>{email}</span><form action={signOut}><button className="btn ghost">Sign out</button></form></nav></header>
  <div className="hero"><div><div className="eyebrow">Clinic workspace · {membership.role}</div><h1 className="h1">{business.name}</h1><p className="sub">Your front desk, appointments and services at a glance.</p></div><span className="pill">Free workspace</span></div>
  {q.error&&<p className="error">{q.error}</p>}
  <details className="card" style={{marginTop:18}}>
    <summary style={{cursor:"pointer",fontWeight:600}}>＋ Add another clinic</summary>
    <p className="muted" style={{marginTop:10}}>Create another clinic workspace under this same login. You will be switched to it automatically.</p>
    <CreateClinicForm action={createBusiness} requestKey={randomBytes(16).toString("hex")}/>
  </details>
  {q.booked&&<p className="notice" role="status">Appointment booked successfully. Reference: <strong>{q.booked}</strong></p>}
  <section className="grid"><div className="card"><div className="label">Upcoming appointments</div><div className="stat">{upcoming}</div><div className="label">Scheduled from today</div></div><div className="card"><div className="label">Active services</div><div className="stat">{(services||[]).filter((s:any)=>s.is_active).length}</div><div className="label">Treatments offered</div></div><div className="card"><div className="label">Clinic timezone</div><div className="stat" style={{fontSize:20,marginTop:17}}>{business.timezone}</div><div className="label">Appointment scheduling zone</div></div></section>
  <section className="section card"><div className="sectionhead"><h2>Appointments</h2><span className="label">Latest 20</span></div><div className="tablewrap"><table className="table"><thead><tr><th>Patient</th><th>Service</th><th>Date & time</th><th>Reference</th><th>Status</th><th>Update</th></tr></thead><tbody>{(appointments||[]).length===0?<tr><td colSpan={6} className="muted">No appointments yet. Create your first booking below.</td></tr>:(appointments||[]).map((a:any)=><tr key={a.id}><td>{a.customers?.full_name||"—"}<div className="muted">{a.customers?.phone||""}</div></td><td>{a.services?.name||"—"}</td><td>{new Date(a.starts_at).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short",hour12:true,timeZone:business.timezone})}</td><td>{a.booking_reference}</td><td><span className="pill">{a.status}</span></td><td><form action={updateAppointment} style={{display:"flex",gap:5}}><input type="hidden" name="id" value={a.id}/><select name="status" defaultValue={a.status} style={{border:"1px solid var(--line)",borderRadius:8,padding:6}}><option value="pending">Pending</option><option value="confirmed">Confirm</option><option value="cancelled">Cancel</option><option value="completed">Complete</option><option value="no_show">No-show</option></select><button className="btn secondary" style={{padding:"7px 9px"}}>Save</button></form></td></tr>)}</tbody></table></div></section>
  <section className="section card"><div className="sectionhead"><h2>Book an appointment</h2><span className="label">Staff booking</span></div><p className="muted">Appointments use {business.timezone}. Bookings are checked against clinic hours and existing appointments.</p>{(services||[]).filter((s:any)=>s.is_active).length===0?<p className="notice">Add an active service before creating an appointment.</p>:<AppointmentForm services={(services||[]).filter((s:any)=>s.is_active)} today={today} timezone={business.timezone} idempotencyKey={randomBytes(16).toString("hex")}/ >}</section>
  <section className="grid section" style={{gridTemplateColumns:"1fr 1fr"}}><div className="card"><div className="sectionhead"><h2>Services</h2><span className="label">{services?.length||0} total</span></div>{(services||[]).map((s:any)=><div key={s.id} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid var(--line)"}}><div><strong>{s.name}</strong><div className="muted">{s.duration_minutes} min · {s.price==null?"Price on request":"₹"+Number(s.price).toLocaleString("en-IN")}</div></div><span className="pill">{s.is_active?"Active":"Inactive"}</span></div>)}{services?.length===0&&<p className="muted">Add your first service below.</p>}<form action={addService} style={{marginTop:14}}><div className="field"><label>Service name</label><input name="name" placeholder="Dental consultation" required/></div><div className="formgrid"><div className="field"><label>Duration (minutes)</label><input name="duration" type="number" min="5" max="480" defaultValue="30" required/></div><div className="field"><label>Price (₹, optional)</label><input name="price" type="number" min="0" step="1" placeholder="Leave blank"/></div></div><button className="btn">Add service</button></form></div>
  <div className="card"><div className="sectionhead"><h2>Business hours</h2><span className="label">Weekly schedule</span></div><form action={saveHours}><div>{dayNames.map((day,i)=>{const h=(hours||[]).find((x:any)=>x.day_of_week===i);return <div className="dayrow" key={day}><strong className="dayname">{day}</strong>{!h?.is_closed&&<><label className="timefield"><span>Opens</span><input type="text" inputMode="text" name={"opens_"+i} placeholder="09:00 AM" pattern="[0-9]{1,2}:[0-5][0-9] ?[AaPp][Mm]" title="Use 12-hour time, e.g. 09:00 AM" defaultValue={formatTime12(h?.opens_at,"09:00 AM")}/></label><label className="timefield"><span>Closes</span><input type="text" inputMode="text" name={"closes_"+i} placeholder="06:00 PM" pattern="[0-9]{1,2}:[0-5][0-9] ?[AaPp][Mm]" title="Use 12-hour time, e.g. 06:00 PM" defaultValue={formatTime12(h?.closes_at,"06:00 PM")}/></label></>}<label className="closed-toggle"><input type="checkbox" name={"closed_"+i} defaultChecked={h?.is_closed||false}/> Closed</label></div>})}</div><p className="muted">Times use {business.timezone}. Closed days are excluded from availability.</p><button className="btn secondary">Save hours</button></form></div></section>
  <footer className="muted" style={{textAlign:"center",marginTop:36}}>ClinicDesk early access · Built for independent dental clinics · No diagnosis or treatment advice</footer></main>;
}
