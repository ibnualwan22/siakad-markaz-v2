"use client";

import { useEffect, useState } from "react";
import { UbudiyahKegiatan, UbudiyahStatus } from "@prisma/client";
import {
  UBUDIYAH_KEGIATAN_LABEL,
  UBUDIYAH_KEGIATAN_ORDER,
  UBUDIYAH_STATUS_LABEL,
  UBUDIYAH_STATUS_OPTIONS,
  isUbudiyahKeteranganRequired,
} from "@/lib/ubudiyah";

type SantriRow = {
  riwayatId: string;
  santriId: string;
  nama: string;
  sakan: string;
  kategori: string;
};

type AbsenTersimpan = {
  status: UbudiyahStatus;
  keterangan: string | null;
};

type Info = {
  isQism: boolean;
  sakan: string | null;
  tanggal: string;
  dufahNama: string;
  santriList: SantriRow[];
  absenHariIni: Record<string, Record<string, AbsenTersimpan>>;
};

type NilaiSatu = {
  status: UbudiyahStatus | "";
  keterangan: string;
};

const HARI_ID = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const BULAN_ID = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

/** "2026-11-11" -> "Rabu, 11 November 2026" (tanggal lokal, tanpa geser zona waktu). */
function formatTanggalPanjang(dateStr: string): string {
  const m = String(dateStr).slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(dateStr).slice(0, 10);
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return `${HARI_ID[d.getDay()]}, ${Number(m[3])} ${BULAN_ID[d.getMonth()]} ${m[1]}`;
}

