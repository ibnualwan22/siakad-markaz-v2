require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const si = require('systeminformation');
const { exec } = require('child_process');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const axios = require('axios');

// ===================== KONFIGURASI =====================
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" });
const MY_CHAT_ID = process.env.MY_CHAT_ID;

// Threshold peringatan
const RAM_THRESHOLD = 90;    // Persen
const CPU_THRESHOLD = 90;    // Persen
const DISK_THRESHOLD = 85;   // Persen
const CHECK_INTERVAL = 300000; // 5 menit (dalam ms) untuk server

const SITES_TO_MONITOR = [
  { name: 'SIAKAD', url: 'https://siakad.markazarabiyah.site', container: 'siakad-app' },
  { name: 'PPDB', url: 'https://ppdb.markazarabiyah.site', container: 'ppdb_app' },
  { name: 'E-MALIYAH', url: 'https://e-maliyah.markazarabiyah.site', container: 'rekap-gaji-app' }
];

let siteStatus = {
  'SIAKAD': true,
  'PPDB': true,
  'E-MALIYAH': true
};

// Tracker CPU tinggi berturut-turut
let highCpuCount = 0;

// ===================== FUNGSI UTILITAS =====================

// Ambil info RAM (sesuai gaya Tencent)
async function getMemInfo() {
  const mem = await si.mem();
  const used = mem.total - mem.available;
  return {
    totalGB: (mem.total / 1073741824).toFixed(2),
    usedGB: (used / 1073741824).toFixed(2),
    availableGB: (mem.available / 1073741824).toFixed(2),
    percent: ((used / mem.total) * 100).toFixed(1),
  };
}

// Ambil info CPU
async function getCpuInfo() {
  const cpu = await si.currentLoad();
  return { percent: cpu.currentLoad.toFixed(1) };
}

// Ambil info Disk
async function getDiskInfo() {
  const disk = await si.fsSize();
  const root = disk.find(d => d.mount === '/') || disk[0];
  return {
    totalGB: (root.size / 1073741824).toFixed(1),
    usedGB: (root.used / 1073741824).toFixed(1),
    percent: root.use.toFixed(1),
  };
}

// Cek status kontainer Docker
function checkContainers() {
  return new Promise((resolve) => {
    exec('sudo docker ps --format "{{.Names}}|{{.Status}}" -a', (err, stdout) => {
      if (err) return resolve([]);
      const containers = stdout.trim().split('\n').filter(Boolean).map(line => {
        const [name, status] = line.split('|');
        return { name, status, running: status?.startsWith('Up') };
      });
      resolve(containers);
    });
  });
}

// Ambil Raw Docker Logs untuk error
function getRawDockerLogs(containerName, tail = 50) {
  return new Promise((resolve) => {
    exec(`sudo docker logs ${containerName} --tail ${tail} 2>&1`, (err, stdout) => {
      resolve(stdout || 'Tidak ada log ditemukan');
    });
  });
}

// Analisis error oleh AI
async function analyzeWithAI(context) {
  try {
    const prompt = `Kamu adalah "Aegis", bot AI penjaga VPS.
Analisis masalah berikut dan berikan solusi singkat dalam bahasa Indonesia (maks 5 kalimat):

${context}`;
    const result = await model.generateContent(prompt);
    return result.response.text();
  } catch (e) {
    console.error("AI Error:", e.message);
    return "⚠️ Gagal mendapatkan analisis dari AI. Silakan cek log mentah secara manual di atas.";
  }
}

