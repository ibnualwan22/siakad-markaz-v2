"use client";

import { useState, useEffect, useCallback } from "react";

type SakanRow = {
  nama: string;
  total: number;
  sudahLapor: boolean;
  hadir: number;
  izin: number;
  sakit: number;
  alpha: number;
};

type PerhatianItem = {
  nama: string;
  sakan: string;
  status: string;
  keterangan: string | null;
  tasrih: string | null;
};

type BoardData = {
  tanggal: string;
  sakan: SakanRow[];
  perhatian: { izinSakit: PerhatianItem[]; bercatatan: PerhatianItem[] };
};

function statusBadge(status: string) {
  if (status === "IZIN")
    return "bg-amber-100 text-amber-800 border-amber-200";
  if (status === "SAKIT") return "bg-rose-100 text-rose-800 border-rose-200";
  if (status === "ALPHA") return "bg-red-100 text-red-800 border-red-200";
  return "bg-emerald-100 text-emerald-800 border-emerald-200";
}

function PerhatianList({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: PerhatianItem[];
  emptyText: string;
}) {
  return (
    <div>
      <h3 className="text-sm font-bold text-[var(--color-text)] mb-2">
        {title} ({items.length})
      </h3>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--color-text-subtle)]">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li
              key={`${it.nama}-${it.sakan}-${i}`}
              className="flex flex-col gap-1 rounded-xl border border-[var(--color-surface-dark)] bg-white px-3 py-2.5 sm:flex-row sm:items-center sm:gap-3"
            >
              <div className="min-w-0 flex-1">
                <span className="font-bold text-sm text-[var(--color-text)]">
                  {it.nama}
                </span>
                <span className="text-sm text-[var(--color-text-muted)]">
                  {" "}
                  • {it.sakan}
                </span>
                {it.keterangan && (
                  <p className="text-sm text-[var(--color-text-muted)] break-words">
                    {it.keterangan}
                    {it.tasrih && (
                      <span className="ml-2 text-xs font-semibold text-[var(--color-text-subtle)]">
                        [{it.tasrih}]
                      </span>
                    )}
                  </p>
                )}
              </div>
              <span
                className={`shrink-0 self-start rounded-full border px-2.5 py-0.5 text-xs font-bold sm:self-auto ${statusBadge(it.status)}`}
              >
                {it.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Papan status sakan hari ini + daftar perhatian (izin/sakit & bercatatan).
// Data dari /api/admin/absensi/rekap/sakan-board; muat ulang manual
// (push memberi tahu staf untuk membuka halaman ini).
export function SakanBoardClient() {
  const [data, setData] = useState<BoardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setIsLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/absensi/rekap/sakan-board");
      if (!res.ok) throw new Error("gagal");
      setData(await res.json());
    } catch {
      setError("Gagal memuat papan sakan.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const belum = data?.sakan.filter((s) => !s.sudahLapor) ?? [];

  return (
    <section className="space-y-4 rounded-2xl border border-[var(--color-surface-dark)] bg-[var(--color-surface-light)] p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-black text-[var(--color-text)]">
            Papan Status Sakan
          </h2>
          <p className="text-sm text-[var(--color-text-muted)]">
            Hari ini{data ? ` • ${data.tanggal}` : ""} — sakan yang belum
            lapor ditandai jelas, tanpa perlu membuka grup WA.
          </p>
        </div>
        <button
          onClick={load}
          disabled={isLoading}
          className="rounded-full border border-[var(--color-surface-dark)] bg-white px-4 py-2 text-xs font-bold text-[var(--color-text)] transition hover:bg-slate-50 disabled:opacity-50"
        >
          {isLoading ? "Memuat..." : "Muat ulang"}
        </button>
      </div>

      {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

      {isLoading && !data && (
        <p className="text-sm text-[var(--color-text-subtle)]">
          Memuat papan...
        </p>
      )}

      {data && (
        <>
          {belum.length > 0 ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-bold text-red-700">
              {belum.length} sakan belum lapor: {belum.map((s) => s.nama).join(", ")}
            </p>
          ) : (
            <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm font-bold text-emerald-700">
              Semua sakan sudah lapor hari ini.
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.sakan.map((s) => (
              <div
                key={s.nama}
                className={`rounded-xl border bg-white px-4 py-3 ${
                  s.sudahLapor
                    ? "border-[var(--color-surface-dark)]"
                    : "border-red-300 ring-1 ring-red-200"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-[var(--color-text)]">
                    {s.nama}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      s.sudahLapor
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {s.sudahLapor ? "Sudah lapor" : "Belum lapor"}
                  </span>
                </div>
                <p className="mt-1.5 text-sm text-[var(--color-text-muted)]">
                  {s.total} santri • H {s.hadir} · I {s.izin} · S {s.sakit} ·
                  A {s.alpha}
                </p>
              </div>
            ))}
          </div>

          <div className="space-y-5 border-t border-[var(--color-surface-dark)] pt-4">
            <h2 className="text-base font-black text-[var(--color-text)]">
              Perhatian hari ini
            </h2>
            <PerhatianList
              title="Santri izin & sakit"
              items={data.perhatian.izinSakit}
              emptyText="Tidak ada santri izin atau sakit hari ini. Izin harian dan ta'birot tidak ditampilkan (rutin)."
            />
            <PerhatianList
              title="Santri bercatatan"
              items={data.perhatian.bercatatan}
              emptyText="Tidak ada catatan pada santri hadir/alpha hari ini."
            />
          </div>
        </>
      )}
    </section>
  );
}
