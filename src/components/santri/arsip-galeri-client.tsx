"use client";

import { useState, useEffect } from "react";
import { Images, ExternalLink, Loader2, FolderOpen } from "lucide-react";

type Arsip = {
  id: string;
  judul: string;
  driveUrl: string;
  dufahNama: string;
  createdAt: string;
};

export function ArsipGaleriClient({ apiBase = "/api/santri/arsip-galeri" }: { apiBase?: string }) {
  const [dufahList, setDufahList] = useState<string[]>([]);
  const [activeDufah, setActiveDufah] = useState("");
  const [arsipList, setArsipList] = useState<Arsip[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchArsip(""); }, []);
  useEffect(() => { if (activeDufah) fetchArsip(activeDufah); }, [activeDufah]);

  const fetchArsip = async (dufahNama: string) => {
    setIsLoading(true);
    try {
      const q = dufahNama ? `?dufahNama=${encodeURIComponent(dufahNama)}` : "";
      const res = await fetch(`${apiBase}${q}`);
      const json = await res.json();
      setArsipList(Array.isArray(json.data) ? json.data : []);
      setDufahList(Array.isArray(json.dufahList) ? json.dufahList : []);
      if (!dufahNama && json.dufahNama) setActiveDufah(json.dufahNama);
    } catch {
      setArsipList([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-xl font-bold flex items-center gap-2 mb-4">
        <Images className="w-6 h-6 text-emerald-700" /> Arsip Galeri
      </h1>

      {dufahList.length > 0 && (
        <div className="mb-4">
          <select
            value={activeDufah}
            onChange={(e) => setActiveDufah(e.target.value)}
            className="border rounded-xl px-3 py-2.5 text-sm w-full bg-white shadow-sm"
          >
            {dufahList.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-emerald-700" /></div>
      ) : arsipList.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <FolderOpen className="w-14 h-14 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Belum ada arsip galeri</p>
          <p className="text-sm">untuk {activeDufah || "dufah ini"}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {arsipList.map((a) => (
            <div key={a.id} className="bg-white rounded-2xl shadow-sm border overflow-hidden flex flex-col">
              <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 p-5 flex items-center justify-center">
                <Images className="w-12 h-12 text-white/80" />
              </div>
              <div className="p-4 flex flex-col flex-1">
                <p className="font-semibold text-[15px] leading-snug mb-1">{a.judul}</p>
                <p className="text-xs text-gray-500 mb-3">
                  {a.dufahNama} • {new Date(a.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                </p>
                <a
                  href={a.driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-auto inline-flex items-center justify-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-medium py-2.5 rounded-xl"
                >
                  Buka di Google Drive <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