// ===================== MONITORING WEBSITE =====================
async function monitorWebsites() {
  if (!MY_CHAT_ID || MY_CHAT_ID === '') return;
  for (const site of SITES_TO_MONITOR) {
    try {
      const response = await axios.get(site.url, { timeout: 15000 }); 
      if (!siteStatus[site.name]) {
        siteStatus[site.name] = true;
        bot.telegram.sendMessage(MY_CHAT_ID, `✅ *PULIH:* Website ${site.name} merespons kembali dengan normal!`, { parse_mode: 'Markdown' });
      }
    } catch (error) {
      if (siteStatus[site.name]) { 
        siteStatus[site.name] = false; 
        
        let errorReason = error.response ? `HTTP ${error.response.status}` : error.message;
        
        // Ambil Log Terminal
        const rawLogs = await getRawDockerLogs(site.container, 100);
        const snippet = rawLogs.slice(-1500); // Batasi supaya muat di prompt API
        
        // Tampilkan 10 baris terakhir log (maksimal) untuk di telegram
        const lines = rawLogs.trim().split('\n');
        const telegramLogSnippet = lines.slice(-12).join('\n').slice(-500);

        // 1. Kirim alert status dan raw log
        await bot.telegram.sendMessage(MY_CHAT_ID,
          `🚨 *PERINGATAN: WEBSITE DOWN!* 🚨\n\n` +
          `🌐 *${site.name}*\n` +
          `🛑 Error: ${errorReason}\n\n` +
          `📜 *Log Terminal Asli (${site.container}):*\n\`\`\`\n${telegramLogSnippet}\n\`\`\``, 
          { parse_mode: 'Markdown' }
        );

        // 2. Minta AI Menganalisa & Kirim Solusi
        const analysis = await analyzeWithAI(`Terjadi ${errorReason} pada website ${site.name}. Berikut log terminal Docker:\n${snippet}\nJelaskan masalah teknisnya dan berikan solusi.`);
        await bot.telegram.sendMessage(MY_CHAT_ID, `💡 *Saran Aegis (AI):*\n\n${analysis}`, { parse_mode: 'Markdown' });
      }
    }
  }
}

// ===================== TOMBOL MENU UTAMA =====================
function mainMenu() {
  return Markup.keyboard([
    ['📊 Status VPS', '🔍 Cek Log'],
    ['🐳 Docker', '🌐 Status Web'],
    ['💾 Disk', '🤖 Tanya AI'],
  ]).resize();
}

// ===================== MIDDLEWARE KEAMANAN =====================
bot.use((ctx, next) => {
  if (!MY_CHAT_ID || MY_CHAT_ID === '') {
    ctx.reply(`👋 Halo! Chat ID Telegram Anda: *${ctx.from.id}*\n\n⚠️ Masukkan ID ini ke MY_CHAT_ID di file .env, lalu restart bot.`, { parse_mode: 'Markdown' });
    return;
  }
  if (ctx.from.id.toString() !== MY_CHAT_ID.toString()) return;
  return next();
});

// ===================== PERINTAH-PERINTAH =====================

bot.start((ctx) => {
  ctx.reply(
    '🛡️ *AEGIS VPS Monitor Aktif!*\n\nAegis sekarang menjaga respons Web & Kinerja VPS 24/7.',
    { parse_mode: 'Markdown', ...mainMenu() }
  );
});

// 🌐 Status Web
bot.hears(['🌐 Status Web', '/web'], async (ctx) => {
  let msg = '🌐 *STATUS WEBSITE SAAT INI*\n━━━━━━━━━━━━━━━━━━━━\n';
  SITES_TO_MONITOR.forEach(site => {
    msg += `${siteStatus[site.name] ? '🟢' : '🔴'} *${site.name}*\n`;
  });
  ctx.reply(msg, { parse_mode: 'Markdown' });
});

bot.hears(['📊 Status VPS', '/status'], async (ctx) => {
  ctx.reply('⏳ Mengambil data dari server...');
  const mem = await getMemInfo();
  const cpu = await getCpuInfo();
  const disk = await getDiskInfo();

  const statusEmoji = (val) => val > 80 ? '🔴' : val > 60 ? '🟡' : '🟢';

  ctx.reply(
    `📊 *KONDISI VPS SAAT INI*\n` +
    `━━━━━━━━━━━━━━━━━━━━\n` +
    `${statusEmoji(cpu.percent)} *CPU:* ${cpu.percent}%\n` +
    `${statusEmoji(mem.percent)} *RAM:* ${mem.usedGB} GB / ${mem.totalGB} GB (${mem.percent}%)\n` +
    `   Tersedia: ${mem.availableGB} GB\n` +
    `${statusEmoji(disk.percent)} *Disk:* ${disk.usedGB} GB / ${disk.totalGB} GB (${disk.percent}%)\n` +
    `━━━━━━━━━━━━━━━━━━━━`,
    { parse_mode: 'Markdown' }
  );
});

// Mengecek manual log spesifik aplikasi terbaru saat dicurigai error
bot.hears(['🔍 Cek Log', '/ceklog'], async (ctx) => {
  ctx.reply('🔍 Memeriksa log siakad-app (default)... untuk spesifik gunakan chat ya.');
  const logs = await getRawDockerLogs('siakad-app', 50);
  const snippet = logs.slice(-1500);
  
  if (snippet.length > 10) {
    ctx.reply('🚨 Mengirim log terbaru ke AI untuk analisis...');
    const analysis = await analyzeWithAI(`Berikut 50 baris terakhir log dari siakad-app:\n${snippet}`);
    ctx.reply(`💡 *ANALISIS AEGIS:*\n\n${analysis}`, { parse_mode: 'Markdown' });
  } else {
    ctx.reply('✅ Log kosong atau gagal diambil.');
  }
});

