import { toArabDigits } from "@/lib/munaqosah-hufadz";

// Blok tabel nilai syahadah Munaqosah — dipakai halaman cetak dan
// preview editor layout (satu komponen, satu tampilan).
// Semua angka tampil angka Arab (bukan Latin).
export default function MunaqosahNilaiTable({
  rows,
  rataRata,
  predikat,
  fontSize,
}: {
  rows: { arab: string; nilai: number }[];
  rataRata: number;
  predikat: string;
  fontSize: number;
}) {
  return (
    <div dir="rtl" style={{ fontSize, lineHeight: 1.5, color: "#111" }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>
        حصيلة نتيجة الطالب/الطالبة
      </div>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize,
        }}
      >
        <tbody>
          {rows.map((r) => (
            <tr key={r.arab}>
              <td
                style={{
                  border: "1px solid #999",
                  padding: "2px 10px",
                  textAlign: "right",
                }}
              >
                {r.arab}
              </td>
              <td
                style={{
                  border: "1px solid #999",
                  padding: "2px 10px",
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
      <div style={{ marginTop: 4 }}>
        بمعدل تراكمي عام ({toArabDigits(rataRata)}) وبتقدير {predikat}
      </div>
    </div>
  );
}
