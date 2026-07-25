"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Loader2, FileText } from "lucide-react";
import TasrihModal, { TasrihDetail } from "./tasrih-modal";

type SantriAbsenTarget = {
  riwayatId: string;
  santriId: string;
  nama: string;
  sakan: string;
  gender: string;
  kategori: string;
  kelasId: string | null;
  kelasNama: string | null;
  programId: string | null;
  programNama: string | null;
  isCheckedOut: boolean;
};

type AbsenStatus = "HADIR" | "IZIN" | "SAKIT" | "ALPHA" | "KOSONG";

type KategoriKegiatan = {
  id: string;
  nama: string;
  aktif: boolean;
};

export function AbsensiKegiatanClient({
  sakanList,
  kegiatanList,
  kelasList,
  defaultSakan,
}: {
  sakanList: string[];
  kegiatanList: KategoriKegiatan[];
  kelasList: { id: string, nama: string }[];
  defaultSakan?: string;
}) {
  const [tanggal, setTanggal] = useState("");
  const [kategoriId, setKategoriId] = useState("");
  const [sakan, setSakan] = useState(defaultSakan || "ALL");
  const [kelasId, setKelasId] = useState("ALL");
  const [santriList, setSantriList] = useState<SantriAbsenTarget[]>([]);
  const [absenMap, setAbsenMap] = useState<Record<string, { status: AbsenStatus; keterangan: string }>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [unconfirmedIds, setUnconfirmedIds] = useState<Set<string>>(new Set());
  const [selectedTasrih, setSelectedTasrih] = useState<TasrihDetail | null>(null);

  const activeKegiatanList = kegiatanList.filter((k) => k.aktif);

  useEffect(() => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
    setTanggal(formatter.format(new Date()));
    if (activeKegiatanList.length > 0) {
      setKategoriId(activeKegiatanList[0].id);
    }
  }, []);

  useEffect(() => {
    if (!tanggal || !kategoriId) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(
          `/api/admin/absensi/kegiatan-harian?tanggal=${tanggal}&kategoriId=${kategoriId}&sakan=${sakan}&kelasId=${kelasId}`
        );
        const data = await res.json();
        if (data.santriList) setSantriList(data.santriList);

        const newMap: Record<string, any> = {};
        if (data.absenData) {
          data.absenData.forEach((a: any) => {
            newMap[a.riwayatId] = { status: a.status, keterangan: a.keterangan || "" };
          });
        }
        setAbsenMap(newMap);

        if (data.unconfirmedIds) {
          setUnconfirmedIds(new Set(data.unconfirmedIds));
        } else {
          setUnconfirmedIds(new Set());
        }
      } catch {
        toast.error("Gagal memuat data absensi kegiatan");
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [tanggal, kategoriId, sakan, kelasId]);

  const viewTasrih = async (nomorTasrih: string) => {
    try {
      const res = await fetch(`/api/admin/perizinan/tasrih/${nomorTasrih}`);
      if (!res.ok) throw new Error("Gagal load tasrih");
      const json = await res.json();
      setSelectedTasrih(json);
    } catch (error) {
      toast.error("Gagal memuat detail tasrih");
    }
  };

  const handleStatusChange = (riwayatId: string, status: AbsenStatus) => {
    setAbsenMap((prev) => ({
      ...prev,
      [riwayatId]: { ...prev[riwayatId], status, keterangan: prev[riwayatId]?.keterangan || "" },
    }));
  };

  const handleKeteranganChange = (riwayatId: string, keterangan: string) => {
    setAbsenMap((prev) => ({
      ...prev,
      [riwayatId]: { ...prev[riwayatId], status: prev[riwayatId]?.status || "ALPHA", keterangan },
    }));
  };

  const setAllStatus = (status: AbsenStatus) => {
    const newMap = { ...absenMap };
    santriList.forEach((s) => {
      if (s.isCheckedOut) return;
      const current = newMap[s.riwayatId];
      // Jika diset ke HADIR tapi santri sudah punya tasrih (keterangan ada [TRS-]), biarkan status bawaannya
      if (status === "HADIR" && current?.keterangan?.includes("[TRS-")) {
        return;
      }
      newMap[s.riwayatId] = { status, keterangan: current?.keterangan || "" };
    });
    setAbsenMap(newMap);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const absenList = Object.entries(absenMap).map(([riwayatId, data]) => ({
        riwayatId,
        status: data.status,
        keterangan: data.keterangan,
      }));

      const res = await fetch("/api/admin/absensi/kegiatan-harian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tanggal, kategoriId, absenList }),
      });

      const result = await res.json();
      if (result.success) {
        toast.success(`Berhasil menyimpan ${result.count} data absensi kegiatan`);
        // Server otomatis kirim WA jika semua sakan sudah absen
        if (result.waSent) {
          toast.success(`📱 ${result.waDetail}`);
        }
      } else {
        toast.error(result.error || "Gagal menyimpan absensi");
      }
    } catch {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsSaving(false);
    }
  };

  const allOptions = [
    { id: "ALL", label: "Semua Sakan" },
    ...sakanList.map(s => ({ id: s, label: s })),
  ];

  const statHadir = Object.values(absenMap).filter((a) => a.status === "HADIR").length;
  const statIzin = Object.values(absenMap).filter((a) => a.status === "IZIN").length;
  const statSakit = Object.values(absenMap).filter((a) => a.status === "SAKIT").length;
  const statAlpha = Object.values(absenMap).filter((a) => a.status === "ALPHA").length;
  const belumDiabsen = santriList.length - Object.keys(absenMap).length;

  return (
    <div className="space-y-6">
      {activeKegiatanList.length === 0 ? (
        <div className="rounded-[var(--radius-2xl)] border border-[var(--color-warning)] bg-[var(--color-warning-light)] p-6 text-sm font-medium text-[var(--color-warning)]">
          Belum ada kategori kegiatan yang aktif. Pergi ke{" "}
          <a href="/admin/absensi/pengaturan" className="underline font-bold">Pengaturan Kegiatan</a>{" "}
          untuk menambahkan kegiatan terlebih dahulu.
        </div>
      ) : (
        <section className="overflow-hidden neu-card-white">
          <div className="flex flex-col gap-4 border-b border-[var(--color-surface-dark)] p-6 md:flex-row md:items-end md:justify-between bg-[var(--color-surface-light)]">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4 flex-wrap">
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                  Tanggal
                </label>
                <input
                  type="date"
                  value={tanggal}
                  onChange={(e) => setTanggal(e.target.value)}
                  className="rounded-2xl border border-[var(--color-surface-dark)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] outline-none transition focus:border-amber-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                  Kategori Kegiatan
                </label>
                <select
                  value={kategoriId}
                  onChange={(e) => setKategoriId(e.target.value)}
                  className="rounded-2xl border border-[var(--color-surface-dark)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] outline-none transition focus:border-amber-500"
                >
                  {activeKegiatanList.map((k) => (
                    <option key={k.id} value={k.id}>{k.nama}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                  Filter Sakan
                </label>
                <select
                  value={sakan}
                  onChange={(e) => setSakan(e.target.value)}
                  className="rounded-2xl border border-[var(--color-surface-dark)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] outline-none transition focus:border-amber-500"
                >
                  {allOptions.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                  Filter Kelas
                </label>
                <select
                  value={kelasId}
                  onChange={(e) => {
                    setKelasId(e.target.value);
                    if (e.target.value !== "ALL") setSakan("ALL");
                  }}
                  className="rounded-2xl border border-[var(--color-surface-dark)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] outline-none transition focus:border-amber-500"
                >
                  <option value="ALL">Semua Kelas</option>
                  {kelasList.map((k) => (
                    <option key={k.id} value={k.id}>{k.nama}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setAllStatus("HADIR")}
                className="rounded-full bg-[var(--color-surface-dark)] px-4 py-2 text-xs font-bold text-[var(--color-text)] transition hover:bg-[var(--color-surface-dark)]"
              >
                Hadirkan Semua
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || isLoading || !tanggal || !kategoriId}
                className="rounded-full bg-[var(--color-warning)] px-6 py-2 text-sm font-bold text-white transition hover:bg-[var(--color-warning)] disabled:opacity-50"
              >
                {isSaving ? "Menyimpan..." : "Simpan Absensi"}
              </button>
            </div>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-4 border-b border-[var(--color-surface-dark)] px-6 py-4 bg-white">
            <div className="flex items-center gap-2 text-sm font-bold">
              <span className="h-2 w-2 rounded-full bg-[var(--color-primary)]"></span>
              <span className="text-[var(--color-text)]">Hadir: {statHadir}</span>
            </div>
            <div className="flex items-center gap-2 text-sm font-bold">
              <span className="h-2 w-2 rounded-full bg-indigo-500"></span>
              <span className="text-[var(--color-text)]">Izin: {statIzin}</span>
            </div>
            <div className="flex items-center gap-2 text-sm font-bold">
              <span className="h-2 w-2 rounded-full bg-[var(--color-warning)]"></span>
              <span className="text-[var(--color-text)]">Sakit: {statSakit}</span>
            </div>
            <div className="flex items-center gap-2 text-sm font-bold">
              <span className="h-2 w-2 rounded-full bg-[var(--color-danger)]"></span>
              <span className="text-[var(--color-text)]">Alpha: {statAlpha}</span>
            </div>
            <div className="flex items-center gap-2 text-sm font-bold pl-4 border-l border-[var(--color-surface-dark)]">
              <span className="text-[var(--color-text-subtle)]">Belum Diabsen: {belumDiabsen}</span>
            </div>
          </div>

          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-8 text-center text-sm font-semibold text-[var(--color-text-muted)]">Memuat data santri...</div>
            ) : (
              <table className="min-w-full divide-y divide-[var(--color-surface-dark)] text-left">
                <thead className="bg-[var(--color-secondary)] text-xs font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-4 py-4 text-center w-16">#</th>
                    <th className="px-6 py-4">Santri</th>
                    <th className="px-6 py-4 min-w-[300px]">Status Kehadiran</th>
                    <th className="px-6 py-4">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-surface)] text-sm text-[var(--color-text-muted)]">
                  {santriList.map((santri, index) => {
                    const currentStatus = absenMap[santri.riwayatId]?.status;
                    const currentKet = absenMap[santri.riwayatId]?.keterangan || "";
                    return (
                      <tr key={santri.riwayatId} className="hover:bg-[var(--color-surface-light)]">
                        <td className="px-4 py-4 text-center font-bold text-[var(--color-text-subtle)]">{index + 1}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <p className={`font-bold ${santri.isCheckedOut ? "text-red-900" : "text-[var(--color-text)]"}`}>
                              {santri.nama}
                              {unconfirmedIds.has(santri.riwayatId) && (
                                <span className="ml-2 inline-flex items-center gap-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-700 uppercase tracking-wider">
                                  ⚠️ Belum Kembali
                                </span>
                              )}
                            </p>
                            {santri.isCheckedOut && (
                              <span className="px-1.5 py-0.5 text-[9px] font-black tracking-wide bg-red-100 text-red-600 rounded">CHECK OUT</span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            {currentKet.includes("[TRS-") && currentStatus === "IZIN" && (() => {
                              const match = currentKet.match(/\[(TRS-[\d-]+)\]/);
                              const nomorTasrih = match ? match[1] : null;
                              return nomorTasrih ? (
                                <button
                                  onClick={() => viewTasrih(nomorTasrih)}
                                  className="ml-2 inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 uppercase tracking-wider hover:bg-blue-200 transition-colors"
                                  title="Lihat Detail Tasrih"
                                >
                                  <FileText size={12} /> Tasrih
                                </button>
                              ) : (
                                <span className="ml-2 inline-flex items-center gap-1 rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 uppercase tracking-wider">
                                  📋 Tasrih
                                </span>
                              );
                            })()}
                            <span className="inline-flex items-center rounded-md bg-[var(--color-surface)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-muted)]">
                              {santri.sakan ?? "-"}
                            </span>
                            {santri.gender === "BANIN" ? (
                              <span className="inline-flex items-center rounded-md bg-[var(--color-primary-50)] px-2 py-0.5 text-xs font-medium text-[var(--color-primary)]">BANIN</span>
                            ) : santri.gender === "BANAT" ? (
                              <span className="inline-flex items-center rounded-md bg-[var(--color-danger-light)] px-2 py-0.5 text-xs font-medium text-[var(--color-danger)]">BANAT</span>
                            ) : (
                              <span className="inline-flex items-center rounded-md bg-[var(--color-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--color-text)]">{santri.gender}</span>
                            )}
                            {santri.kategori === "BARU" ? (
                              <span className="inline-flex items-center rounded-md bg-[var(--color-primary-50)] px-2 py-0.5 text-xs font-medium text-[var(--color-primary)] capitalize">Baru</span>
                            ) : santri.kategori === "LAMA" ? (
                              <span className="inline-flex items-center rounded-md bg-[var(--color-warning-light)] px-2 py-0.5 text-xs font-medium text-[var(--color-warning)] capitalize">Lama</span>
                            ) : santri.kategori === "KSU" ? (
                              <span className="inline-flex items-center rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 uppercase">KSU</span>
                            ) : (
                              <span className="inline-flex items-center rounded-md bg-[var(--color-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--color-text)] capitalize">{santri.kategori ?? "-"}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex gap-2">
                            {(["HADIR", "IZIN", "SAKIT", "ALPHA"] as AbsenStatus[]).map((st) => (
                              <button
                                key={st}
                                disabled={santri.isCheckedOut}
                                onClick={() => handleStatusChange(santri.riwayatId, currentStatus === st ? "KOSONG" : st)}
                                className={`rounded-full px-3 py-1.5 text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${currentStatus === st
                                    ? st === "HADIR"
                                      ? "bg-[var(--color-primary)] text-white"
                                      : st === "IZIN"
                                        ? "bg-indigo-500 text-white"
                                        : st === "SAKIT"
                                          ? "bg-[var(--color-warning)] text-white"
                                          : "bg-[var(--color-danger)] text-white"
                                    : "bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-dark)]"
                                  }`}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <input
                            type="text"
                            placeholder="Catatan..."
                            value={currentKet}
                            disabled={santri.isCheckedOut}
                            onChange={(e) => handleKeteranganChange(santri.riwayatId, e.target.value)}
                            className="w-full rounded-xl border border-[var(--color-surface-dark)] bg-white px-3 py-1.5 text-sm outline-none transition focus:border-amber-500"
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {santriList.length === 0 && !isLoading && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-[var(--color-text-muted)] font-medium">
                        Tidak ada santri yang ditemukan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </section>
      )}

      {selectedTasrih && (
        <TasrihModal tasrih={selectedTasrih} onClose={() => setSelectedTasrih(null)} />
      )}
    </div>
  );
}