bot.hears(['🐳 Docker', '/docker'], async (ctx) => {
  ctx.reply('🐳 Mengecek status kontainer Docker...');
  const containers = await checkContainers();

  if (containers.length === 0) {
    ctx.reply('⚠️ Tidak ada kontainer Docker yang terdeteksi.');
    return;
  }

  let msg = '🐳 *STATUS DOCKER CONTAINERS*\n━━━━━━━━━━━━━━━━━━━━\n';
  containers.forEach(c => {
    const icon = c.running ? '🟢' : '🔴';
    msg += `${icon} *${c.name}*\n   ${c.status}\n`;
  });
  ctx.reply(msg, { parse_mode: 'Markdown' });
});

bot.hears(['💾 Disk', '/disk'], async (ctx) => {
  const disk = await getDiskInfo();
  const statusEmoji = disk.percent > 85 ? '🔴' : disk.percent > 70 ? '🟡' : '🟢';
  ctx.reply(
    `💾 *STATUS DISK*\n━━━━━━━━━━━━━━━━━━━━\n` +
    `${statusEmoji} Terpakai: ${disk.usedGB} GB / ${disk.totalGB} GB (${disk.percent}%)\n` +
    `   Tersisa: ${(disk.totalGB - disk.usedGB).toFixed(1)} GB`,
    { parse_mode: 'Markdown' }
  );
});

bot.hears(['🤖 Tanya AI', '/ai'], (ctx) => {
  ctx.reply('🤖 Tanya seputar server, log spesifik, atau kondisi container! Saya siap...');
});

bot.on('text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) return;
  const buttons = ['📊 Status VPS', '🔍 Cek Log', '🐳 Docker', '🌐 Status Web', '💾 Disk', '🤖 Tanya AI'];
  if (buttons.includes(ctx.message.text)) return;

  ctx.reply('🤖 Aegis sedang berpikir...');

  try {
    const mem = await getMemInfo();
    const cpu = await getCpuInfo();
    const disk = await getDiskInfo();
    const containers = await checkContainers();

    const containerStatus = containers.map(c => `${c.name}: ${c.running ? 'Running' : 'STOPPED'}`).join(', ');

    const prompt = `Kamu adalah "Aegis", bot AI admin IT. 
Data saat ini: CPU ${cpu.percent}%, RAM ${mem.percent}%, Disk ${disk.percent}%.
Docker: ${containerStatus}.
User bertanya: "${ctx.message.text}"
Jawab singkat 5-8 kalimat, sopan, panggil bos, bantu selesaikan.`;

    const result = await model.generateContent(prompt);
    ctx.reply(result.response.text(), { parse_mode: 'Markdown' });
  } catch (e) {
    console.error("ERROR GEMINI:", e);
    ctx.reply('⚠️ Maaf, otak AI Aegis sedang sibuk, coba sesaat lagi.');
  }
});

// ===================== AUTOMASI MONITORING =====================

// Interval 1 menit untuk web ping
setInterval(monitorWebsites, 60000); 

// Interval 5 menit untuk metrics OS
setInterval(async () => {
  if (!MY_CHAT_ID || MY_CHAT_ID === '') return;

  try {
    const mem = await getMemInfo();
    if (parseFloat(mem.percent) > RAM_THRESHOLD) {
      bot.telegram.sendMessage(MY_CHAT_ID, `🚨 *RAM KRITIS:* ${mem.percent}%`, { parse_mode: 'Markdown' });
    }
    const disk = await getDiskInfo();
    if (parseFloat(disk.percent) > DISK_THRESHOLD) {
      bot.telegram.sendMessage(MY_CHAT_ID, `💾 *DISK PENUH:* ${disk.percent}%`, { parse_mode: 'Markdown' });
    }
  } catch (e) {}
}, CHECK_INTERVAL);

// ===================== JALANKAN BOT =====================
bot.launch();
console.log('🛡️ Aegis VPS Monitor v3.0 (Web + Log AI Edition) berjalan!');
console.log(`📡 Website dimonitor tiap 1 menit.`);
console.log(`⚠️ Threshold — RAM: ${RAM_THRESHOLD}% | Disk: ${DISK_THRESHOLD}%`);

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
