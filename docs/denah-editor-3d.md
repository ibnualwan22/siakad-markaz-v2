# Editor kawasan di Admin / Denah Lokasi Sakan

Pengguna menyetujui editor di halaman admin dan koleksi model sederhana lebih dahulu. Editor memperluas mode jelajah orang ketiga yang sudah ada. Aset mandiri GLB dapat diunggah, kemudian ditempatkan seperti aset bawaan.

## Keputusan dan kontrak tampilan

- Tombol Editor 3D di Denah Lokasi Sakan, hanya untuk ADMIN. Tampilan pengelolaan titik/foto tetap tersedia.
- Koleksi kiri, kanvas tengah, properti kanan; toolbar pindah/putar/ukuran, undo/redo, titik awal, simpan draf, coba jelajah, terbitkan. Panel ditumpuk pada layar kecil; pekerjaan penyusunan utama ditujukan ke laptop.
- Klik bangunan referensi untuk menggantinya dengan model, atau menyembunyikannya. Data OSM asli tetap utuh; perubahan disimpan sebagai susunan objek dan daftar bangunan yang disembunyikan.
- Aset bawaan: gedung dengan lantai/atap/warna, gerbang, pohon, pagar, bangku, lampu, papan nama. Ukuran dalam meter, putaran derajat, semua berdiri di tanah. Model impor mempertahankan material aslinya.
- Draf tidak dibaca santri. Terbitkan menyimpan snapshot yang diperiksa server; tersedia satu versi terbit sebelumnya untuk pemulihan. Revisi optimistis mencegah dua admin saling menimpa tanpa pemberitahuan.
- Saat pratinjau, sistem jelajah dan aturan tabrakan yang sama digunakan. Titik awal harus bebas hambatan. Bangunan pengganti menghapus hambatan asli; gerbang menyediakan celah tengah untuk berjalan.

## Penyimpanan dan batas awal

Tabel Prisma khusus menyimpan draf/versi terbit dan metadata aset. Berkas GLB disimpan sebagai raw asset di Cloudinary yang sudah digunakan aplikasi. Semua API penulisan memeriksa sesi ADMIN, masa sesi, dan asal permintaan. Model maksimal 3 MiB dengan tekstur tertanam PNG/JPEG; kompresi yang memerlukan decoder tambahan belum diterima. Tidak menjalankan skrip atau mengambil resource eksternal dari isi GLB. Maksimal 150 objek tambahan; aset tetap harus ringan untuk HP.

Penyimpanan bukan localStorage: hasil tetap tersedia di perangkat lain. Pratinjau boleh memakai draf lokal yang belum disimpan. Keluar saat ada perubahan menampilkan pilihan tetap tinggal/membuang perubahan. Kegagalan server, konflik revisi, unggahan, dan WebGL menampilkan pesan yang dapat ditindaklanjuti; tidak mengklaim berhasil sebelum server mengonfirmasi.

## Penerimaan

Uji validasi payload/GLB, penggantian hambatan, rotasi dan jalur gerbang, spawn yang terhalang, otorisasi API, konflik revisi, isolasi draf/terbit. Periksa browser untuk menambah/mengubah/duplikasi/hapus, undo/redo, simpan dan muat lagi, pratinjau, terbitkan, gagal simpan, dan ukuran layar kecil. Tidak menerbitkan perubahan kawasan pengguna sebagai bagian pengujian.

## Hasil implementasi dan pemeriksaan

Editor dan pratinjau telah diperiksa di Chromium pada ukuran desktop dan HP: penggantian bangunan, seret pegangan objek, properti, undo/redo, salin/hapus, draf, muat ulang, konflik revisi, publikasi pada server simulasi, serta gerakan keyboard di pratinjau. Handler API diuji dengan penyimpanan simulasi untuk otorisasi, masa sesi, revisi, isolasi draf, dan pemulihan versi. Satu GLB uji kecil berhasil diunggah dan diunduh lewat Cloudinary, kemudian dihapus kembali.

Dua tabel editor dibuat melalui transaksi SQL dari migrasi `20261114100000_denah_editor_3d`, tanpa mengubah tabel lama. Lingkungan database saat pemeriksaan tidak mempunyai tabel pencatatan `_prisma_migrations`; migrasi lain tidak dijalankan. Tidak ada draf atau versi terbit yang dibuat selama pengujian database. Deployment aplikasi belum dilakukan.

### Perbaikan penolakan asal permintaan

