import { NextRequest, NextResponse } from 'next/server';

// Standard WifiDog path: /wifidog/ping
export async function GET(request: NextRequest) {
  const gwId = request.nextUrl.searchParams.get('gw_id') || 'unknown';
  console.log(`[WiFiDog Ping /wifidog/] Gateway: ${gwId} at ${new Date().toISOString()}`);
  return new NextResponse('Pong', {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  });
}
