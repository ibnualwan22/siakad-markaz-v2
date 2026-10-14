"use client";

import { useEffect, useRef, useState } from "react";
import AutoFitText from "./AutoFitText";

const REF_W = 1600;

type FieldCfg = {
  x: number; // persen
  y: number; // persen
  fontSize: number; // px pada skala referensi
  align?: string;
  maxWidth?: number; // persen
};

const FIELD_LABEL: Record<string, string> = {
  nama: "Nama",
  juz: "Juz",
  predikat: "Predikat",
  periode: "Periode",
};

export default function CetakTemplateClient({
  programKey,
  data,
}: {
  programKey: string;
  data: {
    nama: string;
    juz: string;
    predikat: string;
    periode: string;
    template: { backgroundUrl: string | null; fieldPositions: Record<string, FieldCfg> };
  };
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [imgRatio, setImgRatio] = useState(9 / 16);

  const bg = data.template.backgroundUrl;
  const fields = data.template.fieldPositions || {};

  useEffect(() => {
    if (!bg) return;
    const img = new Image();
    img.onload = () => setImgRatio(img.naturalHeight / img.naturalWidth);
    img.src = bg;
  }, [bg]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setScale(el.clientWidth / REF_W);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const stageH = Math.round(REF_W * imgRatio);

  const fieldText: Record<string, string> = {
    nama: data.nama,
    juz: data.juz,
    predikat: data.predikat,
    periode: data.periode,
  };

  const renderField = (key: string) => {
    const cfg = fields[key] as FieldCfg | undefined;
    if (!cfg) return null;
    const maxW = ((cfg.maxWidth || 80) / 100) * REF_W;
    const posStyle: React.CSSProperties = {
      position: "absolute",
      left: `${cfg.x}%`,
      top: `${cfg.y}%`,
      transform: "translate(-50%, -50%)",
      width: maxW,
      textAlign: (cfg.align as any) || "center",
      direction: "rtl",
    };
    if (key === "nama") {
      return (
        <AutoFitText
          key={key}
          text={fieldText[key]}
          baseFontSize={cfg.fontSize}
          maxWidth={maxW}
          style={{ ...posStyle, fontWeight: 700 }}
        />
      );
    }
    return (
      <div key={key} style={{ ...posStyle, fontSize: cfg.fontSize, lineHeight: 1.4 }}>
        {fieldText[key]}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-200 print:bg-white">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-stage-wrap { transform: none !important; width: 100% !important; }
          @page { size: landscape; margin: 0; }
        }
      `}</style>

      <div className="no-print sticky top-0 z-10 bg-white/90 backdrop-blur border-b px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="font-bold">Cetak Syahadah — {programKey}</h1>
          <p className="text-sm text-slate-500">{data.nama}</p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-5 py-2 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700"
        >
          Cetak / PDF
        </button>
      </div>

      <div ref={wrapRef} className="mx-auto max-w-6xl p-4 print:p-0 print:max-w-none">
        <div
          className="print-stage-wrap relative overflow-hidden bg-white shadow-lg print:shadow-none"
          style={{
            width: REF_W,
            height: stageH,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            marginBottom: -stageH * (1 - scale),
          }}
        >
          {bg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={bg}
              alt="Template syahadah"
              className="absolute inset-0 w-full h-full object-fill"
              draggable={false}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-slate-400">
              Template belum memiliki background — upload di menu Template
            </div>
          )}
          {Object.keys(FIELD_LABEL).map(renderField)}
        </div>
      </div>
    </div>
  );
}
