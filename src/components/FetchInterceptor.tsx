"use client";

import { useEffect } from "react";

/**
 * Global fetch interceptor: redirect ke login saat API return 401.
 * Dipasang sekali di root layout, berlaku untuk semua fetch di aplikasi.
 */
export function FetchInterceptor() {
  useEffect(() => {
    // Hindari double-patch (StrictMode)
    const w = window as unknown as Record<string, unknown>;
    if (w.__fetchPatched) return;
    w.__fetchPatched = true;

    const originalFetch = window.fetch.bind(window);

    window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
      const res = await originalFetch(...args);

      if (res.status === 401) {
        // Simpan halaman terakhir agar bisa kembali setelah login
        try {
          sessionStorage.setItem("redirectAfterLogin", window.location.pathname + window.location.search);
        } catch {
          /* abaikan */
        }
        // Redirect ke login dengan penanda expired (hindari loop jika sudah di login)
        if (!window.location.pathname.startsWith("/login")) {
          window.location.href = "/login?expired=1";
        }
      }

      return res;
    };
  }, []);

  return null;
}