export default function UbudiyahSantriPage() {
  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [kegiatan, setKegiatan] = useState<UbudiyahKegiatan>(
    UbudiyahKegiatan.SUBUH
  );
  const [nilai, setNilai] = useState<Record<string, NilaiSatu>>({});
  const [simpanLoading, setSimpanLoading] = useState(false);
  const [simpanError, setSimpanError] = useState("");
  const [simpanSukses, setSimpanSukses] = useState("");

  const load = async (initial = false) => {
    if (initial) setLoading(true);
    try {
      const res = await fetch("/api/santri/ubudiyah");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal memuat data");
      const next: Info = {
        isQism: !!json.isQism,
        sakan: json.sakan ?? null,
        tanggal: json.tanggal || "",
        dufahNama: json.dufahNama || "",
        santriList: json.santriList || [],
        absenHariIni: json.absenHariIni || {},
      };
      setInfo(next);
      // Prefill dari absen yang sudah tersimpan hari ini.
      const awal: Record<string, NilaiSatu> = {};
      for (const keg of UBUDIYAH_KEGIATAN_ORDER) {
        const perKeg = next.absenHariIni[keg] || {};
        for (const s of next.santriList) {
          const tersimpan = perKeg[s.riwayatId];
          awal[`${keg}:${s.riwayatId}`] = {
            status: tersimpan?.status ?? "",
            keterangan: tersimpan?.keterangan ?? "",
          };
        }
      }
      setNilai(awal);
      setLoadError("");
    } catch (e: any) {
      setLoadError(e.message || "Gagal memuat data");
    } finally {
      if (initial) setLoading(false);
    }
  };

  useEffect(() => {
    load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setStatus = (riwayatId: string, status: UbudiyahStatus | "") => {
    setNilai((prev) => ({
      ...prev,
      [`${kegiatan}:${riwayatId}`]: {
        status,
        // Bila status tidak lagi butuh keterangan, kosongkan keterangannya.
        keterangan:
          status && !isUbudiyahKeteranganRequired(status)
            ? ""
            : prev[`${kegiatan}:${riwayatId}`]?.keterangan ?? "",
      },
    }));
    setSimpanError("");
    setSimpanSukses("");
  };

  const setKeterangan = (riwayatId: string, keterangan: string) => {
    setNilai((prev) => ({
      ...prev,
      [`${kegiatan}:${riwayatId}`]: {
        status: prev[`${kegiatan}:${riwayatId}`]?.status ?? "",
        keterangan,
      },
    }));
  };

  const simpan = async () => {
    if (!info) return;
    // Validasi client: semua santri harus terisi status; keterangan
    // wajib bila statusnya bukan tepat waktu / hadir (server juga
    // memvalidasi hal yang sama).
    const belum: string[] = [];
    const ketKurang: string[] = [];
    const absenList: {
      riwayatId: string;
      status: UbudiyahStatus;
      keterangan?: string;
    }[] = [];
    for (const s of info.santriList) {
      const n = nilai[`${kegiatan}:${s.riwayatId}`];
      if (!n || !n.status) {
        belum.push(s.nama);
        continue;
      }
      if (
        isUbudiyahKeteranganRequired(n.status) &&
        !n.keterangan.trim()
      ) {
        ketKurang.push(s.nama);
        continue;
      }
      absenList.push({
        riwayatId: s.riwayatId,
        status: n.status,
        keterangan: n.keterangan.trim() || undefined,
      });
    }
    if (belum.length > 0) {
      return setSimpanError(
        `Masih ada santri yang belum dipilih statusnya: ${belum
          .slice(0, 3)
          .join(", ")}${belum.length > 3 ? ` (+${belum.length - 3} lagi)` : ""}`
      );
    }
    if (ketKurang.length > 0) {
      return setSimpanError(
        `Keterangan wajib diisi untuk: ${ketKurang
          .slice(0, 3)
          .join(", ")}${ketKurang.length > 3 ? ` (+${ketKurang.length - 3} lagi)` : ""}`
      );
    }
    setSimpanLoading(true);
    setSimpanError("");
    setSimpanSukses("");
    try {
      const res = await fetch("/api/santri/ubudiyah", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tanggal: info.tanggal,
          kegiatan,
          absenList,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menyimpan absen");
      setSimpanSukses(
        `Absen ${UBUDIYAH_KEGIATAN_LABEL[kegiatan]} tersimpan (${absenList.length} santri).`
      );
      load();
    } catch (e: any) {
      setSimpanError(e.message || "Gagal menyimpan absen");
    } finally {
      setSimpanLoading(false);
    }
  };

  if (loading) return <p className="p-6 text-sm">Memuat...</p>;
  if (loadError || !info)
    return (
      <p className="p-6 text-sm text-red-600">
        {loadError || "Gagal memuat data."}
      </p>
    );

  // Bukan Qism: halaman ini hanya untuk pencatat absen Ubudiyah.
  if (!info.isQism) {
    return (
      <div className="space-y-6 p-4 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-black">Qism Ubudiyah</h1>
          <p className="text-sm text-slate-500">
            Absensi kegiatan wajib berjamaah (Subuh, Maghrib, Isya, Halaqoh)
            per sakan.
          </p>
        </div>
        <div className="bg-white rounded-2xl border p-6 text-center">
          <p className="font-bold">
            Halaman ini hanya untuk Qism Ubudiyah
          </p>
          <p className="text-sm text-slate-500 mt-2">
            Hanya santri yang ditunjuk admin sebagai Qism Ubudiyah yang dapat
            membuka halaman ini. Bila Anda merasa seharusnya ditunjuk,
            silakan hubungi admin.
          </p>
        </div>
      </div>
    );
  }

  const terisi = info.santriList.filter(
    (s) => nilai[`${kegiatan}:${s.riwayatId}`]?.status
  ).length;

  return (
    <div className="space-y-6 p-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-black">Qism Ubudiyah</h1>
        <p className="text-sm text-slate-500">
          {info.tanggal ? formatTanggalPanjang(info.tanggal) : ""}
          {info.sakan ? ` • Sakan ${info.sakan}` : ""}
          {info.dufahNama ? ` • ${info.dufahNama}` : ""}
        </p>
        <p className="text-sm text-slate-500 mt-1">
          Absen hanya untuk hari ini — tanggal tidak dapat diubah. Pilih
          kegiatan, isi status tiap santri, lalu simpan.
        </p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {UBUDIYAH_KEGIATAN_ORDER.map((k) => (
          <button
            key={k}
            onClick={() => {
              setKegiatan(k);
              setSimpanError("");
              setSimpanSukses("");
            }}
            className={`px-4 py-2.5 text-sm font-bold rounded-xl border transition-colors ${
              kegiatan === k
                ? "bg-emerald-600 text-white border-emerald-600"
                : "bg-white text-slate-600 hover:border-emerald-600"
            }`}
          >
            {UBUDIYAH_KEGIATAN_LABEL[k]}
          </button>
        ))}
      </div>

      {info.santriList.length === 0 ? (
        <div className="bg-white rounded-2xl border p-6 text-center text-sm text-slate-500">
          Tidak ada santri aktif di sakan {info.sakan ?? "-"}.
        </div>
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {UBUDIYAH_KEGIATAN_LABEL[kegiatan]} — {terisi}/
            {info.santriList.length} santri sudah terisi
          </p>
          <div className="space-y-3">
            {info.santriList.map((s) => {
              const n = nilai[`${kegiatan}:${s.riwayatId}`] ?? {
                status: "" as const,
                keterangan: "",
              };
              const perluKeterangan =
                n.status !== "" && isUbudiyahKeteranganRequired(n.status);
              return (
                <div
                  key={s.riwayatId}
                  className="bg-white rounded-2xl border p-4 space-y-3"
                >
                  <p className="font-bold">
                    {s.nama}{" "}
                    {s.kategori === "KSU" && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                        KSU
                      </span>
                    )}
                  </p>
                  <select
                    value={n.status}
                    onChange={(e) =>
                      setStatus(
                        s.riwayatId,
                        e.target.value as UbudiyahStatus | ""
                      )
                    }
                    className="w-full px-3 py-2.5 border rounded-xl text-sm bg-white"
                  >
                    <option value="">Pilih status...</option>
                    {UBUDIYAH_STATUS_OPTIONS[kegiatan].map((st) => (
                      <option key={st} value={st}>
                        {UBUDIYAH_STATUS_LABEL[st]}
                      </option>
                    ))}
                  </select>
                  {perluKeterangan && (
                    <div>
                      <input
                        type="text"
                        value={n.keterangan}
                        onChange={(e) =>
                          setKeterangan(s.riwayatId, e.target.value)
                        }
                        placeholder="Keterangan (wajib diisi)"
                        className="w-full px-3 py-2.5 border rounded-xl text-sm bg-white"
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        Keterangan wajib diisi bila status bukan tepat waktu /
                        hadir.
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {simpanError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {simpanError}
            </p>
          )}
          {simpanSukses && (
            <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              {simpanSukses}
            </p>
          )}
          <button
            onClick={simpan}
            disabled={simpanLoading || info.santriList.length === 0}
            className="w-full px-5 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-50"
          >
            {simpanLoading
              ? "Menyimpan..."
              : `Simpan Absen ${UBUDIYAH_KEGIATAN_LABEL[kegiatan]}`}
          </button>
        </>
      )}
    </div>
  );
}
