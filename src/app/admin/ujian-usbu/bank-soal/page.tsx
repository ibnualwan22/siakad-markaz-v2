"use client";

import { useState, useEffect } from "react";
import { Plus, Edit2, Trash2, CheckCircle2, Save, GripVertical, FileSpreadsheet, Activity, Bold, Underline, Image as ImageIcon, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import SoalText from "@/components/soal-text";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

export default function BankSoalPage() {
  const [programList, setProgramList] = useState<any[]>([]);
  const [selectedProgram, setSelectedProgram] = useState("");
  const [selectedMapel, setSelectedMapel] = useState("");
  const [selectedUsbu, setSelectedUsbu] = useState("1");
  const [selectedPaketSoal, setSelectedPaketSoal] = useState("A");
  const [mapelOptions, setMapelOptions] = useState<any[]>([]);
  
  const [soalList, setSoalList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSoal, setLoadingSoal] = useState(false);

  // Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importTimpa, setImportTimpa] = useState(false);
  const [importing, setImporting] = useState(false);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({
    id: "",
    tipeSoal: "PG",
    pertanyaan: "",
    gambarUrl: "",
    bobot: 10,
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
      fetchSoal();
    } else {
      setSoalList([]);
    }
  }, [selectedMapel, selectedProgram, selectedUsbu, selectedPaketSoal]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const progRes = await fetch("/api/admin/program");
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
      const res = await fetch(`/api/admin/ujian-usbu/bank-soal?programId=${selectedProgram}&mapelId=${selectedMapel}&usbuKe=${selectedUsbu}&paketSoal=${selectedPaketSoal}`);
      if (res.ok) setSoalList(await res.json());
      else setSoalList([]);
    } catch {
      toast.error("Gagal load soal");
    } finally {
      setLoadingSoal(false);
    }
  };

  const handleCreateNew = () => {
    if (!selectedProgram || !selectedMapel) return toast.error("Pilih Program dan Mapel terlebih dahulu");
    setFormData({
      id: "",
      tipeSoal: "PG",
      paketSoal: selectedPaketSoal || "A",
      pertanyaan: "",
      gambarUrl: "",
      bobot: 10,
      jawabanList: [
        { id: `opt-${Date.now()}-1`, teks: "", gambarUrl: "", isCorrect: true },
        { id: `opt-${Date.now()}-2`, teks: "", gambarUrl: "", isCorrect: false },
        { id: `opt-${Date.now()}-3`, teks: "", gambarUrl: "", isCorrect: false },
        { id: `opt-${Date.now()}-4`, teks: "", gambarUrl: "", isCorrect: false }
      ]
    });
    setIsEditing(false);
    setIsModalOpen(true);
  };

  const handleEdit = (soal: any) => {
    setFormData({
      id: soal.id,
      tipeSoal: soal.tipeSoal,
      paketSoal: soal.paketSoal || "A",
      pertanyaan: soal.pertanyaan,
      gambarUrl: soal.gambarUrl || "",
      bobot: soal.bobot,
      // pad with empty answers if less than 4, map existing IDs for drag and drop
      jawabanList: [...soal.opsiList, ...Array(4).fill(null)].slice(0, 4).map((j: any, i: number) => 
        j ? { id: j.id || `opt-${i}`, teks: j.teks, gambarUrl: j.gambarUrl || "", isCorrect: j.isCorrect } : { id: `opt-new-${i}`, teks: "", gambarUrl: "", isCorrect: false }
      )
    });
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
    const hasCorrect = formData.jawabanList.some((j: any) => j.isCorrect);
    if (!hasCorrect) return toast.error("Harus ada 1 jawaban benar!");

    const validJawaban = formData.jawabanList.filter((j: any) => j.teks.trim() !== "" || !!j.gambarUrl);
    if (validJawaban.length < 2) return toast.error("Minimal 2 pilihan jawaban yang valid");

    const method = isEditing ? "PUT" : "POST";
    const url = isEditing ? `/api/admin/ujian-usbu/bank-soal/${formData.id}` : "/api/admin/ujian-usbu/bank-soal";

    const payload = {
      mapelId: selectedMapel,
      programId: selectedProgram,
      usbuKe: Number(selectedUsbu),
      paketSoal: formData.paketSoal,
      tipeSoal: formData.tipeSoal,
      pertanyaan: formData.pertanyaan,
      gambarUrl: formData.gambarUrl || null,
      bobot: Number(formData.bobot),
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

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile || !selectedMapel || !selectedProgram) return toast.error("File, sesi, dan program wajib diisi.");
    
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("mapelId", selectedMapel);
      formData.append("programId", selectedProgram);
      formData.append("usbuKe", selectedUsbu);
      formData.append("paketSoal", selectedPaketSoal);
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

      {/* Tabs Usbu' */}
      <div className="flex flex-col md:flex-row gap-4 mb-6 items-start md:items-center">
        <div className="flex gap-2">
          {["1", "2", "3"].map(u => (
            <button
              key={u}
              onClick={() => setSelectedUsbu(u)}
              className={`px-6 py-2.5 rounded-xl font-bold text-sm transition-all border-2 ${
                selectedUsbu === u
                  ? 'bg-[var(--color-primary)] text-white border-[var(--color-primary)] shadow-md'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
              }`}
            >
              Usbu' {u}{u === "3" ? " / Nihai" : ""}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-bold text-gray-600">Paket Soal:</label>
          <select 
             value={selectedPaketSoal} 
             onChange={e => setSelectedPaketSoal(e.target.value)} 
             className="neu-input py-2 px-4 text-sm font-bold"
          >
            {["A", "B", "C", "D"].map(paket => (
              <option key={paket} value={paket}>Paket {paket}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-4">
          <h2 className="font-bold text-lg" style={{ color: "var(--color-text)" }}>Daftar Soal ({soalList.length})</h2>
          <div className="hidden md:flex items-center gap-2 bg-[var(--color-primary-50)] text-[var(--color-primary)] px-3 py-1 rounded-xl text-xs font-bold">
            <Activity size={14}/> Total Poin: {soalList.reduce((sum, s) => sum + s.bobot, 0)}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsImportModalOpen(true)} disabled={!selectedMapel || !selectedProgram} className="font-bold text-sm px-4 py-2 bg-green-50 text-green-700 rounded-xl hover:bg-green-100 transition-colors flex gap-2 items-center shadow-sm">
            <FileSpreadsheet size={16}/> Import Excel
          </button>
          <button onClick={handleCreateNew} disabled={!selectedMapel || !selectedProgram} className="neu-button-primary px-4 py-2 flex items-center justify-center gap-2 rounded-xl text-sm font-bold shadow-sm">
            <Plus size={16}/> Tambah Soal
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
            <Activity size={32} className="text-gray-300"/>
          </div>
          <h3 className="font-bold text-lg text-gray-700">Belum Ada Soal</h3>
          <p className="mt-2 text-sm text-gray-500 mb-6 max-w-md mx-auto">Anda belum menambahkan soal untuk mata pelajaran ini. Silakan tambahkan soal secara manual atau import dari file Excel.</p>
          <button onClick={handleCreateNew} disabled={!selectedMapel || !selectedProgram} className="neu-button-primary px-6 py-2.5 rounded-xl font-bold text-sm inline-flex items-center gap-2">
            <Plus size={16}/> Buat Soal Pertama
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {soalList.map((soal, index) => (
            <div key={soal.id} className="neu-card-white p-0 rounded-2xl transition-all relative overflow-hidden group hover:shadow-md">
              <div className="absolute top-0 right-0 p-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleEdit(soal)} className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors shadow-sm"><Edit2 size={16}/></button>
                <button onClick={() => handleDelete(soal.id)} className="p-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 transition-colors shadow-sm"><Trash2 size={16}/></button>
              </div>
              
              <div className="p-6">
                <div className="flex gap-4 items-start">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm text-white bg-[var(--color-primary)]">
                    {index + 1}
                  </div>
                  <div className="flex-1 pr-20">
                    <div className="flex gap-3 mb-3 items-center flex-wrap">
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-gray-100 text-gray-600">Tipe: {soal.tipeSoal}</span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-orange-100 text-orange-600">Bobot: {soal.bobot} Poin</span>
                      <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-blue-100 text-blue-600">Paket: {soal.paketSoal || "A"}</span>
                    </div>
                    {soal.gambarUrl && (
                      <div className="mb-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={soal.gambarUrl} alt="Soal Image" className="max-w-full h-auto max-h-32 object-contain rounded-lg border shadow-sm" />
                      </div>
                    )}
                    <SoalText html={soal.pertanyaan} className="font-semibold text-base leading-relaxed mb-4 whitespace-pre-wrap text-gray-800 block" />
                    <div className="space-y-2.5">
                      {soal.opsiList.map((j: any, i: number) => (
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
                  <select 
                    value={formData.tipeSoal} 
                    onChange={e => setFormData({ ...formData, tipeSoal: e.target.value })} 
                    className="neu-input w-full p-3 text-sm font-semibold bg-gray-50 border-gray-200 focus:bg-white"
                  >
                    <option value="PG">Pilihan Ganda</option>
                    <option value="BENAR_SALAH" disabled>Benar/Salah (Segera)</option>
                    <option value="ISIAN" disabled>Isian Singkat (Segera)</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-bold text-gray-500">Paket:</label>
                  <select 
                    value={formData.paketSoal}
                    onChange={e => setFormData({ ...formData, paketSoal: e.target.value })}
                    className="neu-input w-24 p-3 text-sm font-bold focus:border-[var(--color-primary)]"
                  >
                    {["A", "B", "C", "D"].map(paket => (
                      <option key={paket} value={paket}>{paket}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm font-bold text-gray-500">Bobot Poin:</label>
                  <input 
                    type="number" min="1" required 
                    value={formData.bobot} 
                    onChange={e => setFormData({ ...formData, bobot: e.target.value })} 
                    className="neu-input w-24 p-3 text-sm text-center font-bold focus:border-[var(--color-primary)]" 
                  />
                </div>
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
                <div 
                  contentEditable
                  id="pertanyaan-editor"
                  onInput={(e) => setFormData({ ...formData, pertanyaan: (e.target as HTMLDivElement).innerHTML })}
                  className="neu-input w-full p-4 text-base focus:border-[var(--color-primary)] focus:bg-white resize-y bg-white border border-gray-200 rounded-xl outline-none min-h-[100px] whitespace-pre-wrap" 
                  dangerouslySetInnerHTML={{ __html: formData.pertanyaan }}
                  suppressContentEditableWarning
                />
              </div>

              <div className="bg-gray-50/50 -mx-8 px-8 py-6 border-t border-b">
                <div className="flex justify-between items-center mb-4">
                  <label className="block text-sm font-bold text-gray-700">Pilihan Jawaban</label>
                  <span className="text-xs text-green-600 font-semibold bg-green-50 px-2 py-1 rounded">Centang jawaban yang benar</span>
                </div>
                
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                  <SortableContext items={formData.jawabanList.map((j:any) => j.id)} strategy={verticalListSortingStrategy}>
                    <div className="space-y-3">
                      {formData.jawabanList.map((j: any, i: number) => (
                        <SortableItem key={j.id} id={j.id} className={`flex items-center gap-3 p-1 rounded-xl transition-colors border bg-white ${j.isCorrect ? 'border-green-400 shadow-sm' : 'border-gray-200'}`}>
                          <input 
                            type="radio" 
                            name="correct-answer" 
                            checked={j.isCorrect} 
                            onChange={() => {
                              const newJawaban = formData.jawabanList.map((ans: any, idx: number) => ({ ...ans, isCorrect: idx === i }));
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
                                onChange={e => {
                                  const newJawaban = [...formData.jawabanList];
                                  newJawaban[i].teks = e.target.value;
                                  setFormData({ ...formData, jawabanList: newJawaban });
                                }} 
                                className="flex-1 bg-transparent border-0 border-b border-transparent focus:border-[var(--color-primary)] focus:ring-0 px-2 py-2 text-sm font-medium transition-colors" 
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

              <div className="flex justify-end gap-3 pt-4">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2.5 rounded-xl font-bold text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors">Batal</button>
                <button type="submit" className="neu-button-primary px-8 py-2.5 rounded-xl flex items-center justify-center gap-2 font-bold text-sm shadow-md hover:shadow-lg transition-all transform active:scale-95">
                  <Save size={16}/> Simpan Soal
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
            <p className="text-sm text-gray-500 mb-4 font-medium leading-relaxed">Pastikan format kolom sesuai dengan template standar CBT. Soal akan masuk ke <strong>Paket {selectedPaketSoal}</strong> sesuai pilihan aktif.</p>
            
            <div className="mb-6 flex">
              <a href="/api/admin/ujian-usbu/bank-soal/template" download className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-primary-50)] text-[var(--color-primary)] rounded-xl text-sm font-bold shadow-sm transition hover:scale-105 active:scale-95">
                <FileSpreadsheet size={16}/> Download Template Excel
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
                  <FileSpreadsheet size={32} className="text-blue-500 mb-2"/>
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
    </div>
  );
}
