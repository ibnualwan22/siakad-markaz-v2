import { NextRequest, NextResponse } from 'next/server';

/**
 * WiFiDog Portal (Success) Endpoint
 * 
 * Setelah user berhasil di-autentikasi dan gateway memberikan akses internet,
 * user akan di-redirect ke halaman ini sebagai "halaman sukses".
 * 
 * Request: GET /wifi/portal?gw_id=...
 */
export async function GET(request: NextRequest) {
  const gwId = request.nextUrl.searchParams.get('gw_id') || '';

  const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WiFi Terhubung - Markaz Arabiyah</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh; display: flex; align-items: center; justify-content: center;
      background: linear-gradient(135deg, #0c1220, #1a2744, #0f1b30);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: white; padding: 24px;
    }
    .card {
      text-align: center; max-width: 380px; width: 100%;
      padding: 40px 32px; border-radius: 24px;
      background: rgba(255,255,255,0.06);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255,255,255,0.1);
    }
    .icon {
      width: 72px; height: 72px; margin: 0 auto 20px;
      border-radius: 20px; display: flex;
      align-items: center; justify-content: center;
      background: linear-gradient(135deg, #22c55e, #16a34a);
      box-shadow: 0 8px 32px rgba(34,197,94,0.3);
      font-size: 36px;
    }
    h1 { font-size: 22px; margin-bottom: 8px; }
    .sub { font-size: 13px; color: rgba(255,255,255,0.5); line-height: 1.6; }
    .footer { margin-top: 32px; font-size: 11px; color: rgba(255,255,255,0.25); }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">✓</div>
    <h1>Berhasil Terhubung!</h1>
    <p class="sub">
      Anda sekarang terhubung ke jaringan WiFi Markaz Arabiyah.
      <br>Selamat beraktivitas!
    </p>
    <p class="footer">مركز العربية — Sistem Akademik Terpadu</p>
  </div>
  <script>
    // Auto-close atau redirect setelah 5 detik
    setTimeout(function() {
      try { window.close(); } catch(e) {}
    }, 5000);
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
