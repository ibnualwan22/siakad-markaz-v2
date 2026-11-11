import { requirePermission } from "@/lib/permission";

export default async function UbudiyahLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission("ubudiyah");
  return <>{children}</>;
}
