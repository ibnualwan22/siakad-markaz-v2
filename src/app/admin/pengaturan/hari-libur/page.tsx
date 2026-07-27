import { HariLiburClient } from "@/components/admin/hari-libur-client";

export const metadata = {
  title: "Kelola Hari Libur - Markaz",
};

export default function HariLiburPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <HariLiburClient />
    </div>
  );
}
