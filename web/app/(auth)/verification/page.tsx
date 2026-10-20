import type { Metadata } from "next";
import { OtpForm } from "@/components/auth/otp-form";

export const metadata: Metadata = { title: "Vérification" };

export default function Page() {
  return <OtpForm />;
}
