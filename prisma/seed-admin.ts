import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding admin user...');

  // Password admin WAJIB disuplai via environment — jangan pernah hardcode
  // kredensial di repo (sebelumnya 'admin123' tertulis di repo publik).
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminPassword || adminPassword.length < 8) {
    console.error(
      "SEED_ADMIN_PASSWORD belum diset (minimal 8 karakter). " +
        "Set env tersebut sebelum menjalankan seed, mis.:\n" +
        "  SEED_ADMIN_PASSWORD='kata-sandi-kuat' npx prisma db seed"
    );
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      passwordHash, // Reset password if already exists
    },
    create: {
      nama: 'Super Admin',
      username: 'admin',
      passwordHash,
      role: "ADMIN",
      isActive: true,
    },
  });

  // Seed default permissions for ADMIN
  const defaultAdminPermissions = [
    'dashboard', 'absen_sakan', 'absen_kelas', 'absen_kegiatan', 
    'absen_pengajar', 'input_nilai', 'rekap_sakan', 'rekap_kelas', 
    'rekap_kegiatan', 'rekap_pengajar', 'manajemen_kelas', 
    'manajemen_dufah', 'manajemen_user', 'syahadah', 'manajemen_konten'
  ];

  for (const permission of defaultAdminPermissions) {
    await prisma.rolePermission.upsert({
      where: {
        role_permission: {
          role: "ADMIN",
          permission,
        }
      },
      update: {},
      create: {
        role: "ADMIN",
        permission,
      }
    });
  }

  console.log('Admin user seeded:', admin.username);
  console.log('Catatan: password diambil dari SEED_ADMIN_PASSWORD (tidak ditampilkan).');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
