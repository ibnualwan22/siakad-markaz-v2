"use client";

import { useState } from "react";
import QRCode from "react-qr-code";
import { Maximize2, X } from "lucide-react";

export function QrSayaClient({
  nama,
  payload,
  error,
}: {
  nama: string;
  payload: string | null;
  error: string | null;
}) {
  const [zoom, setZoom] = useState(false);

  if (error || !payload) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="font-semibold text-red-700">QR belum bisa ditampilkan</p>
        <p className="mt-1 text-sm text-red-600">
          {error || "Terjadi kesalahan."} Hubungi admin.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="rounded-2xl border bg-white p-6 text-center shadow-sm">
        <p className="text-sm text-gray-500">QR Absensi</p>
        <h2 className="mt-1 text-xl font-bold text-gray-900">{nama}</h2>
        <div className="mx-auto mt-4 w-fit rounded-xl border-4 border-gray-900 bg-white p-3">
          <QRCode value={payload} size={240} />
        </div>
        <p className="mt-4 text-sm text-gray-500">
          Tunjukkan QR ini ke petugas saat absensi kegiatan.
          Jangan bagikan ke orang lain.
        </p>
        <button
          onClick={() => setZoom(true)}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white"
        >
          <Maximize2 size={16} /> Perbesar
        </button>
      </div>

      {zoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-6"
          onClick={() => setZoom(false)}
        >
          <button
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white"
            onClick={() => setZoom(false)}
            aria-label="Tutup"
          >
            <X size={24} />
          </button>
          <div className="rounded-2xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <QRCode value={payload} size={320} />
            <p className="mt-3 text-center font-semibold text-gray-900">{nama}</p>
          </div>
        </div>
      )}
    </div>
  );
}
