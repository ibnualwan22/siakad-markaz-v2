"use client";

import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, X, Send, Bell, CalendarDays, LayoutList, History, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

type Template = {
  id: string;
  label: string;
  deskripsi: string | null;
  isActive: boolean;
};

type Jadwal = {
  id: string;
  templateId: string;
  judul: string;
  isi: string;
  tautan: string | null;
  targetLembaga: string[] | null;
  jenisJadwal: "HARIAN" | "MINGGUAN" | "TANGGAL";
  hari: number | null;
  tanggal: string | null;
  waktu: string;
  isActive: boolean;
  lastSentAt: string | null;
  template: { id: string; label: string; isActive: boolean };
};

type LogItem = {
  id: string;
  jadwalId: string | null;
  pengumumanId: string;
  targetLembaga: string[] | null;
  totalTarget: number;
  suksesFCM: number;
  gagalFCM: number;
  suksesWebPush: number;
  gagalWebPush: number;
  fcmEnabled: boolean;
  error: string | null;
  sentAt: string;
  jadwal: { id: string; judul: string } | null;
  pengumuman: { id: string; judul: string; pengirimLabel: string };
};

// Pengumuman sekali-kirim (tanpa jadwal). `lembaga` = target (null = global).
type SekaliItem = {
  id: string;
  judul: string;
  isi: string;
  tautan: string | null;
  pengirimLabel: string;
  lembaga: string[] | null;
  dibuatAt: string;
};

const HARI_LABEL = ["Ahad", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const LEMBAGA_OPSI = [
  { id: "ARABIYAH", label: "Markaz Arabiyah" },
  { id: "TURATS", label: "Markaz Turats" },
  { id: "HUFADZ", label: "Markaz Hufadz" },
];

function labelTarget(target: string[] | null): string {
  if (!target || target.length === 0) return "Global (semua lembaga)";
  return target
    .map((t) => LEMBAGA_OPSI.find((o) => o.id === t)?.label ?? t)
    .join(", ");
}

function labelJenis(j: Jadwal): string {
  if (j.jenisJadwal === "HARIAN") return `Setiap hari · ${j.waktu} WIB`;
  if (j.jenisJadwal === "MINGGUAN")
    return `Setiap ${j.hari !== null ? HARI_LABEL[j.hari] : "?"} · ${j.waktu} WIB`;
  return `${j.tanggal ? format(new Date(j.tanggal), "dd MMM yyyy", { locale: idLocale }) : "?"} · ${j.waktu} WIB`;
}

async function bacaError(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    return data?.error || fallback;
  } catch {
    return fallback;
  }
}

const inputCls =
  "w-full rounded-2xl border border-[var(--color-surface-dark)] bg-[var(--color-secondary)] px-4 py-3 outline-none focus:border-[var(--color-primary)] focus:bg-white";
const labelCls = "block space-y-1.5 text-sm font-semibold text-[var(--color-text)]";

