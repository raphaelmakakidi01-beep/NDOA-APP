import type { Metadata } from "next";
import { UsersList } from "@/components/admin/users";

export const metadata: Metadata = { title: "Utilisateurs" };

export default function Page() {
  return <UsersList />;
}
