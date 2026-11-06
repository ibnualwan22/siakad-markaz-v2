import { toArabDigits } from "@/lib/munaqosah-hufadz";
import { pxRefToMm } from "@/lib/template-layout";

// Blok tabel nilai syahadah Munaqosah — dipakai halaman cetak dan
// preview editor layout (satu komponen, satu tampilan).
// Semua angka tampil angka Arab (bukan Latin).
// fontSize diterima sebagai angka referensi lama (tidak diubah) dan
// dirender dalam mm; padding sel ikut dikonversi supaya proporsinya
// terhadap font tetap sama seperti sebelumnya.
// CATATAN: baris rata-rata & predikat BUKAN bagian komponen ini lagi —
// ia adalah field layout sendiri ("rataRata") di TemplateStage, supaya
// posisinya bisa diatur independen (drag / X-Y) di editor, bukan sekadar
// jeda margin di bawah tabel.
export default function MunaqosahNilaiTable({
  rows,
  fontSize,
}: {
  rows: { arab: string; nilai: number }[];
  fontSize: number; // angka referensi lama (px pada skala 1600)
}) {
  const fontMm = `${pxRefToMm(fontSize)}mm`;
  // Urutan shorthand CSS: vertikal dulu (2px lama), lalu horizontal (10px lama).
  const padMm = `${pxRefToMm(2)}mm ${pxRefToMm(10)}mm`;
  return (
    <div dir="rtl" style={{ fontSize: fontMm, lineHeight: 1.5, color: "#111" }}>
      <div
        style={{
          fontWeight: 700,
          textAlign: "center",
          border: "2px solid #999",
          padding: padMm,
          marginBottom: `${pxRefToMm(4)}mm`,
        }}
      >
        حصيلة نتيجة الطالب/الطالبة
      </div>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: fontMm,
        }}
      >
        <tbody>
          {rows.map((r) => (
            <tr key={r.arab}>
              <td
                style={{
                  border: "2px solid #999",
                  padding: padMm,
                  textAlign: "right",
                }}
              >
                {r.arab}
              </td>
              <td
                style={{
                  border: "2px solid #999",
                  padding: padMm,
                  textAlign: "center",
                  width: "22%",
                }}
              >
                {toArabDigits(r.nilai)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
