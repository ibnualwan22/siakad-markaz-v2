import fs from "fs";

// PENTING: Jalankan script ini di environment LOKAL atau STAGING, BUKAN di Server Produksi utama
// Cara pakai: npx tsx scripts/load-test-ujian.ts --students=100

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const args = process.argv.slice(2);
const numStudentsArg = args.find(a => a.startsWith("--students="));
const NUM_STUDENTS = numStudentsArg ? parseInt(numStudentsArg.split("=")[1]) : 50;

// Token testing (harus valid jwt token santri jika ada middleware, atau kita buat mock di server)
// Karena script ini dijalankan eksternal, kita simulasi request dengan cookie auth yg valid
const TEST_COOKIE = process.env.TEST_COOKIE || "";

if (!TEST_COOKIE) {
  console.warn("⚠️ TEST_COOKIE tidak di-set. Jika API route butuh auth, request akan gagal.");
  console.warn("Silakan login sebagai santri, copy cookie 'auth-token' atau cookie sesi, dan set env TEST_COOKIE.");
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function simulateStudent(studentId: number) {
  console.log(`[Student ${studentId}] Memulai ujian...`);
  const startTime = Date.now();
  
  try {
    // 1. Dapatkan Sesi (Simulasi hit awal)
    // Dalam real life, santri hit /api/santri/ujian/start dengan kode
    // Untuk load test, kita harus punya cara generate sesi. 
    // Jika tidak ada seeder otomatis, ini hanya template alur request.

    // WARNING: Script ini butuh penyesuaian dengan flow spesifik auth aplikasi Anda
    const startRes = await fetch(`${BASE_URL}/api/santri/ujian/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": TEST_COOKIE },
      body: JSON.stringify({ kode: "KODE_TEST" })
    });

    if (!startRes.ok) {
        throw new Error(`Start gagal: ${startRes.status}`);
    }

    const startData = await startRes.json();
    const sesiId = startData.sesiId;
    const soalList = startData.soal;

    console.log(`[Student ${studentId}] Mulai sesi ${sesiId}. Total soal: ${soalList.length}`);

    // 2. Mengerjakan Soal (Loop)
    let successJawab = 0;
    for (let i = 0; i < Math.min(soalList.length, 10); i++) { // Limit 10 soal untuk tes
      const soal = soalList[i];
      
      // Jeda 3 - 8 detik antar jawaban
      await sleep(Math.floor(Math.random() * 5000) + 3000);
      
      const jawabRes = await fetch(`${BASE_URL}/api/santri/ujian/jawab`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cookie": TEST_COOKIE },
        body: JSON.stringify({
          sesiId,
          soalId: soal.soalId,
          opsiId: soal.opsi[Math.floor(Math.random() * soal.opsi.length)]?.id, // random opsi
        })
      });

      if (jawabRes.ok) {
        successJawab++;
      } else {
        console.error(`[Student ${studentId}] Gagal jawab soal ${i+1}: ${jawabRes.status}`);
      }
    }

    // 3. Submit
    const submitRes = await fetch(`${BASE_URL}/api/santri/ujian/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": TEST_COOKIE },
      body: JSON.stringify({
        sesiId,
        reason: "MANUAL"
      })
    });

    const duration = (Date.now() - startTime) / 1000;
    console.log(`✅ [Student ${studentId}] Selesai dalam ${duration.toFixed(1)}s. Jawab sukses: ${successJawab}`);

  } catch (err: any) {
    console.error(`❌ [Student ${studentId}] Error: ${err.message}`);
  }
}

async function runLoadTest() {
  console.log(`🚀 Memulai Load Test dengan ${NUM_STUDENTS} santri konstan...`);
  
  const promises = [];
  // Luncurkan "santri" secara bertahap dalam 10 detik agar tidak serentak millisecond yg sama
  for (let i = 1; i <= NUM_STUDENTS; i++) {
    const delay = Math.random() * 10000;
    promises.push(
      sleep(delay).then(() => simulateStudent(i))
    );
  }

  await Promise.all(promises);
  console.log(`🎉 Load Test Selesai.`);
}

runLoadTest();
