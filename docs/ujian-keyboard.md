# Keyboard ujian Indonesia–Arab

Disetujui untuk mitigasi pertama pada web ujian usbu'. Semua isian teks santri memakai
keyboard halaman, termasuk esai, paragraf rumpang, dan tabel tasrif. Preview bank soal
admin tetap menerima keyboard biasa. Tidak ada perubahan API/format jawaban.

Keyboard mengikuti warna biru dan bidang putih halaman ujian. Arab menjadi bahasa awal,
dengan pergantian Indonesia, angka/simbol, harakat langsung, dan variasi pada tekan lama
450 ms (hamzah, alif, ya, ta marbutah, tanwin). Pengguna bisa melepas lalu mengetuk variasi,
atau menggeser jari ke variasi dan melepas. Tetap tersedia tombol hapus, spasi, enter,
penggerak kursor dan tutup. Keyboard dipasang di luar tabel yang di-zoom, tetap terlihat
dalam fullscreen, dan memberi ruang gulir supaya jawaban terlihat di atasnya.

Kolom jawaban readonly + inputmode none; perubahan normal hanya melalui tombol halaman.
Paste/drop/composition/input native ditolak/dikembalikan ke nilai aplikasi. Papan klip
perangkat tidak dibaca. Tidak menyimpulkan kecurangan dari panjang input atau memberi
hukuman baru. Ini tidak mengunci OS/perangkat atau mencegah manipulasi klien tingkat lanjut.

Tiap perubahan dikirim langsung ke state/penyimpanan lokal/antrean persisten halaman ujian.
Pengiriman server dibatasi jeda singkat, sehingga tidak perlu menunggu blur untuk menyimpan
huruf terakhir. Penutupan keyboard, pergantian soal, popup, rotasi, dan unmount membersihkan
penekanan/timer aktif. Harakat dihapus satu per satu sebelum huruf; teks campuran tetap
Unicode dengan arah otomatis. Uji unit operasi teks dan tes browser Chromium/WebKit untuk
tekan lama, cancel, penyuntingan, pergantian kolom, navigasi cepat, input terlarang, layar
kecil, orientasi, dan fullscreen. Tes browser emulasi tidak menggantikan uji HP fisik.

Validasi implementasi (15 November 2026): empat uji unit lulus, pemeriksaan TypeScript
terarah lulus, dan ESLint berkas baru lulus. Temuan lint pada dua berkas lama tetap
merupakan temuan yang sudah ada. Uji interaksi Chromium dan WebKit lulus pada ukuran
390×844 serta 844×390. Halaman ujian sebenarnya diuji dengan API tiruan untuk fullscreen,
simpan lokal seketika, pergantian soal, pemulihan jawaban kosong setelah offline/reload,
dan memastikan keyboard tidak memicu auto-submit. Keyboard bisa ditutup melalui panah
kanan atas sebelum menggunakan navigasi soal di bawahnya. Belum diuji pada HP fisik.
