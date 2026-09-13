import { NextRequest, NextResponse } from 'next/server';

// WifiDog standard: /wifidog/login → redirect ke halaman login kita
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams.toString();
  const loginUrl = `/wifi/login${params ? '?' + params : ''}`;
  return NextResponse.redirect(new URL(loginUrl, request.url));
}
