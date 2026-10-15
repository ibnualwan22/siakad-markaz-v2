import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { decrypt, encrypt, isMaxAgeExceeded, shouldRefreshToken, SESSION_DURATION_HOURS } from '@/lib/auth';

const publicRoutes = ['/login', '/api/auth/login', '/tauzi/login'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Biarkan route publik dan aset statis lewat
  if (
    publicRoutes.includes(pathname) ||
    pathname.startsWith('/_next/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Dapatkan session token
  const sessionToken = request.cookies.get('session')?.value;

  // Jika mencoba akses route terproteksi tanpa token, redirect ke login
  if (!sessionToken && (pathname.startsWith('/admin') || pathname.startsWith('/portal'))) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (sessionToken) {
    const session = await decrypt(sessionToken);

    if (!session) {
      // Token tidak valid, redirect ke login
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('session');
      return response;
    }

    // Batas maksimal 7 hari dari login awal — wajib login ulang
    if (isMaxAgeExceeded(session)) {
      const url = new URL('/login', request.url);
      url.searchParams.set('expired', '1');
      const response = NextResponse.redirect(url);
      response.cookies.delete('session');
      return response;
    }

    // Role-based routing:
    // Semua user (ADMIN, WALI_KELAS, PENGAJAR, KSU) menggunakan portal /admin
    // Akses spesifik halaman akan dibatasi oleh UI (Sidebar) dan API

    // Redirect / atau /portal ke /admin/dashboard
    if (pathname === '/' || pathname.startsWith('/portal')) {
      const response = NextResponse.redirect(new URL('/admin/dashboard', request.url));
      // Sliding refresh juga berlaku untuk redirect
      if (await shouldRefreshToken(sessionToken)) {
        const newToken = await encrypt(session);
        response.cookies.set('session', newToken, {
          expires: new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000),
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
        });
      }
      return response;
    }

    // Sliding session: perpanjang token jika sisa < 12 jam
    if (await shouldRefreshToken(sessionToken)) {
      const newToken = await encrypt(session);
      const response = NextResponse.next();
      response.cookies.set('session', newToken, {
        expires: new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
      });
      return response;
    }
  }

  // Khusus Tauzi Portal Auth
  if (pathname.startsWith('/tauzi') && pathname !== '/tauzi/login') {
    const tauziToken = request.cookies.get('tauzi-session')?.value;
    if (!tauziToken) {
      return NextResponse.redirect(new URL('/tauzi/login', request.url));
    }
  }


  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
