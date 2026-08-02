import { getSantriSession } from "@/lib/santri-auth";
import { redirect } from "next/navigation";
import ClientMengerjakanUjian from "./client";

export default async function Page() {
  const session = await getSantriSession();
  if (!session) redirect("/santri-login");
  
  return <ClientMengerjakanUjian />;
}
