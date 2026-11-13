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
