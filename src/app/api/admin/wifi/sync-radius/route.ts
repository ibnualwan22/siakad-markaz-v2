import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // --- 1. Ambil Data Santri Aktif ---
    const sakanConfigs = await prisma.wifiSakanConfig.findMany({
      where: { enabled: true }
    });
    const enabledSakanNames = sakanConfigs.map(c => c.sakan);

    const santriList = await prisma.santriInternal.findMany({
      where: {
        isAktif: true,
        wifiEnabled: true,
        sakan: { in: enabledSakanNames }
      },
      select: { id: true, sakan: true }
    });

    // --- 2. Ambil Data Akun Civitas Aktif ---
    const civitasList = await prisma.wifiAccount.findMany({
      where: { isActive: true },
      include: { profile: true }
    });

    // --- 3. Ambil Data Voucher Aktif ---
    const voucherList = await prisma.wifiVoucher.findMany({
      where: {
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } }
        ]
      },
      include: { profile: true }
    });

    // --- 4. Ambil Daftar Profile untuk Mapping Bandwidth ---
    const profiles = await prisma.wifiProfile.findMany();

    // Mapping Sakan ke Profile (utk fallback)
    const sakanProfileMap = new Map<string, string>();
    for (const config of sakanConfigs) {
      if (config.profileId) {
        const p = profiles.find(pr => pr.id === config.profileId);
        if (p) sakanProfileMap.set(config.sakan, p.radiusGroup);
      }
    }

    // Persiapkan data untuk Bulk Insert (Manual Query)
    const radchecks: { username: string; attribute: string; value: string }[] = [];
    const radusergroups: { username: string; groupname: string }[] = [];
    const radgroupreplies: { groupname: string; attribute: string; value: string }[] = [];
    const validUsernames = new Set<string>();

    const defaultSantriGroup = profiles.find(p => p.name === 'Santri')?.radiusGroup || 'wifi-santri';
    const defaultCivitasGroup = profiles.find(p => p.name === 'Civitas')?.radiusGroup || 'wifi-civitas';
    const defaultTamuGroup = profiles.find(p => p.name === 'Tamu 2 Jam')?.radiusGroup || 'wifi-tamu';

    // A. Proses Santri
    for (const santri of santriList) {
      const gname = (santri.sakan && sakanProfileMap.get(santri.sakan)) || defaultSantriGroup;
      radchecks.push({ username: santri.id, attribute: 'Cleartext-Password', value: santri.id });
      radusergroups.push({ username: santri.id, groupname: gname });
      validUsernames.add(santri.id);
    }

    // B. Proses Civitas
    for (const civ of civitasList) {
      const gname = civ.profile?.radiusGroup || defaultCivitasGroup;
      radchecks.push({ username: civ.username, attribute: 'Cleartext-Password', value: civ.password });
      radusergroups.push({ username: civ.username, groupname: gname });
      validUsernames.add(civ.username);
    }

    // C. Proses Voucher
    for (const vouch of voucherList) {
      const gname = vouch.profile?.radiusGroup || defaultTamuGroup;
      const code = vouch.code;
      radchecks.push({ username: code, attribute: 'Cleartext-Password', value: code });
      
      // Jika ada expiresAt
      if (vouch.expiresAt) {
        // RADIUS Expiration format: "02 Sep 2026 15:30:00" atau epoch/tanggal lain yg didukung
        // Lebih aman pakai Unix timestamp atau string standar RFC2822
        // FreeRADIUS mensupport Expiration dengan format "DD MMM YYYY HH:MM:SS" atau epoch timestamp
        radchecks.push({ username: code, attribute: 'Expiration', value: Math.floor(vouch.expiresAt.getTime() / 1000).toString() });
      }

      radusergroups.push({ username: code, groupname: gname });
      validUsernames.add(code);
    }

    // D. Proses Profil Bandwidth
    for (const p of profiles) {
      radgroupreplies.push({ groupname: p.radiusGroup, attribute: 'WISPr-Bandwidth-Max-Down', value: String(p.downloadKbps * 1000) });
      radgroupreplies.push({ groupname: p.radiusGroup, attribute: 'WISPr-Bandwidth-Max-Up', value: String(p.uploadKbps * 1000) });
    }

    const usernameListStr = validUsernames.size > 0 
        ? Array.from(validUsernames).map(u => `'${u.replace(/'/g, "''")}'`).join(',')
        : "'__NOBODY__'";

    // --- 5. Eksekusi ke Database (Transaction) ---
    // Karena radcheck dll dibuat manual, pakai $transaction dengan $executeRawUnsafe
    const queries = [];

    // Hapus username yang tidak ada di list lagi (expired/disabled)
    queries.push(prisma.$executeRawUnsafe(`DELETE FROM radcheck WHERE username NOT IN (${usernameListStr})`));
    queries.push(prisma.$executeRawUnsafe(`DELETE FROM radusergroup WHERE username NOT IN (${usernameListStr})`));
    
    // UPSERT ke radcheck
    for (const r of radchecks) {
      queries.push(prisma.$executeRawUnsafe(`
        INSERT INTO radcheck (username, attribute, op, value) 
        VALUES ('${r.username.replace(/'/g, "''")}', '${r.attribute}', ':=', '${r.value.replace(/'/g, "''")}')
        ON CONFLICT (username, attribute) DO UPDATE SET value = EXCLUDED.value
      `));
    }

    // RECREATE radusergroup (karena gk ada unique constraint yang mudah diupdate)
    queries.push(prisma.$executeRawUnsafe(`DELETE FROM radusergroup WHERE username IN (${usernameListStr})`));
    for (const r of radusergroups) {
      queries.push(prisma.$executeRawUnsafe(`
        INSERT INTO radusergroup (username, groupname, priority) 
        VALUES ('${r.username.replace(/'/g, "''")}', '${r.groupname.replace(/'/g, "''")}', 1)
      `));
    }

    // UPSERT Profil Bandwidth via radgroupreply
    // Agar rapi, delete radgroupreply lalu populate? Atau upsert. Tapi radgroupreply tidak punya unique constraint di schema awal.
    // Kita hapus dulu yg berhubungan dgn max-down/max-up, lalu insert.
    queries.push(prisma.$executeRawUnsafe(`DELETE FROM radgroupreply WHERE attribute IN ('WISPr-Bandwidth-Max-Down', 'WISPr-Bandwidth-Max-Up')`));
    for (const r of radgroupreplies) {
      queries.push(prisma.$executeRawUnsafe(`
        INSERT INTO radgroupreply (groupname, attribute, op, value)
        VALUES ('${r.groupname}', '${r.attribute}', ':=', '${r.value}')
      `));
    }

    // Jalankan semua query serial
    await prisma.$transaction(queries);

    return NextResponse.json({
      success: true,
      summary: {
        totaleAkunWifi: validUsernames.size,
        santri: santriList.length,
        civitas: civitasList.length,
        vouchers: voucherList.length,
        profiles: profiles.length
      },
      message: `Sinkronisasi selesai. ${validUsernames.size} akun WiFi aktif.`
    });

  } catch (error) {
    console.error('WiFi RADIUS sync error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('radcheck') && msg.includes('does not exist')) {
      return NextResponse.json({
        error: 'Tabel RADIUS belum dibuat. Jalankan script SQL terlebih dahulu: scripts/setup-radius-tables.sql'
      }, { status: 400 });
    }
    return NextResponse.json({ error: msg || 'Gagal sinkronisasi WiFi RADIUS' }, { status: 500 });
  }
}
