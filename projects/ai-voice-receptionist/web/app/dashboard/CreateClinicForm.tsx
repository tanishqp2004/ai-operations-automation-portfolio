"use client";

import { useState } from "react";

export default function CreateClinicForm({ action, requestKey }: {
  action: (formData: FormData) => void | Promise<void>;
  requestKey: string;
}) {
  const [pending, setPending] = useState(false);
  return (
    <form action={action} onSubmit={() => setPending(true)} style={{maxWidth:520}}>
      <input type="hidden" name="creation_request_key" value={requestKey}/>
      <div className="field"><label>New clinic name</label><input name="name" placeholder="e.g. Smile Dental Studio – Branch 2" required minLength={2} maxLength={120} disabled={pending}/></div>
      <div className="field"><label>Timezone</label><select name="timezone" defaultValue="Asia/Kolkata" disabled={pending}><option value="Asia/Kolkata">India (Asia/Kolkata)</option><option value="Asia/Dubai">Dubai</option><option value="Europe/London">London</option><option value="America/New_York">New York</option></select></div>
      <button className="btn" type="submit" disabled={pending}>{pending ? "Creating clinic…" : "Create clinic and switch"}</button>
      {pending && <p className="muted" role="status" aria-live="polite">Please wait. Keep this page open while your clinic is being created.</p>}
    </form>
  );
}
