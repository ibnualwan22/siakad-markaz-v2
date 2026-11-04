"use client";

import { useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
  MUNAQOSAH_NILAI_FIELDS,
  MUNAQOSAH_FIELD_KEYS,
  MUNAQOSAH_FIELD_LABEL,
  MUNAQOSAH_PEMBUKA,
  MUNAQOSAH_DOA,
  MUNAQOSAH_QR_LABEL,
  hitungNilaiAkhir,
  predikatIndo,
  isMusyarokah,
  kalimatJuz,
  formatTanggalCetakMunaqosah,
} from "@/lib/munaqosah-hufadz";
import { TemplateStage, TemplateStageZoom } from "@/components/cetak/TemplateStage";
import { normalizeFieldPositions } from "@/lib/template-layout";

type Row = {
  santriId: string;
  nama: string;
  record: {
    id: string;
    nilaiHafalan: number;
    nilaiKelancaran: number;
    nilaiTajwid: number;
    nilaiMakhorijulHuruf: number;
    juzTeks: string;
    tanggal: string;
    catatan: string | null;
    pengujiNama: string | null;
    verifyToken: string;
  } | null;
  nilaiAkhir: number | null;
  predikat: string | null;
  status: string | null;
};

const emptyForm = {
  nilaiHafalan: "",
  nilaiKelancaran: "",
  nilaiTajwid: "",
  nilaiMakhorijulHuruf: "",
  juzTeks: "",
  tanggal: new Date().toISOString().slice(0, 10),
  catatan: "",
};

