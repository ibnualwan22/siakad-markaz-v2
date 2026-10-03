# Layar acara pemilihan lajnah

## Keputusan bersama

- Animasi Three.js ditampilkan di halaman khusus proyektor, terpisah dari formulir memilih di HP.
- Satu sesi bersama untuk pemilihan rois/roisah lajnah, memakai pasangan calon yang sudah didaftarkan admin.
- Perolehan setiap pasangan calon tetap terlihat langsung selama pemilihan.
- Admin membuka dan menutup sesi; batas waktu yang diatur juga mengakhiri penerimaan suara.
- Identitas pemilih tidak ditampilkan pada layar acara. Akses layar memakai login dan izin pengelolaan lajnah yang sudah ada.

## Arah tampilan

Kotak suara 3D menjadi pusat perhatian di panggung berwarna teal. Panel hasil memakai permukaan terang, nama calon besar, angka tabular, dan urutan nomor pasangan yang tetap. Warna mengikuti warna utama aplikasi (#006666), dengan putih gading dan aksen emas terbatas. Pilihan ini meneruskan konsep kotak suara yang sudah dibahas; alternatif pohon dan panggung tirai tidak dipakai karena kotak suara lebih langsung menjelaskan kegiatan memilih.

Sebelum pembukaan, panggung hijau memenuhi layar dengan kotak tertutup, cahaya lembut, dan pesan menunggu panitia. Saat admin membuka sesi, penutup kotak bergeser dengan sapuan cahaya; setelah 2,8 detik panggung mengecil ke samping perolehan suara. Selama pemilihan, tambahan suara nyata memicu surat suara netral masuk ke kotak; pembaruan pertama tidak memutar ulang semua suara lama. Lonjakan suara digabung agar gerakan tidak menumpuk.

Penutupan mempunyai dua alur yang disepakati:

- **Admin menutup:** server langsung menghentikan penerimaan suara dan menetapkan hasil. Setelah layar menerima status penutupan, panggung membesar dan menampilkan hitungan **5–4–3–2–1**, disertai teks “Pemilihan telah ditutup”. Lima detik ini hanya pengantar pengumuman, bukan perpanjangan waktu memilih. Pembaruan data berikutnya tidak mengulang hitungan.
- **Waktu habis:** panggung membesar dan menampilkan hitungan pada lima detik terakhir berdasarkan jam server. Saat nol, kotak menutup. Layar menunggu konfirmasi hasil server sebelum mengumumkan pasangan terpilih, termasuk bila koneksi terputus. Tidak ada hitungan lima detik kedua.

Pada pengumuman, kotak meredup dan mengecil, foto paslon serta nama pasangan muncul dengan aksen emas dan konfeti singkat. Bila foto tidak tersedia atau gagal dimuat, nomor pasangan menggantikannya. Hasil tetap tampil sampai panitia memilih “Lihat rekap suara”; pengumuman dapat ditampilkan kembali. Membuka ulang halaman sesi yang sudah ditutup langsung menampilkan hasil tanpa mengulang hitungan atau konfeti. Mode pengurangan gerakan mempertahankan informasi dan hitungan tanpa gerakan dekoratif.

## Kontrak desain dan perilaku

- Hierarki: judul dan status acara → kotak suara dan hasil paslon → waktu tersisa dan total suara.
- Layar 16:9 mendapat dua kolom; layar sempit menumpuk bagian tanpa memotong nama atau kontrol.
- Daftar paslon panjang dibagi dalam halaman yang dapat berganti; angka perolehan selalu berasal dari server.
- Tombol layar penuh, pengurangan gerakan, dan kembali ke admin tersedia tanpa menutupi informasi utama.
- Panggung otomatis memenuhi area halaman selama seremoni. Layar penuh browser tetap diaktifkan melalui tombol layar penuh agar sesuai izin browser.
- Loading, sesi tidak ditemukan, izin habis, koneksi terputus, DRAFT, BUKA, menunggu konfirmasi penutupan, dan TUTUP mempunyai tampilan jelas.
- Jika WebGL tidak tersedia, ilustrasi statis menggantikan objek 3D; status dan hasil tetap berfungsi.
- Animasi dibatasi resolusinya dan dihentikan ketika tab tersembunyi. Tidak ada audio otomatis atau model/aset 3D eksternal.

## Waktu dan konsistensi

Jam tampilan diselaraskan terhadap waktu server. Input tanggal admin dikirim sebagai ISO berzona. Penutupan manual dan karena deadline memakai satu logika server yang sama; pencatatan suara dan penutupan diserialkan per sesi untuk mencegah suara terlambat mengubah hasil akhir. Penutupan otomatis dipersistenkan pada permintaan berikutnya; penerimaan suara tetap menolak deadline yang telah lewat. Layar mengambil data setiap tiga detik, lebih sering mendekati batas waktu, dan langsung memperbarui setelah menerima pemberitahuan admin dari tab lain pada browser yang sama. Pemberitahuan tersebut hanya memicu pengambilan data resmi, tidak membawa hasil pemilihan. Tidak ditambahkan scheduler atau migrasi basis data.

Kebijakan pemenang yang sudah ada—suara tertinggi, nomor urut terkecil bila seri, dan pasangan pemenang menjadi anggota lajnah—dipertahankan. Aturan gender, hak memilih, dan struktur pasangan tidak diubah oleh penambahan layar acara.

## Asumsi dan batasan

Proyektor dijalankan dari browser modern oleh panitia yang sudah login. Pengambilan data memakai pola pembaruan tiga detik aplikasi; tidak diasumsikan jumlah peserta atau persentase partisipasi tanpa data pemilih berhak. Komponen 3D dipisahkan dari logika pemilihan supaya tim aplikasi dapat merawatnya. Uji visual memakai data demonstrasi terisolasi; pengujian tidak mengubah data pemilihan nyata.
