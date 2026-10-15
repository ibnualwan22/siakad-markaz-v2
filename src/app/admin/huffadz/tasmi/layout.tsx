import { requirePermission } from "@/lib/permission";

export default async function HuffadzLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePermission("huffadz");
  return <>{children}</>;
}
