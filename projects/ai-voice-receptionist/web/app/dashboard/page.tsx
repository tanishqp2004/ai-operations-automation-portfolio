/* eslint-disable @typescript-eslint/no-explicit-any -- Supabase nested relation inference is currently wider than the generated database types. */
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { addService, createBusiness, saveHours, updateAppointment, selectActiveBusiness, deleteBusiness } from "./actions";
import AppointmentForm from "./AppointmentForm";
import AppointmentsManager from "./AppointmentsManager";
import CreateClinicForm from "./CreateClinicForm";
import DeleteClinicForm from "./DeleteClinicForm";
import HoursEditor from "./HoursEditor";
import { signOut } from "@/app/auth/actions";
import { cookies } from "next/headers";

export default async function Dashboard({ searchParams }: { searchParams: Promise<{error?:string;booked?:string;deleted?:string}> }) {
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
  if (memberRows.length === 0) return <main className="shell"><header className="topbar"><div className="brand">Clinic<span>Desk</span></div><form action={signOut}><button className="btn ghost">Sign out</button></form></header><section className="card" style={{maxWidth:650,margin:"8vh auto"}}><div className="eyebrow">One last step</div><h1 className="h1">Set up your clinic</h1><p className="sub">Create your workspace to start managing appointments. Your timezone defaults to India.</p>{q.error&&<p className="error">{q.error}</p>}{q.deleted&&<p className="notice" role="status">Clinic deleted. Your other clinic workspaces are unchanged.</p>}<CreateClinicForm action={createBusiness} requestKey={randomBytes(16).toString("hex")}/></section></main>;
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
    return <main className="shell"><header className="topbar"><div className="brand">Clinic<span>Desk</span></div><nav className="nav"><span>{email}</span><form action={signOut}><button className="btn ghost">Sign out</button></form></nav></header><section className="card" style={{maxWidth:650,margin:"8vh auto"}}><div className="eyebrow">Workspace selection</div><h1 className="h1">Choose your clinic</h1><p className="sub">Select the clinic workspace you want to manage. Your access is checked against your account.</p>{q.error&&<p className="error">{q.error}</p>}{q.deleted&&<p className="notice" role="status">Clinic deleted. Your other clinic workspaces are unchanged.</p>}<form action={selectActiveBusiness}><div className="field"><label htmlFor="business_id">Clinic workspace</label><select id="business_id" name="business_id" required defaultValue=""><option value="" disabled>Select a clinic</option>{memberRows.map((item) => <option key={item.business_id} value={item.business_id}>{clinicNames.get(item.business_id) || "Clinic workspace"} · {item.role}</option>)}</select></div><button className="btn">Open clinic workspace</button></form></section></main>;
  }
  if (!membership) redirect("/dashboard?error=Could+not+resolve+your+clinic+membership");
  const businessId = membership.business_id;
  const { data: availableClinics, error: availableClinicsError } = memberRows.length > 1
    ? await supabase.from("businesses").select("id,name").in("id", memberRows.map((item) => item.business_id))
    : { data: [], error: null };
  if (availableClinicsError) throw new Error(availableClinicsError.message);
  const nowIso = new Date().toISOString();
  const [{data:business},{data:services},{data:hours},{data:upcomingAppointments},{data:recentAppointments},{count:upcomingCount}] = await Promise.all([
    supabase.from("businesses").select("id,name,slug,timezone,phone,email,address,created_by").eq("id",businessId).single(),
    supabase.from("services").select("id,name,duration_minutes,price,is_active").eq("business_id",businessId).order("name"),
    supabase.from("business_hours").select("day_of_week,opens_at,closes_at,is_closed").eq("business_id",businessId).order("day_of_week"),
    supabase.from("appointments").select("id,booking_reference,starts_at,ends_at,status,customers(full_name,phone),services(name)").eq("business_id",businessId).gte("starts_at",nowIso).in("status",["pending","confirmed","cancelled","completed","no_show"]).order("starts_at",{ascending:true}).limit(20),
    supabase.from("appointments").select("id,booking_reference,starts_at,ends_at,status,customers(full_name,phone),services(name)").eq("business_id",businessId).lt("starts_at",nowIso).order("starts_at",{ascending:false}).limit(20),
    supabase.from("appointments").select("id",{count:"exact",head:true}).eq("business_id",businessId).gte("starts_at",new Date().toISOString()).in("status",["pending","confirmed"])
  ]);
  if (!business) redirect("/dashboard?error=Could+not+load+clinic");
  const upcoming = upcomingCount ?? 0;
  const today = new Intl.DateTimeFormat("en-CA",{timeZone:business.timezone,year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  return <main className="shell"><header className="topbar"><div className="brand">Clinic<span>Desk</span></div><nav className="nav">{memberRows.length > 1&&<form action={selectActiveBusiness} style={{display:"flex",gap:6,alignItems:"center"}}><label className="muted" htmlFor="switch_business_id">Clinic</label><select id="switch_business_id" name="business_id" defaultValue={businessId} aria-label="Switch clinic workspace" style={{border:"1px solid var(--line)",borderRadius:8,padding:7,maxWidth:190}}>{(availableClinics||[]).map((clinic:any)=><option key={clinic.id} value={clinic.id}>{clinic.name}</option>)}</select><button className="btn secondary" style={{padding:"7px 9px"}}>Switch</button></form>}<span>{email}</span><form action={signOut}><button className="btn ghost">Sign out</button></form></nav></header>
  <div className="hero"><div><div className="eyebrow">Clinic workspace · {membership.role}</div><h1 className="h1">{business.name}</h1><p className="sub">Your front desk, appointments and services at a glance.</p></div><span className="pill">Free workspace</span></div>
  <section className="card" style={{marginTop:18}}>
    <div className="sectionhead"><h2>Patient booking page</h2><span className="pill">Shareable link</span></div>
    <p className="muted">Patients can choose a service, view live availability and book an appointment without calling the clinic.</p>
    <div style={{display:"flex",gap:12,alignItems:"center",justifyContent:"space-between",flexWrap:"wrap"}}>
      <code style={{fontSize:13,background:"var(--paper)",padding:"10px 12px",borderRadius:8,overflowWrap:"anywhere"}}>/book/{business.slug}</code>
      <a className="btn secondary" href={`/book/${business.slug}`} target="_blank" rel="noreferrer">Preview booking page ↗</a>
    </div>
  </section>
  {q.error&&<p className="error">{q.error}</p>}{q.deleted&&<p className="notice" role="status">Clinic deleted. Your other clinic workspaces are unchanged.</p>}
  <details className="card" style={{marginTop:18}}>
    <summary style={{cursor:"pointer",fontWeight:600}}>＋ Add another clinic</summary>
    <p className="muted" style={{marginTop:10}}>Create another clinic workspace under this same login. You will be switched to it automatically.</p>
    <CreateClinicForm action={createBusiness} requestKey={randomBytes(16).toString("hex")}/>
  </details>
  {q.booked&&<p className="notice" role="status">Appointment booked successfully. Reference: <strong>{q.booked}</strong></p>}
  <section className="grid"><div className="card"><div className="label">Upcoming appointments</div><div className="stat">{upcoming}</div><div className="label">Scheduled from today</div></div><div className="card"><div className="label">Active services</div><div className="stat">{(services||[]).filter((s:any)=>s.is_active).length}</div><div className="label">Treatments offered</div></div><div className="card"><div className="label">Clinic timezone</div><div className="stat" style={{fontSize:20,marginTop:17}}>{business.timezone}</div><div className="label">Appointment scheduling zone</div></div></section>
  <AppointmentsManager upcoming={(upcomingAppointments||[]) as any[]} recent={(recentAppointments||[]) as any[]} timezone={business.timezone}/>
  <section className="section card"><div className="sectionhead"><h2>Book an appointment</h2><span className="label">Staff booking</span></div><p className="muted">Appointments use {business.timezone}. Bookings are checked against clinic hours and existing appointments.</p>{(services||[]).filter((s:any)=>s.is_active).length===0?<p className="notice">Add an active service before creating an appointment.</p>:<AppointmentForm services={(services||[]).filter((s:any)=>s.is_active)} today={today} timezone={business.timezone} idempotencyKey={randomBytes(16).toString("hex")}/ >}</section>
  <section className="grid section" style={{gridTemplateColumns:"1fr 1fr"}}><div className="card"><div className="sectionhead"><h2>Services</h2><span className="label">{services?.length||0} total</span></div>{(services||[]).map((s:any)=><div key={s.id} style={{display:"flex",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid var(--line)"}}><div><strong>{s.name}</strong><div className="muted">{s.duration_minutes} min · {s.price==null?"Price on request":"₹"+Number(s.price).toLocaleString("en-IN")}</div></div><span className="pill">{s.is_active?"Active":"Inactive"}</span></div>)}{services?.length===0&&<p className="muted">Add your first service below.</p>}<form action={addService} style={{marginTop:14}}><div className="field"><label>Service name</label><input name="name" placeholder="Dental consultation" required/></div><div className="formgrid"><div className="field"><label>Duration (minutes)</label><input name="duration" type="number" min="5" max="480" defaultValue="30" required/></div><div className="field"><label>Price (₹, optional)</label><input name="price" type="number" min="0" step="1" placeholder="Leave blank"/></div></div><button className="btn">Add service</button></form></div>
  <HoursEditor hours={hours || []} timezone={business.timezone} canEdit={["owner","admin"].includes(membership.role)} action={saveHours}/></section>
  {membership.role === "owner" && business.created_by === userId && <section className="section card" style={{border:"1px solid #f0b4b4",background:"rgba(180,35,24,0.035)"}}>
    <div className="sectionhead"><h2 style={{color:"#b42318"}}>Danger zone</h2></div>
    <p className="muted">Permanently delete <strong>{business.name}</strong> and only its own data, including appointments, patient records, services, business hours, integrations, call logs, audit history and notification records. This cannot be undone. Your other clinic workspaces and their data are not affected.</p>
    <DeleteClinicForm action={deleteBusiness} businessId={business.id} businessName={business.name}/>
  </section>}
  <footer className="muted" style={{textAlign:"center",marginTop:36}}>ClinicDesk early access · Built for independent dental clinics · No diagnosis or treatment advice</footer></main>;
}
