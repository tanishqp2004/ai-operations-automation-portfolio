import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClinicDesk — Dental clinic workspace",
  description: "Simple appointment and front-desk management for independent dental clinics."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}