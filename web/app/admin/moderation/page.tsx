import type { Metadata } from "next";
import { Moderation } from "@/components/admin/moderation";

export const metadata: Metadata = { title: "Modération" };

export default function Page() {
  return <Moderation />;
}
