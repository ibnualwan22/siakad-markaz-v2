import { requirePermission } from "@/lib/permission";

export default async function NadiHufadzLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission("nadi_hufadz");
  return <>{children}</>;
}
