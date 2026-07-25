"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { Send, FileText, X } from "lucide-react";
import TasrihModal, { TasrihDetail } from "./tasrih-modal";

// Strip [TRS-xxx] prefix dari keterangan untuk tampilan
function stripTasrihId(keterangan: string): string {
  return keterangan.replace(/\s*\[TRS-[\d-]+\]\s*/, "").trim();
}

// Ambil nomorTasrih dari keterangan
function extractNomorTasrih(keterangan: string): string | null {
  const match = keterangan.match(/\[(TRS-[\d-]+)\]/);
  return match ? match[1] : null;
}

type SantriAbsenTarget = {
  riwayatId: string;
  santriId: string;
  nama: string;
  sakan: string;
  kamar: string;
  gender: string;
  kategori: string;
  kelasId: string | null;
  kelasNama: string | null;
  programId: string | null;
  programNama: string | null;
  isCheckedOut: boolean;
};

type AbsenStatus = "HADIR" | "IZIN" | "SAKIT" | "ALPHA" | "KOSONG";

export function AbsensiSakanClient({ sakanList, defaultSakan }: { sakanList: string[]; defaultSakan?: string }) {
  const [tanggal, setTanggal] = useState("");
  const [sakan, setSakan] = useState(defaultSakan || "ALL");
  const [santriList, setSantriList] = useState<SantriAbsenTarget[]>([]);
  const [absenMap, setAbsenMap] = useState<Record<string, { status: AbsenStatus; keterangan: string }>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sendToWa, setSendToWa] = useState(true);
  const [isSendingWa, setIsSendingWa] = useState(false);
  const [unconfirmedIds, setUnconfirmedIds] = useState<Set<string>>(new Set());
  const [selectedTasrih, setSelectedTasrih] = useState<TasrihDetail | null>(null);
  const [tasrihPickerFor, setTasrihPickerFor] = useState<{ riwayatId: string; nama: string } | null>(null);
  const [perizinanCache, setPerizinanCache] = useState<Record<string, any[]>>({});
  const [isFetchingPerizinan, setIsFetchingPerizinan] = useState(false);

  useEffect(() => {
    // Set default tanggal to today WIB (timezone-safe)
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric', month: '2-digit', day: '2-digit'
    });
    setTanggal(formatter.format(new Date()));
  }, []);

  useEffect(() => {
    if (!tanggal) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/admin/absensi/sakan?tanggal=${tanggal}&sakan=${sakan}`);
        const data = await res.json();

        if (data.santriList) {
          setSantriList(data.santriList);
        }

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
      } catch (error) {
        toast.error("Gagal memuat data absensi");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [tanggal, sakan]);
  const viewTasrih = async (nomorTasrih: string) => {
    try {
      const res = await fetch(`/api/admin/perizinan/tasrih/${nomorTasrih}`);
      if (!res.ok) throw new Error("Gagal load tasrih");
      const json = await res.json();
      
      // Inject sakan dari data santriList saat ini
      const matchedSantri = santriList.find(s => s.riwayatId === json.riwayatId);
      if (matchedSantri && matchedSantri.sakan) {
        json.sakan = matchedSantri.sakan;
      }
      
      setSelectedTasrih(json);
    } catch (error) {
      toast.error("Gagal memuat detail tasrih");
    }
  };

  const openTasrihPicker = async (santri: SantriAbsenTarget) => {
    setTasrihPickerFor({ riwayatId: santri.riwayatId, nama: santri.nama });
    if (!perizinanCache[santri.riwayatId]) {
      setIsFetchingPerizinan(true);
      try {
        const res = await fetch(`/api/admin/perizinan/santri/${santri.riwayatId}`);
        const data = await res.json();
        setPerizinanCache(prev => ({ ...prev, [santri.riwayatId]: Array.isArray(data) ? data : [] }));
      } catch {
        toast.error("Gagal memuat perizinan");
      } finally {
        setIsFetchingPerizinan(false);
      }
    }
  };

  const attachTasrih = (riwayatId: string, perizinan: any) => {
    const keterangan = `[${perizinan.nomorTasrih}] ${perizinan.alasan}`;
    setAbsenMap(prev => ({
      ...prev,
      [riwayatId]: { status: "IZIN", keterangan }
    }));
    setTasrihPickerFor(null);
    toast.success("Tasrih berhasil dilampirkan");
  };

  const handleStatusChange = (riwayatId: string, status: AbsenStatus) => {
    setAbsenMap(prev => ({
      ...prev,
      [riwayatId]: { ...prev[riwayatId], status, keterangan: prev[riwayatId]?.keterangan || "" }
    }));
  };

  const handleKeteranganChange = (riwayatId: string, keterangan: string) => {
    setAbsenMap(prev => ({
      ...prev,
      [riwayatId]: { ...prev[riwayatId], status: prev[riwayatId]?.status || "ALPHA", keterangan }
    }));
  };

  const setAllStatus = (status: AbsenStatus) => {
    const newMap = { ...absenMap };
    santriList.forEach(s => {
      if (s.isCheckedOut) return; // Skip checked out santri
      const current = newMap[s.riwayatId];
      // Jika diset ke HADIR tapi santri sudah punya tasrih (keterangan ada [TRS-]), biarkan status bawaannya
      if (status === "HADIR" && current?.keterangan?.includes("[TRS-")) {
        return;
      }
      newMap[s.riwayatId] = { status, keterangan: current?.keterangan || "" };
    });
    setAbsenMap(newMap);
  };

  const handleSendWa = async () => {
    setIsSendingWa(true);
    try {
      const res = await fetch("/api/admin/absensi/sakan/send-wa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tanggal }),
      });
      const result = await res.json();
      if (result.success) {
        toast.success("📱 Laporan berhasil dikirim ke WhatsApp!");
      } else {
        toast.error(result.error || "Gagal mengirim ke WhatsApp");
      }
    } catch {
      toast.error("Gagal mengirim ke WhatsApp");
    } finally {
      setIsSendingWa(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const absenList = Object.entries(absenMap).map(([riwayatId, data]) => ({
        riwayatId,
        status: data.status,
        keterangan: data.keterangan,
      }));

      const res = await fetch("/api/admin/absensi/sakan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tanggal, absenList }),
      });

      const result = await res.json();
      if (result.success) {
        toast.success(`Berhasil menyimpan ${result.count} data absensi`);
        // Kirim ke WA jika toggle aktif
        if (sendToWa) {
          await handleSendWa();
        }
      } else {
        toast.error(result.error || "Gagal menyimpan absensi");
      }
    } catch (e) {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      setIsSaving(false);
    }
  };

  const allOptions = [
    { id: "ALL", label: "Semua Sakan" },
    ...sakanList.map(s => ({ id: s, label: s })),
  ];

  const statHadir = Object.values(absenMap).filter(a => a.status === "HADIR").length;
  const statIzin = Object.values(absenMap).filter(a => a.status === "IZIN").length;
  const statSakit = Object.values(absenMap).filter(a => a.status === "SAKIT").length;
  const statAlpha = Object.values(absenMap).filter(a => a.status === "ALPHA").length;
  const belumDiabsen = santriList.length - Object.keys(absenMap).length;

  const groupedSantri = santriList.reduce<Record<string, SantriAbsenTarget[]>>((acc, santri) => {
    const kamar = santri.kamar || "Tanpa Kamar";
    if (!acc[kamar]) acc[kamar] = [];
    acc[kamar].push(santri);
    return acc;
  }, {});

  const sortedKamarKeys = Object.keys(groupedSantri).sort((a, b) => {
    if (a === "Tanpa Kamar") return 1;
    if (b === "Tanpa Kamar") return -1;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
  });

  return (
    <div className="space-y-6">
      <section className="overflow-hidden neu-card-white">
        <div className="flex flex-col gap-4 border-b border-[var(--color-surface-dark)] p-6 md:flex-row md:items-end md:justify-between bg-[var(--color-surface-light)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                Tanggal
              </label>
              <input
                type="date"
                value={tanggal}
                onChange={(e) => setTanggal(e.target.value)}
                className="rounded-2xl border border-[var(--color-surface-dark)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] outline-none transition focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                Filter Sakan
              </label>
              <select
                value={sakan}
                onChange={(e) => setSakan(e.target.value)}
                disabled={!!defaultSakan} // lock to defaultSakan if provided
                className="rounded-2xl border border-[var(--color-surface-dark)] bg-white px-4 py-2.5 text-sm font-semibold text-[var(--color-text)] outline-none transition focus:border-blue-500 disabled:opacity-70 disabled:bg-[var(--color-secondary)]"
              >
                {allOptions.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-3 items-end">
            <div className="flex gap-2">
              <button
                onClick={() => setAllStatus("HADIR")}
                className="rounded-full bg-[var(--color-surface-dark)] px-4 py-2 text-xs font-bold text-[var(--color-text)] transition hover:bg-[var(--color-surface-dark)]"
              >
                Hadirkan Semua
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || isSendingWa || isLoading || !tanggal}
                className="rounded-full bg-blue-600 px-6 py-2 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving ? (isSendingWa ? "Mengirim WA..." : "Menyimpan...") : "Simpan Absensi"}
              </button>
            </div>
            {/* Toggle Kirim ke WhatsApp */}
            <label className="flex items-center gap-2.5 cursor-pointer select-none group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={sendToWa}
                  onChange={(e) => setSendToWa(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="h-6 w-11 rounded-full bg-[var(--color-surface-dark)] transition-colors peer-checked:bg-[var(--color-primary)] peer-focus:ring-2 peer-focus:ring-emerald-300"></div>
                <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5"></div>
              </div>
              <div className="flex items-center gap-1.5">
                <Send className="h-3.5 w-3.5 text-[var(--color-primary)]" />
                <span className="text-xs font-bold text-[var(--color-text-muted)] group-hover:text-[var(--color-text)] transition">
                  Kirim ke WhatsApp
                </span>
              </div>
            </label>
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
              {sortedKamarKeys.map((kamar) => (
                <tbody key={kamar} className="divide-y divide-[var(--color-surface)] text-sm text-[var(--color-text-muted)]">
                  <tr className="bg-[var(--color-surface-light)] border-t-2 border-[var(--color-surface-dark)]">
                    <td colSpan={4} className="px-6 py-3 text-xs font-bold text-[var(--color-text)] uppercase tracking-wide">
                      🏠 {kamar === "Tanpa Kamar" ? kamar : `Kamar ${kamar}`}
                    </td>
                  </tr>
                  {groupedSantri[kamar].map((santri, index) => {
                    const currentStatus = absenMap[santri.riwayatId]?.status;
                    const currentKet = absenMap[santri.riwayatId]?.keterangan || "";

                    const nomorTasrih = extractNomorTasrih(currentKet);
                    const displayKet = stripTasrihId(currentKet);

                    return (
                      <tr key={santri.riwayatId} className="hover:bg-[var(--color-surface-light)] transition-colors">
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
                          <span className="inline-flex items-center rounded-md bg-[var(--color-surface)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-muted)]">
                            {santri.sakan ?? "-"}
                          </span>
                          {santri.kategori === "BARU" ? (
                            <span className="inline-flex items-center rounded-md bg-[var(--color-primary-50)] px-2 py-0.5 text-xs font-medium text-[var(--color-primary)] capitalize">Baru</span>
                          ) : santri.kategori === "LAMA" ? (
                            <span className="inline-flex items-center rounded-md bg-[var(--color-warning-light)] px-2 py-0.5 text-xs font-medium text-[var(--color-warning)] capitalize">Lama</span>
                          ) : santri.kategori === "KSU" ? (
                            <span className="inline-flex items-center rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 uppercase">KSU</span>
                          ) : (
                            <span className="inline-flex items-center rounded-md bg-[var(--color-secondary)] px-2 py-0.5 text-xs font-medium text-[var(--color-text)] capitalize">{santri.kategori ?? "-"}</span>
                          )}
                          {/* Tombol Tasrih — selalu tampil untuk akses cepat */}
                          {nomorTasrih && (
                            <button
                              onClick={() => viewTasrih(nomorTasrih)}
                              className="inline-flex items-center gap-1 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 uppercase tracking-wider hover:bg-indigo-200 transition-colors"
                              title="Lihat Detail Tasrih"
                            >
                              <FileText size={12} /> Lihat Tasrih
                            </button>
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
                                  ? st === "HADIR" ? "bg-[var(--color-primary)] text-white shadow-[var(--color-primary-100)] shadow-sm"
                                    : st === "IZIN" ? "bg-indigo-500 text-white shadow-indigo-200 shadow-sm"
                                      : st === "SAKIT" ? "bg-[var(--color-warning)] text-white shadow-amber-200 shadow-sm"
                                        : "bg-[var(--color-danger)] text-white shadow-rose-200 shadow-sm"
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
                          value={displayKet}
                          disabled={santri.isCheckedOut}
                          onChange={(e) => {
                            let val = e.target.value;
                            if (nomorTasrih) {
                              val = `[${nomorTasrih}] ${val.replace(/\s*\[TRS-[\d-]+\]\s*/g, "")}`;
                            }
                            handleKeteranganChange(santri.riwayatId, val);
                          }}
                          className="w-full rounded-xl border border-[var(--color-surface-dark)] bg-white px-3 py-1.5 text-sm outline-none transition focus:border-blue-500"
                        />
                      </td>
                    </tr>
                  )
                  })}
                </tbody>
              ))}
              {santriList.length === 0 && !isLoading && (
                <tbody>
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-[var(--color-text-muted)] font-medium">
                      Tidak ada santri yang ditemukan pada filter ini.
                    </td>
                  </tr>
                </tbody>
              )}
            </table>
          )}
        </div>
      </section>

      {selectedTasrih && (
        <TasrihModal tasrih={selectedTasrih} onClose={() => setSelectedTasrih(null)} />
      )}

      {/* Modal Picker Tasrih */}
      {tasrihPickerFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-800">Lampirkan Tasrih</h3>
                <p className="text-xs text-slate-500 mt-0.5">{tasrihPickerFor.nama}</p>
              </div>
              <button onClick={() => setTasrihPickerFor(null)} className="text-slate-400 hover:text-slate-600 transition">
                <X size={20} />
              </button>
            </div>
            <div className="p-5">
              {isFetchingPerizinan ? (
                <div className="text-center py-8 text-sm text-slate-500 font-medium">Memuat perizinan...</div>
              ) : (perizinanCache[tasrihPickerFor.riwayatId] || []).length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm font-bold text-slate-700 mb-1">Tidak ada tasrih aktif</p>
                  <p className="text-xs text-slate-500">Santri ini tidak memiliki perizinan yang aktif saat ini.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Pilih perizinan aktif:</p>
                  {(perizinanCache[tasrihPickerFor.riwayatId] || []).map((p: any) => (
                    <button
                      key={p.id}
                      onClick={() => attachTasrih(tasrihPickerFor.riwayatId, p)}
                      className="w-full text-left p-3.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-indigo-600 bg-indigo-50 group-hover:bg-white px-2 py-0.5 rounded-md border border-indigo-100 transition">
                          {p.tipeIzin.replace(/_/g, " ")}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {new Date(p.tanggalMulai).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}
                          {p.tanggalSelesai && ` - ${new Date(p.tanggalSelesai).toLocaleDateString("id-ID", { day: "numeric", month: "short" })}`}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm font-semibold text-slate-700 leading-snug">{p.alasan}</p>
                      <p className="mt-1 text-[10px] text-slate-400 font-medium">Status → Izin • Klik untuk melampirkan</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
