"use client";

import { useState, useEffect, useRef } from "react";
import { Plus, Edit2, Trash2, CheckCircle2, Save, GripVertical, FileSpreadsheet, Activity, Bold, Underline, Image as ImageIcon, Loader2, Eye, X, ChevronLeft, ChevronRight, Grid3X3, Info } from "lucide-react";
import toast from "react-hot-toast";
import SoalText from "@/components/soal-text";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { detectTextDirection } from "@/lib/text-direction";
import QuestionRenderer from "@/components/ujian/QuestionRenderer";

// Sortable Row Component for Drag and Drop options or questions
function SortableItem({ id, children, className }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className={className}>
      <div {...attributes} {...listeners} className="cursor-grab hover:text-[var(--color-primary)] px-2">
        <GripVertical size={18} className="text-gray-400" />
      </div>
      {children}
    </div>
  );
}

const TIPE_SOAL_INFO: Record<string, string> = {
  PG: "Soal pilihan ganda klasik. Santri memilih 1 jawaban benar dari opsi A, B, C, D.",
  PG_MULTI: "Pilihan ganda kompleks. Santri dapat memilih lebih dari 1 opsi benar.",
  BENAR_SALAH: "Pernyataan yang harus dihakimi Benar atau Salah.",
  ISIAN_SAMPING: "Opsi jawaban (3 pill) muncul MENDAMPINGI pertanyaan. Cocok untuk soal per-item terpisah. Maksimal 3 opsi.",
  ISIAN_BAWAH: "Opsi jawaban dikumpulkan menjadi BANK KATA di bawah semua pertanyaan. Cocok untuk teks rumpang.",
  MUFRODAT: "Tampilan grid menarik untuk memilih kosakata / terjemahan yang tepat.",
  ESSAY_SINGKAT: "Kolom jawaban teks pendek (1-2 baris).",
  PARAGRAF_RUMPANG: "Satu wacana penuh dengan lubang-lubang blank. Gunakan {{1}}, {{2}} untuk menandai posisi blank yang santri akan isi teks.",
  IDENTIFIKASI_KESALAHAN: "Memecah satu kalimat menjadi beberapa kata. Santri akan men-tap/klik kata yang tata bahasanya (grammar) salah.",
  ESSAY_PANJANG: "Jawaban paragraf yang akan dikoreksi otomatis (AI Grading) berdasar referensi Kunci Jawaban.",
  MENJODOHKAN: "Menarik garis (drag n drop) dari Kolom Kanan ke Kolom Kiri agar berpasangan.",
  MENGURUTKAN: "Menyusun ulang acakan kotak secara vertikal atau horizontal ke urutan yang presisi.",
  KITABAH: "Menggeser serpihan potongan huruf Arab (drag n drop) agar terangkai mufrodat yang utuh.",
  DRAG_KATEGORI: "Menyeret item kata ke dalam keranjang kategori spesifik.",
  TABEL_TASRIF: "Tabel dinamis baris × kolom. Beberapa sel dikosongkan (blank) untuk diisi santri. Sangat cocok untuk menghafal Wazan Shorof/Nahwu.",
  SUSUN_HURUF: "Huruf/potongan kata rumpang dalam kondisi acak. Santri harus mengetuk/menyeretnya satu demi satu menjadi mufrodat yang utuh.",
  DRAG_TO_BLANK: "Santri diarahkan menarik (drag) kosa kata dari Bank Kata menuju lubang rumpang di dalam sebuah paragraf. (Evolusi Cloze Test).",
  STABILO_SYNTAX: "Pilihlah warna (kategori) yang tepat lalu stabilo/warnai kata dalam kalimat Arab yang memiliki status jabatan tersebut. (Ex: Fi'il Biru, Isim Merah).",
  JARING_RELASI: "Pencocokan rumit (Complex Matching). Satu item di kiri bisa dihubungkan kebanyak item di kanan membentuk jaring-jaring."
};

const TIPE_SOAL_MAP: Record<string, string> = {
  PG: "Pilihan Ganda",
  PG_MULTI: "Pilihan Ganda (Multi)",
  BENAR_SALAH: "Benar / Salah",
  ISIAN_SAMPING: "Isi Kosong (Opsi Samping)",
  ISIAN_BAWAH: "Isi Kosong (Opsi Bawah)",
  MUFRODAT: "Pilih Mufrodat",
  ESSAY_SINGKAT: "Essay Singkat",
  ESSAY_PANJANG: "Essay Panjang (AI Grading)",
  MENJODOHKAN: "Menjodohkan",
  MENGURUTKAN: "Mengurutkan",
  KITABAH: "Kitabah Merangkai Huruf",
  DRAG_KATEGORI: "Drag & Drop Kategori",
  PARAGRAF_RUMPANG: "Paragraf Rumpang",
  IDENTIFIKASI_KESALAHAN: "Identifikasi Kesalahan",
  TABEL_TASRIF: "Tabel Matrix",
  SUSUN_HURUF: "Susun Huruf",
  DRAG_TO_BLANK: "Drag to Blank",
  STABILO_SYNTAX: "Stabilo Syntax / I'rab",
  JARING_RELASI: "Jaring Relasi Kata"
};

function EditorDiv({ value, onChange, dir, className, id }: any) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only set innerHTML if it's strictly different from external value (prevents cursor jumping)
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  return (
    <div
      id={id}
      ref={editorRef}
      contentEditable
      dir={dir}
      className={className}
      onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
      onBlur={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
      suppressContentEditableWarning
    />
  );
}

