import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const oldName = "Duf'ah 92";
    const newName = "Dufah 91";

    console.log(`Menyiapkan pemulihan '${oldName}' kembali ke '${newName}'...`);

    // 1. Pastikan Dufah 91 tidak hilang sebagai induk
    const existing = await prisma.dufah.findUnique({
        where: { nama: newName }
    });

    if (!existing) {
        await prisma.dufah.create({
            data: { nama: newName }
        });
        console.log(`Dibuat ulang Angkatan Induk: ${newName}`);
    }

    // 2. Hapus Riwayat "Dufah 91" kosongan/duplikat hasil cetakan paksa sync
    // (Hal ini penting agar Constraint/Data Kembar tidak menolak langkah ke-3)
    const deletedRiwayat = await prisma.riwayatSantri.deleteMany({
        where: { dufahNama: newName }
    });
    console.log(`Dibersihkan ${deletedRiwayat.count} RiwayatSantri ${newName} (dari duplikat kosong).`);

    // 3. Kembalikan RiwayatSantri yang memiliki data historis asli dari Duf'ah 92 -> Dufah 91
    const updatedRiwayat = await prisma.riwayatSantri.updateMany({
        where: { dufahNama: oldName },
        data: { dufahNama: newName }
    });
    console.log(`Berhasil mengembalikan ${updatedRiwayat.count} RiwayatSantri historis utuh kembali ke ${newName}.`);

    // 4. Kembalikan tabel profil SantriInternal
    const updatedSantri = await prisma.santriInternal.updateMany({
        where: { dufahNama: oldName },
        data: { dufahNama: newName }
    });
    console.log(`Berhasil mengembalikan ${updatedSantri.count} data SantriInternal yang sempat tersesat.`);

    // 5. Hapus wadah rekam jejak Duf'ah 92
    try {
        await prisma.dufah.delete({
            where: { nama: oldName }
        });
        console.log(`Wadah angkatan kosong '${oldName}' telah dibersihkan sepenuhnya.`);
    } catch (e) {
        console.log(`Catatan: '${oldName}' dibiarkan karena ada bentrokan constraint dari tabel lain.`);
    }
}

main()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
