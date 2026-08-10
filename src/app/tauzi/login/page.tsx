import { getSantriSession } from "@/lib/santri-auth";
import TauziLoginForm from "./login-form";

export const dynamic = "force-dynamic";

export default async function TauziLoginPage() {
  const session = await getSantriSession();
  
  return <TauziLoginForm initialNis={session?.santriId || ""} />;
}

