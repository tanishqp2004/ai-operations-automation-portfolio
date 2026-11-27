"use client";

import { useState } from "react";

export default function DeleteClinicForm({
  action,
  businessId,
  businessName
}: {
  action: (formData: FormData) => void | Promise<void>;
  businessId: string;
  businessName: string;
}) {
  const [pending, setPending] = useState(false);

  return (
    <form action={action} onSubmit={() => setPending(true)} style={{maxWidth:520}}>
      <input type="hidden" name="business_id" value={businessId}/>
      <div className="field">
        <label htmlFor="clinic_delete_confirmation">Type <strong>{businessName}</strong> to confirm</label>
        <input
          id="clinic_delete_confirmation"
          name="confirmation_name"
          autoComplete="off"
          placeholder="Enter the exact clinic name"
          required
          disabled={pending}
        />
      </div>
      <label style={{display:"flex",alignItems:"flex-start",gap:9,margin:"12px 0 16px",fontSize:13,lineHeight:1.5}}>
        <input type="checkbox" required disabled={pending} style={{marginTop:3}}/>
        <span>I understand this permanently deletes this clinic and its appointments, patient records, services, call logs, settings and related data. Other clinic workspaces will not be deleted.</span>
      </label>
      <button
        className="btn"
        type="submit"
        disabled={pending}
        style={{background:"#b42318",borderColor:"#b42318",color:"#fff"}}
      >
        {pending ? "Deleting clinic…" : "Delete this clinic permanently"}
      </button>
      {pending && <p className="muted" role="status" aria-live="polite">Deleting this clinic. Please keep this page open.</p>}
    </form>
  );
}
