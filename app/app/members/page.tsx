import { redirect } from "next/navigation";

// Team now lives inside Settings → Team. Keep this path working for old links.
export default function MembersPage() {
  redirect("/app/settings");
}
