"use client";

import { useMemo, useState } from "react";
import TemplateSyahadahOfflineTab from "./template-syahadah-offline-tab";
import { offlineProgramKey } from "@/lib/syahadah-offline";

export type OfflineProgramOption = {
  id: string;
  nama_indo: string;
  nama_arab: string;
  kategori?: string;
  programMapels: Array<{
    mapel: { id: string; nama_indo: string; nama_arab: string; tampil_di_syahadah: boolean };
  }>;
};

// Pemilih program + tab editor template offline. Satu template per program;
// template dibuat otomatis (posisi awal dari peta terukur) saat pertama
// kali program dipilih.
export default function SyahadahOfflineClient({
  programs,
}: {
  programs: OfflineProgramOption[];
}) {
  const [programId, setProgramId] = useState<string>(programs[0]?.id || "");

  const program = useMemo(
    () => programs.find((p) => p.id === programId) || programs[0],
    [programs, programId],
  );

  const programKey = program ? offlineProgramKey(program.nama_indo) : "";

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border p-5 space-y-3">
        <h3 className="font-bold">Program</h3>
        <p className="text-xs text-[var(--color-text-muted)]">
          Template syahadah offline dibuat per program. Pilih program, upload
          desain Canva-nya (A4 portrait), lalu atur posisi field dan kalibrasi.
        </p>
        <select
          value={program?.id || ""}
          onChange={(e) => setProgramId(e.target.value)}
          className="w-full max-w-md px-3 py-2 border rounded-xl font-bold"
        >
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nama_indo}
              {p.nama_arab ? ` — ${p.nama_arab}` : ""}
            </option>
          ))}
        </select>
        {program && (
          <p className="text-xs text-[var(--color-text-muted)]">
            Template key: <code>{programKey}</code>
          </p>
        )}
        {/* Cetak tes dengan data santri contoh (Takhossus Tsani, Duf'ah 95).
            Template program Takhossus Tsani harus sudah dibuat di editor ini
            dulu (pilih programnya, upload desain, simpan) supaya isi tercetak. */}
        <a
          href="/cetak-offline/cmw55m1l80044rhbchu753xyf"
          target="_blank"
          rel="noreferrer"
          className="inline-block px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700"
        >
          Cetak Tes — Ahmad Ibnu Alwan
        </a>
        <p className="text-xs text-[var(--color-text-muted)]">
          Membuka halaman cetak syahadah santri contoh (Takhossus Tsani, Duf&apos;ah 95)
          di tab baru — untuk mengetes posisi field di kertas pre-printed.
        </p>
      </div>

      {program && (
        <TemplateSyahadahOfflineTab
          key={programKey}
          programKey={programKey}
          apiBase="/api/admin/syahadah-offline/template"
          canEdit
        />
      )}
    </div>
  );
}
