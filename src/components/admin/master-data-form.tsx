"use client";

import { formatDateIndo, toDateInputValue, translateDateToArabic } from "@/lib/formatters";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type ProgramSetting = {
  id: string;
  nama_indo: string;
  nama_arab: string;
  kkm: number;
  mapelList: Array<{
    id: string;
  }>;
};

type TemplateSetting = {
  id: number;
  tgl_cetak_indo: string;
  tgl_cetak_arab: string;
  tgl_mulai_indo: string | null;
  tgl_mulai_arab: string | null;
  tgl_selesai_indo: string | null;
  tgl_selesai_arab: string | null;
  nama_mudir_indo: string;
  nama_mudir_arab: string;
  jabatan_mudir_indo: string;
  jabatan_mudir_arab: string;
  teks_dufah_akbarnas_arab: string | null;
  teks_dufah_arab: string | null;
  nama_mudir_turats?: string | null;
  nama_mudir_turats_arab?: string | null;
  jabatan_mudir_turats?: string | null;
  nama_mudir_hufadz_indo?: string | null;
  nama_mudir_hufadz_arab?: string | null;
  ttd_mudir_arabiyah_url?: string | null;
  ttd_mudir_turats_url?: string | null;
  ttd_mudir_hufadz_url?: string | null;
};

type LembagaKey = "ARABIYAH" | "TURATS" | "HUFADZ";

const DEFAULT_TTD: Record<LembagaKey, string> = {
  ARABIYAH: "/images/signature.png",
  TURATS: "/images/signature-turats.png",
  HUFADZ: "/images/signature.png",
};

