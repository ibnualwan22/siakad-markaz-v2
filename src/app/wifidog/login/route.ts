import { NextRequest, NextResponse } from 'next/server';

// WifiDog standard: /wifidog/login → redirect ke halaman login kita (gunakan host asli, bukan 0.0.0.0:3000)
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams.toString();
  const host =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    'siakad.markazarabiyah.site';
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const loginUrl = `${proto}://${host}/wifi/login${params ? '?' + params : ''}`;
  return NextResponse.redirect(loginUrl);
}
