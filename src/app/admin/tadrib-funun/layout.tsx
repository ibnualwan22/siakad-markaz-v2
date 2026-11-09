import { requirePermission } from "@/lib/permission";

export default async function TadribFununLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission("tadrib_funun");
  return <>{children}</>;
}
