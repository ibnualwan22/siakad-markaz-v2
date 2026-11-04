import { toArabDigits } from "@/lib/munaqosah-hufadz";
import { pxRefToMm } from "@/lib/template-layout";

// Blok tabel nilai syahadah Munaqosah — dipakai halaman cetak dan
// preview editor layout (satu komponen, satu tampilan).
// Semua angka tampil angka Arab (bukan Latin).
// fontSize diterima sebagai angka referensi lama (tidak diubah) dan
// dirender dalam mm; padding sel ikut dikonversi supaya proporsinya
// terhadap font tetap sama seperti sebelumnya.
export default function MunaqosahNilaiTable({
  rows,
  rataRata,
  predikat,
  fontSize,
}: {
  rows: { arab: string; nilai: number }[];
  rataRata: number;
  predikat: string;
  fontSize: number; // angka referensi lama (px pada skala 1600)
}) {
  const fontMm = `${pxRefToMm(fontSize)}mm`;
  // Urutan shorthand CSS: vertikal dulu (2px lama), lalu horizontal (10px lama).
  const padMm = `${pxRefToMm(2)}mm ${pxRefToMm(10)}mm`;
  return (
    <div dir="rtl" style={{ fontSize: fontMm, lineHeight: 1.5, color: "#111" }}>
      <div style={{ fontWeight: 700, marginBottom: `${pxRefToMm(4)}mm` }}>
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
                  border: "1px solid #999",
                  padding: padMm,
                  textAlign: "right",
                }}
              >
                {r.arab}
              </td>
              <td
                style={{
                  border: "1px solid #999",
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
      <div style={{ marginTop: `${pxRefToMm(4)}mm` }}>
        بمعدل تراكمي عام ({toArabDigits(rataRata)}) وبتقدير {predikat}
      </div>
    </div>
  );
}
