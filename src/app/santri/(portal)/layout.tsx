import { getSantriSession } from "@/lib/santri-auth";
import { redirect } from "next/navigation";
import { SantriSidebar, SantriBottomNav } from "@/components/santri/santri-nav";
import { Toaster } from "react-hot-toast";
import { getSantriMenu } from "@/lib/santri-menu";

export default async function SantriLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSantriSession();
  if (!session) {
    redirect("/santri/login");
  }

  const menu = await getSantriMenu(session.santriId);

  return (
    <div
      className="min-h-screen flex flex-col lg:flex-row"
      style={{ background: "var(--bg-app)" }}
    >
      <SantriSidebar nama={session.nama} isAktif={session.isAktif} {...menu} />
      <main className="flex-1 min-w-0 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-24 lg:pb-8 pt-16 lg:pt-8">
          <div className="mx-auto max-w-4xl w-full">{children}</div>
        </div>
        <footer
          className="app-footer hidden lg:block border-t"
          style={{ borderColor: "var(--color-surface-dark)" }}
        >
          Developed by{" "}
          <span className="font-bold" style={{ color: "var(--color-primary)" }}>
            Aksara X
          </span>{" "}
          KSU Batch 10
        </footer>
      </main>
      <SantriBottomNav />
      <Toaster
        position="bottom-center"
        toastOptions={{
          style: {
            fontWeight: "600",
            fontSize: "14px",
            borderRadius: "var(--radius-lg)",
            boxShadow: "var(--shadow-raised)",
            background: "var(--bg-card)",
            color: "var(--color-text)",
          },
        }}
      />
    </div>
  );
}
