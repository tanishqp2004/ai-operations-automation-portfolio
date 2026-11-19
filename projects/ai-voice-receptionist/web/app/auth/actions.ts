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
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\\/+$/, "");
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: siteUrl + "/auth/callback" },
  });
  if (error) redirect("/signup?error=" + encodeURIComponent(error.message));
  redirect("/login?message=" + encodeURIComponent("Check your email to confirm your account, then sign in."));
}

export async function resendSignupConfirmation(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  if (!email) redirect("/login?error=" + encodeURIComponent("Enter your email address first."));

  const supabase = await createClient();
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\\/+$/, "");
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: siteUrl + "/auth/callback" },
  });

  if (error) {
    redirect("/login?error=" + encodeURIComponent("We couldn't resend the confirmation email: " + error.message));
  }
  redirect("/login?message=" + encodeURIComponent("If this account is awaiting confirmation, a new email has been sent. Check your inbox and spam folder."));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
