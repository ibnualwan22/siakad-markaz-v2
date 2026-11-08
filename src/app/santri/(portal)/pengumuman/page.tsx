"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { PushPrompt } from "@/components/santri/push-prompt";

type PengumumanItem = {
  id: string;
  judul: string;
  isi: string;
  tautan: string | null;
  pengirimLabel: string;
  dibuatAt: string;
  sudahDibaca: boolean;
};

type PengumumanResponse = {
  items: PengumumanItem[];
  jumlahBelumDibaca: number;
};

function formatTanggal(iso: string) {
  return new Date(iso).toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Tautan internal (path "/...") dinavigasi di dalam portal; URL penuh
// dibuka di tab baru.
function TautanPengumuman({ tautan }: { tautan: string }) {
  if (tautan.startsWith("/")) {
    return (
      <Link
        href={tautan}
        onClick={(e) => e.stopPropagation()}
        className="text-sm font-bold underline"
        style={{ color: "var(--color-primary)" }}
      >
        Buka tautan →
      </Link>
    );
  }
  return (
    <a
      href={tautan}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="text-sm font-bold underline"
      style={{ color: "var(--color-primary)" }}
    >
      Buka tautan ↗
    </a>
  );
}

export default function PengumumanSantriPage() {
  const [data, setData] = useState<PengumumanResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [dibacaIds, setDibacaIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/santri/pengumuman")
      .then((r) => {
        if (!r.ok) throw new Error("gagal");
        return r.json();
      })
      .then((d: PengumumanResponse) => {
        setData(d);
        setDibacaIds(
          new Set(d.items.filter((i) => i.sudahDibaca).map((i) => i.id))
        );
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const tandaiDibaca = (id: string) => {
    if (dibacaIds.has(id)) return;
    setDibacaIds((prev) => new Set(prev).add(id));
    fetch(`/api/santri/pengumuman/${id}/baca`, { method: "POST" }).catch(
      () => {
        // Gagal menandai di server: kembalikan penanda agar tidak bohong.
        setDibacaIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }
    );
  };

  if (loading) return <p className="p-2 text-sm">Memuat pengumuman...</p>;
  if (error || !data)
    return (
      <p className="p-2 text-sm text-red-600">
        Gagal memuat pengumuman. Silakan muat ulang halaman.
      </p>
    );

  const jumlahBelumDibaca =
    data.items.filter((i) => !dibacaIds.has(i.id)).length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold">Pengumuman</h1>
        <p className="text-sm text-gray-500">
          Pengumuman dari pengurus untukmu
          {jumlahBelumDibaca > 0
            ? ` — ${jumlahBelumDibaca} belum dibaca.`
            : "."}
        </p>
      </div>

      <PushPrompt />

      {data.items.length === 0 ? (
        <div className="rounded-2xl border bg-white p-6 text-center space-y-2">
          <div className="text-4xl">📣</div>
          <p className="font-semibold">Belum ada pengumuman</p>
          <p className="text-sm text-gray-500">
            Pengumuman baru akan muncul di sini.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.items.map((item) => {
            const sudahDibaca = dibacaIds.has(item.id);
            return (
              <article
                key={item.id}
                onClick={() => tandaiDibaca(item.id)}
                className="rounded-2xl border bg-white p-4 space-y-2 shadow-sm cursor-pointer"
                style={
                  sudahDibaca
                    ? undefined
                    : { borderColor: "var(--color-primary)" }
                }
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2 min-w-0">
                    <Bell
                      size={18}
                      className="shrink-0 mt-0.5"
                      style={{
                        color: sudahDibaca
                          ? "var(--color-text-subtle)"
                          : "var(--color-primary)",
                      }}
                    />
                    <div className="min-w-0">
                      <h2 className="font-bold leading-snug">{item.judul}</h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {item.pengirimLabel} • {formatTanggal(item.dibuatAt)}
                      </p>
                    </div>
                  </div>
                  {!sudahDibaca && (
                    <span
                      className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold text-white"
                      style={{ background: "var(--color-primary)" }}
                    >
                      Baru
                    </span>
                  )}
                </div>

                <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
                  {item.isi}
                </p>

                {item.tautan && <TautanPengumuman tautan={item.tautan} />}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
