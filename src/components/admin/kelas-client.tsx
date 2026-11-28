"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, X, Save, AlertCircle, Check, Loader2, Power, PowerOff } from "lucide-react";

type ProgramItem = {
  id: string;
  nama_indo: string;
  nama_arab: string;
  kelasList: Array<{
    id: string;
    nama: string;
    isActive?: boolean;
  }>;
};

// ─── Inline Add Row ─────────────────────────────────────────────────────────

function InlineAddKelas({ programId, programNama, onSaved }: {
  programId: string;
  programNama: string;
  onSaved: () => void;
}) {
  const [names, setNames] = useState<string[]>([""]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const addRow = () => setNames((prev) => [...prev, ""]);
  const removeRow = (i: number) => setNames((prev) => prev.filter((_, idx) => idx !== i));
  const updateRow = (i: number, v: string) => setNames((prev) => prev.map((n, idx) => idx === i ? v : n));

  const handleSave = async () => {
    const valid = names.map((n) => n.trim()).filter(Boolean);
    if (valid.length === 0) { setErrors(["Minimal satu nama kelas."]) ; return; }
    setLoading(true);
    setErrors([]);
    const errs: string[] = [];
    for (const nama of valid) {
      const res = await fetch("/api/admin/kelas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama, programId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        errs.push(`"${nama}": ${d?.error || "Gagal"}`);
      }
    }
    setLoading(false);
    if (errs.length > 0) { setErrors(errs); return; }
    onSaved();
  };

  return (
    <div className="mt-3 rounded-xl border border-[var(--color-primary-100)] bg-[var(--color-primary-50)] p-4 space-y-2">
      <p className="text-xs font-bold text-[var(--color-primary)] uppercase tracking-wider">Tambah Kelas ke {programNama}</p>
      {errors.map((e, i) => (
        <p key={i} className="text-xs text-[var(--color-danger)] font-medium">{e}</p>
      ))}
      <div className="space-y-2">
        {names.map((name, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => updateRow(i, e.target.value)}
              placeholder={`Contoh: ${programNama} ${String.fromCharCode(65 + i)}`}
              className="flex-1 rounded-xl border border-[var(--color-surface-dark)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-primary)]"
              onKeyDown={(e) => e.key === "Enter" && i === names.length - 1 && addRow()}
            />
            {names.length > 1 && (
              <button onClick={() => removeRow(i)} className="text-[var(--color-text-subtle)] hover:text-[var(--color-danger)] transition">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Tombol + tambah baris berikutnya */}
      <button
        onClick={addRow}
        className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-primary)] hover:text-[var(--color-primary)] py-1 transition"
      >
        <Plus className="h-3.5 w-3.5" />
        + Tambah kelas lagi
      </button>

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl bg-[var(--color-primary)] px-4 py-2 text-xs font-bold text-white hover:bg-[var(--color-primary-dark)] disabled:opacity-60 transition"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Simpan
        </button>
        <button
          onClick={() => { setNames([""]); setErrors([]); onSaved(); }}
          className="rounded-xl border border-[var(--color-surface-dark)] px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] hover:bg-[var(--color-surface)] transition"
        >
          Batal
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function KelasClient({ programList }: { programList: ProgramItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formNama, setFormNama] = useState("");
  const [formProgramId, setFormProgramId] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Inline add state per program
  const [inlineAddProgramId, setInlineAddProgramId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);

  const openEditModal = (id: string, nama: string, programId: string) => {
    setModalMode("edit");
    setEditingId(id);
    setFormNama(nama);
    setFormProgramId(programId);
    setErrorMsg("");
    setIsModalOpen(true);
  };

  const activeIndo = programList.find((p) => p.id === formProgramId)?.nama_indo || "Kelas";

  const handleSave = async () => {
    if (!formNama.trim() || !formProgramId) {
      setErrorMsg("Nama dan Program wajib diisi.");
      return;
    }
    setErrorMsg("");
    startTransition(async () => {
      const res = await fetch("/api/admin/kelas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editingId, nama: formNama, programId: formProgramId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setErrorMsg(data?.error || "Terjadi kesalahan saat menyimpan.");
        return;
      }

      setIsModalOpen(false);
      router.refresh();
    });
  };

  const handleToggleActive = async (id: string, nama: string, nextActive: boolean) => {
    setNoticeMsg(null);
    startTransition(async () => {
      const res = await fetch("/api/admin/kelas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: nextActive }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) {
        alert(data?.error || `Gagal mengubah status kelas "${nama}".`);
        return;
      }

      if (data?.message) setNoticeMsg(data.message);
      router.refresh();
    });
  };

  const handleDelete = async (id: string, nama: string) => {
    if (
      !confirm(
        `Hapus kelas "${nama}" dari daftar?\n\nCatatan: Jika kelas ini pernah digunakan oleh santri/absensi lama, seluruh data riwayat & nilainya akan tetap aman utuh (tidak ikut terhapus).`
      )
    ) {
      return;
    }

    setNoticeMsg(null);
    startTransition(async () => {
      const res = await fetch(`/api/admin/kelas?id=${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        alert(data?.error || "Gagal menghapus.");
        return;
      }

      if (data?.message) setNoticeMsg(data.message);
      router.refresh();
    });
  };

  const totalAktif = programList.reduce(
    (sum, p) => sum + p.kelasList.filter((k) => k.isActive !== false).length,
    0
  );
  const totalNonaktif = programList.reduce(
    (sum, p) => sum + p.kelasList.filter((k) => k.isActive === false).length,
    0
  );

  return (
    <div className="space-y-5">
      {/* Filter bar Aktif / Nonaktif */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-3.5 border border-[var(--color-surface-dark)] shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {(
            [
              { key: "ALL", label: `Semua (${totalAktif + totalNonaktif})` },
              { key: "ACTIVE", label: `Aktif (${totalAktif})` },
              { key: "INACTIVE", label: `Nonaktif (${totalNonaktif})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition border ${
                statusFilter === tab.key
                  ? "bg-[var(--color-primary)] text-white border-transparent shadow-sm"
                  : "bg-[var(--color-secondary)] text-[var(--color-text-muted)] border-[var(--color-surface-dark)] hover:bg-[var(--color-surface)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="text-[11px] font-medium text-[var(--color-text-muted)]">
          Kelas <strong>Nonaktif</strong> otomatis disembunyikan dari Alokasi Kelas, Absen, Jadwal Mengajar, Input Nilai &amp; Cetak Usbu&apos; tanpa mengubah riwayat.
        </p>
      </div>

      {noticeMsg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-xs font-semibold text-emerald-800 flex items-center justify-between gap-3">
          <span>{noticeMsg}</span>
          <button
            type="button"
            onClick={() => setNoticeMsg(null)}
            className="text-emerald-600 hover:text-emerald-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {programList.map((program) => {
          const visibleKelas = program.kelasList.filter((k) => {
            if (statusFilter === "ACTIVE") return k.isActive !== false;
            if (statusFilter === "INACTIVE") return k.isActive === false;
            return true;
          });
          return (
          <div key={program.id} className="neu-card-white p-6">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-xl font-bold text-[var(--color-text)] truncate">{program.nama_indo}</h3>
                <p className="text-sm tracking-wide text-[var(--color-text-muted)] truncate">{program.nama_arab}</p>
              </div>
              {/* Tombol + langsung di setiap kartu */}
              <button
                onClick={() =>
                  setInlineAddProgramId((prev) => (prev === program.id ? null : program.id))
                }
                className="shrink-0 flex items-center gap-1.5 rounded-full bg-[var(--color-primary-50)] px-3 py-1.5 text-xs font-bold text-[var(--color-primary)] hover:bg-[var(--color-primary-100)] border border-[var(--color-primary-100)] transition"
              >
                <Plus className="h-3.5 w-3.5" />
                Tambah
              </button>
            </div>

            <div className="space-y-2">
              {visibleKelas.length === 0 ? (
                <p className="text-sm italic text-[var(--color-text-subtle)]">
                  {program.kelasList.length === 0 ? "Belum ada ruangan" : "Tidak ada kelas sesuai filter"}
                </p>
              ) : (
                visibleKelas.map((kelas) => {
                  const isAktif = kelas.isActive !== false;
                  return (
                  <div
                    key={kelas.id}
                    className={`flex items-center justify-between gap-2 rounded-2xl px-3.5 py-2.5 border transition-colors ${
                      isAktif
                        ? "bg-[var(--color-secondary)] border-[var(--color-surface)] hover:border-[var(--color-surface-dark)]"
                        : "bg-gray-100/80 border-dashed border-gray-300 opacity-80"
                    }`}
                  >
                    <span
                      className={`font-semibold text-sm leading-snug min-w-0 flex-1 break-words ${
                        isAktif ? "text-[var(--color-text)]" : "text-gray-500 line-through"
                      }`}
                    >
                      {kelas.nama}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(kelas.id, kelas.nama, !isAktif)}
                        disabled={isPending}
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold flex items-center gap-1 transition disabled:opacity-50 ${
                          isAktif
                            ? "bg-emerald-100 text-emerald-700 hover:bg-amber-100 hover:text-amber-800 border border-emerald-200 hover:border-amber-200"
                            : "bg-gray-200 text-gray-600 hover:bg-emerald-100 hover:text-emerald-700 border border-gray-300 hover:border-emerald-200"
                        }`}
                        title={isAktif ? "Status Aktif — klik untuk nonaktifkan" : "Status Nonaktif — klik untuk aktifkan kembali"}
                      >
                        {isAktif ? <Power className="h-3 w-3" /> : <PowerOff className="h-3 w-3" />}
                        <span>{isAktif ? "Aktif" : "Nonaktif"}</span>
                      </button>
                      <button
                        onClick={() => openEditModal(kelas.id, kelas.nama, program.id)}
                        disabled={isPending}
                        className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-dark)] hover:text-[var(--color-primary)] disabled:opacity-50"
                        title="Edit"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(kelas.id, kelas.nama)}
                        disabled={isPending}
                        className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-danger-light)] hover:text-[var(--color-danger)] disabled:opacity-50"
                        title="Hapus kelas (riwayat lama tetap aman)"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  );
                })
              )}
            </div>

            {/* Inline add form muncul di bawah daftar kelas */}
            {inlineAddProgramId === program.id && (
              <InlineAddKelas
                programId={program.id}
                programNama={program.nama_indo}
                onSaved={() => {
                  setInlineAddProgramId(null);
                  router.refresh();
                }}
              />
            )}
          </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-text)]/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-[var(--radius-2xl)] neu-card">
            <div className="flex items-center justify-between border-b border-[var(--color-surface)] px-6 py-4">
              <h3 className="text-lg font-bold text-[var(--color-text)]">Edit Nama Kelas</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="rounded-full p-2 text-[var(--color-text-subtle)] transition-colors hover:bg-[var(--color-surface)] hover:text-[var(--color-text-muted)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {errorMsg && (
                <div className="flex gap-2 rounded-2xl bg-[var(--color-danger-light)] p-4 text-sm font-medium text-[var(--color-danger)] border border-[var(--color-danger-light)]">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p>{errorMsg}</p>
                </div>
              )}
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">Program / Induk</span>
                <select
                  value={formProgramId}
                  onChange={(e) => setFormProgramId(e.target.value)}
                  className="w-full rounded-2xl border border-[var(--color-surface-dark)] bg-[var(--color-secondary)] px-4 py-3 text-base font-medium text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:bg-white"
                >
                  <option value="">-- Pilih Induk Program --</option>
                  {programList.map((p) => (
                    <option key={p.id} value={p.id}>{p.nama_indo}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-[var(--color-text)]">Nama Kelas (Ruangan)</span>
                <input
                  type="text"
                  placeholder={`Contoh: ${activeIndo} A, ${activeIndo} B`}
                  value={formNama}
                  onChange={(e) => setFormNama(e.target.value)}
                  className="w-full rounded-2xl border border-[var(--color-surface-dark)] bg-[var(--color-secondary)] px-4 py-3 text-base font-medium text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:bg-white"
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-[var(--color-surface)] bg-[var(--color-secondary)] px-6 py-4">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-dark)]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending || !formNama || !formProgramId}
                className="flex items-center gap-2 rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--color-primary-dark)] disabled:opacity-50"
              >
                {isPending ? <span>Menyimpan...</span> : <><Save className="h-4 w-4" /><span>Simpan</span></>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