export default function MunaqosahHufadzClient({
  dufahAktif,
  canEdit,
}: {
  dufahAktif: string;
  canEdit: boolean;
}) {
  const [tab, setTab] = useState<"nilai" | "template">("nilai");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<any>({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/munaqosah-hufadz?dufahNama=${encodeURIComponent(dufahAktif)}`);
      if (!res.ok) throw new Error("Gagal memuat data");
      const j = await res.json();
      setRows(j.data || []);
    } catch {
      toast.error("Gagal memuat data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dufahAktif) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dufahAktif]);

  // Form nilai tampil sebagai modal (bukan kartu di bawah tabel) supaya
  // pengguna HP tidak perlu scroll ke bawah: modal menempel di viewport
  // dan isinya bisa di-scroll di dalam modal sendiri.
  const closeForm = () => {
    setSelectedId(null);
    setForm({ ...emptyForm });
  };

  useEffect(() => {
    if (!selectedId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeForm();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const selectRow = (row: Row) => {
    setSelectedId(row.santriId);
    if (row.record) {
      setForm({
        nilaiHafalan: String(row.record.nilaiHafalan),
        nilaiKelancaran: String(row.record.nilaiKelancaran),
        nilaiTajwid: String(row.record.nilaiTajwid),
        nilaiMakhorijulHuruf: String(row.record.nilaiMakhorijulHuruf),
        juzTeks: row.record.juzTeks,
        tanggal: row.record.tanggal.slice(0, 10),
        catatan: row.record.catatan || "",
      });
    } else {
      setForm({ ...emptyForm });
    }
  };

  const formNilai: any = {};
  let previewAkhir: number | null = null;
  let previewPredikat: string | null = null;
  let previewMusyarokah = false;
  const allFilled = MUNAQOSAH_NILAI_FIELDS.every((f) => form[f.key] !== "");
  if (allFilled) {
    for (const f of MUNAQOSAH_NILAI_FIELDS) formNilai[f.key] = Number(form[f.key]);
    previewAkhir = hitungNilaiAkhir(formNilai);
    previewPredikat = predikatIndo(previewAkhir);
    previewMusyarokah = isMusyarokah(previewAkhir);
  }

  const save = async () => {
    if (!selectedId) return;
    if (!allFilled) return toast.error("Lengkapi 4 nilai (0–100)");
    if (!form.juzTeks.trim()) return toast.error("Juz yang diselesaikan wajib diisi");
    setSaving(true);
    try {
      const res = await fetch("/api/admin/munaqosah-hufadz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ santriId: selectedId, dufahNama: dufahAktif, ...formNilai, juzTeks: form.juzTeks, tanggal: form.tanggal, catatan: form.catatan }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Gagal menyimpan");
      toast.success("Nilai munaqosah tersimpan");
      await load();
      closeForm();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: Row) => {
    if (!row.record) return;
    if (!confirm(`Hapus nilai munaqosah ${row.nama}? Santri kembali berstatus belum munaqosah.`)) return;
    try {
      const res = await fetch(`/api/admin/munaqosah-hufadz/${row.record.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Gagal menghapus");
      toast.success("Nilai dihapus");
      if (selectedId === row.santriId) {
        setSelectedId(null);
        setForm({ ...emptyForm });
      }
      await load();
    } catch {
      toast.error("Gagal menghapus");
    }
  };

  const toggleCheck = (id: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = rows.filter((r) => r.nama.toLowerCase().includes(search.toLowerCase()));
  const selected = rows.find((r) => r.santriId === selectedId) || null;
  const bulkIds = filtered.filter((r) => r.record && checked.has(r.record.id)).map((r) => r.record!.id);

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <button
          onClick={() => setTab("nilai")}
          className={`px-4 py-2 rounded-xl font-bold ${tab === "nilai" ? "bg-[var(--color-primary)] text-white" : "bg-white border"}`}
        >
          Nilai Munaqosah
        </button>
        <button
          onClick={() => setTab("template")}
          className={`px-4 py-2 rounded-xl font-bold ${tab === "template" ? "bg-[var(--color-primary)] text-white" : "bg-white border"}`}
        >
          Template & Layout
        </button>
      </div>

      {tab === "nilai" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama santri..."
              className="px-3 py-2 border rounded-xl flex-1 min-w-52"
            />
            {bulkIds.length > 0 && (
              <a
                href={`/admin/munaqosah-hufadz/cetak-bulk?ids=${bulkIds.join(",")}`}
                target="_blank"
                rel="noreferrer"
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold"
              >
                Cetak Massal ({bulkIds.length})
              </a>
            )}
          </div>

          {loading ? (
            <p className="text-sm text-[var(--color-text-muted)]">Memuat...</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-[var(--color-text-muted)]">Tidak ada santri Hufadz aktif di dufah {dufahAktif}.</p>
          ) : (
            <div className="bg-white rounded-2xl border overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="p-3"></th>
                    <th className="p-3">Nama</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Nilai Akhir</th>
                    <th className="p-3">Predikat</th>
                    <th className="p-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.santriId} className={`border-b ${selectedId === r.santriId ? "bg-amber-50" : ""}`}>
                      <td className="p-3">
                        {r.record && (
                          <input type="checkbox" checked={checked.has(r.record.id)} onChange={() => toggleCheck(r.record!.id)} />
                        )}
                      </td>
                      <td className="p-3 font-semibold">{r.nama}</td>
                      <td className="p-3">
                        {!r.record ? (
                          <span className="text-slate-400">Belum munaqosah</span>
                        ) : r.status === "LULUS" ? (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-xs">Lulus</span>
                        ) : r.status === "MUSYAROKAH" ? (
                          <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold text-xs">Musyarokah</span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-xs">Tidak Lulus</span>
                        )}
                      </td>
                      <td className="p-3">{r.nilaiAkhir ?? "-"}</td>
                      <td className="p-3">{r.status === "MUSYAROKAH" ? "-" : r.predikat ?? "-"}</td>
                      <td className="p-3">
                        <div className="flex gap-2">
                          {canEdit && (
                            <button onClick={() => selectRow(r)} className="px-3 py-1 rounded-lg bg-blue-50 text-blue-700 font-bold">
                              {r.record ? "Edit Nilai" : "Input Nilai"}
                            </button>
                          )}
                          {r.record && (
                            <a
                              href={`/cetak-template/munaqosah-hufadz/${r.record.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold"
                            >
                              Cetak
                            </a>
                          )}
                          {canEdit && r.record && (
                            <button onClick={() => remove(r)} className="px-3 py-1 rounded-lg bg-red-50 text-red-700 font-bold">
                              Hapus
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selected && canEdit && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
              <div className="absolute inset-0 bg-black/50" onClick={closeForm} />
              <div className="relative bg-white rounded-2xl w-full max-w-2xl max-h-[90dvh] overflow-y-auto p-5 space-y-4 shadow-2xl">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-bold">Nilai Munaqosah — {selected.nama}</h3>
                <button onClick={closeForm} aria-label="Tutup" className="shrink-0 w-8 h-8 rounded-full bg-slate-100 font-bold">✕</button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {MUNAQOSAH_NILAI_FIELDS.map((f) => (
                  <label key={f.key} className="text-sm font-semibold">
                    {f.label}
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form[f.key]}
                      onChange={(e) => setForm((p: any) => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full mt-1 px-3 py-2 border rounded-xl"
                    />
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-sm font-semibold">
                  Juz yang diselesaikan (cth: 30،29،1)
                  <input
                    value={form.juzTeks}
                    onChange={(e) => setForm((p: any) => ({ ...p, juzTeks: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border rounded-xl"
                    dir="rtl"
                  />
                </label>
                <label className="text-sm font-semibold">
                  Tanggal munaqosah
                  <input
                    type="date"
                    value={form.tanggal}
                    onChange={(e) => setForm((p: any) => ({ ...p, tanggal: e.target.value }))}
                    className="w-full mt-1 px-3 py-2 border rounded-xl"
                  />
                </label>
              </div>
              <label className="text-sm font-semibold block">
                Catatan (opsional)
                <textarea
                  value={form.catatan}
                  onChange={(e) => setForm((p: any) => ({ ...p, catatan: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border rounded-xl"
                  rows={2}
                />
              </label>
              {previewAkhir !== null && (
                <p className="text-sm">
                  Nilai akhir (rata-rata): <b>{previewAkhir}</b>
                  {previewMusyarokah ? (
                    <> — <b>Musyarokah</b> (nilai tidak ditampilkan di syahadah)</>
                  ) : (
                    <> — Predikat: <b>{previewPredikat}</b></>
                  )}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={save}
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-50"
                >
                  {saving ? "Menyimpan..." : "Simpan Nilai"}
                </button>
                <button
                  onClick={closeForm}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 font-bold"
                >
                  Batal
                </button>
              </div>
              </div>
            </div>
          )}
          {!canEdit && (
            <p className="text-sm text-[var(--color-text-muted)]">Kamu hanya bisa melihat daftar ini. Input nilai memakai izin yang sama dengan input tasmi&apos; Hufadz.</p>
          )}
        </div>
      )}

      {tab === "template" && <TemplateTab canEdit={canEdit} />}
    </div>
  );
}

function TemplateTab({ canEdit }: { canEdit: boolean }) {
  const [bg, setBg] = useState<string | null>(null);
  const [positions, setPositions] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Panggung preview memakai TemplateStage (330 x 215 mm, posisi mm) —
  // komponen yang sama dengan halaman cetak, supaya preview sebangun
  // dengan hasil print seperti syahadah offline.
  const dragRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/admin/munaqosah-hufadz/template?programKey=munaqosah-hufadz");
        if (!res.ok) return;
        const tpl = await res.json();
        setBg(tpl.backgroundUrl || null);
        // Posisi dinormalisasi ke mm saat load (data lama %/px dikonversi);
        // saat save, units:"mm" ikut tersimpan di fieldPositions.
        setPositions(normalizeFieldPositions(tpl.fieldPositions || {}));
      } catch { /* abaikan */ }
    })();
  }, []);

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("programKey", "munaqosah-hufadz");
      const res = await fetch("/api/admin/munaqosah-hufadz/template/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error((await res.json()).error || "Gagal upload");
      const { url, publicId } = await res.json();
      const put = await fetch("/api/admin/munaqosah-hufadz/template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programKey: "munaqosah-hufadz", backgroundUrl: url, backgroundId: publicId }),
      });
      if (!put.ok) throw new Error("Gagal menyimpan template");
      setBg(url);
      toast.success("Background terupload");
    } catch (err: any) {
      toast.error(err.message || "Gagal upload");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const savePositions = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/munaqosah-hufadz/template", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ programKey: "munaqosah-hufadz", fieldPositions: positions }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan");
      toast.success("Layout tersimpan");
    } catch {
      toast.error("Gagal menyimpan layout");
    } finally {
      setSaving(false);
    }
  };

  const onFieldDown = (e: React.PointerEvent, key: string) => {
    // Rect diukur dari elemen .template-stage terdekat (sudah termasuk
    // zoom layar), lalu geseran diubah ke mm panggung 330 x 215.
    const stage = (e.target as HTMLElement).closest(".template-stage");
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    dragRef.current = {
      key, startX: e.clientX, startY: e.clientY,
      origX: positions[key]?.x ?? 165, origY: positions[key]?.y ?? 107.5,
      w: rect.width, h: rect.height,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const nx = Math.min(330, Math.max(0, d.origX + ((e.clientX - d.startX) / d.w) * 330));
    const ny = Math.min(215, Math.max(0, d.origY + ((e.clientY - d.startY) / d.h) * 215));
    setPositions((p: any) => ({ ...p, [d.key]: { ...p[d.key], x: Math.round(nx * 10) / 10, y: Math.round(ny * 10) / 10 } }));
  };
  const onUp = () => { dragRef.current = null; };

  const setField = (key: string, patch: any) =>
    setPositions((p: any) => ({ ...p, [key]: { ...p[key], ...patch } }));

  // Data contoh preview — SAMA seperti yang dirender halaman cetak,
  // hanya namanya contoh (bukan santri baru).
  const sample: Record<string, string> = {
    pembuka: MUNAQOSAH_PEMBUKA,
    nama: "Ahmad Ibnu Alwan",
    kalimatJuz: kalimatJuz("30،29،1"),
    periodeLine: "التي أقيمت في النخبة الأولى",
    tanggalPeriodeLine: "التي تقام خلال فترات ١١ سبتمبر ٢٠٢٦ إلى ٥ أكتوبر ٢٠٢٦",
    doa: MUNAQOSAH_DOA,
    tanggalCetak: `صدرت في باري بتاريخ ${formatTanggalCetakMunaqosah(new Date())}`,
    qrLabel: MUNAQOSAH_QR_LABEL,
  };
  const sampleRows = [
    { arab: "الحفظ", nilai: 85 },
    { arab: "الطلاقة", nilai: 80 },
    { arab: "التجويد", nilai: 90 },
    { arab: "مخارج الحروف", nilai: 75 },
  ];

  return (
    <div className="bg-white rounded-2xl border p-5 space-y-4">
      <h3 className="font-bold">Atur Posisi & Ukuran Field <span className="font-normal text-sm text-[var(--color-text-muted)]">(geser teks di atas desain)</span></h3>
      <p className="text-xs text-[var(--color-text-muted)]">
        Background awal kosong — upload gambar template kiriman (logo, basmalah, SK, tanda tangan + stempel) lewat tombol di bawah; hanya berlaku untuk template Munaqosah ini.
        Preview memakai data contoh dengan gaya field asli. Tanggal periode di cetakan asli diambil dari setting syahadah, bukan dari preview ini.
      </p>
      {canEdit && (
        <>
          <label className="inline-block px-5 py-2.5 rounded-xl bg-[var(--color-primary)] text-white font-bold cursor-pointer hover:opacity-90">
            {uploading ? "Mengupload..." : "Upload Desain Baru"}
            <input type="file" accept="image/*" className="hidden" onChange={upload} disabled={uploading} />
          </label>
          <p className="text-xs text-[var(--color-text-muted)]">Format gambar (JPG/PNG), maksimal 10MB. Tersimpan di Cloudinary, hanya untuk template Munaqosah.</p>
        </>
      )}
      {!bg ? (
        <p className="text-sm text-[var(--color-text-muted)]">Template belum memiliki background.</p>
      ) : (
        <>
          <div
            className="relative w-full max-w-3xl mx-auto border rounded-xl overflow-hidden select-none touch-none"
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <TemplateStageZoom>
              <TemplateStage
                programKey="munaqosah-hufadz"
                backgroundUrl={bg}
                fieldPositions={positions}
                fieldKeys={[...MUNAQOSAH_FIELD_KEYS]}
                texts={sample}
                tabelNilai={{ rows: sampleRows, rataRata: 83, predikat: "جيد جدا" }}
                editorMode
                defaultFontSize={26}
                onFieldPointerDown={onFieldDown}
              />
            </TemplateStageZoom>
          </div>

          {canEdit && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {MUNAQOSAH_FIELD_KEYS.map((key) => {
                  const cfg = positions[key] || {};
                  const isImg = key === "qr";
                  return (
                    <div key={key} className="border rounded-xl p-3 space-y-2">
                      <p className="font-bold text-sm">{MUNAQOSAH_FIELD_LABEL[key]}</p>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <label>X (mm)
                          <input type="number" step="0.5" value={cfg.x ?? 165}
                            onChange={(e) => setField(key, { x: Number(e.target.value) })}
                            className="w-full px-2 py-1 border rounded" />
                        </label>
                        <label>Y (mm)
                          <input type="number" step="0.5" value={cfg.y ?? 107.5}
                            onChange={(e) => setField(key, { y: Number(e.target.value) })}
                            className="w-full px-2 py-1 border rounded" />
                        </label>
                        {!isImg && (
                          <label>Font (px)
                            <input type="number" value={cfg.fontSize ?? 26}
                              onChange={(e) => setField(key, { fontSize: Number(e.target.value) })}
                              className="w-full px-2 py-1 border rounded" />
                          </label>
                        )}
                        <label>{isImg ? "Lebar (mm, panggung)" : "Lebar maks (mm)"}
                          <input type="number" value={cfg.maxWidth ?? 264}
                            onChange={(e) => setField(key, { maxWidth: Number(e.target.value) })}
                            className="w-full px-2 py-1 border rounded" />
                        </label>
                        {!isImg && key !== "tabelNilai" && (
                          <>
                            <label className="col-span-2">Font (nama family)
                              <input type="text" value={cfg.fontFamily ?? ""}
                                placeholder="cth: Poppins"
                                onChange={(e) => setField(key, { fontFamily: e.target.value })}
                                className="w-full px-2 py-1 border rounded" />
                            </label>
                            <label className="col-span-2">Warna
                              <span className="flex gap-2">
                                <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(cfg.color || "") ? cfg.color : "#000000"}
                                  onChange={(e) => setField(key, { color: e.target.value })}
                                  className="w-10 h-8 px-1 border rounded cursor-pointer" />
                                <input type="text" value={cfg.color ?? ""}
                                  placeholder="#000000"
                                  onChange={(e) => setField(key, { color: e.target.value })}
                                  className="flex-1 px-2 py-1 border rounded" />
                              </span>
                            </label>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <button onClick={savePositions} disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold disabled:opacity-50">
                {saving ? "Menyimpan..." : "Simpan Layout"}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