export function MasterDataForm({
  programList,
  template,
}: {
  programList: ProgramSetting[];
  template: TemplateSetting;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [uploadingLembaga, setUploadingLembaga] = useState<LembagaKey | null>(null);
  const [tanggalCetak, setTanggalCetak] = useState(
    toDateInputValue(template.tgl_cetak_indo) || new Date().toISOString().slice(0, 10),
  );
  const [tanggalMulai, setTanggalMulai] = useState(
    template.tgl_mulai_indo ? toDateInputValue(template.tgl_mulai_indo) : "",
  );
  const [tanggalSelesai, setTanggalSelesai] = useState(
    template.tgl_selesai_indo ? toDateInputValue(template.tgl_selesai_indo) : "",
  );
  const [templateState, setTemplateState] = useState({
    nama_mudir_indo: template.nama_mudir_indo,
    nama_mudir_arab: template.nama_mudir_arab,
    jabatan_mudir_indo: template.jabatan_mudir_indo,
    jabatan_mudir_arab: template.jabatan_mudir_arab,
    teks_dufah_akbarnas_arab: template.teks_dufah_akbarnas_arab ?? "",
    teks_dufah_arab: template.teks_dufah_arab ?? "",
    nama_mudir_turats: template.nama_mudir_turats ?? "",
    nama_mudir_turats_arab: template.nama_mudir_turats_arab ?? "",
    jabatan_mudir_turats: template.jabatan_mudir_turats ?? "Direktur Markaz Turats",
    nama_mudir_hufadz_indo: template.nama_mudir_hufadz_indo ?? "",
    nama_mudir_hufadz_arab: template.nama_mudir_hufadz_arab ?? "",
    ttd_mudir_arabiyah_url: template.ttd_mudir_arabiyah_url ?? "",
    ttd_mudir_turats_url: template.ttd_mudir_turats_url ?? "",
    ttd_mudir_hufadz_url: template.ttd_mudir_hufadz_url ?? "",
  });
  const [kkmByKelas, setKkmByKelas] = useState<Record<string, string>>(() => {
    return Object.fromEntries(programList.map((program) => [program.id, String(program.kkm)]));
  });

  const previewDate = {
    indo: tanggalCetak ? formatDateIndo(tanggalCetak) : "",
    arab: tanggalCetak ? translateDateToArabic(tanggalCetak) : "",
  };

  const handleUploadSignature = async (
    lembaga: LembagaKey,
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError("");
    setMessage("");
    setUploadingLembaga(lembaga);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("lembaga", lembaga);
      const res = await fetch("/api/admin/master-data/upload-signature", {
        method: "POST",
        body: fd,
      });
      const payload = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
      if (!res.ok || !payload?.url) {
        throw new Error(payload?.error || "Gagal mengupload tanda tangan.");
      }
      setTemplateState((current) => ({
        ...current,
        ...(lembaga === "ARABIYAH" ? { ttd_mudir_arabiyah_url: payload.url! } : {}),
        ...(lembaga === "TURATS" ? { ttd_mudir_turats_url: payload.url! } : {}),
        ...(lembaga === "HUFADZ" ? { ttd_mudir_hufadz_url: payload.url! } : {}),
      }));
      setMessage(`Tanda tangan Mudir ${lembaga} berhasil diupload. Klik "Simpan Master Data" untuk menerapkan.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal mengupload tanda tangan.");
    } finally {
      setUploadingLembaga(null);
      event.target.value = "";
    }
  };

  const handleSubmit = () => {
    setMessage("");
    setError("");

    if (!tanggalCetak) {
      setError("Tanggal cetak wajib diisi.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/admin/master-data", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tanggalCetak,
          tanggalMulai,
          tanggalSelesai,
          kelas: programList.map((program) => ({
            id: program.id,
            kkm: Number(kkmByKelas[program.id]),
          })),
          template: templateState,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(payload?.error ?? "Gagal menyimpan master data.");
        return;
      }

      setMessage("Master data berhasil diperbarui.");
      router.refresh();
    });
  };

  const renderTtdUploader = (
    lembaga: LembagaKey,
    url: string,
    onClear: () => void,
    accentClass: string,
  ) => {
    const effectiveSrc = url || DEFAULT_TTD[lembaga];
    const isCustom = Boolean(url);
    const isBusy = uploadingLembaga === lembaga;

    return (
      <div className="space-y-2 rounded-2xl border border-[var(--color-surface-dark)] bg-white p-3.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
            Tanda Tangan Mudir (PNG Transparan)
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              isCustom ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
            }`}
          >
            {isCustom ? "Custom Upload" : "Default Bawaan"}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-16 w-28 shrink-0 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={effectiveSrc}
              alt={`TTD Mudir ${lembaga}`}
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label
              className={`inline-flex cursor-pointer items-center rounded-xl px-3.5 py-2 text-xs font-bold text-white transition hover:opacity-90 ${accentClass} ${
                isBusy ? "opacity-60 pointer-events-none" : ""
              }`}
            >
              {isBusy ? "Mengupload..." : "Upload TTD"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                disabled={isBusy}
                onChange={(e) => handleUploadSignature(lembaga, e)}
              />
            </label>
            {isCustom && (
              <button
                type="button"
                onClick={onClear}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Reset Default
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <section className="neu-card-white p-6">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--color-primary)]">
              Master KKM
            </p>
            <h2 className="mt-2 text-3xl font-bold text-[var(--color-text)]">
              Pengaturan kelas dan ambang kelulusan
            </h2>
          </div>
          <p className="max-w-md text-right text-sm leading-6 text-[var(--color-text-muted)]">
            Perubahan KKM akan langsung memengaruhi penentuan status LULUS, MUSYAROKAH, atau TIDAK_LULUS.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {programList.map((program) => (
            <label
              key={program.id}
              className="rounded-[1.75rem] border border-[var(--color-surface-dark)] bg-[var(--color-secondary)] px-4 py-4"
            >
              <span className="block text-base font-bold text-[var(--color-text)]">{program.nama_indo}</span>
              <span className="mt-1 block text-xs tracking-[0.2em] text-[var(--color-text-muted)]">
                {program.nama_arab}
              </span>
              <span className="mt-3 block text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
                {program.mapelList.length} mapel
              </span>
              <input
                type="number"
                min={0}
                max={100}
                value={kkmByKelas[program.id] ?? ""}
                onChange={(event) =>
                  setKkmByKelas((current) => ({
                    ...current,
                    [program.id]: event.target.value,
                  }))
                }
                className="mt-4 w-full rounded-2xl border border-[var(--color-surface-dark)] bg-white px-4 py-3 text-center text-2xl font-black text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)]"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="grid gap-6 neu-card-white p-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div className="space-y-6">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--color-primary)]">
              Template Syahadah
            </p>
            <h2 className="mt-2 text-3xl font-bold text-[var(--color-text)]">
              Tanggal periode &amp; identitas mudir per lembaga
            </h2>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              Tanggal mulai, selesai, dan tanggal terbit berlaku bersama untuk semua lembaga. Nama dan tanda tangan mudir otomatis mengikuti lembaga program santri.
            </p>
          </div>

          {/* Shared Dates & Duf'ah Text */}
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2 text-sm font-semibold text-[var(--color-text)]">
              <span>Tanggal Mulai Program</span>
              <input
                type="date"
                value={tanggalMulai}
                onChange={(event) => setTanggalMulai(event.target.value)}
                className="w-full rounded-2xl border border-[var(--color-surface-dark)] bg-[var(--color-secondary)] px-4 py-3 text-base font-medium text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:bg-white"
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-[var(--color-text)]">
              <span>Tanggal Selesai Program</span>
              <input
                type="date"
                value={tanggalSelesai}
                onChange={(event) => setTanggalSelesai(event.target.value)}
                className="w-full rounded-2xl border border-[var(--color-surface-dark)] bg-[var(--color-secondary)] px-4 py-3 text-base font-medium text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:bg-white"
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-[var(--color-text)]">
              <span>Tanggal Cetak Syahadah</span>
              <input
                type="date"
                value={tanggalCetak}
                onChange={(event) => setTanggalCetak(event.target.value)}
                className="w-full rounded-2xl border border-[var(--color-surface-dark)] bg-[var(--color-secondary)] px-4 py-3 text-base font-medium text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:bg-white"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm font-semibold text-[var(--color-text)]">
              <span>Teks Duf&apos;ah Program Reguler (Arab)</span>
              <input
                dir="rtl"
                placeholder="Contoh: الدفعة التسعون"
                value={templateState.teks_dufah_arab ?? ""}
                onChange={(event) =>
                  setTemplateState((current) => ({ ...current, teks_dufah_arab: event.target.value }))
                }
                className="w-full rounded-2xl border border-[var(--color-surface-dark)] bg-[var(--color-secondary)] px-4 py-3 text-base text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:bg-white font-arabic"
              />
            </label>
            <label className="space-y-2 text-sm font-semibold text-[var(--color-text)]">
              <span>Teks Duf&apos;ah Akbarnas (Arab)</span>
              <input
                dir="rtl"
                placeholder="Contoh: الدفعة ٨٩ إلى ٩٠"
                value={templateState.teks_dufah_akbarnas_arab ?? ""}
                onChange={(event) =>
                  setTemplateState((current) => ({
                    ...current,
                    teks_dufah_akbarnas_arab: event.target.value,
                  }))
                }
                className="w-full rounded-2xl border border-[var(--color-surface-dark)] bg-[var(--color-secondary)] px-4 py-3 text-base text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:bg-white font-arabic"
              />
            </label>
          </div>

          {/* 3-Lembaga Mudir Cards */}
          <div className="space-y-4">
            {/* Markaz Arabiyah */}
            <div className="rounded-3xl border border-sky-200 bg-sky-50/40 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-sky-500" />
                <h3 className="text-base font-bold text-slate-900">Mudir Markaz Arabiyah</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text)]">
                  <span>Nama Mudir (Indonesia)</span>
                  <input
                    value={templateState.nama_mudir_indo}
                    onChange={(event) =>
                      setTemplateState((current) => ({ ...current, nama_mudir_indo: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-[var(--color-surface-dark)] bg-white px-4 py-2.5 text-sm text-[var(--color-text)] outline-none transition focus:border-sky-500"
                  />
                </label>
                <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text)]">
                  <span>Nama Mudir (Arab — tampil di syahadah)</span>
                  <input
                    dir="rtl"
                    value={templateState.nama_mudir_arab}
                    onChange={(event) =>
                      setTemplateState((current) => ({ ...current, nama_mudir_arab: event.target.value }))
                    }
                    className="w-full rounded-2xl border border-[var(--color-surface-dark)] bg-white px-4 py-2.5 text-sm text-[var(--color-text)] outline-none transition focus:border-sky-500 font-arabic"
                  />
                </label>
                <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text)]">
                  <span>Jabatan Mudir (Indonesia)</span>
                  <input
                    value={templateState.jabatan_mudir_indo}
                    onChange={(event) =>
                      setTemplateState((current) => ({
                        ...current,
                        jabatan_mudir_indo: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-[var(--color-surface-dark)] bg-white px-4 py-2.5 text-sm text-[var(--color-text)] outline-none transition focus:border-sky-500"
                  />
                </label>
                <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text)]">
                  <span>Jabatan Mudir (Arab)</span>
                  <input
                    dir="rtl"
                    value={templateState.jabatan_mudir_arab}
                    onChange={(event) =>
                      setTemplateState((current) => ({
                        ...current,
                        jabatan_mudir_arab: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-[var(--color-surface-dark)] bg-white px-4 py-2.5 text-sm text-[var(--color-text)] outline-none transition focus:border-sky-500 font-arabic"
                  />
                </label>
              </div>
              {renderTtdUploader(
                "ARABIYAH",
                templateState.ttd_mudir_arabiyah_url,
                () => setTemplateState((c) => ({ ...c, ttd_mudir_arabiyah_url: "" })),
                "bg-sky-600",
              )}
            </div>

            {/* Markaz Turats */}
            <div className="rounded-3xl border border-amber-200 bg-amber-50/40 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-amber-500" />
                <h3 className="text-base font-bold text-slate-900">Mudir Markaz Turats</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text)]">
                  <span>Nama Mudir (Indonesia)</span>
                  <input
                    placeholder="Ustadz Abdul Wahhab, M.Pd."
                    value={templateState.nama_mudir_turats}
                    onChange={(event) =>
                      setTemplateState((current) => ({
                        ...current,
                        nama_mudir_turats: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-[var(--color-surface-dark)] bg-white px-4 py-2.5 text-sm text-[var(--color-text)] outline-none transition focus:border-amber-500"
                  />
                </label>
                <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text)]">
                  <span>Nama Mudir (Arab — tampil di syahadah)</span>
                  <input
                    dir="rtl"
                    placeholder="الأستاذ عبد الوهاب"
                    value={templateState.nama_mudir_turats_arab}
                    onChange={(event) =>
                      setTemplateState((current) => ({
                        ...current,
                        nama_mudir_turats_arab: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-[var(--color-surface-dark)] bg-white px-4 py-2.5 text-sm text-[var(--color-text)] outline-none transition focus:border-amber-500 font-arabic"
                  />
                </label>
                <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text)]">
                  <span>Jabatan Mudir</span>
                  <input
                    value={templateState.jabatan_mudir_turats}
                    onChange={(event) =>
                      setTemplateState((current) => ({
                        ...current,
                        jabatan_mudir_turats: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-[var(--color-surface-dark)] bg-white px-4 py-2.5 text-sm text-[var(--color-text)] outline-none transition focus:border-amber-500"
                  />
                </label>
              </div>
              {renderTtdUploader(
                "TURATS",
                templateState.ttd_mudir_turats_url,
                () => setTemplateState((c) => ({ ...c, ttd_mudir_turats_url: "" })),
                "bg-amber-600",
              )}
            </div>

            {/* Markaz Hufadz */}
            <div className="rounded-3xl border border-emerald-200 bg-emerald-50/40 p-5 space-y-4">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-emerald-500" />
                <h3 className="text-base font-bold text-slate-900">Mudir Markaz Hufadz</h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text)]">
                  <span>Nama Mudir (Indonesia)</span>
                  <input
                    placeholder="Nama Mudir Markaz Hufadz"
                    value={templateState.nama_mudir_hufadz_indo}
                    onChange={(event) =>
                      setTemplateState((current) => ({
                        ...current,
                        nama_mudir_hufadz_indo: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-[var(--color-surface-dark)] bg-white px-4 py-2.5 text-sm text-[var(--color-text)] outline-none transition focus:border-emerald-500"
                  />
                </label>
                <label className="space-y-1.5 text-sm font-semibold text-[var(--color-text)]">
                  <span>Nama Mudir (Arab — tampil di syahadah)</span>
                  <input
                    dir="rtl"
                    placeholder="اسم مدير مركز الحفاظ"
                    value={templateState.nama_mudir_hufadz_arab}
                    onChange={(event) =>
                      setTemplateState((current) => ({
                        ...current,
                        nama_mudir_hufadz_arab: event.target.value,
                      }))
                    }
                    className="w-full rounded-2xl border border-[var(--color-surface-dark)] bg-white px-4 py-2.5 text-sm text-[var(--color-text)] outline-none transition focus:border-emerald-500 font-arabic"
                  />
                </label>
              </div>
              {renderTtdUploader(
                "HUFADZ",
                templateState.ttd_mudir_hufadz_url,
                () => setTemplateState((c) => ({ ...c, ttd_mudir_hufadz_url: "" })),
                "bg-emerald-600",
              )}
            </div>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="rounded-[1.75rem] bg-[var(--color-text)] p-5 text-white h-fit">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--color-text-subtle)]">
            Preview Template
          </p>
          <div className="mt-5 space-y-4 text-sm leading-7 text-slate-200">
            <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
              <p className="font-semibold text-white">Tanggal cetak (Indonesia)</p>
              <p>{previewDate.indo}</p>
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3" dir="rtl">
              <p className="font-semibold text-white">التاريخ بالعربية</p>
              <p>{previewDate.arab}</p>
            </div>

            {(
              [
                {
                  key: "ARABIYAH" as const,
                  title: "Markaz Arabiyah",
                  dot: "bg-sky-400",
                  indo: templateState.nama_mudir_indo || "-",
                  arab: templateState.nama_mudir_arab || "-",
                  ttd: templateState.ttd_mudir_arabiyah_url || DEFAULT_TTD.ARABIYAH,
                },
                {
                  key: "TURATS" as const,
                  title: "Markaz Turats",
                  dot: "bg-amber-400",
                  indo: templateState.nama_mudir_turats || "-",
                  arab: templateState.nama_mudir_turats_arab || "(pakai default Arabiyah)",
                  ttd: templateState.ttd_mudir_turats_url || DEFAULT_TTD.TURATS,
                },
                {
                  key: "HUFADZ" as const,
                  title: "Markaz Hufadz",
                  dot: "bg-emerald-400",
                  indo: templateState.nama_mudir_hufadz_indo || "-",
                  arab: templateState.nama_mudir_hufadz_arab || "(pakai default Arabiyah)",
                  ttd: templateState.ttd_mudir_hufadz_url || DEFAULT_TTD.HUFADZ,
                },
              ]
            ).map((item) => (
              <div
                key={item.key}
                className="rounded-3xl border border-white/10 bg-white/5 px-4 py-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-300">
                    <span className={`h-2 w-2 rounded-full ${item.dot}`} />
                    {item.title}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-white">{item.indo}</p>
                    <p className="truncate text-slate-300 font-arabic" dir="rtl">
                      {item.arab}
                    </p>
                  </div>
                  <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded-xl bg-white p-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.ttd}
                      alt={`Preview TTD ${item.title}`}
                      className="max-h-full max-w-full object-contain"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {message ? (
        <div className="rounded-3xl border border-[var(--color-primary-100)] bg-[var(--color-primary-50)] px-4 py-3 text-sm font-medium text-[var(--color-primary)]">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-3xl border border-[var(--color-danger)] bg-[var(--color-danger-light)] px-4 py-3 text-sm font-medium text-[var(--color-danger)]">
          {error}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={isPending}
          onClick={handleSubmit}
          className="rounded-full bg-[var(--color-primary)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:bg-[var(--color-surface-dark)]"
        >
          {isPending ? "Menyimpan..." : "Simpan Master Data"}
        </button>
      </div>
    </div>
  );
}
