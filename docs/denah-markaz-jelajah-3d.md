# Jelajah jalan Markaz Arabiyah

## Keputusan desain

- Portal santri tetap membuka peta 2D. Tombol **Jelajah 3D** membuka pengalaman orang ketiga, sesuai pilihan pengguna.
- Karakter sementara berupa penjelajah sederhana dengan pakaian hijau dan tas. Kamera mengikuti karakter dari belakang; layar bisa digeser untuk melihat sekeliling.
- Area dibatasi di sekitar Markaz Arabiyah, berpusat pada koordinat Maktab di data lokasi. Fokus berjalan di jalan luar, bukan masuk ruangan.
- Keyboard WASD/panah dan Shift untuk berlari; HP menggunakan joystick dan tombol lari. Ada tombol kembali ke titik awal, peta kecil, dan detail lokasi yang sudah ada.
- Posisi karakter adalah virtual, tidak memerlukan GPS, dan tidak disimpan atau dibagikan. GPS tetap tersedia untuk navigasi nyata di mode 2D.
- Three.js langsung dipertahankan agar tidak menambah mesin peta lain. Bentuk bangunan disederhanakan; ini bukan rekonstruksi foto atau Street View.

## Asumsi dan batasan

Target awal 30 fps dengan resolusi terbatas di HP. Data kawasan kecil dimuat sekali; rendering berhenti saat tab tidak terlihat. Aset geometri, material, dan event listener dibersihkan ketika keluar dari mode 3D. Perangkat tanpa WebGL mendapat tombol kembali ke peta 2D. Pengujian perangkat fisik tetap diperlukan untuk memastikan performa.

Jalan dan jejak bangunan mengikuti data publik OpenStreetMap yang tersedia, bukan susunan jalan rekaan. Tinggi dan warna bangunan adalah ilustrasi ketika tidak tersedia di sumber. Penanda sakan mengikuti data admin; pengelola tetap bertanggung jawab memperbarui koordinat dan foto. Atribusi OpenStreetMap terlihat di layar dan asal data dicatat bersama snapshot.

## Kontrak tampilan dan penerimaan

Layar mengutamakan dunia 3D dan karakter. Judul di kiri atas, pengalih mode dan peta kecil di kanan, kontrol gerak di bawah. Kontrol tidak tertutup navigasi portal di HP. Panel detail/daftar menghentikan gerakan karakter. Status memuat, kegagalan data/WebGL, dan kembali ke 2D harus dapat digunakan tanpa gerakan karakter.

Karakter berjalan relatif terhadap arah kamera dengan kecepatan diagonal yang sama, tidak menembus bangunan, dan tidak keluar batas kawasan. Kamera bisa diputar dengan sentuhan/mouse tanpa pointer lock. Melepas joystick, kehilangan fokus, atau berpindah tab harus menghentikan gerakan. Tombol titik awal mengembalikan karakter dan kamera. Minimap harus mencerminkan posisi dan arah aktual karakter.

## Implementasi dan validasi

Snapshot publik di `public/maps/markaz-area.json` memuat 81 rangkaian jalan dan 1.362 jejak bangunan. Kawasan berjalan dibatasi radius 300 meter; titik awal dipilih otomatis di jalan terdekat dari Maktab yang tidak bertabrakan dengan bangunan. Atribusi dan langkah pembaruan ada di `public/maps/README.md`, dengan pengimpor `scripts/import-markaz-map.py`.

Geometri bangunan digabung per petak agar bagian di luar pandangan dapat dilewati oleh renderer. Resolusi dibatasi 1,5 kali piksel layar dan loop dibatasi sekitar 30 fps. Tabrakan kamera mencegah kamera masuk dinding. Animasi langkah mengikuti jarak gerak, termasuk saat berlari. Penanda lokasi memakai API denah yang sudah ada.

Enam uji otomatis di `tests/markaz-explore.test.ts` lolos: proyeksi, arah/kecepatan gerak, tabrakan dan batas, poligon, kelayakan titik awal pada snapshot sebenarnya, dan tidak adanya titik awal saat semua jalan terhalang. TypeScript untuk berkas yang diubah lolos; ESLint tanpa error dengan tiga peringatan `<img>` yang sudah ada di tampilan foto 2D/detail.

Uji Chromium lokal memakai data lokasi contoh dan WebGL perangkat lunak: keyboard, kembali ke awal, jeda saat daftar lokasi terbuka, kehilangan fokus, joystick serta kamera dengan dua sentuhan, melepas joystick, pergantian 2D/3D, GPS hanya atas permintaan, kegagalan memuat data, mencoba ulang, kehilangan konteks WebGL, dan pembersihan canvas. Tampilan diperiksa pada desktop dan viewport HP. Uji ini memvalidasi perilaku, bukan jaminan fps di HP fisik; performa dan kenyamanan tetap perlu diperiksa pada perangkat pengguna. Belum melakukan deployment.