export default function BankSoalPage() {
  const [programList, setProgramList] = useState<any[]>([]);
  const [selectedProgram, setSelectedProgram] = useState("");
  const [selectedMapel, setSelectedMapel] = useState("");
  const [selectedUsbu, setSelectedUsbu] = useState("1"); // only used for testing/legacy or defaults? Actually we'll use it for Preview default.
  // const [selectedPaketSoal, setSelectedPaketSoal] = useState("A"); removed
  const [jenisSoalList, setJenisSoalList] = useState<any[]>([]);
  const [selectedJenisSoal, setSelectedJenisSoal] = useState("");
  const [isAddJenisModalOpen, setIsAddJenisModalOpen] = useState(false);
  const [addJenisSoalTipe, setAddJenisSoalTipe] = useState("PG");
  const [instruksiText, setInstruksiText] = useState("");
  const [savingInstruksi, setSavingInstruksi] = useState(false);
  
  // Batch Assignment Statee
  const [selectedSoalIds, setSelectedSoalIds] = useState<string[]>([]);
  const [mapelOptions, setMapelOptions] = useState<any[]>([]);

  const [soalList, setSoalList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSoal, setLoadingSoal] = useState(false);

  // Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importTimpa, setImportTimpa] = useState(false);
  const [importing, setImporting] = useState(false);

  // Preview State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [previewIdx, setPreviewIdx] = useState(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [showPreviewNav, setShowPreviewNav] = useState(false);
  const [previewAnswers, setPreviewAnswers] = useState<any>({});
  const [showCheck, setShowCheck] = useState(false);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [manualDir, setManualDir] = useState<'rtl' | 'ltr' | 'auto' | null>(null);
  const [formData, setFormData] = useState<any>({
    id: "",
    tipeSoal: "PG",
    pertanyaan: "",
    gambarUrl: "",
    bobot: 10,
    perintah: "",
    kunciJawaban: "",
    dataTambahan: {},
    jawabanList: [
      { id: "opt-1", teks: "", gambarUrl: "", isCorrect: true },
      { id: "opt-2", teks: "", gambarUrl: "", isCorrect: false },
      { id: "opt-3", teks: "", gambarUrl: "", isCorrect: false },
      { id: "opt-4", teks: "", gambarUrl: "", isCorrect: false }
    ]
  });
  const [isUploadingImg, setIsUploadingImg] = useState(""); // "soal" or opt id

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    if (selectedProgram) {
      const prog = programList.find(p => p.id === selectedProgram);
      if (prog) {
        setMapelOptions(prog.programMapels || []);
        if (prog.programMapels?.length > 0 && !selectedMapel) {
          setSelectedMapel(prog.programMapels[0].mapelId);
        }
      }
    }
  }, [selectedProgram, programList]);

  useEffect(() => {
    if (selectedMapel && selectedProgram) {
      fetchJenisSoal();
    } else {
      setJenisSoalList([]);
      setSelectedJenisSoal("");
      setSoalList([]);
    }
  }, [selectedMapel, selectedProgram]);

  useEffect(() => {
    if (selectedMapel && selectedProgram && selectedJenisSoal) {
      const active = jenisSoalList.find(j => j.id === selectedJenisSoal);
      setInstruksiText(active?.instruksi || "");
      fetchSoal();
    } else {
      setSoalList([]);
    }
  }, [selectedMapel, selectedProgram, selectedJenisSoal]);

  const fetchJenisSoal = async () => {
    try {
      const res = await fetch(`/api/admin/ujian-usbu/jenis-soal?mapelId=${selectedMapel}`);
      if (res.ok) {
        const data = await res.json();
        setJenisSoalList(data);
        if (data.length > 0) setSelectedJenisSoal(data[0].id);
        else setSelectedJenisSoal("");
      }
    } catch {
      toast.error("Gagal load jenis soal");
    }
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const progRes = await fetch("/api/admin/program?bypassFilter=true");
      const progData = await progRes.json();
      setProgramList(progData || []);

      if (progData?.length > 0) {
        setSelectedProgram(progData[0].id);
        const mapels = progData[0].programMapels;
        if (mapels?.length > 0) setSelectedMapel(mapels[0].mapelId);
      }
    } catch {
      toast.error("Gagal load initial data");
    } finally {
      setLoading(false);
    }
  };

  const fetchSoal = async () => {
    setLoadingSoal(true);
    try {
      const res = await fetch(`/api/admin/ujian-usbu/bank-soal?programId=${selectedProgram}&mapelId=${selectedMapel}&jenisSoalId=${selectedJenisSoal}`);
      if (res.ok) setSoalList(await res.json());
      else setSoalList([]);
    } catch {
      toast.error("Gagal load soal");
    } finally {
      setLoadingSoal(false);
    }
  };

  const handleAddJenisSoal = () => {
    setAddJenisSoalTipe("PG");
    setIsAddJenisModalOpen(true);
  };

  const handleAddJenisSoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/ujian-usbu/jenis-soal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mapelId: selectedMapel, nama: addJenisSoalTipe })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Berhasil menambahkan jenis soal");
      setIsAddJenisModalOpen(false);
      fetchJenisSoal();
    } catch (err: any) {
      toast.error(err.message || "Gagal menambah jenis soal");
    }
  };

  const handleUpdateInstruksi = async () => {
    if (!selectedJenisSoal) return;
    setSavingInstruksi(true);
    try {
      const res = await fetch(`/api/admin/ujian-usbu/jenis-soal/${selectedJenisSoal}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruksi: instruksiText })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Instruksi berhasil disimpan");
      fetchJenisSoal();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyinmpan instruksi");
    } finally {
      setSavingInstruksi(false);
    }
  };

  const handleDeleteJenisSoal = async (id: string) => {
    if (!confirm("Hapus jenis soal ini? Semua soal di dalamnya akan ikut lenyap (atau tidak tampil).")) return;
    try {
      const res = await fetch(`/api/admin/ujian-usbu/jenis-soal/${id}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Berhasil menghapus jenis soal");
      fetchJenisSoal();
    } catch (err: any) {
      toast.error(err.message || "Gagal menghapus jenis soal");
    }
  };

  const handleCreateNew = () => {
    if (!selectedProgram || !selectedMapel || !selectedJenisSoal) return toast.error("Pilih Program, Mapel, dan Jenis Soal terlebih dahulu");
    const activeJenis = jenisSoalList.find(j => j.id === selectedJenisSoal);
    const tipeToUse = activeJenis?.nama || "PG";

    setFormData({
      id: "",
      tipeSoal: tipeToUse,
      jenisSoalId: selectedJenisSoal,
      // usbuKe & paketSoal fallback hidden
      pertanyaan: "",
      gambarUrl: "",
      grupSoalId: "",
      bobot: 10,
      perintah: "",
      kunciJawaban: "",
      dataTambahan: {},
      jawabanList: [
        { id: `opt-${Date.now()}-1`, teks: "", gambarUrl: "", isCorrect: true },
        { id: `opt-${Date.now()}-2`, teks: "", gambarUrl: "", isCorrect: false },
        { id: `opt-${Date.now()}-3`, teks: "", gambarUrl: "", isCorrect: false },
        { id: `opt-${Date.now()}-4`, teks: "", gambarUrl: "", isCorrect: false }
      ]
    });
    setManualDir(null);
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = (soal: any) => {
    setFormData({
      id: soal.id,
      tipeSoal: soal.tipeSoal,
      jenisSoalId: selectedJenisSoal,
      pertanyaan: soal.pertanyaan,
      gambarUrl: soal.gambarUrl || "",
      grupSoalId: soal.grupSoalId || "",
      bobot: soal.bobot,
      perintah: soal.perintah || "",
      kunciJawaban: soal.kunciJawaban || "",
      dataTambahan: soal.dataTambahan || {},
      // pad with empty answers if less than 4, map existing IDs for drag and drop
      jawabanList: [...soal.opsiList, ...Array(4).fill(null)].slice(0, 4).map((j: any, i: number) =>
        j ? { id: j.id || `opt-${i}`, teks: j.teks, gambarUrl: j.gambarUrl || "", isCorrect: j.isCorrect } : { id: `opt-new-${i}`, teks: "", gambarUrl: "", isCorrect: false }
      )
    });
    setManualDir(null);
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const handleUploadImage = async (e: React.ChangeEvent<HTMLInputElement>, target: "soal" | string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) return toast.error("Ukuran gambar maksimal 2MB");

    setIsUploadingImg(target);
    const formDataUpload = new FormData();
    formDataUpload.append("file", file);

    try {
      const res = await fetch("/api/admin/ujian-usbu/bank-soal/upload-image", { method: "POST", body: formDataUpload });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (target === "soal") {
        setFormData((prev: any) => ({ ...prev, gambarUrl: data.url }));
      } else {
        setFormData((prev: any) => ({
          ...prev,
          jawabanList: prev.jawabanList.map((j: any) => j.id === target ? { ...j, gambarUrl: data.url } : j)
        }));
      }
      toast.success("Gambar berhasil diupload!");
    } catch (err: any) {
      toast.error(err.message || "Gagal upload gambar");
    } finally {
      setIsUploadingImg("");
      e.target.value = ""; // reset input
    }
  };

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setFormData((prev: any) => {
        const oldIndex = prev.jawabanList.findIndex((item: any) => item.id === active.id);
        const newIndex = prev.jawabanList.findIndex((item: any) => item.id === over.id);
        return {
          ...prev,
          jawabanList: arrayMove(prev.jawabanList, oldIndex, newIndex),
        };
      });
    }
  };

  const handleSaveSoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMapel || !selectedProgram) return toast.error("Pilih mapel dan program dulu");

    // Validasi
    let validJawaban = formData.jawabanList.filter((j: any) => j.teks?.trim() !== "" || !!j.gambarUrl);

    const isPilihanGanda = ["PG", "PG_MULTI", "BENAR_SALAH", "MUFRODAT", "ISIAN_SAMPING", "ISIAN_BAWAH"].includes(formData.tipeSoal);
    if (isPilihanGanda) {
      const hasCorrect = formData.jawabanList.some((j: any) => j.isCorrect);
      if (!hasCorrect) return toast.error("Harus ada 1 jawaban benar!");
      if (validJawaban.length < 2) return toast.error("Minimal 2 pilihan jawaban yang valid");
    } else {
      // Kosongkan opsiList untuk essay & interaktif
      validJawaban = [];
    }

    const method = isEditing ? "PUT" : "POST";
    const url = isEditing ? `/api/admin/ujian-usbu/bank-soal/${formData.id}` : "/api/admin/ujian-usbu/bank-soal";

    const payload = {
      mapelId: selectedMapel,
      programId: selectedProgram,
      jenisSoalId: selectedJenisSoal,
      tipeSoal: formData.tipeSoal,
      pertanyaan: formData.pertanyaan,
      gambarUrl: formData.gambarUrl || null,
      grupSoalId: formData.grupSoalId || null,
      bobot: Number(formData.bobot),
      perintah: formData.perintah || null,
      kunciJawaban: formData.kunciJawaban || null,
      dataTambahan: Object.keys(formData.dataTambahan || {}).length > 0 ? formData.dataTambahan : null,
      opsiList: validJawaban
    };

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(isEditing ? "Soal berhasil diupdate!" : "Soal berhasil ditambahkan!");
      setIsModalOpen(false);
      fetchSoal();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus soal ini? (Data yang dihapus tidak bisa dikembalikan)")) return;
    try {
      const res = await fetch(`/api/admin/ujian-usbu/bank-soal/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success("Soal berhasil dihapus");
      fetchSoal();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggleAssignment = async (soalId: string, usbuKe: number, isChecked: boolean) => {
    try {
      const url = isChecked
        ? "/api/admin/ujian-usbu/bank-soal/assign"
        : "/api/admin/ujian-usbu/bank-soal/assign";
      const method = isChecked ? "POST" : "DELETE";

      // Update optimistic state
      setSoalList(prev => prev.map(s => {
        if (s.id === soalId) {
          const newAssigns = [...(s.usbuAssignments || [])];
          if (isChecked) newAssigns.push({ usbuKe });
          else {
            const idx = newAssigns.findIndex(ua => ua.usbuKe === usbuKe);
            if (idx > -1) newAssigns.splice(idx, 1);
          }
          return { ...s, usbuAssignments: newAssigns };
        }
        return s;
      }));

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soalIds: [soalId], usbuKe })
      });

      if (!res.ok) throw new Error((await res.json()).error);
    } catch (err: any) {
      toast.error(err.message || "Gagal mengubah assignment soal");
      fetchSoal(); // rollback on error
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile || !selectedMapel || !selectedProgram) return toast.error("File, sesi, dan program wajib diisi.");

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("mapelId", selectedMapel);
      formData.append("programId", selectedProgram);
      formData.append("jenisSoalId", selectedJenisSoal);
      formData.append("usbuKe", "1"); // legacy fallback
      formData.append("paketSoal", "A"); // legacy fallback
      formData.append("timpaSoal", importTimpa.toString());

      const res = await fetch("/api/admin/ujian-usbu/bank-soal/import", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast.success(`Berhasil mengimport ${data.count} soal.`);
      setIsImportModalOpen(false);
      setImportFile(null);
      fetchSoal();
    } catch (err: any) {
      toast.error(err.message || "Gagal import excel");
    } finally {
      setImporting(false);
    }
  };

  const handlePreview = async () => {
    if (!selectedProgram) return toast.error("Pilih program terlebih dahulu");
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/admin/ujian-usbu/bank-soal/preview?programId=${selectedProgram}&usbuKe=${selectedUsbu}`);
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      if (data.soal.length === 0) return toast.error("Tidak ada soal untuk dikonfigurasi pratinjau ini.");
      setPreviewData(data);
      setPreviewIdx(0);
      setPreviewAnswers({});
      setShowCheck(false);
      setIsPreviewOpen(true);
      document.documentElement.requestFullscreen?.().catch(() => { });
    } catch (err: any) {
      toast.error(err.message || "Gagal memuat pratinjau");
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    setIsPreviewOpen(false);
    setPreviewData(null);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => { });
  };

  const handleResetAssign = async () => {
    if (!selectedProgram || !selectedMapel) return toast.error("Pilih Program dan Mapel dahulu");
    if (!confirm(`Yakin ingin MENGHAPUS SEMUA penugasan soal (dari seluruh Jenis Soal pada Mapel ini) untuk Usbu' ${selectedUsbu}? Soal tidak akan dihapus, hanya checklist-nya saja yang direset.`)) return;

    try {
      const res = await fetch(`/api/admin/ujian-usbu/bank-soal/reset-assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId: selectedProgram,
          mapelId: selectedMapel,
          usbuKe: Number(selectedUsbu)
        })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(`Berhasil mereset penugasan soal untuk Usbu' ${selectedUsbu}`);
      fetchSoal();
    } catch (err: any) {
      toast.error(err.message || "Gagal mereset penugasan");
    }
  };

  const handleAutoBobot = async () => {
    if (soalList.length === 0) return toast.error("Belum ada soal untuk dihitung");
    const bobotPerSoal = Number((100 / soalList.length).toFixed(2));
    const msg = `Atur bobot semua ${soalList.length} soal menjadi ${bobotPerSoal} poin per soal? (Total ≈ ${(bobotPerSoal * soalList.length).toFixed(2)})`;
    if (!confirm(msg)) return;

    try {
      const res = await fetch(`/api/admin/ujian-usbu/bank-soal/auto-bobot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programId: selectedProgram,
          mapelId: selectedMapel,
          jenisSoalId: selectedJenisSoal,
          bobot: bobotPerSoal
        })
      });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success(`Bobot semua ${soalList.length} soal di-set ke ${bobotPerSoal} poin`);
      fetchSoal();
    } catch (err: any) {
      toast.error(err.message || "Gagal update bobot");
    }
  };

  if (loading) return <div>Memuat data bank soal...</div>;

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display" style={{ color: "var(--color-text)" }}>Bank Soal CBT Usbu'</h1>
          <p className="text-sm mt-1" style={{ color: "var(--color-text-subtle)" }}>Kelola bank soal untuk masing-masing program dan mata pelajaran</p>
        </div>
      </div>

      <div className="neu-card rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-muted)" }}>Program</label>
          <select value={selectedProgram} onChange={e => setSelectedProgram(e.target.value)} className="neu-input w-full py-2.5 text-sm font-semibold">
            {programList.map(p => <option key={p.id} value={p.id}>{p.nama_indo}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "var(--color-text-muted)" }}>Mata Pelajaran</label>
          <select value={selectedMapel} onChange={e => setSelectedMapel(e.target.value)} className="neu-input w-full py-2.5 text-sm font-semibold">
            <option value="">-- Pilih Mapel --</option>
            {mapelOptions.map(m => (
              <option key={m.mapel.id} value={m.mapel.id}>
                {m.mapel.nama_indo} (Tes: {m.mapel.jumlah_tes}x)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs Jenis Soal */}
      {selectedMapel && (
        <div className="flex flex-col gap-3 mb-6 bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-gray-700 uppercase tracking-wider text-xs">Jenis Soal</h3>
            <button onClick={handleAddJenisSoal} className="text-xs font-bold text-[var(--color-primary)] hover:underline flex items-center gap-1">
              <Plus size={14} /> Tambah Jenis Soal
            </button>
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {jenisSoalList.map(js => (
              <div key={js.id} className="relative group">
                <button
                  onClick={() => setSelectedJenisSoal(js.id)}
                  className={`px-5 py-2 rounded-xl font-bold text-sm transition-all border-2 ${selectedJenisSoal === js.id
                    ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-md'
                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:border-gray-300'
                    }`}
                >
                  {TIPE_SOAL_MAP[js.nama] || js.nama}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteJenisSoal(js.id);
                  }}
                  className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity border border-red-200 hover:bg-red-500 hover:text-white"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
            {jenisSoalList.length === 0 && (
              <div className="text-sm font-medium text-gray-400 italic py-2">Belum ada jenis soal. Klik &apos;Tambah Jenis Soal&apos;.</div>
            )}
          </div>
          
          {selectedJenisSoal && (
            <div className="mt-4 p-4 border border-blue-100 bg-blue-50/30 rounded-xl flex flex-col md:flex-row gap-3 md:items-end">
               <div className="flex-1">
                 <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">Instruksi Global (Opsional, Ditampilkan pada setiap soal di Ujian Santri)</label>
                 <input 
                   type="text" 
                   value={instruksiText}
                   onChange={(e) => setInstruksiText(e.target.value)}
                   placeholder="Contoh: Pilihlah jawaban yang paling benar!"
                   className="neu-input w-full p-2.5 text-sm outline-none border border-gray-200 focus:border-blue-400 focus:bg-white"
                 />
               </div>
               <button 
                 onClick={handleUpdateInstruksi}
                 disabled={savingInstruksi}
                 className="px-5 py-2.5 bg-blue-100 text-blue-700 font-bold text-sm rounded-lg hover:bg-blue-200 transition-colors shrink-0 disabled:opacity-50"
               >
                 {savingInstruksi ? "Menyimpan..." : "Simpan Instruksi"}
               </button>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 bg-gray-50 border border-gray-100 p-4 rounded-xl">
        <div className="flex gap-4 items-center">
          <h2 className="font-bold text-lg" style={{ color: "var(--color-text)" }}>Daftar Soal ({soalList.length})</h2>
          <div className="hidden md:flex items-center gap-2 bg-[var(--color-primary-50)] text-[var(--color-primary)] px-3 py-1 rounded-xl text-xs font-bold">
            <Activity size={14} /> Total Poin: {Number(soalList.reduce((sum, s) => sum + s.bobot, 0).toFixed(2))}
          </div>
          {soalList.length > 0 && (
            <button onClick={handleAutoBobot} className="hidden md:flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors border border-amber-200 shadow-sm">
              ⚖️ Auto Bobot (100/{soalList.length})
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Actions Usbu */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-gray-200 shadow-sm mr-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase">Target Usbu:</label>
            <select
              value={selectedUsbu}
              onChange={(e) => setSelectedUsbu(e.target.value)}
              className="neu-input py-1 px-2 text-xs font-bold w-16 cursor-pointer"
            >
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>
            <button onClick={handlePreview} disabled={!selectedProgram || previewLoading} className="font-bold text-xs px-2 py-1 bg-purple-50 text-purple-700 rounded-md hover:bg-purple-100 transition-colors flex gap-1 items-center shadow-sm disabled:opacity-50" title="Lihat pratinjau seluruh soal yang telah ditugaskan ke Usbu ini (Semua Jenis Soal)">
              {previewLoading ? <Loader2 size={12} className="animate-spin" /> : <Eye size={12} />} Pratinjau
            </button>
            <button onClick={handleResetAssign} disabled={!selectedProgram} className="font-bold text-xs px-2 py-1 bg-red-50 text-red-700 rounded-md hover:bg-red-100 transition-colors flex gap-1 items-center shadow-sm" title="Hapus semua penugasan soal dari mapel ini untuk Usbu yang dipilih">
              <Trash2 size={12} /> Reset Pilihan
            </button>
          </div>
          <button onClick={() => setIsImportModalOpen(true)} disabled={!selectedMapel || !selectedProgram} className="font-bold text-sm px-3 py-2 bg-green-50 text-green-700 rounded-xl hover:bg-green-100 transition-colors flex gap-1 items-center shadow-sm">
            <FileSpreadsheet size={16} /> Import
          </button>
          <button onClick={handleCreateNew} disabled={!selectedMapel || !selectedProgram || !selectedJenisSoal} className="neu-button-primary px-3 py-2 flex items-center justify-center gap-1 rounded-xl text-sm font-bold shadow-sm">
            <Plus size={16} /> Tambah Soal
          </button>
        </div>
      </div>

      {loadingSoal ? (
        <div className="py-12 text-center text-sm font-medium" style={{ color: "var(--color-text-subtle)" }}>
          <div className="w-8 h-8 rounded-full border-t-2 border-[var(--color-primary)] animate-spin mx-auto mb-3"></div>
          Memuat soal...
        </div>
      ) : soalList.length === 0 ? (
        <div className="neu-card border-dashed p-12 text-center rounded-2xl bg-white shadow-sm">
          <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
            <Activity size={32} className="text-gray-300" />
          </div>
          <h3 className="font-bold text-lg text-gray-700">Belum Ada Soal</h3>
          <p className="mt-2 text-sm text-gray-500 mb-6 max-w-md mx-auto">Anda belum menambahkan soal untuk mata pelajaran ini. Silakan tambahkan soal secara manual atau import dari file Excel.</p>
          <button onClick={handleCreateNew} disabled={!selectedMapel || !selectedProgram} className="neu-button-primary px-6 py-2.5 rounded-xl font-bold text-sm inline-flex items-center gap-2">
            <Plus size={16} /> Buat Soal Pertama
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(
            soalList.reduce((acc: any, soal: any) => {
              if (!acc[soal.tipeSoal]) acc[soal.tipeSoal] = [];
              acc[soal.tipeSoal].push(soal);
              return acc;
            }, {})
          ).map(([tipe, groupSoals]: [string, any]) => (
            <div key={tipe} className="space-y-4">
              <div className="border-b pb-2 mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold text-lg text-gray-800 uppercase tracking-wide">
                    {tipe.replace(/_/g, ' ')}
                  </h3>
                  <span className="text-xs font-bold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{groupSoals.length} Soal</span>
                </div>
                {groupSoals[0]?.perintah && (
                  <p className="text-sm font-medium text-gray-500 italic">
                    Instruksi: &quot;{groupSoals[0].perintah}&quot;
                  </p>
                )}
              </div>
              <div className="space-y-5">
                {groupSoals.map((soal: any, index: number) => (
                  <div key={soal.id} className="neu-card-white p-0 rounded-2xl transition-all relative overflow-hidden group hover:shadow-md">
                    <div className="absolute top-0 right-0 p-3 flex gap-2 transition-opacity z-10">
                      <button onClick={() => handleEdit(soal)} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors shadow-sm"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(soal.id)} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors shadow-sm"><Trash2 size={16} /></button>
                    </div>

                    <div className="p-6">
                      <div className="flex gap-4 items-start">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white bg-[var(--color-primary)]">
                          {index + 1}
                        </div>
                        <div className="flex-1 pr-20">
                          <div className="flex gap-3 mb-3 items-center flex-wrap">
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">ID: {soal.id.substring(soal.id.length - 5)}</span>
                            <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-orange-100 text-orange-600">Bobot: {Number.isInteger(soal.bobot) ? soal.bobot : soal.bobot.toFixed(2)} Poin</span>
                            {/* Indikator Grup Qiro'ah */}
                            {soal.grupSoalId ? (
                              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-purple-100 text-purple-600 flex gap-1 items-center" title="Pertanyaan turunan dari bacaan lain">
                                <Activity size={12} /> Anak Qiro&apos;ah
                              </span>
                            ) : soalList.some((s: any) => s.grupSoalId === soal.id) ? (
                              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-purple-600 text-white flex gap-1 items-center" title="Soal ini digunakan sebagai bacaan induk untuk soal lain">
                                <Activity size={12} /> Induk Qiro&apos;ah
                              </span>
                            ) : null}
                          </div>

                          {soal.perintah && (
                            <p className="text-xs text-gray-500 font-bold mb-2">Perintah: {soal.perintah}</p>
                          )}

                          {soal.gambarUrl && (
                            <div className="mb-4">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={soal.gambarUrl} alt="Soal Image" className="max-w-full h-auto max-h-32 object-contain rounded-lg border shadow-sm" />
                            </div>
                          )}
                          <SoalText html={soal.pertanyaan} className="font-semibold text-base leading-relaxed mb-4 whitespace-pre-wrap text-gray-800 block" />

                          {soal.kunciJawaban && (
                            <div className="mb-4 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                              <span className="text-xs font-bold text-blue-800 block mb-1">Kunci Jawaban:</span>
                              <p className="text-sm text-blue-900 whitespace-pre-wrap">{soal.kunciJawaban}</p>
                            </div>
                          )}

                          {/* Visualisasi Data Tambahan */}
                          {soal.dataTambahan && Object.keys(soal.dataTambahan).length > 0 && (
                            <div className="mb-4">
                              {soal.tipeSoal === "MENJODOHKAN" && (
                                <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
                                  <h4 className="text-xs font-bold text-orange-800 mb-2 uppercase tracking-wider block">Pasangan Menjodohkan:</h4>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                                    {(soal.dataTambahan.lefts || []).map((l: string, i: number) => (
                                      <div key={i} className="flex bg-white rounded border border-orange-100">
                                        <div className="flex-1 p-2 border-r border-orange-100 break-words" dir="auto">{l}</div>
                                        <div className="w-8 shrink-0 flex items-center justify-center bg-orange-100 text-orange-600 font-bold">↔</div>
                                        <div className="flex-1 p-2 break-words" dir="auto">{soal.dataTambahan.rights?.[i] || ""}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {soal.tipeSoal === "MENGURUTKAN" && (
                                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                                  <h4 className="text-xs font-bold text-indigo-800 mb-2 uppercase tracking-wider block">Kunci Urutan:</h4>
                                  <ol className="list-decimal list-inside space-y-1">
                                    {(soal.dataTambahan.items || []).map((item: string, i: number) => (
                                      <li key={i} className="text-sm bg-white p-2 border border-indigo-100 rounded shadow-sm break-words" dir="auto">
                                        {item}
                                      </li>
                                    ))}
                                  </ol>
                                </div>
                              )}

                              {soal.tipeSoal === "KITABAH" && (
                                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                                  <h4 className="text-xs font-bold text-amber-800 mb-2 uppercase tracking-wider block">Blok Huruf/Kata:</h4>
                                  <div className="flex flex-wrap gap-2" dir="rtl">
                                    {(soal.dataTambahan.huruf || []).map((h: string, i: number) => (
                                      <span key={i} className="px-3 py-2 bg-white border border-amber-200 rounded-lg shadow-sm font-serif text-lg text-amber-900">{h}</span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {soal.tipeSoal === "DRAG_KATEGORI" && (
                                <div className="bg-cyan-50 border border-cyan-100 rounded-lg p-3">
                                  <h4 className="text-xs font-bold text-cyan-800 mb-2 uppercase tracking-wider block">Kategori & Kosakata:</h4>
                                  <div className="flex flex-wrap gap-2 mb-3">
                                    {(soal.dataTambahan.categories || []).map((c: string, i: number) => (
                                      <span key={i} className="px-2 py-1 bg-cyan-600 text-white text-[10px] font-bold rounded-full uppercase tracking-wide">{c}</span>
                                    ))}
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {(soal.dataTambahan.items || []).map((item: any, i: number) => (
                                      <div key={i} className="flex flex-col border border-cyan-200 rounded bg-white overflow-hidden shadow-sm">
                                        <span className="bg-cyan-100 text-cyan-800 text-[9px] font-bold px-2 py-0.5 text-center">{item.category}</span>
                                        <span className="p-2 text-sm text-center font-medium break-words" dir="auto">{item.text}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {soal.tipeSoal === "PARAGRAF_RUMPANG" && (
                                <div className="bg-rose-50 border border-rose-100 rounded-lg p-3">
                                  <h4 className="text-xs font-bold text-rose-800 mb-2 uppercase tracking-wider block">Paragraf & Kunci Rumpang:</h4>
                                  <p className="p-2 mb-2 bg-white border border-rose-200 rounded text-sm whitespace-pre-wrap font-serif text-right">{soal.dataTambahan.paragraf}</p>
                                  <div className="flex flex-wrap gap-2">
                                    {(soal.dataTambahan.blanks || []).map((b: any, i: number) => (
                                      <span key={i} className="px-2 py-1 bg-white border border-rose-200 rounded text-xs font-medium">
                                        <strong className="text-rose-600">{b.index}.</strong> {b.jawaban}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {soal.tipeSoal === "IDENTIFIKASI_KESALAHAN" && (
                                <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                                  <h4 className="text-xs font-bold text-emerald-800 mb-2 uppercase tracking-wider block">Segmen Kalimat:</h4>
                                  <div className="flex flex-wrap gap-1" dir="rtl">
                                    {(soal.dataTambahan.segments || []).map((seg: any, i: number) => (
                                      <span key={i} className={`px-2 py-1 border rounded text-sm font-serif ${seg.isError ? 'bg-rose-100 border-rose-300 text-rose-800 line-through' : 'bg-white border-emerald-200 text-emerald-800'}`}>
                                        {seg.text}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {soal.tipeSoal === "TABEL_TASRIF" && (
                                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                                  <h4 className="text-xs font-bold text-amber-800 mb-2 uppercase tracking-wider block">Matriks Tabel Matrix:</h4>
                                  <table className="text-xs border-collapse w-full max-w-sm" dir="rtl">
                                    <thead>
                                      <tr>
                                        {["", ...(soal.dataTambahan.headers || [])].map((h: any, i: number) => (
                                          <th key={i} className="border border-amber-200 p-1 bg-amber-100">{h}</th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(soal.dataTambahan.rows || []).map((r: any, i: number) => (
                                        <tr key={i}>
                                          <td className="border border-amber-200 p-1 bg-amber-100 font-bold">{r.label}</td>
                                          {(r.cells || []).map((c: any, j: number) => (
                                            <td key={j} className={`border border-amber-200 p-1 font-serif text-center ${c.isBlank ? 'bg-amber-100 text-rose-500 line-through' : 'bg-white'}`}>{c.value}</td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {soal.tipeSoal === "SUSUN_HURUF" && (
                                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3">
                                  <h4 className="text-xs font-bold text-indigo-800 mb-2 uppercase tracking-wider block">Potongan Huruf:</h4>
                                  <div className="flex flex-wrap gap-2 justify-center" dir="rtl">
                                    {(soal.dataTambahan.hurufAcak || []).map((h: any, i: number) => (
                                      <span key={i} className="px-3 py-2 bg-white border border-indigo-200 rounded-lg text-lg font-serif shadow-sm text-indigo-900">{h}</span>
                                    ))}
                                  </div>
                                  <div className="mt-3 text-center border-t border-indigo-200/50 pt-2 text-xs font-bold text-indigo-500">
                                    Jawaban: <span className="font-serif text-sm">{soal.dataTambahan.jawaban}</span>
                                  </div>
                                </div>
                              )}

                              {soal.tipeSoal === "DRAG_TO_BLANK" && (
                                <div className="bg-cyan-50 border border-cyan-100 rounded-lg p-3">
                                  <h4 className="text-xs font-bold text-cyan-800 mb-2 uppercase tracking-wider block">Drag to Blank (Word Bank):</h4>
                                  <p className="p-2 mb-2 bg-white border border-cyan-200 rounded text-sm whitespace-pre-wrap font-serif text-right">{soal.dataTambahan.paragraf}</p>
                                  <div className="flex flex-wrap gap-2 mb-3">
                                    {(soal.dataTambahan.blanks || []).map((b: any, i: number) => (
                                      <span key={i} className="px-2 py-1 bg-white border border-cyan-200 rounded text-xs font-medium">
                                        <strong className="text-cyan-600">{b.index}.</strong> {b.jawaban}
                                      </span>
                                    ))}
                                  </div>
                                  <div className="border-t border-cyan-200/50 pt-2 flex flex-wrap justify-center gap-1" dir="rtl">
                                    {(soal.dataTambahan.wordBank || []).map((w: string, i: number) => (
                                      <span key={i} className="px-2 py-0.5 bg-cyan-100 border border-cyan-300 rounded text-xs text-cyan-800 font-serif">{w}</span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {soal.tipeSoal === "STABILO_SYNTAX" && (
                                <div className="bg-fuchsia-50 border border-fuchsia-100 rounded-lg p-3">
                                  <h4 className="text-xs font-bold text-fuchsia-800 mb-2 uppercase tracking-wider block">Kategori Warna (Stabilo):</h4>
                                  <div className="flex flex-wrap gap-2 mb-3">
                                    {(soal.dataTambahan.categories || []).map((c: any, i: number) => (
                                      <span key={i} className="px-2 py-1 rounded text-xs font-bold text-white shadow-sm" style={{ backgroundColor: c.color || '#9333ea' }}>
                                        {c.label || c.name}
                                      </span>
                                    ))}
                                  </div>
                                  <div className="border-t border-fuchsia-200/50 pt-3 flex flex-wrap gap-1 leading-loose" dir="rtl">
                                    {(soal.dataTambahan.words || []).map((w: any, i: number) => {
                                      const cat = (soal.dataTambahan.categories || []).find((c: any) => c.name === w.category);
                                      return (
                                        <span key={i} className={`px-2 py-1 rounded text-sm font-serif ${cat ? 'text-white font-bold shadow-sm' : 'bg-white text-gray-800 border border-gray-200'}`} style={{ backgroundColor: cat ? cat.color : undefined }}>
                                          {w.text}
                                        </span>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {soal.tipeSoal === "JARING_RELASI" && (
                                <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
                                  <h4 className="text-xs font-bold text-orange-800 mb-2 uppercase tracking-wider block">Jaring Relasi (1 to Many):</h4>
                                  <div className="grid grid-cols-2 gap-4 text-xs">
                                    <div className="space-y-1">
                                      <div className="font-bold text-gray-500 mb-1 border-b pb-1">Kiri</div>
                                      {(soal.dataTambahan.leftItems || []).map((l: string, i: number) => (
                                        <div key={i} className="bg-white p-1 rounded border border-orange-200" dir="auto">{l}</div>
                                      ))}
                                    </div>
                                    <div className="space-y-1">
                                      <div className="font-bold text-gray-500 mb-1 border-b pb-1">Kanan</div>
                                      {(soal.dataTambahan.rightItems || []).map((r: string, i: number) => (
                                        <div key={i} className="bg-white p-1 rounded border border-orange-200" dir="auto">{r}</div>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Fallback JSON if unknown active */}
                              {!["MENJODOHKAN", "MENGURUTKAN", "KITABAH", "DRAG_KATEGORI", "PARAGRAF_RUMPANG", "IDENTIFIKASI_KESALAHAN", "TABEL_TASRIF", "SUSUN_HURUF", "DRAG_TO_BLANK", "STABILO_SYNTAX", "JARING_RELASI"].includes(soal.tipeSoal) && (
                                <div className="bg-gray-100 border border-gray-200 rounded-lg p-3 overflow-auto text-xs">
                                  <span className="font-bold text-gray-700 block mb-1">Data Tambahan (JSON):</span>
                                  <pre className="text-gray-600 font-mono">{JSON.stringify(soal.dataTambahan, null, 2)}</pre>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="space-y-2.5">
                            {soal.opsiList?.map((j: any, i: number) => (
                              <div key={j.id} className={`px-4 py-3 rounded-xl border text-sm flex gap-3 items-start transition-colors ${j.isCorrect ? 'border-green-300 bg-green-50' : 'border-gray-100 bg-gray-50/50 hover:bg-gray-50'}`}>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center border text-xs font-bold mt-0.5 shrink-0 ${j.isCorrect ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 text-gray-500 bg-white'}`}>
                                  {String.fromCharCode(65 + i)}
                                </div>
                                <div className="flex-1 overflow-hidden">
                                  <SoalText html={j.teks} className="font-medium text-gray-700 block" style={{ color: j.isCorrect ? '#166534' : '' }} />
                                  {j.gambarUrl && (
                                    <div className="mt-2">
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img src={j.gambarUrl} alt={`Opsi ${String.fromCharCode(65 + i)}`} className="max-w-full h-auto max-h-24 object-contain rounded-lg border shadow-sm mix-blend-multiply" />
                                    </div>
                                  )}
                                </div>
                                {j.isCorrect && <CheckCircle2 size={18} className="text-green-500 shrink-0 mt-1" />}
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Checkbox Assignments Footer */}
                    <div className="border-t border-gray-100 px-6 py-3 bg-gray-50 flex flex-col sm:flex-row items-center justify-between mt-auto">
                      <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2 sm:mb-0">Tugaskan ke Pekan (Usbu'):</span>
                      <div className="flex gap-4">
                        {[1, 2, 3].map(u => {
                          const isAssigned = soal.usbuAssignments?.some((ua: any) => ua.usbuKe === u);
                          return (
                            <label key={u} className={`flex items-center gap-2 cursor-pointer text-sm font-bold transition-all ${isAssigned ? 'text-green-600' : 'text-gray-500 hover:text-gray-800'}`}>
                              <input
                                type="checkbox"
                                className="w-4 h-4 text-green-500 rounded border-gray-300 focus:ring-green-500 cursor-pointer"
                                checked={isAssigned || false}
                                onChange={(e) => handleToggleAssignment(soal.id, u, e.target.checked)}
                              />
                              Usbu {u}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL FORM BUILDER GOOGLE FORMS STYLE */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto pt-24 pb-12">
          <div className="neu-card-white rounded-2xl w-full max-w-3xl flex flex-col my-auto shadow-2xl overflow-hidden border-t-8 border-t-[var(--color-primary)]">

            <div className="border-b px-8 py-5 flex justify-between items-center bg-gray-50/50">
              <h2 className="text-xl font-bold font-display" style={{ color: "var(--color-text)" }}>
                {isEditing ? "Edit Soal" : "Buat Soal Baru"}
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveSoal} className="p-8 space-y-6">

              <div className="flex gap-4 items-center flex-wrap">
                <div className="flex-1 min-w-[200px]">
                  <div className="neu-input w-full p-3 text-sm font-semibold bg-gray-100 text-gray-500 border border-gray-200 cursor-not-allowed">
                    {TIPE_SOAL_MAP[formData.tipeSoal] || formData.tipeSoal}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-sm font-bold text-gray-500">Bobot Poin:</label>
                  <input
                    type="number" min="0.01" step="any" required
                    value={formData.bobot}
                    onChange={e => setFormData({ ...formData, bobot: e.target.value })}
                    className="neu-input w-28 p-3 text-sm text-center font-bold focus:border-[var(--color-primary)]"
                  />
                </div>
              </div>

              {/* Grup Qiro'ah / Soal Induk */}
              <div className="flex items-center gap-3 bg-purple-50/50 border border-purple-100 rounded-xl p-3">
                <label className="text-sm font-bold text-purple-700 whitespace-nowrap">Grup Qiro&apos;ah:</label>
                <select
                  value={formData.grupSoalId}
                  onChange={e => setFormData({ ...formData, grupSoalId: e.target.value })}
                  className="neu-input flex-1 p-2.5 text-sm font-medium bg-white focus:border-purple-400"
                >
                  <option value="">-- Soal Mandiri (Tidak Tergabung) --</option>
                  {soalList
                    .filter((s: any) => s.id !== formData.id && !s.grupSoalId) // Hanya soal mandiri yang bisa jadi induk
                    .map((s: any, i: number) => (
                      <option key={s.id} value={s.id}>
                        Soal #{i + 1}: {(s.pertanyaan || "").replace(/<[^>]*>/g, "").substring(0, 60)}...
                      </option>
                    ))
                  }
                </select>
              </div>

              <div>
                <div className="flex gap-1 mb-2 border border-gray-200 rounded-xl p-1 bg-gray-50 w-fit">
                  <button type="button" title="Bold" onClick={() => document.execCommand('bold')} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm transition-all text-gray-600 hover:text-gray-900">
                    <Bold size={16} />
                  </button>
                  <button type="button" title="Underline" onClick={() => document.execCommand('underline')} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm transition-all text-gray-600 hover:text-gray-900">
                    <Underline size={16} />
                  </button>
                  <label className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm transition-all text-blue-600 hover:text-blue-700 cursor-pointer relative" title="Upload Gambar Soal">
                    {isUploadingImg === "soal" ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleUploadImage(e, "soal")}
                      disabled={!!isUploadingImg}
                    />
                  </label>
                  <label className="text-[10px] sm:text-xs text-gray-400 mr-auto self-center bg-gray-50 px-2 py-1 rounded font-medium">Bisa Upload Foto</label>
                  <button type="button" title="Ganti Arah Teks (RTL/LTR)" onClick={() => setManualDir(prev => prev === 'rtl' ? 'ltr' : (prev === 'ltr' ? 'auto' : 'rtl'))} className="w-auto px-2 h-8 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm transition-all text-blue-600 hover:text-blue-700 bg-blue-50 font-bold ml-auto font-mono text-xs gap-1 border border-blue-100">
                    {manualDir === 'rtl' ? 'عر' : (manualDir === 'ltr' ? 'AB' : 'Auto')}
                  </button>
                </div>
                {formData.gambarUrl && (
                  <div className="mb-4 relative w-fit">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={formData.gambarUrl} alt="Preview Soal" className="max-w-full h-auto max-h-48 rounded-lg border shadow-sm" />
                    <button
                      type="button"
                      onClick={() => setFormData((prev: any) => ({ ...prev, gambarUrl: "" }))}
                      className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                )}
                {(() => {
                  const resolvedDir = manualDir || detectTextDirection(formData.pertanyaan || "");
                  return (
                    <EditorDiv
                      id="pertanyaan-editor"
                      value={formData.pertanyaan}
                      onChange={(html: string) => setFormData((f: any) => ({ ...f, pertanyaan: html }))}
                      dir={resolvedDir}
                      className={`neu-input w-full p-4 text-base focus:border-[var(--color-primary)] focus:bg-white resize-y bg-white border border-gray-200 rounded-xl outline-none min-h-[100px] whitespace-pre-wrap ${resolvedDir === 'rtl' ? 'font-serif text-right text-xl' : 'text-left'}`}
                    />
                  );
                })()}
              </div>

              {/* ESSAY KEY */}
              {["ESSAY_SINGKAT", "ESSAY_PANJANG", "KITABAH"].includes(formData.tipeSoal) && (
                <div className="mt-4 p-4 rounded-xl border border-blue-100 bg-blue-50/50">
                  <label className="text-sm font-bold text-blue-800 block mb-2">Kunci Jawaban (Referensi Guru & AI)</label>
                  <textarea
                    value={formData.kunciJawaban || ""}
                    dir="auto"
                    onChange={e => setFormData({ ...formData, kunciJawaban: e.target.value })}
                    placeholder="Masukkan kunci jawaban yang benar..."
                    className={`neu-input w-full p-3 text-sm focus:border-[var(--color-primary)] min-h-[100px] font-serif`}
                  />
                  {formData.tipeSoal === "ESSAY_PANJANG" && (
                    <p className="text-xs text-blue-600 mt-2 font-medium">⚠️ Kunci jawaban ini akan digunakan oleh AI untuk mengoreksi jawaban santri secara otomatis.</p>
                  )}
                </div>
              )}

              {/* PILIHAN JAWABAN */}
              {["PG", "PG_MULTI", "BENAR_SALAH", "MUFRODAT", "ISIAN_SAMPING", "ISIAN_BAWAH"].includes(formData.tipeSoal) && (
                <div className="bg-gray-50/50 -mx-8 px-8 py-6 border-t border-b mt-6">
                  <div className="flex justify-between items-center mb-4">
                    <label className="block text-sm font-bold text-gray-700">Pilihan Jawaban</label>
                    <span className="text-xs text-green-600 font-semibold bg-green-50 px-2 py-1 rounded">
                      {formData.tipeSoal === "PG_MULTI" ? "Centang semua jawaban yang benar" : "Centang 1 jawaban benar"}
                    </span>
                  </div>

                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={formData.jawabanList.map((j: any) => j.id)} strategy={verticalListSortingStrategy}>
                      <div className="space-y-3">
                        {formData.jawabanList.map((j: any, i: number) => (
                          <SortableItem key={j.id} id={j.id} className={`flex items-center gap-3 p-1 rounded-xl transition-colors border bg-white ${j.isCorrect ? 'border-green-400 shadow-sm' : 'border-gray-200'}`}>
                            <input
                              type={formData.tipeSoal === "PG_MULTI" ? "checkbox" : "radio"}
                              name={formData.tipeSoal === "PG_MULTI" ? `correct-answer-${i}` : "correct-answer"}
                              checked={j.isCorrect}
                              onChange={(e) => {
                                let newJawaban;
                                if (formData.tipeSoal === "PG_MULTI") {
                                  newJawaban = formData.jawabanList.map((ans: any, idx: number) => idx === i ? { ...ans, isCorrect: e.target.checked } : ans);
                                } else {
                                  newJawaban = formData.jawabanList.map((ans: any, idx: number) => ({ ...ans, isCorrect: idx === i }));
                                }
                                setFormData({ ...formData, jawabanList: newJawaban });
                              }}
                              className="w-5 h-5 cursor-pointer accent-green-600 ml-2"
                            />
                            <span className="font-bold text-gray-400 w-6 text-center text-xs">{String.fromCharCode(65 + i)}</span>
                            <div className="flex-1 flex flex-col gap-2 relative">
                              <div className="flex gap-2 items-center">
                                <input
                                  type="text"
                                  required={j.isCorrect || i < 2}
                                  value={j.teks}
                                  dir="auto"
                                  onChange={e => {
                                    const newJawaban = [...formData.jawabanList];
                                    newJawaban[i].teks = e.target.value;
                                    setFormData({ ...formData, jawabanList: newJawaban });
                                  }}
                                  className={`flex-1 bg-transparent border-0 border-b border-transparent focus:border-[var(--color-primary)] focus:ring-0 px-2 py-2 text-sm transition-colors font-serif`}
                                  placeholder={`Ketik opsi ${String.fromCharCode(65 + i)}...`}
                                />
                                <label className="p-2 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-all text-gray-500 hover:text-blue-600 cursor-pointer" title="Upload Gambar Opsi">
                                  {isUploadingImg === j.id ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => handleUploadImage(e, j.id)}
                                    disabled={!!isUploadingImg}
                                  />
                                </label>
                              </div>
                              {j.gambarUrl && (
                                <div className="relative w-fit bg-gray-50 p-2 rounded-lg border mt-1">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img src={j.gambarUrl} alt="Preview Opsi" className="max-w-full h-auto max-h-24 rounded shadow-sm" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newJawaban = [...formData.jawabanList];
                                      newJawaban[i].gambarUrl = "";
                                      setFormData({ ...formData, jawabanList: newJawaban });
                                    }}
                                    className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              )}
                            </div>
                          </SortableItem>
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>

                  <p className="text-xs text-gray-400 mt-4 text-center">Gunakan ikon titik enam di kiri untuk menukar urutan jawaban</p>
                </div>
              )}

              {/* DATA TAMBAHAN (INTERAKTIF) */}
              {["MENJODOHKAN", "MENGURUTKAN", "DRAG_KATEGORI", "KITABAH", "PARAGRAF_RUMPANG", "IDENTIFIKASI_KESALAHAN", "TABEL_TASRIF", "SUSUN_HURUF", "DRAG_TO_BLANK", "STABILO_SYNTAX", "JARING_RELASI"].includes(formData.tipeSoal) && (
                <div className="mt-4 p-5 rounded-2xl border border-purple-100 bg-purple-50/30">
                  <h3 className="text-sm font-bold text-purple-800 block mb-4 flex items-center gap-2">
                    <Activity size={16} /> Konfigurasi Soal {formData.tipeSoal.replace(/_/g, ' ')}
                  </h3>

                  {/* BUILDER MENJODOHKAN */}
                  {formData.tipeSoal === "MENJODOHKAN" && (() => {
                    const dt = formData.dataTambahan || {};
                    const lefts: string[] = dt.lefts || [];
                    const rights: string[] = dt.rights || [];
                    const count = Math.max(lefts.length, rights.length);

                    return (
                      <div className="space-y-3">
                        <div className="flex font-bold text-purple-700 text-xs tracking-wider mb-2 gap-4">
                          <div className="flex-1">Pernyataan Kolom A (Kiri)</div>
                          <div className="flex-1">Pasangan Kolom B (Kanan)</div>
                          <div className="w-10"></div>
                        </div>
                        {Array.from({ length: count }).map((_, idx) => (
                          <div key={idx} className="flex gap-4 items-start">
                            <input
                              type="text"
                              value={lefts[idx] || ""}
                              dir="auto"
                              onChange={e => {
                                const newLefts = [...lefts];
                                newLefts[idx] = e.target.value;
                                setFormData({ ...formData, dataTambahan: { ...dt, lefts: newLefts, rights } });
                              }}
                              placeholder="Pernyataan..."
                              className="neu-input flex-1 p-2.5 text-sm bg-white focus:border-purple-400"
                            />
                            <input
                              type="text"
                              value={rights[idx] || ""}
                              dir="auto"
                              onChange={e => {
                                const newRights = [...rights];
                                newRights[idx] = e.target.value;
                                setFormData({ ...formData, dataTambahan: { ...dt, lefts, rights: newRights } });
                              }}
                              placeholder="Pasangan jawaban..."
                              className="neu-input flex-1 p-2.5 text-sm bg-white border-green-200 focus:border-green-400 focus:ring-green-100"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newLefts = lefts.filter((_, i) => i !== idx);
                                const newRights = rights.filter((_, i) => i !== idx);
                                setFormData({ ...formData, dataTambahan: { ...dt, lefts: newLefts, rights: newRights } });
                              }}
                              className="p-2.5 rounded-xl bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors"
                              title="Hapus Pasangan"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, dataTambahan: { ...dt, lefts: [...lefts, ""], rights: [...rights, ""] } });
                          }}
                          className="mt-2 text-sm font-bold text-purple-600 bg-purple-100/50 hover:bg-purple-100 px-4 py-2 rounded-xl transition flex gap-2 items-center"
                        >
                          <Plus size={16} /> Tambah Pasangan jodoh
                        </button>
                      </div>
                    );
                  })()}

                  {/* BUILDER MENGURUTKAN */}
                  {formData.tipeSoal === "MENGURUTKAN" && (() => {
                    const dt = formData.dataTambahan || {};
                    const items: string[] = dt.items || [];

                    return (
                      <div className="space-y-3 max-w-2xl">
                        <p className="text-xs text-purple-600 mb-2 font-medium">Masukkan kunci jawaban urutan secara berurutan (Sistem akan mengacaknya secara otomatis untuk santri).</p>
                        {items.map((item, idx) => (
                          <div key={idx} className="flex gap-3 items-center">
                            <span className="w-6 h-6 flex items-center justify-center bg-purple-100 text-purple-700 rounded-full text-xs font-bold shrink-0">{idx + 1}</span>
                            <input
                              type="text"
                              value={item}
                              dir="auto"
                              onChange={e => {
                                const newItems = [...items];
                                newItems[idx] = e.target.value;
                                setFormData({ ...formData, dataTambahan: { ...dt, items: newItems } });
                              }}
                              placeholder="Masukkan langkah/kalimat..."
                              className="neu-input flex-1 p-2.5 text-sm bg-white focus:border-purple-400"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newItems = items.filter((_, i) => i !== idx);
                                setFormData({ ...formData, dataTambahan: { ...dt, items: newItems } });
                              }}
                              className="p-2.5 rounded-xl text-gray-400 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, dataTambahan: { ...dt, items: [...items, ""] } });
                          }}
                          className="mt-2 text-sm font-bold text-purple-600 bg-purple-100/50 hover:bg-purple-100 px-4 py-2 rounded-xl transition flex gap-2 items-center w-fit"
                        >
                          <Plus size={16} /> Tambah Urutan
                        </button>
                      </div>
                    );
                  })()}

                  {/* BUILDER KITABAH */}
                  {formData.tipeSoal === "KITABAH" && (() => {
                    const dt = formData.dataTambahan || {};
                    const huruf: string[] = dt.huruf || [];

                    return (
                      <div className="space-y-3">
                        <p className="text-xs text-purple-600 mb-2 font-medium">Tambahkan blok font / kata yang akan disusun santri. (Urutan yang benar otomatis tercatat di data).</p>
                        <div className="flex flex-wrap gap-2" dir="rtl">
                          {huruf.map((hrf, idx) => (
                            <div key={idx} className="flex flex-col gap-1 items-center bg-white p-2 border rounded-xl shadow-sm">
                              <input
                                type="text"
                                value={hrf}
                                dir="rtl"
                                onChange={e => {
                                  const newHuruf = [...huruf];
                                  newHuruf[idx] = e.target.value;
                                  setFormData({ ...formData, dataTambahan: { ...dt, huruf: newHuruf } });
                                }}
                                className="w-16 h-12 text-center text-xl font-serif bg-gray-50 border-0 focus:ring-2 rounded-lg"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  const newHuruf = huruf.filter((_, i) => i !== idx);
                                  setFormData({ ...formData, dataTambahan: { ...dt, huruf: newHuruf } });
                                }}
                                className="text-rose-500 text-xs font-bold hover:underline"
                              >
                                Hapus
                              </button>
                            </div>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              setFormData({ ...formData, dataTambahan: { ...dt, huruf: [...huruf, ""] } });
                            }}
                            className="w-16 h-12 flex items-center justify-center text-purple-500 border-2 border-dashed border-purple-300 rounded-xl hover:bg-purple-100"
                          >
                            <Plus size={20} />
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* BUILDER DRAG_KATEGORI */}
                  {formData.tipeSoal === "DRAG_KATEGORI" && (() => {
                    const dt = formData.dataTambahan || {};
                    const categories: string[] = dt.categories || [];
                    const items: { text: string; category: string }[] = dt.items || [];

                    return (
                      <div className="space-y-6">
                        {/* 1. Kategori Builder */}
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">Daftar Kategori / Keranjang</label>
                          <div className="flex flex-wrap gap-2 mb-2">
                            {categories.map((cat, idx) => (
                              <div key={idx} className="flex bg-white border border-purple-200 rounded-full shadow-sm items-center pr-1 pl-3 py-1">
                                <input
                                  type="text"
                                  value={cat}
                                  onChange={e => {
                                    const newCats = [...categories];
                                    newCats[idx] = e.target.value;
                                    // Update items reference as well
                                    const newItems = items.map(item => item.category === cat ? { ...item, category: e.target.value } : item);
                                    setFormData({ ...formData, dataTambahan: { ...dt, categories: newCats, items: newItems } });
                                  }}
                                  className="bg-transparent border-none text-sm font-bold text-gray-700 w-32 focus:outline-none"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newCats = categories.filter((_, i) => i !== idx);
                                    setFormData({ ...formData, dataTambahan: { ...dt, categories: newCats } });
                                  }}
                                  className="p-1 rounded-full text-gray-400 hover:text-rose-500 hover:bg-rose-50"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, dataTambahan: { ...dt, categories: [...categories, "Nama Kategori"] } });
                              }}
                              className="text-xs font-bold text-purple-600 bg-purple-100/50 hover:bg-purple-100 px-3 py-1.5 rounded-full transition flex gap-1 items-center"
                            >
                              <Plus size={14} /> Tambah Kategori
                            </button>
                          </div>
                        </div>

                        {/* 2. Items Builder */}
                        <div>
                          <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2 block">Daftar Item / Kosakata</label>
                          <div className="space-y-2 max-w-2xl">
                            {items.map((item, idx) => (
                              <div key={idx} className="flex gap-2">
                                <input
                                  type="text"
                                  value={item.text}
                                  dir="auto"
                                  onChange={e => {
                                    const newItems = [...items];
                                    newItems[idx].text = e.target.value;
                                    setFormData({ ...formData, dataTambahan: { ...dt, items: newItems } });
                                  }}
                                  placeholder="Masukkan teks item..."
                                  className="neu-input flex-1 p-2 text-sm bg-white"
                                />
                                <select
                                  value={item.category}
                                  onChange={e => {
                                    const newItems = [...items];
                                    newItems[idx].category = e.target.value;
                                    setFormData({ ...formData, dataTambahan: { ...dt, items: newItems } });
                                  }}
                                  className="neu-input w-48 p-2 text-sm bg-purple-50 text-purple-800 font-medium"
                                >
                                  <option value="">Pilih Kategori...</option>
                                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const newItems = items.filter((_, i) => i !== idx);
                                    setFormData({ ...formData, dataTambahan: { ...dt, items: newItems } });
                                  }}
                                  className="p-2 bg-gray-100 rounded-xl hover:bg-rose-100 hover:text-rose-500 transition-colors"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, dataTambahan: { ...dt, items: [...items, { text: "", category: "" }] } });
                              }}
                              className="mt-2 text-sm font-bold text-gray-600 bg-gray-100 hover:bg-gray-200 px-4 py-2 rounded-xl transition flex gap-2 items-center"
                            >
                              <Plus size={16} /> Tambah Item
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* BUILDER PARAGRAF_RUMPANG */}
                  {formData.tipeSoal === "PARAGRAF_RUMPANG" && (() => {
                    const dt = formData.dataTambahan || {};
                    const paragraf: string = dt.paragraf || "";
                    const blanks: { index: number, jawaban: string }[] = dt.blanks || [];

                    return (
                      <div className="space-y-4">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Wacana Arab / Paragraf Rumpang</label>
                        <p className="text-xs text-purple-600 mb-2 font-medium">Gunakan tag <code className="bg-white font-mono px-1 rounded">{"{{1}}"}</code>, <code className="bg-white font-mono px-1 rounded">{"{{2}}"}</code>, dst untuk merepresentasikan titik-titik rumpang.</p>
                        <textarea
                          value={paragraf}
                          dir="auto"
                          onChange={e => setFormData({ ...formData, dataTambahan: { ...dt, paragraf: e.target.value } })}
                          className={`w-full p-4 border border-purple-200 rounded-xl bg-white focus:ring-2 focus:outline-none min-h-[120px] font-serif`}
                          placeholder="Contoh: Rukun iman berjumlah {{1}} perkara, sedangkan sholat masuk dalam rukun {{2}}."
                        />

                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block mt-4">Kunci Jawaban Tiap Blank</label>
                        <p className="text-[10px] text-gray-400">Pisahkan kemungkinan jawaban dengan tanda ( | ) jika ada banyak ejaan. Bebas case-insensitive.</p>

                        {blanks.map((b, i) => (
                          <div key={i} className="flex flex-wrap items-center gap-2 p-2 bg-white rounded-lg border border-purple-100 shadow-sm">
                            <div className="bg-purple-100 text-purple-800 font-bold px-3 py-2 rounded-lg">{`{{${b.index}}}`}</div>
                            <input type="text" value={b.jawaban} dir="auto" onChange={e => {
                              const nb = [...blanks];
                              nb[i].jawaban = e.target.value;
                              setFormData({ ...formData, dataTambahan: { ...dt, blanks: nb } });
                            }} className="flex-1 neu-input p-2 text-sm bg-gray-50" placeholder="Kunci jawaban..." />
                            <button type="button" onClick={() => {
                              const nb = blanks.filter((_, idx) => idx !== i);
                              setFormData({ ...formData, dataTambahan: { ...dt, blanks: nb } });
                            }} className="text-rose-500 hover:bg-rose-100 p-2 rounded-lg transition-colors"><Trash2 size={16} /></button>
                          </div>
                        ))}
                        <button type="button" onClick={() => {
                          const newIdx = blanks.length > 0 ? Math.max(...blanks.map(b => b.index)) + 1 : 1;
                          setFormData({ ...formData, dataTambahan: { ...dt, blanks: [...blanks, { index: newIdx, jawaban: "" }] } });
                        }} className="text-sm font-bold text-purple-600 bg-purple-100/50 hover:bg-purple-100 px-4 py-2 rounded-xl transition flex gap-2 items-center">
                          <Plus size={16} /> Tambah Blank
                        </button>
                      </div>
                    );
                  })()}

                  {/* BUILDER IDENTIFIKASI_KESALAHAN */}
                  {formData.tipeSoal === "IDENTIFIKASI_KESALAHAN" && (() => {
                    const dt = formData.dataTambahan || {};
                    const segments: { text: string, isError: boolean }[] = dt.segments || [];

                    return (
                      <div className="space-y-4">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Segmen Kalimat (Kata per Kata)</label>
                        <p className="text-xs text-purple-600 mb-2 font-medium">Santri akan men-tap kata yang bermasalah. Klik tombol &quot;Salah!&quot; untuk menetapkan mana yg salah grammar-nya. Akan dieksekusi / dirender dalam RTL jika teks Arab.</p>

                        <div className="flex flex-wrap items-center gap-2" dir="rtl">
                          {segments.map((seg, i) => (
                            <div key={i} className={`flex flex-col border-2 rounded-xl p-2 bg-white gap-2 shadow-sm transition-colors ${seg.isError ? 'border-rose-400 bg-rose-50' : 'border-gray-200'}`}>
                              <input type="text" value={seg.text} dir="rtl" onChange={e => {
                                const ns = [...segments];
                                ns[i].text = e.target.value;
                                setFormData({ ...formData, dataTambahan: { ...dt, segments: ns } });
                              }} className="font-serif text-lg text-center bg-gray-50 border-none rounded focus:ring-0 w-24 h-12" placeholder="Kata..." />

                              <div className="flex justify-between items-center px-1">
                                <label className="flex items-center gap-1 cursor-pointer">
                                  <input type="checkbox" checked={seg.isError} onChange={e => {
                                    const ns = [...segments];
                                    ns[i].isError = e.target.checked;
                                    setFormData({ ...formData, dataTambahan: { ...dt, segments: ns } });
                                  }} className="accent-rose-500 rounded" />
                                  <span className={`text-[10px] font-bold ${seg.isError ? 'text-rose-600' : 'text-gray-400'}`}>Salah!</span>
                                </label>

                                <button type="button" onClick={() => {
                                  const ns = segments.filter((_, idx) => idx !== i);
                                  setFormData({ ...formData, dataTambahan: { ...dt, segments: ns } });
                                }} className="text-gray-300 hover:text-rose-500"><X size={14} /></button>
                              </div>
                            </div>
                          ))}
                          <button type="button" onClick={() => {
                            setFormData({ ...formData, dataTambahan: { ...dt, segments: [...segments, { text: "", isError: false }] } });
                          }} className="w-24 h-[5.5rem] flex flex-col justify-center items-center gap-1 border-2 border-dashed border-purple-300 bg-purple-50/50 rounded-xl hover:bg-purple-100 text-purple-500 font-bold text-xs transition-colors">
                            <Plus size={20} /> Kata
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                  {/* BUILDER TABEL_TASRIF */}
                  {formData.tipeSoal === "TABEL_TASRIF" && (() => {
                    const dt = formData.dataTambahan || {};
                    const headers: string[] = dt.headers || ["Kolom 1", "Kolom 2"];
                    const rows: { label: string, cells: { value: string, isBlank: boolean }[] }[] = dt.rows || [
                      { label: "Baris 1", cells: [{ value: "", isBlank: true }, { value: "", isBlank: false }] }
                    ];

                    return (
                      <div className="space-y-4 overflow-x-auto pb-4">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Matriks Tabel Matrix</label>
                        <p className="text-xs text-purple-600 mb-4 font-medium">Bentuk tabel kolom dan baris. Gunakan centang di tiap sel untuk membuat sel tersebut kosong/rumpang saat dikerjakan murid. Isian teks adalah kunci jawaban (bisa multi jawaban dipisan pipe |).</p>

                        <div className="min-w-fit border border-purple-200 rounded-xl bg-white p-4 inline-block shadow-sm">
                          <table className="w-full text-sm border-spacing-2 border-separate" dir="rtl">
                            <thead>
                              <tr>
                                <th></th>
                                {headers.map((h, cIdx) => (
                                  <th key={cIdx} className="font-bold relative group">
                                    <input type="text" value={h} dir="rtl" onChange={e => {
                                      const nh = [...headers]; nh[cIdx] = e.target.value;
                                      setFormData({ ...formData, dataTambahan: { ...dt, headers: nh } });
                                    }} className="text-center font-bold text-gray-700 bg-purple-50 p-2 rounded w-32 md:w-40 xl:w-48 focus:ring-2 outline-none border border-transparent focus:border-purple-300" />
                                    {headers.length > 1 && (
                                      <button type="button" onClick={() => {
                                        const nh = headers.filter((_, i) => i !== cIdx);
                                        const nr = rows.map(r => ({ ...r, cells: r.cells.filter((_, i) => i !== cIdx) }));
                                        setFormData({ ...formData, dataTambahan: { ...dt, headers: nh, rows: nr } });
                                      }} className="absolute -top-2 -right-2 hidden group-hover:flex bg-rose-500 text-white rounded-full w-5 h-5 items-center justify-center shadow z-10"><X size={12} /></button>
                                    )}
                                  </th>
                                ))}
                                <th>
                                  <button type="button" onClick={() => {
                                    setFormData({ ...formData, dataTambahan: { ...dt, headers: [...headers, "Baru"], rows: rows.map(r => ({ ...r, cells: [...r.cells, { value: "", isBlank: false }] })) } });
                                  }} className="bg-purple-100 hover:bg-purple-200 text-purple-600 rounded p-2 text-xs font-bold leading-none w-10 flex items-center justify-center"><Plus size={16} /></button>
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((row, rIdx) => (
                                <tr key={rIdx}>
                                  <td className="relative group p-1 align-top pt-3">
                                    <input type="text" value={row.label} dir="rtl" onChange={e => {
                                      const nr = [...rows]; nr[rIdx].label = e.target.value;
                                      setFormData({ ...formData, dataTambahan: { ...dt, rows: nr } });
                                    }} className="bg-gray-100 w-24 p-2 rounded font-bold text-gray-700 text-center outline-none focus:ring-2 border border-transparent focus:border-gray-300" placeholder="Kiri" />
                                    {rows.length > 1 && (
                                      <button type="button" onClick={() => {
                                        const nr = rows.filter((_, i) => i !== rIdx);
                                        setFormData({ ...formData, dataTambahan: { ...dt, rows: nr } });
                                      }} className="absolute 0 -right-2 hidden group-hover:flex bg-rose-500 text-white rounded-full w-5 h-5 items-center justify-center shadow z-10"><X size={12} /></button>
                                    )}
                                  </td>
                                  {row.cells.map((cell, cIdx) => (
                                    <td key={cIdx} className="p-1 align-top relative group">
                                      <div className={`p-1 border-2 rounded ${cell.isBlank ? 'border-amber-400 bg-amber-50 shadow-inner' : 'border-gray-200 bg-white'} focus-within:border-blue-400 relative transition-colors`}>
                                        <input type="text" value={cell.value} dir="rtl" onChange={e => {
                                          const nr = [...rows]; nr[rIdx].cells[cIdx].value = e.target.value;
                                          setFormData({ ...formData, dataTambahan: { ...dt, rows: nr } });
                                        }} className="w-full bg-transparent text-center font-serif text-xl p-2 outline-none" placeholder="..." />
                                        <label className="absolute -top-2 -right-2 cursor-pointer bg-white border border-gray-200 shadow-sm p-1 rounded hover:scale-110 transition-transform flex items-center" title="Jadikan Rumpang (Blank)">
                                          <input type="checkbox" checked={cell.isBlank} onChange={e => {
                                            const nr = [...rows]; nr[rIdx].cells[cIdx].isBlank = e.target.checked;
                                            setFormData({ ...formData, dataTambahan: { ...dt, rows: nr } });
                                          }} className="accent-amber-500 w-4 h-4" />
                                        </label>
                                      </div>
                                    </td>
                                  ))}
                                </tr>
                              ))}
                              <tr>
                                <td colSpan={headers.length + 2} className="pt-4 text-right">
                                  <button type="button" onClick={() => {
                                    setFormData({ ...formData, dataTambahan: { ...dt, rows: [...rows, { label: "Baru", cells: headers.map(() => ({ value: "", isBlank: false })) }] } });
                                  }} className="bg-gray-100 font-bold hover:bg-gray-200 text-gray-600 border border-gray-200 shadow-sm rounded-lg px-4 py-2 text-sm inline-flex items-center gap-2"><Plus size={16} /> Baris Baru</button>
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}

                  {/* BUILDER SUSUN_HURUF */}
                  {formData.tipeSoal === "SUSUN_HURUF" && (() => {
                    const dt = formData.dataTambahan || {};
                    const jawaban: string = dt.jawaban || "";
                    const hurufAcak: string[] = dt.hurufAcak || [];

                    return (
                      <div className="space-y-4">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Konfigurasi Susun Huruf</label>
                        <p className="text-xs text-purple-600 mb-2 font-medium">Santri akan menekan/memilih potongan chip satu per satu secara berurutan hingga merangkai string yang utuh berdasar Kunci Kata di bawah.</p>

                        <div className="bg-white p-4 md:p-6 rounded-xl border border-purple-100 shadow-sm space-y-6">
                          <div>
                            <label className="text-xs font-bold text-gray-500 block mb-2">Kata/Kalimat Utuh (Kunci Jawaban)</label>
                            <input type="text" dir="auto" value={jawaban} onChange={e => {
                              setFormData({ ...formData, dataTambahan: { ...dt, jawaban: e.target.value } });
                            }} className="w-full font-serif text-2xl p-4 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-200 focus:border-purple-400 outline-none text-right transition-all" placeholder="..." />
                          </div>

                          <div className="pt-4 border-t border-gray-100">
                            <div className="flex justify-between items-center mb-4">
                              <label className="text-xs font-bold text-gray-500 block">Potongan Huruf / Kata Acak</label>
                              <div className="flex gap-2">
                                <button type="button" onClick={() => {
                                  if (!jawaban) return;
                                  const chars = jawaban.split(' ').filter(c => c.trim() !== "");
                                  for (let i = chars.length - 1; i > 0; i--) {
                                    const j = Math.floor(Math.random() * (i + 1));
                                    [chars[i], chars[j]] = [chars[j], chars[i]];
                                  }
                                  setFormData({ ...formData, dataTambahan: { ...dt, hurufAcak: chars } });
                                }} className="text-[10px] bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded font-bold hover:bg-emerald-200 transition-colors shadow-sm">Atur per Kata</button>

                                <button type="button" onClick={() => {
                                  if (!jawaban) return;
                                  const chars = Array.from(jawaban).filter(c => c.trim() !== "");
                                  for (let i = chars.length - 1; i > 0; i--) {
                                    const j = Math.floor(Math.random() * (i + 1));
                                    [chars[i], chars[j]] = [chars[j], chars[i]];
                                  }
                                  setFormData({ ...formData, dataTambahan: { ...dt, hurufAcak: chars } });
                                }} className="text-[10px] bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded font-bold hover:bg-indigo-200 transition-colors shadow-sm">✨ Auto-Pecah & Acak</button>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2" dir="rtl">
                              {hurufAcak.map((h, i) => (
                                <div key={i} className="flex flex-col relative group">
                                  <input type="text" dir="auto" value={h} onChange={e => {
                                    const nh = [...hurufAcak]; nh[i] = e.target.value;
                                    setFormData({ ...formData, dataTambahan: { ...dt, hurufAcak: nh } });
                                  }} className="w-16 h-16 md:w-20 md:h-20 font-serif text-2xl md:text-3xl text-center border-2 border-indigo-200 rounded-xl bg-white shadow-sm focus:border-indigo-400 outline-none" />
                                  <button type="button" onClick={() => {
                                    const nh = hurufAcak.filter((_, idx) => idx !== i);
                                    setFormData({ ...formData, dataTambahan: { ...dt, hurufAcak: nh } });
                                  }} className="absolute -top-2 -right-2 hidden group-hover:flex bg-rose-500 text-white rounded-full w-6 h-6 items-center justify-center shadow z-10"><X size={14} /></button>
                                </div>
                              ))}
                              <button type="button" onClick={() => {
                                setFormData({ ...formData, dataTambahan: { ...dt, hurufAcak: [...hurufAcak, ""] } });
                              }} className="w-16 h-16 md:w-20 md:h-20 flex justify-center items-center rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 hover:bg-indigo-100 text-indigo-400 transition-colors">
                                <Plus size={24} />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* BUILDER DRAG_TO_BLANK */}
                  {formData.tipeSoal === "DRAG_TO_BLANK" && (() => {
                    const dt = formData.dataTambahan || {};
                    const wg: string = dt.paragraf || "";
                    const blanks: { index: number, jawaban: string }[] = dt.blanks || [];
                    const wordBank: string[] = dt.wordBank || [];

                    const detectBlanks = (text: string) => {
                      const matches = text.match(/{{(\d+)}}/g);
                      if (!matches) return [];
                      const indices = matches.map(m => parseInt(m.replace(/\D/g, ''))).sort((a, b) => a - b);
                      return [...new Set(indices)]; // unique
                    };

                    const handlePargrafChange = (newParagraf: string) => {
                      const newIndices = detectBlanks(newParagraf);
                      const newBlanks = newIndices.map(idx => {
                        const exist = blanks.find(b => b.index === idx);
                        return exist ? exist : { index: idx, jawaban: "" };
                      });
                      setFormData({ ...formData, dataTambahan: { ...dt, paragraf: newParagraf, blanks: newBlanks } });
                    };

                    return (
                      <div className="space-y-4">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Wacana Teks Rumpang & Word Bank</label>
                        <p className="text-xs text-purple-600 mb-2 font-medium">Beri tanda {'{{1}}'}, {'{{2}}'}, dst pada teks untuk membuat kolom rumpang. Santri akan menarik chip dari Bank Kata ke dalam lubang-lubang tersebut.</p>

                        <div className="bg-white p-4 rounded-xl border border-purple-100 shadow-sm">
                          <textarea
                            dir="auto"
                            rows={4}
                            value={wg}
                            onChange={e => handlePargrafChange(e.target.value)}
                            placeholder="Contoh: أَحْمَدُ {{1}} إِلَى السُّوقِ لِشِرَاءِ {{2}}."
                            className="w-full font-serif text-2xl p-4 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-cyan-200 focus:border-cyan-400 focus:bg-white resize-y outline-none"
                          />

                          {blanks.length > 0 && (
                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mt-4">
                              <h4 className="text-xs font-bold text-emerald-800 mb-3">Definisikan Kunci Jawaban (Sesuai Urutan):</h4>
                              <div className="space-y-2">
                                {blanks.map((b, i) => (
                                  <div key={b.index} className="flex gap-2 items-center" dir="rtl">
                                    <span className="font-bold text-emerald-600 bg-emerald-100 px-3 py-1.5 rounded-lg text-center shadow-sm">{b.index}</span>
                                    <input type="text" dir="auto" value={b.jawaban} onChange={e => {
                                      const nb = [...blanks]; nb[i].jawaban = e.target.value;
                                      setFormData({ ...formData, dataTambahan: { ...dt, blanks: nb } });
                                    }} className="flex-1 font-serif text-xl p-2 rounded-lg border-emerald-200 focus:ring-emerald-400 outline-none shadow-sm" placeholder="Kunci jawaban..." />
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div className="mt-6 border-t border-gray-100 pt-4">
                            <div className="flex justify-between items-center mb-4">
                              <label className="text-xs font-bold text-gray-500 block">Bank Kata (Pilihan Ganda)</label>
                              <button type="button" onClick={() => {
                                const validAnswers = blanks.map(b => b.jawaban.split('|')[0].trim()).filter(Boolean);
                                const newBank = [...new Set([...wordBank, ...validAnswers])];
                                setFormData({ ...formData, dataTambahan: { ...dt, wordBank: newBank } });
                              }} className="text-[10px] bg-cyan-100 text-cyan-700 px-3 py-1.5 rounded font-bold hover:bg-cyan-200 transition-colors shadow-sm">Atur otomatis dgn Kunci</button>
                            </div>

                            <div className="flex flex-wrap gap-2" dir="rtl">
                              {wordBank.map((w, i) => (
                                <div key={i} className="flex flex-col relative group">
                                  <input type="text" dir="auto" value={w} onChange={e => {
                                    const nw = [...wordBank]; nw[i] = e.target.value;
                                    setFormData({ ...formData, dataTambahan: { ...dt, wordBank: nw } });
                                  }} className="w-24 md:w-32 font-serif text-xl border border-cyan-200 rounded-xl p-3 bg-white shadow-sm focus:border-cyan-400 outline-none text-center" />
                                  <button type="button" onClick={() => {
                                    const nw = wordBank.filter((_, idx) => idx !== i);
                                    setFormData({ ...formData, dataTambahan: { ...dt, wordBank: nw } });
                                  }} className="absolute -top-2 -right-2 hidden group-hover:flex bg-rose-500 text-white rounded-full w-5 h-5 items-center justify-center shadow z-10"><X size={12} /></button>
                                </div>
                              ))}
                              <button type="button" onClick={() => {
                                setFormData({ ...formData, dataTambahan: { ...dt, wordBank: [...wordBank, ""] } });
                              }} className="w-24 md:w-32 flex justify-center items-center rounded-xl border-2 border-dashed border-cyan-300 bg-cyan-50/50 hover:bg-cyan-100 text-cyan-500 transition-colors">
                                <Plus size={20} />
                              </button>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-3 font-semibold">💡 Tips: Silakan edit manual bank kata untuk menambahkan "pengecoh" (*distractor*) agar lebih menantang bagi santri.</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* BUILDER STABILO_SYNTAX */}
                  {formData.tipeSoal === "STABILO_SYNTAX" && (() => {
                    const dt = formData.dataTambahan || {};
                    const categories: { name: string, color: string, label: string }[] = dt.categories || [
                      { name: "Kategori 1", color: "#3b82f6", label: "Kategori 1 (Biru)" }
                    ];
                    const words: { text: string, category: string }[] = dt.words || [];

                    const defaultColors = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#ec4899", "#14b8a6"];

                    return (
                      <div className="space-y-4">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Mewarnai Kategori Kata (Syntax Highlighting)</label>
                        <p className="text-xs text-purple-600 mb-2 font-medium">Buat beberapa kategori warna, lalu potong wacana menjadi kata-per-kata dan beri label kunci jawaban pada masing-masing kata tersebut.</p>

                        <div className="bg-white p-4 rounded-xl border border-purple-100 shadow-sm space-y-6">

                          {/* Categories Builder */}
                          <div className="bg-fuchsia-50/50 border border-fuchsia-100 rounded-xl p-4">
                            <h4 className="text-xs font-bold text-fuchsia-800 mb-3">Definisi Kategori & Warna:</h4>
                            <div className="space-y-2">
                              {categories.map((c, i) => (
                                <div key={i} className="flex gap-2 items-center bg-white p-2 rounded-lg border border-fuchsia-100 shadow-sm transition-colors focus-within:ring-2 focus-within:ring-fuchsia-200">
                                  <input type="color" value={c.color} onChange={e => {
                                    const nc = [...categories]; nc[i].color = e.target.value;
                                    setFormData({ ...formData, dataTambahan: { ...dt, categories: nc } });
                                  }} className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
                                  <input type="text" value={c.name} onChange={e => {
                                    const nc = [...categories]; nc[i].name = e.target.value;
                                    setFormData({ ...formData, dataTambahan: { ...dt, categories: nc } });
                                  }} className="w-1/3 flex-1 text-sm md:text-base font-bold p-1.5 border border-transparent focus:border-gray-200 rounded outline-none focus:bg-gray-50 text-gray-700" placeholder="ID / Singkatan" />
                                  <input type="text" value={c.label} onChange={e => {
                                    const nc = [...categories]; nc[i].label = e.target.value;
                                    setFormData({ ...formData, dataTambahan: { ...dt, categories: nc } });
                                  }} className="w-1/3 flex-1 text-sm md:text-base p-1.5 border border-transparent focus:border-gray-200 rounded outline-none focus:bg-gray-50 text-gray-600" placeholder="Label UI (opsional)" />
                                  <button type="button" onClick={() => {
                                    const nc = categories.filter((_, idx) => idx !== i);
                                    setFormData({ ...formData, dataTambahan: { ...dt, categories: nc } });
                                  }} className="p-2 text-gray-300 hover:text-rose-500 rounded hover:bg-rose-50 transition-colors"><X size={16} /></button>
                                </div>
                              ))}
                              <button type="button" onClick={() => {
                                const newColor = defaultColors[categories.length % defaultColors.length];
                                setFormData({ ...formData, dataTambahan: { ...dt, categories: [...categories, { name: `Kategori ${categories.length + 1}`, color: newColor, label: `Kategori Baru` }] } });
                              }} className="mt-4 text-[10px] bg-white border border-fuchsia-200 shadow-sm text-fuchsia-700 px-4 py-2 rounded-lg font-bold hover:bg-fuchsia-50 transition-colors inline-flex items-center gap-2"><Plus size={14} /> Tambah Kategori Warna</button>
                            </div>
                          </div>

                          {/* Words Builder */}
                          <div className="pt-2 border-t border-gray-100">
                            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
                              <label className="text-xs font-bold text-gray-500 block">Potongan Kata (Wacana) & Kunci Jawaban</label>
                              <button type="button" onClick={() => {
                                const inputText = prompt("Masukkan kalimat utuh untuk dipecah otomatis ke dalam balok-balok (pisahkan antar kata dengan spasi):");
                                if (inputText) {
                                  const newWords = inputText.trim().split(/\s+/).filter(Boolean).map(w => ({ text: w, category: "" }));
                                  setFormData({ ...formData, dataTambahan: { ...dt, words: [...words, ...newWords] } });
                                }
                              }} className="text-[10px] bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded font-bold hover:bg-indigo-200 transition-colors shadow-sm inline-flex items-center gap-1">✨ Auto-Pecah Spasi kalimat</button>
                            </div>

                            <div className="flex flex-wrap gap-2" dir="rtl">
                              {words.map((w, i) => {
                                const cat = categories.find(c => c.name === w.category);
                                return (
                                  <div key={i} className="flex flex-col relative group gap-1 border border-transparent hover:border-gray-200 p-2 rounded-xl transition-colors bg-gray-50/50 hover:bg-white" style={{ borderBottomColor: cat ? cat.color : undefined, borderBottomWidth: cat ? '4px' : undefined }}>
                                    <input type="text" dir="auto" value={w.text} onChange={e => {
                                      const nw = [...words]; nw[i].text = e.target.value;
                                      setFormData({ ...formData, dataTambahan: { ...dt, words: nw } });
                                    }} className="w-24 md:w-32 font-serif text-2xl pt-2 border-none bg-transparent outline-none text-center rounded focus:bg-white" placeholder="Kata..." />

                                    <select value={w.category} onChange={e => {
                                      const nw = [...words]; nw[i].category = e.target.value;
                                      setFormData({ ...formData, dataTambahan: { ...dt, words: nw } });
                                    }} className="w-full text-xs p-1.5 border border-gray-200 rounded font-bold outline-none mt-2 shadow-sm appearance-none text-center cursor-pointer" dir="ltr" style={{ backgroundColor: cat ? cat.color : '#fff', color: cat ? '#fff' : '#6b7280' }}>
                                      <option value="" className="bg-white text-gray-500">- Netral -</option>
                                      {categories.map(c => <option key={c.name} value={c.name} className="bg-white text-gray-700">{c.name}</option>)}
                                    </select>

                                    <button type="button" onClick={() => {
                                      const nw = words.filter((_, idx) => idx !== i);
                                      setFormData({ ...formData, dataTambahan: { ...dt, words: nw } });
                                    }} className="absolute -top-1 -right-1 hidden group-hover:flex bg-rose-500 text-white rounded-full w-5 h-5 items-center justify-center shadow z-10"><X size={12} /></button>
                                  </div>
                                )
                              })}
                              <button type="button" onClick={() => {
                                setFormData({ ...formData, dataTambahan: { ...dt, words: [...words, { text: "", category: "" }] } });
                              }} className="w-24 md:w-32 h-[5.5rem] mt-2 flex justify-center items-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 text-gray-400 transition-colors shadow-inner">
                                <Plus size={20} />
                              </button>
                            </div>
                            <p className="text-[10px] text-gray-400 mt-4 leading-relaxed max-w-lg">Saran: Biarkan kategori "- Netral -" pada kata-kata yang tidak memiliki nilai (tidak masuk ke kunci jawaban) agar murid tertantang membedakan mana yang merupakan target (misal: fi'il) dan yang bukan.</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* BUILDER JARING_RELASI */}
                  {formData.tipeSoal === "JARING_RELASI" && (() => {
                    const dt = formData.dataTambahan || {};
                    const leftItems: string[] = dt.leftItems || [];
                    const rightItems: string[] = dt.rightItems || [];
                    const connections: { left: number, right: number[] }[] = dt.connections || [];

                    const toggleConnection = (leftIdx: number, rightIdx: number) => {
                      const currentConnections = [...connections];
                      const conn = currentConnections.find(c => c.left === leftIdx);
                      if (conn) {
                        if (conn.right.includes(rightIdx)) {
                          conn.right = conn.right.filter(r => r !== rightIdx);
                        } else {
                          conn.right.push(rightIdx);
                        }
                      } else {
                        currentConnections.push({ left: leftIdx, right: [rightIdx] });
                      }
                      setFormData({ ...formData, dataTambahan: { ...dt, connections: currentConnections } });
                    };

                    return (
                      <div className="space-y-4">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider block">Jaring Relasi Kompleks (1-to-Many Matching)</label>
                        <p className="text-xs text-purple-600 mb-2 font-medium">Buat item di Kolom Kiri dan Kolom Kanan. Lalu centang relasi kunci jawabannya di bawah (1 item Kiri bisa berelasi ke banyak Kanan).</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Kolom Kiri */}
                          <div className="bg-white p-4 rounded-xl border border-orange-200 shadow-sm">
                            <h4 className="text-sm font-bold text-gray-700 mb-3 border-b border-gray-100 pb-2">Item Kolom Kiri (Asal)</h4>
                            <div className="space-y-2">
                              {leftItems.map((l, i) => (
                                <div key={i} className="flex gap-2 transition-transform hover:scale-[1.02]">
                                  <input type="text" dir="auto" value={l} onChange={e => {
                                    const nl = [...leftItems]; nl[i] = e.target.value;
                                    setFormData({ ...formData, dataTambahan: { ...dt, leftItems: nl } });
                                  }} className="flex-1 font-serif text-lg p-2 border border-orange-200 rounded-lg outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-right shadow-sm" placeholder={`Kiri ${i + 1}`} />
                                  <button type="button" onClick={() => {
                                    const nl = leftItems.filter((_, idx) => idx !== i);
                                    const nc = connections.filter(c => c.left !== i).map(c => ({ ...c, left: c.left > i ? c.left - 1 : c.left }));
                                    setFormData({ ...formData, dataTambahan: { ...dt, leftItems: nl, connections: nc } });
                                  }} className="p-2 bg-gray-50 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors border border-gray-200"><X size={16} /></button>
                                </div>
                              ))}
                              <button type="button" onClick={() => {
                                setFormData({ ...formData, dataTambahan: { ...dt, leftItems: [...leftItems, ""] } });
                              }} className="w-full py-2.5 mt-2 bg-orange-50 text-orange-600 font-bold text-xs rounded-lg hover:bg-orange-100 transition-colors border border-orange-200 border-dashed shadow-sm"><Plus size={14} className="inline mr-1" /> Tambah Item Kiri</button>
                            </div>
                          </div>

                          {/* Kolom Kanan */}
                          <div className="bg-white p-4 rounded-xl border border-orange-200 shadow-sm">
                            <h4 className="text-sm font-bold text-gray-700 mb-3 border-b border-gray-100 pb-2">Item Kolom Kanan (Tujuan)</h4>
                            <div className="space-y-2">
                              {rightItems.map((r, i) => (
                                <div key={i} className="flex gap-2 transition-transform hover:scale-[1.02]">
                                  <input type="text" dir="auto" value={r} onChange={e => {
                                    const nr = [...rightItems]; nr[i] = e.target.value;
                                    setFormData({ ...formData, dataTambahan: { ...dt, rightItems: nr } });
                                  }} className="flex-1 font-serif text-lg p-2 border border-orange-200 rounded-lg outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 text-right shadow-sm" placeholder={`Kanan ${i + 1}`} />
                                  <button type="button" onClick={() => {
                                    const nr = rightItems.filter((_, idx) => idx !== i);
                                    const nc = connections.map(c => ({ ...c, right: c.right.filter(x => x !== i).map(x => x > i ? x - 1 : x) })).filter(c => c.right.length > 0);
                                    setFormData({ ...formData, dataTambahan: { ...dt, rightItems: nr, connections: nc } });
                                  }} className="p-2 bg-gray-50 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors border border-gray-200"><X size={16} /></button>
                                </div>
                              ))}
                              <button type="button" onClick={() => {
                                setFormData({ ...formData, dataTambahan: { ...dt, rightItems: [...rightItems, ""] } });
                              }} className="w-full py-2.5 mt-2 bg-orange-50 text-orange-600 font-bold text-xs rounded-lg hover:bg-orange-100 transition-colors border border-orange-200 border-dashed shadow-sm"><Plus size={14} className="inline mr-1" /> Tambah Item Kanan</button>
                            </div>
                          </div>
                        </div>

                        {/* Kunci Jawaban Relasi */}
                        {leftItems.length > 0 && rightItems.length > 0 && (
                          <div className="bg-orange-50/70 p-4 shrink-0 rounded-xl border border-orange-200 shadow-sm mt-4">
                            <h4 className="text-sm font-bold text-orange-800 mb-4 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-orange-500"></div> Kunci Jawaban Silang (Relasi 1-to-Many):</h4>
                            <div className="space-y-3">
                              {leftItems.map((l, i) => {
                                const conn = connections.find(c => c.left === i);
                                const selectedRights = conn ? conn.right : [];
                                return (
                                  <div key={i} className="bg-white p-4 rounded-xl border border-orange-100 shadow-sm transition-shadow hover:shadow-md">
                                    <div className="font-bold font-serif text-xl md:text-2xl text-orange-700 right-0 text-right mb-3 pb-3 border-b border-orange-100/70 flex flex-col items-end gap-1">
                                      {l || `[Kiri ${i + 1} Kosong]`}
                                      <span className="text-[10px] bg-orange-100 text-orange-600 px-2 rounded-full font-sans tracking-wide uppercase">Berelasi Ke</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 justify-end mt-2" dir="rtl">
                                      {rightItems.map((r, j) => {
                                        const isConnected = selectedRights.includes(j);
                                        return (
                                          <button
                                            key={j}
                                            type="button"
                                            onClick={() => toggleConnection(i, j)}
                                            className={`px-4 py-2 text-base md:text-lg font-serif rounded-lg transition-all border outline-none active:scale-95 shadow-sm
                                                ${isConnected ? 'bg-orange-500 text-white border-orange-600 shadow-[0_4px_0_#c2410c] -translate-y-1' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-orange-50 hover:text-orange-600 hover:border-orange-200'}`}
                                          >
                                            {r || `[Kanan ${j + 1}]`}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl font-bold text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">Batal</button>
                <button type="submit" className="neu-button-primary px-8 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-sm shadow-md hover:shadow-lg transition-all transform active:scale-95">
                  <Save size={16} /> Simpan Soal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL IMPORT EXCEL */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="neu-card-white rounded-2xl w-full max-w-lg p-8 shadow-2xl">
            <h2 className="text-xl font-bold mb-2 font-display" style={{ color: "var(--color-text)" }}>
              Import Soal Excel
            </h2>
            <p className="text-sm text-gray-500 mb-4 font-medium leading-relaxed">Pastikan format kolom sesuai dengan template standar CBT.</p>

            <div className="mb-6 flex">
              <a href="/api/admin/ujian-usbu/bank-soal/template" download className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-primary-50)] text-[var(--color-primary)] rounded-xl text-sm font-bold shadow-sm transition hover:scale-105 active:scale-95">
                <FileSpreadsheet size={16} /> Download Template Excel
              </a>
            </div>

            <form onSubmit={handleImport} className="space-y-6">
              <div className="neu-card border-dashed p-6 text-center bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors relative">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  required
                  onChange={e => setImportFile(e.target.files?.[0] || null)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="pointer-events-none flex flex-col items-center">
                  <FileSpreadsheet size={32} className="text-blue-500 mb-2" />
                  <span className="font-bold text-gray-700">{importFile ? importFile.name : "Klik atau seret file ke sini"}</span>
                  <span className="text-xs text-gray-400 mt-1">Mendukung .xlsx dan .xls</span>
                </div>
              </div>

              <label className="flex items-start gap-4 p-4 rounded-xl border border-rose-200 bg-rose-50 cursor-pointer hover:bg-rose-100 transition-colors">
                <input type="checkbox" checked={importTimpa} onChange={e => setImportTimpa(e.target.checked)} className="rounded mt-1 w-5 h-5 accent-rose-600" />
                <div>
                  <span className="block text-sm font-bold text-rose-700">Timpa Soal Lama</span>
                  <span className="block text-xs text-rose-500 mt-1">Mencentang opsi ini akan menghapus semua soal yang sudah ada untuk Mapel dan Program terpilih!</span>
                </div>
              </label>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={() => setIsImportModalOpen(false)} className="px-5 py-2.5 rounded-xl font-bold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors">Batal</button>
                <button type="submit" disabled={importing || !importFile} className="px-6 py-2.5 bg-blue-600 text-white rounded-xl flex items-center justify-center gap-2 font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {importing ? "Membaca..." : "Upload & Import"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL TAMBAH JENIS SOAL */}
      {isAddJenisModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-sm flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-gray-800">Tambah Jenis Soal</h3>
              <button onClick={() => setIsAddJenisModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddJenisSoalSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider mb-2 text-gray-500">Pilih Tipe Soal</label>
                <select value={addJenisSoalTipe} onChange={e => setAddJenisSoalTipe(e.target.value)} className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold focus:ring-2 focus:border-[var(--color-primary)] outline-none">
                  {Object.entries(TIPE_SOAL_MAP).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsAddJenisModalOpen(false)} className="px-4 py-2 rounded-lg font-bold text-sm bg-gray-100 text-gray-600 hover:bg-gray-200">Batal</button>
                <button type="submit" className="px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg font-bold text-sm hover:brightness-95">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== FULLSCREEN PREVIEW OVERLAY ===== */}
      {isPreviewOpen && previewData && (() => {
        const soal = previewData.soal[previewIdx];
        if (!soal) return null;
        const isFirst = previewIdx === 0;
        const isLast = previewIdx === previewData.soal.length - 1;
        const currentAnswerState = previewAnswers[previewIdx] || {};

        return (
          <div className="fixed inset-0 bg-gray-50 flex flex-col md:flex-row font-sans z-[9999] overflow-hidden">
            <style dangerouslySetInnerHTML={{
              __html: `
              aside { display: none !important; }
              .app-footer { display: none !important; }
              .santri-bottom-nav, nav.fixed.bottom-0 { display: none !important; }
              .santri-mobile-menu-btn { display: none !important; }
              body { overflow: hidden !important; }
            `}} />

            {/* LEFT: Soal Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-white">
              {/* Header */}
              <div className="bg-white px-4 md:px-6 py-2.5 md:py-4 border-b flex justify-between items-center shadow-sm z-10 shrink-0">
                <div className="flex items-center gap-2 md:gap-3">
                  <div className="w-8 h-8 md:w-10 md:h-10 bg-purple-600 text-white font-bold text-sm md:text-lg rounded-lg md:rounded-xl flex items-center justify-center shadow-sm">
                    {soal.urutanUI}
                  </div>
                  <div>
                    <h1 className="font-bold text-xs md:text-sm text-gray-800 uppercase tracking-wide">SOAL {soal.urutanUI} / {previewData.totalSoal}</h1>
                    <p className="text-[9px] md:text-xs font-semibold text-purple-500 bg-purple-50 px-1.5 md:px-2 py-0.5 mt-0.5 rounded-full inline-block">{soal.mapelName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowPreviewNav(!showPreviewNav)} className="p-2 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition" title="Grid Navigasi Soal">
                    <Grid3X3 size={18} />
                  </button>
                  <div className="px-3 md:px-4 py-1.5 md:py-2 bg-purple-50 text-purple-700 border border-purple-100 rounded-lg md:rounded-xl font-bold text-xs md:text-sm">
                    <Eye size={14} className="inline mr-1.5" /> MODE PRATINJAU
                  </div>
                  <button onClick={closePreview} className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition shadow-sm border border-rose-100">
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Grid Navigator Overlay */}
              {showPreviewNav && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 md:p-8" onClick={() => setShowPreviewNav(false)}>
                  <div className="bg-white rounded-3xl shadow-2xl p-5 md:p-8 w-full max-w-3xl max-h-[80vh] md:max-h-[70vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-gray-800">Navigasi Soal</h3>
                      <button onClick={() => setShowPreviewNav(false)} className="p-1.5 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"><X size={18} /></button>
                    </div>
                    <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 mb-4">
                      {previewData.soal.map((s: any, idx: number) => {
                        const active = previewIdx === idx;
                        const isAnswered = !!previewAnswers[idx];
                        return (
                          <button key={s.soalId} onClick={() => { setPreviewIdx(idx); setShowCheck(false); setShowPreviewNav(false); }}
                            className={`h-10 md:h-12 w-full rounded-lg font-bold text-sm flex items-center justify-center transition-all border-2 shadow-sm 
                              ${active ? 'border-purple-600 ring-2 ring-purple-200 bg-purple-600 text-white' :
                                isAnswered ? 'bg-green-50 border-green-200 text-green-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                          >{idx + 1}</button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Soal Content */}
              <div className="flex-1 overflow-y-auto w-full md:w-4/5 mx-auto p-4 md:p-8 scroll-smooth pb-8">
                {/* Qiro'ah Parent Passage */}
                {soal.grupSoalId && (() => {
                  const parentSoal = previewData.soal.find((s: any) => s.soalId === soal.grupSoalId);
                  if (!parentSoal) return null;
                  return (
                    <div className="bg-purple-50/50 rounded-3xl p-6 md:p-8 shadow-sm border-2 border-purple-200 mb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded-md bg-purple-100 text-purple-600">Bacaan Qiro&apos;ah</span>
                      </div>
                      {parentSoal.gambarUrl && (
                        <div className="mb-4 flex justify-center">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={parentSoal.gambarUrl} alt="Bacaan" className="max-w-full max-h-[300px] rounded-xl border border-purple-200 shadow-sm" />
                        </div>
                      )}
                      <SoalText html={parentSoal.pertanyaan} className="text-base md:text-lg font-medium text-gray-800 leading-relaxed font-serif prose max-w-none block" />
                    </div>
                  );
                })()}

                <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-gray-100 mb-6">
                  {soal.perintah && (
                    <div className="mb-4">
                      <span className="inline-block px-3 py-1 bg-gray-100 text-gray-700 font-bold text-xs rounded-lg uppercase tracking-wider mb-2">Instruksi Soal</span>
                      <p className="text-sm font-medium text-gray-500 italic border-l-4 border-gray-300 pl-3 py-1">
                        {soal.perintah}
                      </p>
                    </div>
                  )}

                  {soal.gambarUrl && (
                    <div className="mb-6 flex justify-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={soal.gambarUrl} alt="Soal Image" className="max-w-full max-h-[300px] rounded-xl border border-gray-200 shadow-sm" />
                    </div>
                  )}
                  <SoalText html={soal.pertanyaan} className="text-base md:text-xl font-medium text-gray-800 leading-relaxed font-serif prose max-w-none block" />

                  {/* Kunci jawaban moved to showCheck overlay */}

                  {soal.dataTambahan && Object.keys(soal.dataTambahan).length > 0 && (
                    <div className="mt-6 p-4 bg-purple-50 border border-purple-100 rounded-xl overflow-auto hidden">
                      {/* JSON hidden in preview to simulate real test view */}
                      <pre className="text-xs md:text-sm text-purple-900 font-mono bg-white p-3 rounded-lg border border-purple-100">{JSON.stringify(soal.dataTambahan, null, 2)}</pre>
                    </div>
                  )}

                  <div className="mt-6 border-t pt-6">
                    <QuestionRenderer
                      soal={{
                        ...soal,
                        // inject answer state payload for preview
                        opsiTerpilih: currentAnswerState.opsiId,
                        jawabanTeks: currentAnswerState.jawabanTeks,
                        jawabanData: currentAnswerState.jawabanData
                      }}
                      onAnswer={(payload) => {
                        setPreviewAnswers({
                          ...previewAnswers,
                          [previewIdx]: { ...currentAnswerState, ...payload }
                        });
                        // Auto-check for simple MCQs
                        if (["PG", "BENAR_SALAH"].includes(soal.tipeSoal)) {
                          setShowCheck(true);
                        }
                      }}
                    />
                  </div>

                  <div className="mt-8 flex justify-center border-t border-dashed pt-6">
                    <button
                      onClick={() => setShowCheck(!showCheck)}
                      className="px-6 py-2.5 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 transition flex items-center gap-2 shadow-sm"
                    >
                      <CheckCircle2 size={18} /> {showCheck ? "Sembunyikan Kunci" : "Cek Jawaban Benar"}
                    </button>
                  </div>

                  {showCheck && (
                    <div className="mt-4 p-4 bg-green-50 border-2 border-green-200 rounded-2xl flex flex-col gap-2 relative overflow-hidden">
                      <h3 className="font-bold text-green-800 text-sm uppercase tracking-widest mb-1 flex items-center gap-2">
                        Kunci Jawaban Asli
                      </h3>
                      {["PG", "PG_MULTI", "BENAR_SALAH", "MUFRODAT", "ISIAN_SAMPING", "ISIAN_BAWAH"].includes(soal.tipeSoal) && (
                        <div className="space-y-2 relative z-10">
                          {soal.opsiList.map((j: any, i: number) => (
                            <div key={j.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 ${j.isCorrect ? 'border-green-500 bg-white ring-2 ring-green-100' : 'border-gray-100 bg-gray-50/50 opacity-50'}`}>
                              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold text-sm ${j.isCorrect ? 'bg-green-500 border-green-500 text-white' : 'border-gray-300 text-gray-400 bg-white'}`}>{String.fromCharCode(65 + i)}</div>
                              <div className="flex-1 font-medium text-gray-700 font-serif" dangerouslySetInnerHTML={{ __html: j.teks }} dir="auto"></div>
                              {j.isCorrect && <CheckCircle2 size={20} className="text-green-500" />}
                            </div>
                          ))}
                        </div>
                      )}
                      {["MENJODOHKAN", "MENGURUTKAN", "DRAG_KATEGORI", "KITABAH"].includes(soal.tipeSoal) && (
                        <div className="mt-2 text-sm text-green-800 bg-white p-3 rounded-xl border border-green-200">
                          <span className="font-bold border-b border-green-200 pb-1 mb-2 block">Kunci sudah ter-set pada Soal ini:</span>
                          <pre className="font-mono text-xs whitespace-pre-wrap">{JSON.stringify(soal.dataTambahan, null, 2)}</pre>
                        </div>
                      )}
                      {soal.kunciJawaban && (
                        <div className="mt-2 text-sm text-green-800 bg-white p-3 rounded-xl border border-green-200">
                          <span className="font-bold border-b border-green-200 pb-1 mb-2 block">Referensi Kunci Jawaban:</span>
                          <p className="whitespace-pre-wrap">{soal.kunciJawaban}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer Navigation */}
              <div className="w-full shrink-0 bg-white border-t p-3 sm:p-4 flex gap-2 md:gap-4 justify-between items-center z-20 shadow-[0_-10px_40px_-5px_rgba(0,0,0,0.05)]">
                <button
                  onClick={() => { setPreviewIdx(Math.max(0, previewIdx - 1)); setShowCheck(false); }}
                  disabled={isFirst}
                  className="px-2 md:px-5 py-2.5 sm:py-3 rounded-xl bg-gray-100 font-bold text-gray-700 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition flex gap-1 sm:gap-2 items-center flex-1 sm:flex-none justify-center text-[11px] sm:text-sm"
                >
                  <ChevronLeft size={18} /> <span className="hidden sm:inline">Soal</span> Sebelumnya
                </button>
                <div className="text-xs font-bold text-gray-400">{soal.urutanUI} / {previewData.totalSoal}</div>
                <button
                  onClick={() => { setPreviewIdx(Math.min(previewData.soal.length - 1, previewIdx + 1)); setShowCheck(false); }}
                  disabled={isLast}
                  className="px-2 md:px-5 py-2.5 sm:py-3 rounded-xl bg-purple-600 font-bold text-white hover:bg-purple-700 shadow-md shadow-purple-200 transition flex gap-1 sm:gap-2 items-center flex-1 sm:flex-none justify-center text-[11px] sm:text-sm disabled:opacity-30"
                >
                  <span className="hidden sm:inline">Soal</span> Berikutnya <ChevronRight size={18} />
                </button>
              </div>
            </div>

            {/* RIGHT: Grid Navigasi (Desktop) */}
            <div className="hidden md:flex flex-col w-80 lg:w-88 bg-white border-l h-full sticky top-0 shrink-0 shadow-[-5px_0_15px_-5px_rgba(0,0,0,0.02)]">
              <div className="p-5 border-b bg-gray-50/50">
                <h3 className="font-bold font-display text-gray-800">Navigasi Pratinjau</h3>
                <p className="text-xs text-gray-500 font-medium mt-1">Usbu&apos; {selectedUsbu}</p>
              </div>
              <div className="p-5 overflow-y-auto flex-1">
                <div className="grid grid-cols-5 lg:grid-cols-6 gap-2 xl:gap-3">
                  {previewData.soal.map((s: any, idx: number) => {
                    const active = previewIdx === idx;
                    return (
                      <button key={s.soalId} onClick={() => { setPreviewIdx(idx); setShowCheck(false); }}
                        className={`h-11 w-full rounded-lg font-bold text-sm flex items-center justify-center transition-all border-2 cursor-pointer shadow-sm active:scale-95 ${active ? 'border-purple-600 ring-2 ring-purple-200 bg-white text-purple-700' : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
                          }`}
                      >{idx + 1}</button>
                    );
                  })}
                </div>
              </div>
              <div className="p-4 border-t bg-gray-50 shrink-0">
                <button onClick={closePreview} className="w-full bg-rose-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-rose-700 shadow-md transition-colors">
                  <X size={18} /> Tutup Pratinjau
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
