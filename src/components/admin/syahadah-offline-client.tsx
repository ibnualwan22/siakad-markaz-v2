"use client";

import { useMemo, useState } from "react";
import TemplateSyahadahOfflineTab from "./template-syahadah-offline-tab";
import { offlineProgramKey } from "@/lib/syahadah-offline";

export type OfflineProgramOption = {
  id: string;
  nama_indo: string;
  nama_arab: string;
  kategori?: string;
  // Bentuk terserialisasi dari getProgramCatalog() / serializeProgram()
  // (src/lib/app-data.ts): mapelList diratakan, TANPA `.mapel` bersarang.
  // Jangan pakai `programMapels` — field itu tidak ada di katalog ini.
  mapelList: Array<{
    id: string;
    nama_indo: string;
    nama_arab: string;
    urutan: number;
    jumlah_tes: number;
    tampil_di_syahadah: boolean;
    masuk_akumulasi: boolean;
    bobot: number;
    bobot_usbu: number;
    bulan_aktif: number;
    jumlah_tes_b2: number | null;
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
  // Jumlah slot nilai = jumlah mapel tampil program terpilih (I'dad Awal:
  // 5, Shifr: 7, Akbarnas: 12) — editor hanya menampilkan slot itu.
  const tampilCount = program
    ? (program.mapelList ?? []).filter(
        (m) => m.tampil_di_syahadah !== false,
      ).length
    : 12;

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
        {/* Cetak tes DUMMY untuk program yang dipilih: nama selalu
            "Ahmad Ibnu Alwan" di semua program, nilai ٩٥ semua (bukan data
            santri asli). Template program harus sudah dibuat di editor ini
            dulu (upload desain, simpan) supaya desain tampil di preview. */}
        <a
          href={`/cetak-offline/tes/${programKey}`}
          target="_blank"
          rel="noreferrer"
          className="inline-block px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700"
        >
          Cetak Tes (dummy Ahmad Ibnu Alwan)
        </a>
        <p className="text-xs text-[var(--color-text-muted)]">
          Membuka contoh cetak dummy untuk program {program?.nama_indo} di tab baru
          — untuk mengetes posisi field + desain di kertas pre-printed.
        </p>
      </div>

      {program && (
        <TemplateSyahadahOfflineTab
          key={programKey}
          programKey={programKey}
          apiBase="/api/admin/syahadah-offline/template"
          canEdit
          slotCount={tampilCount}
        />
      )}
    </div>
  );
}
