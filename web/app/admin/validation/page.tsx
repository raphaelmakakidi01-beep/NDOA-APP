import type { Metadata } from "next";
import { ValidationQueue } from "@/components/admin/validation";

export const metadata: Metadata = { title: "File de validation" };

export default function Page() {
  return <ValidationQueue />;
}