export function NotifikasiClient() {
  const [tab, setTab] = useState<"jadwal" | "sekali" | "template" | "riwayat">("jadwal");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [jadwalList, setJadwalList] = useState<Jadwal[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [logLimit, setLogLimit] = useState(50);
  const [loading, setLoading] = useState(false);
  const [memuat, setMemuat] = useState(true);

  // --- Modal jadwal ---
  const [jadwalModal, setJadwalModal] = useState(false);
  const [editJadwalId, setEditJadwalId] = useState<string | null>(null);
  const [fTemplateId, setFTemplateId] = useState("");
  const [fJudul, setFJudul] = useState("");
  const [fIsi, setFIsi] = useState("");
  const [fTautan, setFTautan] = useState("");
  const [fGlobal, setFGlobal] = useState(true);
  const [fTarget, setFTarget] = useState<string[]>([]);
  const [fJenis, setFJenis] = useState<"HARIAN" | "MINGGUAN" | "TANGGAL">("HARIAN");
  const [fHari, setFHari] = useState(0);
  const [fTanggal, setFTanggal] = useState("");
  const [fWaktu, setFWaktu] = useState("07:00");
  const [fAktif, setFAktif] = useState(true);
  const [kirimId, setKirimId] = useState<string | null>(null);

  // --- Kirim sekali ---
  const [sekaliList, setSekaliList] = useState<SekaliItem[]>([]);
  const [sTemplateId, setSTemplateId] = useState("");
  const [sJudul, setSJudul] = useState("");
  const [sIsi, setSIsi] = useState("");
  const [sTautan, setSTautan] = useState("");
  const [sGlobal, setSGlobal] = useState(true);
  const [sTarget, setSTarget] = useState<string[]>([]);
  const [kirimUlangId, setKirimUlangId] = useState<string | null>(null);

  // --- Modal template ---
  const [templateModal, setTemplateModal] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState<string | null>(null);
  const [tLabel, setTLabel] = useState("");
  const [tDeskripsi, setTDeskripsi] = useState("");
  const [tAktif, setTAktif] = useState(true);

  const muatTemplates = async () => {
    const res = await fetch("/api/admin/notifikasi/template");
    if (res.ok) setTemplates(await res.json());
  };

  const muatJadwal = async () => {
    const res = await fetch("/api/admin/notifikasi/jadwal");
    if (res.ok) setJadwalList(await res.json());
  };

  const muatLog = async (limit = logLimit) => {
    const res = await fetch(`/api/admin/notifikasi/log?limit=${limit}`);
    if (res.ok) setLogs(await res.json());
  };

  const muatSekali = async () => {
    const res = await fetch("/api/admin/notifikasi/sekali");
    if (res.ok) setSekaliList(await res.json());
  };

  useEffect(() => {
    (async () => {
      setMemuat(true);
      await Promise.all([muatTemplates(), muatJadwal()]);
      setMemuat(false);
    })();
  }, []);

  useEffect(() => {
    if (tab === "riwayat") void muatLog();
    if (tab === "sekali") void muatSekali();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, logLimit]);

  // Pilih template aktif pertama sebagai pengirim default form sekali-kirim.
  useEffect(() => {
    if (!sTemplateId) {
      const pertama = templates.find((t) => t.isActive);
      if (pertama) setSTemplateId(pertama.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates]);

  // ---------- Jadwal ----------
  const bukaModalJadwal = (j?: Jadwal) => {
    if (j) {
      setEditJadwalId(j.id);
      setFTemplateId(j.templateId);
      setFJudul(j.judul);
      setFIsi(j.isi);
      setFTautan(j.tautan || "");
      const global = !j.targetLembaga || j.targetLembaga.length === 0;
      setFGlobal(global);
      setFTarget(global ? [] : j.targetLembaga || []);
      setFJenis(j.jenisJadwal);
      setFHari(j.hari ?? 0);
      setFTanggal(j.tanggal ? new Date(j.tanggal).toISOString().slice(0, 10) : "");
      setFWaktu(j.waktu);
      setFAktif(j.isActive);
    } else {
      setEditJadwalId(null);
      setFTemplateId(templates.find((t) => t.isActive)?.id || "");
      setFJudul("");
      setFIsi("");
      setFTautan("");
      setFGlobal(true);
      setFTarget([]);
      setFJenis("HARIAN");
      setFHari(0);
      setFTanggal("");
      setFWaktu("07:00");
      setFAktif(true);
    }
    setJadwalModal(true);
  };

  const simpanJadwal = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        templateId: fTemplateId,
        judul: fJudul,
        isi: fIsi,
        tautan: fTautan || null,
        targetLembaga: fGlobal ? null : fTarget,
        jenisJadwal: fJenis,
        hari: fJenis === "MINGGUAN" ? fHari : null,
        tanggal: fJenis === "TANGGAL" ? fTanggal : null,
        waktu: fWaktu,
        isActive: fAktif,
      };
      const method = editJadwalId ? "PUT" : "POST";
      const endpoint = editJadwalId
        ? `/api/admin/notifikasi/jadwal/${editJadwalId}`
        : "/api/admin/notifikasi/jadwal";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const saved = await res.json();
        setJadwalList((prev) =>
          editJadwalId
            ? prev.map((p) => (p.id === saved.id ? saved : p))
            : [...prev, saved].sort((a, b) => a.waktu.localeCompare(b.waktu))
        );
        setJadwalModal(false);
      } else {
        alert(await bacaError(res, "Gagal menyimpan jadwal."));
      }
    } catch {
      alert("Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  };

  const toggleJadwal = async (j: Jadwal) => {
    const res = await fetch(`/api/admin/notifikasi/jadwal/${j.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !j.isActive }),
    });
    if (res.ok) {
      const saved = await res.json();
      setJadwalList((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
    } else {
      alert(await bacaError(res, "Gagal mengubah status jadwal."));
    }
  };

  const hapusJadwal = async (j: Jadwal) => {
    if (!confirm(`Hapus jadwal "${j.judul}"? Pengumuman dan riwayat yang sudah terkirim tetap tersimpan.`)) return;
    const res = await fetch(`/api/admin/notifikasi/jadwal/${j.id}`, { method: "DELETE" });
    if (res.ok) {
      setJadwalList((prev) => prev.filter((p) => p.id !== j.id));
    } else {
      alert(await bacaError(res, "Gagal menghapus jadwal."));
    }
  };

  const kirimSekarang = async (j: Jadwal) => {
    if (
      !confirm(
        `Kirim pengumuman "${j.judul}" sekarang ke ${labelTarget(j.targetLembaga)}? Jadwal ini akan ditandai sudah terkirim hari ini.`
      )
    )
      return;
    setKirimId(j.id);
    try {
      const res = await fetch(`/api/admin/notifikasi/jadwal/${j.id}/kirim-sekarang`, { method: "POST" });
      if (res.ok) {
        const hasil = await res.json();
        alert(
          `Terkirim ke ${hasil.totalTarget} santri.\nFCM: ${hasil.suksesFCM} sukses / ${hasil.gagalFCM} gagal${hasil.fcmEnabled ? "" : " (FCM belum aktif)"}.\nWeb push: ${hasil.suksesWebPush} sukses / ${hasil.gagalWebPush} gagal.${hasil.error ? `\nCatatan: ${hasil.error}` : ""}`
        );
        await muatJadwal();
      } else {
        alert(await bacaError(res, "Gagal mengirim pengumuman."));
      }
    } catch {
      alert("Terjadi kesalahan.");
    } finally {
      setKirimId(null);
    }
  };

  // ---------- Kirim sekali ----------
  const kirimSekali = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !confirm(
        `Kirim pengumuman "${sJudul}" sekarang ke ${sGlobal ? "Global (semua lembaga)" : labelTarget(sTarget)}?`
      )
    )
      return;
    setLoading(true);
    try {
      const res = await fetch("/api/admin/notifikasi/kirim-sekali", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: sTemplateId,
          judul: sJudul,
          isi: sIsi,
          tautan: sTautan || null,
          targetLembaga: sGlobal ? null : sTarget,
        }),
      });
      if (res.ok) {
        const hasil = await res.json();
        alert(
          `Terkirim ke ${hasil.totalTarget} santri.\nFCM: ${hasil.suksesFCM} sukses / ${hasil.gagalFCM} gagal${hasil.fcmEnabled ? "" : " (FCM belum aktif)"}.\nWeb push: ${hasil.suksesWebPush} sukses / ${hasil.gagalWebPush} gagal.${hasil.error ? `\nCatatan: ${hasil.error}` : ""}`
        );
        setSJudul("");
        setSIsi("");
        setSTautan("");
        await muatSekali();
      } else {
        alert(await bacaError(res, "Gagal mengirim pengumuman."));
      }
    } catch {
      alert("Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  };

  const kirimUlang = async (item: SekaliItem) => {
    if (
      !confirm(
        `Kirim ulang pengumuman "${item.judul}" ke ${labelTarget(item.lembaga)}? Isi yang sama akan terkirim sebagai pengumuman baru.`
      )
    )
      return;
    setKirimUlangId(item.id);
    try {
      const res = await fetch(`/api/admin/notifikasi/sekali/${item.id}/kirim-ulang`, { method: "POST" });
      if (res.ok) {
        const hasil = await res.json();
        alert(
          `Terkirim ke ${hasil.totalTarget} santri.\nFCM: ${hasil.suksesFCM} sukses / ${hasil.gagalFCM} gagal${hasil.fcmEnabled ? "" : " (FCM belum aktif)"}.\nWeb push: ${hasil.suksesWebPush} sukses / ${hasil.gagalWebPush} gagal.${hasil.error ? `\nCatatan: ${hasil.error}` : ""}`
        );
        await muatSekali();
      } else {
        alert(await bacaError(res, "Gagal mengirim ulang pengumuman."));
      }
    } catch {
      alert("Terjadi kesalahan.");
    } finally {
      setKirimUlangId(null);
    }
  };

  const toggleTargetSekali = (lembagaId: string) => {
    setSGlobal(false);
    setSTarget((prev) =>
      prev.includes(lembagaId) ? prev.filter((t) => t !== lembagaId) : [...prev, lembagaId]
    );
  };

  const toggleTarget = (lembagaId: string) => {
    setFGlobal(false);
    setFTarget((prev) =>
      prev.includes(lembagaId) ? prev.filter((t) => t !== lembagaId) : [...prev, lembagaId]
    );
  };

  // ---------- Template ----------
  const bukaModalTemplate = (t?: Template) => {
    if (t) {
      setEditTemplateId(t.id);
      setTLabel(t.label);
      setTDeskripsi(t.deskripsi || "");
      setTAktif(t.isActive);
    } else {
      setEditTemplateId(null);
      setTLabel("");
      setTDeskripsi("");
      setTAktif(true);
    }
    setTemplateModal(true);
  };

  const simpanTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { label: tLabel, deskripsi: tDeskripsi || null, isActive: tAktif };
      const method = editTemplateId ? "PUT" : "POST";
      const endpoint = editTemplateId
        ? `/api/admin/notifikasi/template/${editTemplateId}`
        : "/api/admin/notifikasi/template";
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const saved = await res.json();
        setTemplates((prev) =>
          editTemplateId
            ? prev.map((p) => (p.id === saved.id ? saved : p)).sort((a, b) => a.label.localeCompare(b.label))
            : [...prev, saved].sort((a, b) => a.label.localeCompare(b.label))
        );
        setTemplateModal(false);
      } else {
        alert(await bacaError(res, "Gagal menyimpan template."));
      }
    } catch {
      alert("Terjadi kesalahan.");
    } finally {
      setLoading(false);
    }
  };

  const hapusTemplate = async (t: Template) => {
    if (!confirm(`Hapus template "${t.label}"?`)) return;
    const res = await fetch(`/api/admin/notifikasi/template/${t.id}`, { method: "DELETE" });
    if (res.ok) {
      setTemplates((prev) => prev.filter((p) => p.id !== t.id));
    } else {
      alert(await bacaError(res, "Gagal menghapus template."));
    }
  };

  const tabs = [
    { id: "jadwal" as const, label: "Jadwal", icon: CalendarDays },
    { id: "sekali" as const, label: "Kirim Sekali", icon: Send },
    { id: "template" as const, label: "Template Pengirim", icon: LayoutList },
    { id: "riwayat" as const, label: "Riwayat", icon: History },
  ];

  return (
    <div className="space-y-6">
      {/* Tab */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map((t) => {
          const Icon = t.icon;
          const aktif = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition"
              style={
                aktif
                  ? { background: "var(--color-primary)", color: "#fff", boxShadow: "var(--shadow-flat)" }
                  : { background: "var(--color-secondary)", color: "var(--color-text-muted)" }
              }
            >
              <Icon className="h-4 w-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {memuat && tab !== "riwayat" && (
        <p className="text-sm text-[var(--color-text-muted)]">Memuat data...</p>
      )}

      {/* ============ TAB JADWAL ============ */}
      {tab === "jadwal" && !memuat && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              onClick={() => bukaModalJadwal()}
              disabled={templates.filter((t) => t.isActive).length === 0}
              className="flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--color-primary-dark)] shadow-sm disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> Tambah Jadwal
            </button>
          </div>
          {templates.filter((t) => t.isActive).length === 0 && (
            <p className="text-sm text-[var(--color-text-muted)]">
              Belum ada template pengirim yang aktif — buat dulu di tab &quot;Template Pengirim&quot;.
            </p>
          )}

          <div className="overflow-hidden neu-card-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--color-surface-dark)] text-left text-sm">
                <thead className="bg-[var(--color-secondary)] font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-6 py-4">Jadwal</th>
                    <th className="px-6 py-4">Pengirim / Target</th>
                    <th className="px-6 py-4">Jenis &amp; Waktu</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Terakhir Terkirim</th>
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-surface)] text-[var(--color-text)]">
                  {jadwalList.map((j) => (
                    <tr key={j.id} className="hover:bg-[var(--color-secondary)]/80 align-top">
                      <td className="px-6 py-4">
                        <p className="font-bold text-[var(--color-text)]">{j.judul}</p>
                        <p className="mt-1 text-xs text-[var(--color-text-muted)] line-clamp-2">{j.isi}</p>
                        {j.tautan && (
                          <p className="mt-1 text-xs text-[var(--color-primary)] truncate max-w-xs">{j.tautan}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium flex items-center gap-1.5">
                          <Bell className="w-3.5 h-3.5 text-[var(--color-text-subtle)]" />
                          {j.template?.label ?? "-"}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">{labelTarget(j.targetLembaga)}</p>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium">{labelJenis(j)}</td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => toggleJadwal(j)}
                          title="Klik untuk mengubah status aktif"
                          className={`inline-block px-3 py-1 text-xs font-bold rounded-full ${j.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}
                        >
                          {j.isActive ? "AKTIF" : "NONAKTIF"}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-xs text-[var(--color-text-muted)]">
                        {j.lastSentAt
                          ? format(new Date(j.lastSentAt), "dd MMM yyyy HH:mm", { locale: idLocale })
                          : "Belum pernah"}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => kirimSekarang(j)}
                            disabled={kirimId === j.id}
                            title="Kirim sekarang"
                            className="rounded-full bg-[var(--color-primary)] p-2 text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
                          >
                            {kirimId === j.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => bukaModalJadwal(j)}
                            title="Ubah"
                            className="rounded-full bg-[var(--color-surface)] p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-dark)] hover:text-[var(--color-primary)]"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => hapusJadwal(j)}
                            title="Hapus"
                            className="rounded-full bg-[var(--color-surface)] p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-danger-light)] hover:text-[var(--color-danger)]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {jadwalList.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-8 text-center text-[var(--color-text-muted)]">Belum ada jadwal pengumuman.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============ TAB KIRIM SEKALI ============ */}
      {tab === "sekali" && !memuat && (
        <div className="space-y-6">
          <div className="neu-card-white p-6">
            <form onSubmit={kirimSekali} className="space-y-5">
              <p className="text-sm text-[var(--color-text-muted)]">
                Pengumuman sekali kirim — langsung terkirim saat tombol ditekan, tanpa jadwal. Riwayatnya tersimpan di bawah dan bisa dikirim ulang kapan saja.
              </p>
              <label className={labelCls}>
                <span>Template Pengirim</span>
                <select value={sTemplateId} onChange={(e) => setSTemplateId(e.target.value)} required className={inputCls}>
                  <option value="" disabled>Pilih pengirim...</option>
                  {templates.filter((t) => t.isActive).map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </label>

              <label className={labelCls}>
                <span>Judul Pengumuman</span>
                <input type="text" required value={sJudul} onChange={(e) => setSJudul(e.target.value)} className={inputCls} />
              </label>

              <label className={labelCls}>
                <span>Isi Pengumuman</span>
                <textarea rows={4} required value={sIsi} onChange={(e) => setSIsi(e.target.value)} className={`${inputCls} resize-none`} />
              </label>

              <label className={labelCls}>
                <span>Tautan (opsional)</span>
                <input type="text" value={sTautan} onChange={(e) => setSTautan(e.target.value)} placeholder="/santri/pengumuman atau https://..." className={inputCls} />
              </label>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-[var(--color-text)]">Target Lembaga</p>
                <label className="flex items-center gap-3 text-sm font-bold cursor-pointer">
                  <input type="checkbox" checked={sGlobal} onChange={(e) => { setSGlobal(e.target.checked); if (e.target.checked) setSTarget([]); }} className="h-5 w-5 rounded text-[var(--color-primary)]" />
                  Global (semua lembaga)
                </label>
                <div className="flex flex-wrap gap-4 pl-8">
                  {LEMBAGA_OPSI.map((o) => (
                    <label key={o.id} className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <input type="checkbox" checked={!sGlobal && sTarget.includes(o.id)} onChange={() => toggleTargetSekali(o.id)} className="h-5 w-5 rounded text-[var(--color-primary)]" />
                      {o.label}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-[var(--color-text-subtle)]">Memilih ketiga lembaga sama dengan Global. Bila tidak ada yang dicentang, target dianggap Global.</p>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading || templates.filter((t) => t.isActive).length === 0}
                  className="flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--color-primary-dark)] shadow-sm disabled:opacity-50"
                >
                  <Send className="h-4 w-4" /> {loading ? "Mengirim..." : "Kirim Sekarang"}
                </button>
              </div>
            </form>
          </div>
          {templates.filter((t) => t.isActive).length === 0 && (
            <p className="text-sm text-[var(--color-text-muted)]">
              Belum ada template pengirim yang aktif — buat dulu di tab &quot;Template Pengirim&quot;.
            </p>
          )}

          <div className="overflow-hidden neu-card-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--color-surface-dark)] text-left text-sm">
                <thead className="bg-[var(--color-secondary)] font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-6 py-4">Pengumuman</th>
                    <th className="px-6 py-4">Pengirim / Target</th>
                    <th className="px-6 py-4">Terkirim</th>
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-surface)] text-[var(--color-text)]">
                  {sekaliList.map((item) => (
                    <tr key={item.id} className="hover:bg-[var(--color-secondary)]/80 align-top">
                      <td className="px-6 py-4">
                        <p className="font-bold text-[var(--color-text)]">{item.judul}</p>
                        <p className="mt-1 text-xs text-[var(--color-text-muted)] line-clamp-2">{item.isi}</p>
                        {item.tautan && (
                          <p className="mt-1 text-xs text-[var(--color-primary)] truncate max-w-xs">{item.tautan}</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium flex items-center gap-1.5">
                          <Bell className="w-3.5 h-3.5 text-[var(--color-text-subtle)]" />
                          {item.pengirimLabel}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">{labelTarget(item.lembaga)}</p>
                      </td>
                      <td className="px-6 py-4 text-xs text-[var(--color-text-muted)] whitespace-nowrap">
                        {format(new Date(item.dibuatAt), "dd MMM yyyy HH:mm", { locale: idLocale })}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => kirimUlang(item)}
                            disabled={kirimUlangId === item.id}
                            title="Kirim ulang isi yang sama"
                            className="flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
                          >
                            {kirimUlangId === item.id ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Kirim lagi
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {sekaliList.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-[var(--color-text-muted)]">Belum ada pengumuman sekali-kirim.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============ TAB TEMPLATE ============ */}
      {tab === "template" && !memuat && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button
              onClick={() => bukaModalTemplate()}
              className="flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--color-primary-dark)] shadow-sm"
            >
              <Plus className="h-4 w-4" /> Tambah Template
            </button>
          </div>

          <div className="overflow-hidden neu-card-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--color-surface-dark)] text-left text-sm">
                <thead className="bg-[var(--color-secondary)] font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-6 py-4">Label Pengirim</th>
                    <th className="px-6 py-4">Deskripsi</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-surface)] text-[var(--color-text)]">
                  {templates.map((t) => (
                    <tr key={t.id} className="hover:bg-[var(--color-secondary)]/80 align-top">
                      <td className="px-6 py-4 font-bold">{t.label}</td>
                      <td className="px-6 py-4 text-[var(--color-text-muted)]">{t.deskripsi || "-"}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-block px-3 py-1 text-xs font-bold rounded-full ${t.isActive ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500"}`}>
                          {t.isActive ? "AKTIF" : "NONAKTIF"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => bukaModalTemplate(t)}
                            className="rounded-full bg-[var(--color-surface)] p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-dark)] hover:text-[var(--color-primary)]"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => hapusTemplate(t)}
                            className="rounded-full bg-[var(--color-surface)] p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-danger-light)] hover:text-[var(--color-danger)]"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {templates.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-[var(--color-text-muted)]">Belum ada template pengirim.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============ TAB RIWAYAT ============ */}
      {tab === "riwayat" && (
        <div className="space-y-6">
          <div className="flex justify-end items-center gap-3">
            <label className="text-sm font-semibold text-[var(--color-text-muted)]">
              Tampilkan{" "}
              <select
                value={logLimit}
                onChange={(e) => setLogLimit(Number(e.target.value))}
                className="rounded-xl border border-[var(--color-surface-dark)] bg-white px-3 py-2 outline-none"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>{" "}
              terakhir
            </label>
            <button
              onClick={() => muatLog()}
              className="flex items-center gap-2 rounded-full bg-[var(--color-secondary)] px-4 py-2 text-sm font-bold text-[var(--color-text-muted)] hover:bg-[var(--color-surface-dark)]"
            >
              <RefreshCw className="h-4 w-4" /> Muat ulang
            </button>
          </div>

          <div className="overflow-hidden neu-card-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--color-surface-dark)] text-left text-sm">
                <thead className="bg-[var(--color-secondary)] font-bold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                  <tr>
                    <th className="px-6 py-4">Waktu Kirim</th>
                    <th className="px-6 py-4">Pengumuman</th>
                    <th className="px-6 py-4">Target</th>
                    <th className="px-6 py-4">Santri</th>
                    <th className="px-6 py-4">FCM</th>
                    <th className="px-6 py-4">Web Push</th>
                    <th className="px-6 py-4">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-surface)] text-[var(--color-text)]">
                  {logs.map((l) => (
                    <tr key={l.id} className="hover:bg-[var(--color-secondary)]/80 align-top">
                      <td className="px-6 py-4 whitespace-nowrap text-xs">
                        {format(new Date(l.sentAt), "dd MMM yyyy HH:mm", { locale: idLocale })}
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-bold">{l.pengumuman?.judul ?? "-"}</p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-1">
                          {l.jadwal ? `Jadwal: ${l.jadwal.judul}` : "Kirim manual / tanpa jadwal"}
                          {l.pengumuman ? ` · dari ${l.pengumuman.pengirimLabel}` : ""}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-xs">{labelTarget(l.targetLembaga)}</td>
                      <td className="px-6 py-4 text-center font-bold">{l.totalTarget}</td>
                      <td className="px-6 py-4 text-xs whitespace-nowrap">
                        {l.suksesFCM} sukses / {l.gagalFCM} gagal
                        <span className="block text-[var(--color-text-subtle)]">
                          {l.fcmEnabled ? "FCM aktif" : "FCM tidak aktif"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs whitespace-nowrap">
                        {l.suksesWebPush} sukses / {l.gagalWebPush} gagal
                      </td>
                      <td className="px-6 py-4 text-xs text-[var(--color-danger)] max-w-xs break-words">
                        {l.error || "-"}
                      </td>
                    </tr>
                  ))}
                  {logs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-6 py-8 text-center text-[var(--color-text-muted)]">Belum ada riwayat pengiriman.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============ MODAL JADWAL ============ */}
      {jadwalModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-text)]/50 p-4">
          <div className="w-full max-w-xl rounded-3xl neu-card max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--color-surface)] px-6 py-4 sticky top-0 bg-white/90 backdrop-blur-sm z-10">
              <h3 className="font-bold text-[var(--color-text)] text-lg">{editJadwalId ? "Ubah Jadwal" : "Tambah Jadwal"}</h3>
              <button onClick={() => setJadwalModal(false)} className="text-[var(--color-text-subtle)] hover:text-[var(--color-text-muted)]"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={simpanJadwal} className="p-6 space-y-5">
              <label className={labelCls}>
                <span>Template Pengirim</span>
                <select value={fTemplateId} onChange={(e) => setFTemplateId(e.target.value)} required className={inputCls}>
                  <option value="" disabled>Pilih pengirim...</option>
                  {templates.filter((t) => t.isActive).map((t) => (
                    <option key={t.id} value={t.id}>{t.label}</option>
                  ))}
                </select>
              </label>

              <label className={labelCls}>
                <span>Judul Pengumuman</span>
                <input type="text" required value={fJudul} onChange={(e) => setFJudul(e.target.value)} className={inputCls} />
              </label>

              <label className={labelCls}>
                <span>Isi Pengumuman</span>
                <textarea rows={4} required value={fIsi} onChange={(e) => setFIsi(e.target.value)} className={`${inputCls} resize-none`} />
              </label>

              <label className={labelCls}>
                <span>Tautan (opsional)</span>
                <input type="text" value={fTautan} onChange={(e) => setFTautan(e.target.value)} placeholder="/santri/pengumuman atau https://..." className={inputCls} />
              </label>

              <div className="space-y-2">
                <p className="text-sm font-semibold text-[var(--color-text)]">Target Lembaga</p>
                <label className="flex items-center gap-3 text-sm font-bold cursor-pointer">
                  <input type="checkbox" checked={fGlobal} onChange={(e) => { setFGlobal(e.target.checked); if (e.target.checked) setFTarget([]); }} className="h-5 w-5 rounded text-[var(--color-primary)]" />
                  Global (semua lembaga)
                </label>
                <div className="flex flex-wrap gap-4 pl-8">
                  {LEMBAGA_OPSI.map((o) => (
                    <label key={o.id} className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <input type="checkbox" checked={!fGlobal && fTarget.includes(o.id)} onChange={() => toggleTarget(o.id)} className="h-5 w-5 rounded text-[var(--color-primary)]" />
                      {o.label}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-[var(--color-text-subtle)]">Memilih ketiga lembaga sama dengan Global. Bila tidak ada yang dicentang, target dianggap Global.</p>
              </div>

              <div className="space-y-3">
                <p className="text-sm font-semibold text-[var(--color-text)]">Jenis Jadwal</p>
                <div className="flex gap-4 flex-wrap">
                  {([
                    ["HARIAN", "Harian"],
                    ["MINGGUAN", "Mingguan"],
                    ["TANGGAL", "Tanggal tertentu"],
                  ] as const).map(([v, l]) => (
                    <label key={v} className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                      <input type="radio" name="jenisJadwal" checked={fJenis === v} onChange={() => setFJenis(v)} className="h-5 w-5 text-[var(--color-primary)]" />
                      {l}
                    </label>
                  ))}
                </div>

                {fJenis === "MINGGUAN" && (
                  <label className={labelCls}>
                    <span>Hari</span>
                    <select value={fHari} onChange={(e) => setFHari(Number(e.target.value))} className={inputCls}>
                      {HARI_LABEL.map((h, i) => (
                        <option key={i} value={i}>{h}</option>
                      ))}
                    </select>
                  </label>
                )}

                {fJenis === "TANGGAL" && (
                  <label className={labelCls}>
                    <span>Tanggal (sekali kirim, lalu nonaktif otomatis)</span>
                    <input type="date" required value={fTanggal} onChange={(e) => setFTanggal(e.target.value)} className={inputCls} />
                  </label>
                )}

                <label className={labelCls}>
                  <span>Waktu (WIB)</span>
                  <input type="time" required value={fWaktu} onChange={(e) => setFWaktu(e.target.value)} className={inputCls} />
                </label>
              </div>

              <label className="flex items-center gap-3 text-sm font-bold cursor-pointer">
                <input type="checkbox" checked={fAktif} onChange={(e) => setFAktif(e.target.checked)} className="h-5 w-5 rounded text-[var(--color-primary)]" />
                Jadwal aktif
              </label>

              <div className="flex gap-3 pt-4 border-t border-[var(--color-surface)]">
                <button type="button" onClick={() => setJadwalModal(false)} className="w-full rounded-full border border-[var(--color-surface-dark)] py-3 font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-secondary)]">Batal</button>
                <button type="submit" disabled={loading} className="w-full rounded-full bg-[var(--color-primary)] py-3 font-bold text-white shadow-sm hover:bg-[var(--color-primary-dark)] disabled:opacity-50">
                  {loading ? "Menyimpan..." : "Simpan Jadwal"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============ MODAL TEMPLATE ============ */}
      {templateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-text)]/50 p-4">
          <div className="w-full max-w-xl rounded-3xl neu-card max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--color-surface)] px-6 py-4 sticky top-0 bg-white/90 backdrop-blur-sm z-10">
              <h3 className="font-bold text-[var(--color-text)] text-lg">{editTemplateId ? "Ubah Template" : "Tambah Template"}</h3>
              <button onClick={() => setTemplateModal(false)} className="text-[var(--color-text-subtle)] hover:text-[var(--color-text-muted)]"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={simpanTemplate} className="p-6 space-y-5">
              <label className={labelCls}>
                <span>Label Pengirim</span>
                <input type="text" required value={tLabel} onChange={(e) => setTLabel(e.target.value)} placeholder="cth. Pengurus Markaz" className={inputCls} />
              </label>
              <label className={labelCls}>
                <span>Deskripsi (opsional)</span>
                <textarea rows={3} value={tDeskripsi} onChange={(e) => setTDeskripsi(e.target.value)} className={`${inputCls} resize-none`} />
              </label>
              <label className="flex items-center gap-3 text-sm font-bold cursor-pointer">
                <input type="checkbox" checked={tAktif} onChange={(e) => setTAktif(e.target.checked)} className="h-5 w-5 rounded text-[var(--color-primary)]" />
                Template aktif
              </label>
              <div className="flex gap-3 pt-4 border-t border-[var(--color-surface)]">
                <button type="button" onClick={() => setTemplateModal(false)} className="w-full rounded-full border border-[var(--color-surface-dark)] py-3 font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-secondary)]">Batal</button>
                <button type="submit" disabled={loading} className="w-full rounded-full bg-[var(--color-primary)] py-3 font-bold text-white shadow-sm hover:bg-[var(--color-primary-dark)] disabled:opacity-50">
                  {loading ? "Menyimpan..." : "Simpan Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
