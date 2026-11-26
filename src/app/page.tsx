import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { resolvePostLoginRedirect } from "@/lib/permission";

export default async function HomePage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const target = await resolvePostLoginRedirect(session.userId, session.role);
  redirect(target);
}
