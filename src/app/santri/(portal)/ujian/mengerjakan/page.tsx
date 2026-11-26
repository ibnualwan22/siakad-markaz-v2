import type { Viewport } from "next";
import { getSantriSession } from "@/lib/santri-auth";
import { redirect } from "next/navigation";
import ClientMengerjakanUjian from "./client";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default async function Page() {
  const session = await getSantriSession();
  if (!session) redirect("/santri-login");

  return <ClientMengerjakanUjian />;
}
