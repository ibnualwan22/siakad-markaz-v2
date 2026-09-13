import { NextRequest, NextResponse } from 'next/server';

/**
 * WiFiDog Ping Endpoint
 * 
 * Gateway Ruijie secara periodik mengirim request ke endpoint ini
 * untuk mengecek apakah auth server (Siakad) masih hidup.
 * 
 * Request: GET /wifi/ping?gw_id=xxx&sys_uptime=xxx&sys_memfree=xxx&sys_load=xxx&wifidog_uptime=xxx
 * Response: Harus mengembalikan plain text "Pong" (tanpa kutip)
 * 
 * Jika endpoint ini tidak menjawab "Pong", Ruijie akan menganggap
 * server mati dan meluluskan semua user tanpa autentikasi (fail-open).
 */
export async function GET(request: NextRequest) {
  // Log ping untuk monitoring (opsional)
  const gwId = request.nextUrl.searchParams.get('gw_id') || 'unknown';
  console.log(`[WiFiDog Ping] Gateway: ${gwId} at ${new Date().toISOString()}`);

  // Response HARUS berupa plain text "Pong"
  return new NextResponse('Pong', {
    status: 200,
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}
