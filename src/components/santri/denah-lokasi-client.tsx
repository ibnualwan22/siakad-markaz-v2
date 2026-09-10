"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { Navigation, Info, X, MapPin, Search, List, Eye, ArrowRight, ImageIcon } from "lucide-react";

// Mengimpor Map tanpa SSR
const LeafletMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 backdrop-blur-sm animate-pulse z-10 w-full h-full">
      <div className="flex flex-col items-center justify-center gap-3">
        <MapPin className="text-blue-500 animate-bounce" size={32} />
        <span className="text-gray-500 font-bold text-sm tracking-widest uppercase">Memuat Peta...</span>
      </div>
    </div>
  ),
});

interface Lokasi {
  id: string;
  nama: string;
  deskripsi: string | null;
  latitude: number;
  longitude: number;
  imageUrl?: string | null;
  isActive: boolean;
}

export function DenahLokasiClient() {
  const [destinations, setDestinations] = useState<Lokasi[]>([]);
  const [selectedDestId, setSelectedDestId] = useState<string | null>(null);

  const [currentPosition, setCurrentPosition] = useState<[number, number] | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<[number, number][]>([]);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);

  const [isTracking, setIsTracking] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const watchIdRef = useRef<number | null>(null);

  // Fitur List
  const [showList, setShowList] = useState(false);
  const [detailItem, setDetailItem] = useState<Lokasi | null>(null);

  useEffect(() => {
    fetch("/api/santri/denah-lokasi")
      .then((res) => res.json())
      .then((data) => {
        if (data.data) {
          setDestinations(data.data.filter((d: Lokasi) => d.isActive));
        }
      })
      .catch((err) => console.error("Gagal memuat lokasi:", err));
  }, []);

  const calculateRouteOSRM = useCallback(async () => {
    if (!currentPosition || !selectedDestId) {
      setRouteCoordinates([]);
      setRouteDistance(null);
      setRouteDuration(null);
      return;
    }

    const dest = destinations.find((d) => d.id === selectedDestId);
    if (!dest) return;

    try {
      // OSRM foot profile route (tanpa tol, asumsi jalan kaki)
      const url = `https://router.project-osrm.org/route/v1/foot/${currentPosition[1]},${currentPosition[0]};${dest.longitude},${dest.latitude}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      const data = await res.json();

      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        // Leaflet butuh [lat, lng]
        const coords = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
        setRouteCoordinates(coords);
        
        // Jarak dalam meter
        setRouteDistance(route.distance);
        // Durasi dalam detik (jalan kaki) rata-rata 5 km/h ≈ 1.39 m/s
        setRouteDuration(route.duration);
      } else {
        setRouteCoordinates([]);
        setRouteDistance(null);
        setRouteDuration(null);
      }
    } catch (error) {
      console.error("Gagal generate routing OSRM:", error);
    }
  }, [currentPosition, selectedDestId, destinations]);

  // Recalculate route saat pindah lokasi gps / ganti tujuan
  useEffect(() => {
    calculateRouteOSRM();
  }, [selectedDestId, currentPosition, calculateRouteOSRM]);

  const startTracking = () => {
    if (!navigator.geolocation) {
      setErrorMsg("Browser tidak support GPS.");
      return;
    }

    setIsTracking(true);
    setErrorMsg("");

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const newPos: [number, number] = [
          position.coords.latitude,
          position.coords.longitude,
        ];
        setCurrentPosition(newPos);
      },
      (error) => {
        // Jangan langsung false, mungkin delay sinyal aja
        setErrorMsg("Sinyal GPS terputus. Pastikan izin lokasi aktif.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );
  };

  const stopTracking = () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  // Mulai pantau posisi sejak halaman dirender
  useEffect(() => {
    startTracking();
    return () => stopTracking();
  }, []);

  const handleNavigate = (dest: Lokasi) => {
    setSelectedDestId(dest.id);
  };

  const cancelNavigation = () => {
    setSelectedDestId(null);
    setRouteCoordinates([]);
    setRouteDistance(null);
    setRouteDuration(null);
  };

  const activeDest = destinations.find((d) => d.id === selectedDestId);

  // Formatting utils
  const formatDistance = (meters: number) => {
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(1)} km`;
  };
  
  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)} detik`;
    const mins = Math.floor(seconds / 60);
    return `${mins} mnt`;
  };

  return (
    <div className="fixed top-0 left-0 lg:left-64 right-0 bottom-16 lg:bottom-0 overflow-hidden bg-slate-50 z-20">
      
      {/* MAP LAYER: Selalu fullscreen di dalam kontainer */}
      <div className="absolute inset-0 z-0 bg-blue-50/50">
        <LeafletMap 
           currentPosition={currentPosition}
           destinations={destinations}
           routeCoordinates={routeCoordinates}
           selectedDestId={selectedDestId}
           onNavigate={handleNavigate}
        />
      </div>

      {/* OVERLAY: Error GPS */}
      {errorMsg && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 w-11/12 max-w-sm px-4 py-3 bg-red-600/90 backdrop-blur text-white text-xs font-bold rounded-xl shadow-xl flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-4">
          <Info size={16} />
          {errorMsg}
        </div>
      )}

      {/* OVERLAY: Navigasi Aktif Panel (Bawah) */}
      {selectedDestId && activeDest && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 w-[92%] max-w-sm bg-white/95 backdrop-blur-md px-5 py-4 rounded-3xl shadow-2xl border border-gray-200/50 animate-in slide-in-from-bottom-10 fade-in duration-300">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="font-extrabold text-gray-900 text-lg truncate flex items-center gap-2">
                <Navigation size={18} className="text-blue-500 fill-blue-50" />
                {activeDest.nama}
              </h3>
              <p className="text-xs text-blue-600 mt-1.5 font-bold bg-blue-50 inline-block px-2 py-0.5 rounded-md">
                {routeDistance !== null ? formatDistance(routeDistance) : "Menghitung jarak..."}
                {routeDuration !== null && ` • ±${formatDuration(routeDuration)} jalan kaki`}
              </p>
            </div>
            
            <button
              onClick={cancelNavigation}
              className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100/80 hover:bg-red-100 hover:text-red-600 text-gray-500 flex items-center justify-center transition-colors"
              title="Batalkan Rute"
            >
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      )}

      {/* OVERLAY: Lokasi Tersedia (Jika tidak ada yang dipilih) */}
      {!selectedDestId && (
        <div className="absolute top-4 left-4 z-20">
          <div className="bg-white/90 backdrop-blur shadow-lg px-4 py-2.5 rounded-full border border-gray-100 flex items-center gap-2 text-sm font-bold text-gray-800">
             <Search size={16} className="text-blue-500" />
             Ketik Peta atau klik Marker Sakan
          </div>
        </div>
      )}

      {/* OVERLAY: FAB Lacak Lokasi Saya */}
      <button
        onClick={() => {
          if (!isTracking) {
             startTracking(); 
          }
          // Jika GPS sudah dipantau, trik reset state agar Peta nge-pan lgi ke titik skr
          setCurrentPosition((prev) => prev ? [...prev] : prev);
        }}
        className={`absolute z-30 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border transition-all active:scale-95 flex items-center justify-center
          ${selectedDestId ? "bottom-28 right-4 lg:right-6" : "bottom-6 right-4 lg:right-6"}
          ${isTracking ? "bg-white text-blue-600 border-gray-100" : "bg-gray-800 text-white border-transparent"}
          w-14 h-14 rounded-full
        `}
        title="Posisi Saya"
      >
        <Navigation size={24} className={isTracking ? "fill-blue-50" : ""} />
        {isTracking && (
           <span className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full animate-ping"></span>
        )}
      </button>

      {/* OVERLAY: Tombol Daftar Sakan (Kiri Bawah) */}
      {!selectedDestId && (
        <div className="absolute bottom-6 left-4 lg:left-6 z-30">
          <button
            onClick={() => setShowList(true)}
            className="flex items-center gap-2 bg-white text-gray-800 shadow-[0_4px_20px_rgb(0,0,0,0.1)] px-4 py-3.5 rounded-full font-bold text-sm hover:scale-105 active:scale-95 transition-all outline outline-1 outline-gray-100"
          >
            <List size={18} className="text-blue-600" /> Daftar Sakan
          </button>
        </div>
      )}

      {/* MODAL: List Daftar Sakan */}
      {showList && (
        <div className="fixed inset-0 z-50 flex justify-center items-end sm:items-center bg-gray-900/40 backdrop-blur-sm p-4 lg:p-0 p-safe" onClick={() => setShowList(false)}>
          <div 
            className="w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[70vh] sm:h-[60vh] max-h-[600px] animate-in slide-in-from-bottom-10 fade-in duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h2 className="font-extrabold text-lg flex items-center gap-2 text-gray-900">
                <MapPin className="text-blue-500" size={20} /> Daftar Lokasi
              </h2>
              <button onClick={() => setShowList(false)} className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200">
                <X size={18} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {destinations.map(dest => (
                <div key={dest.id} className="border border-gray-100 bg-gray-50/50 rounded-2xl p-3 flex items-center gap-3">
                  <div className="w-14 h-14 shrink-0 rounded-xl bg-gray-200 overflow-hidden border border-gray-200 flex items-center justify-center text-gray-400">
                    {dest.imageUrl ? (
                      <img src={dest.imageUrl} alt={dest.nama} className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon size={20} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm text-gray-900 truncate">{dest.nama}</h4>
                    <button 
                      onClick={() => setDetailItem(dest)}
                      className="text-[11px] font-bold text-blue-600 mt-1 inline-flex items-center gap-1 hover:underline"
                    >
                      <Eye size={12} /> Lihat Detail
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      handleNavigate(dest);
                      setShowList(false);
                    }}
                    className="w-10 h-10 shrink-0 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-colors"
                  >
                    <ArrowRight size={18} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Detail Item Sakan */}
      {detailItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-md" onClick={() => setDetailItem(null)}>
          <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
             {detailItem.imageUrl ? (
               <div className="w-full h-48 bg-gray-100 relative">
                 <img src={detailItem.imageUrl} alt="Serta" className="w-full h-full object-cover" />
                 <button onClick={() => setDetailItem(null)} className="absolute top-4 right-4 p-2 bg-black/40 text-white rounded-full backdrop-blur-sm hover:bg-black/60"><X size={16} /></button>
               </div>
             ) : (
               <div className="w-full h-24 bg-gray-100 flex items-center justify-center relative">
                 <MapPin className="text-gray-300" size={32} />
                 <button onClick={() => setDetailItem(null)} className="absolute top-4 right-4 p-2 bg-black/10 text-gray-500 rounded-full hover:bg-black/20"><X size={16} /></button>
               </div>
             )}
             
             <div className="p-5">
                <h2 className="text-xl font-extrabold text-gray-900 mb-2">{detailItem.nama}</h2>
                {detailItem.deskripsi && <p className="text-sm text-gray-600 mb-4">{detailItem.deskripsi}</p>}
                
                <button
                  onClick={() => {
                    handleNavigate(detailItem);
                    setDetailItem(null);
                    setShowList(false);
                  }}
                  className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl active:scale-95 transition-all text-sm flex items-center justify-center gap-2"
                >
                  <Navigation size={18} /> Buat Rute Menuju Lokasi
                </button>
             </div>
          </div>
        </div>
      )}

    </div>
  );
}
