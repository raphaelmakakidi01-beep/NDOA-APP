import type { Metadata } from "next";
import { Communication } from "@/components/admin/communication";

export const metadata: Metadata = { title: "Communication" };

export default function Page() {
  return <Communication />;
}