Pemeriksaan awal membandingkan `Origin` browser langsung dengan `request.url`. Pada deployment Docker/proxy, URL server dapat berupa HTTP internal sedangkan browser menggunakan HTTPS publik. Pemeriksaan sekarang memakai `X-Forwarded-Host` (atau `Host`) dan `X-Forwarded-Proto` untuk mencocokkan alamat publik. Proxy deployment harus menimpa kedua header ini dengan alamat yang diterimanya, bukan meneruskan nilai kiriman klien tanpa pemeriksaan. Domain lain, subdomain berbeda, port berbeda, metadata cross-site, serta header penerusan ambigu tetap ditolak. Hak akses akun dan pemeriksaan sesi tetap berlaku.

Regresi kasus proxy dan penolakan domain asing terdapat di `tests/denah-request-origin.test.ts`; kasus aset/objek di `tests/denah-scene.test.ts` dan gerakan di `tests/markaz-explore.test.ts`.

## Aset bawaan (14 November 2026)

Keputusan: gunakan tiga rumah Kenney City Kit Suburban untuk mengganti seluruh bangunan
referensi pada peta, serta karakter Blocky Characters sebagai pemain. Gedung `building-i`
dari City Kit Industrial tersedia sebagai calon aula di koleksi admin; admin menentukan
posisi aula dan papan namanya. Aset di-host lokal, tekstur tertanam, lisensi CC0 disertakan
di `public/models/markaz`. Tidak memerlukan seed database atau layanan CDN eksternal.

Rumah mengikuti sumbu tepi terpanjang bangunan, dengan jarak tepi 10%; bentuk footprint
menjadi persegi panjang berorientasi (pendekatan visual, bukan survei bangunan asli).
Collider pemain menggunakan ukuran yang sama. Varian dipilih secara deterministik dari
ID peta. Instancing per varian/blok 60 meter menghemat draw call; rumah dasar tidak
menghabiskan batas 150 objek tambahan. Model yang sebelumnya diganti/disembunyikan admin
masih dihormati. Pilih rumah lalu pilih aset untuk membuat salinan yang dapat digeser,
diputar, dan diubah ukurannya. Menghapus pengganti memunculkan rumah dasar kembali.

Koleksi bawaan dikenali server melalui manifest tetap, sehingga dapat disimpan dan
terbit tanpa catatan unggahan database. Aset unggahan tetap tersedia. Karakter memuat
animasi idle/walk/sprint dengan transisi; bila unduhan lokal gagal, bentuk prosedural
sementara tetap tersedia disertai pesan kesalahan. Permintaan dibatalkan dan GPU/mixer
objek dilepas saat kanvas ditutup. Total lima GLB sekitar 0,5 MiB.

Warung yang diminta: lihat `public/models/markaz/README.md`. Belum diimpor karena unduhan
resmi Sketchfab memerlukan login. Diperlukan berkas GLB/glTF dari pengguna, kemudian
validasi dan kredit CC BY 4.0 sebelum integrasi. Tidak ada lokasi warung/aula yang ditebak.

Validasi: tes GLB/manifest dan animasi, referensi aset bawaan, collision rumah berputar,
seluruh footprint nyata dan spawn, plus regresi denah. Pratinjau lokal memakai komponen
editor dan jelajah asli, API scene tiruan, dan Chromium. Tidak menulis data produksi.

### Rumah detail hanya di tepi jalan

Model Kenney dipakai untuk bangunan dengan jarak tepi footprint maksimal 4 meter dari
tepi jalan, termasuk ruang halaman depan. Perhitungan memperhitungkan lebar jalan dan
jarak antarsegmen, bukan jarak pusat bangunan, sehingga bangunan panjang di depan gang
pendek tetap terdeteksi. Data saat ini menghasilkan 502 rumah detail dan 860 rumah
sederhana. Bagian dalam blok tetap berbentuk rumah beratap pelana, dengan pintu dan dua
jendela, tetapi cukup satu mesh berwarna (26 segitiga) tanpa tekstur.

Kedua bentuk berbagi posisi, ukuran, collision, ID pemilihan, dan aturan sembunyikan/ganti
pada editor maupun jelajah. Model yang ditambahkan admin tetap memakai aset pilihannya.
Klasifikasi hanya berjalan sekali saat layer dibuat. Model detail diunduh hanya untuk
varian yang memiliki bangunan tepi jalan; saat loading/gagal, versi sederhana digunakan.
Instancing bangunan sederhana digabung per blok tanpa memisahkan varian, mengurangi draw
call awal dibanding menggunakan preset editor lengkap sebagai fallback.

Total geometri bangunan dasar berkurang dari 1.343.932 menjadi 518.088 segitiga (sekitar
61%). Ini perbandingan geometri, bukan jaminan kenaikan FPS pada HP tertentu. Warung akan
diunggah sendiri oleh pengguna melalui editor; bukan prasyarat perubahan rumah ini.
