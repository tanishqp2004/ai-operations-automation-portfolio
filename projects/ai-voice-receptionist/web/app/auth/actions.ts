"use server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=" + encodeURIComponent(error.message));
  redirect("/dashboard");
}
export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (password.length < 8) redirect("/signup?error=" + encodeURIComponent("Use at least 8 characters for your password."));
  const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: undefined } });
  if (error) redirect("/signup?error=" + encodeURIComponent(error.message));
  redirect("/login?message=" + encodeURIComponent("Check your email to confirm your account, then sign in."));
}
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}