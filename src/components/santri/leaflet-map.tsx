"use client";

import { useEffect } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup, Tooltip, useMap } from "react-leaflet";
import L from "leaflet";
import { Navigation } from "lucide-react";
import "leaflet/dist/leaflet.css";

// Perbaikan icon leaflet default di Next.js agar tidak broken
const customIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconAnchor: [12, 41],
  popupAnchor: [0, -41],
});
L.Marker.prototype.options.icon = customIcon;

// Icon Rofi berdenyut untuk lokasi Santri saat ini
const rofiIcon = L.divIcon({
  className: "custom-rofi-marker bg-transparent border-none",
  html: `
    <div class="relative flex items-center justify-center w-12 h-12">
      <div class="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-60"></div>
      <div class="absolute inset-2 bg-white rounded-full flex items-center justify-center shadow-lg border-2 border-blue-600 z-10 overflow-hidden">
        <img src="/images/icon-rofi.png" class="w-full h-full object-cover" />
      </div>
    </div>
  `,
  iconSize: [48, 48],
  iconAnchor: [24, 24],
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

// Komponen helper untuk menggerakkan peta (Auto Pan smooth) ke titik baru
function MapController({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 17, { animate: true, duration: 1.5 });
  }, [center, map]);
  return null;
}

export default function LeafletMap({
  currentPosition,
  destinations,
  routeCoordinates,
  onNavigate,
  selectedDestId,
}: {
  currentPosition: [number, number] | null;
  destinations: Lokasi[];
  routeCoordinates: [number, number][];
  onNavigate: (dest: Lokasi) => void;
  selectedDestId: string | null;
}) {
  const defaultPos: [number, number] = [-7.747, 112.183]; // Default Pare center
  const center = currentPosition || defaultPos;

  return (
    <MapContainer
      center={center}
      zoom={16}
      style={{ width: "100%", height: "100%", zIndex: 0 }}
      zoomControl={false} // Kita hilangkan agar UI lebih bersih, user bs cubit zoom
    >
      {/* Menggunakan Tile Layer OSM standard yang 100% gratis tanpa API Key */}
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      <MapController center={center} />

      {/* Marker Posisi Santri Saat ini */}
      {currentPosition && (
        <Marker position={currentPosition} icon={rofiIcon} title="Posisi Anda" />
      )}

      {/* Tampilkan SEMUA Sakan */}
      {destinations.map((dest) => (
        <Marker key={dest.id} position={[dest.latitude, dest.longitude]}>
          <Tooltip direction="bottom" offset={[0, 5]} opacity={1} permanent={false} className="font-bold text-xs">
            {dest.nama}
          </Tooltip>
          <Popup className="custom-popup">
            <div className="flex flex-col w-48 p-1">
              <h3 className="font-bold text-base text-gray-900 leading-tight mb-1">{dest.nama}</h3>
              {dest.deskripsi && (
                <p className="text-xs text-gray-500 line-clamp-2 mb-2">{dest.deskripsi}</p>
              )}
              {dest.imageUrl && (
                <div className="w-full h-28 mb-3 rounded-lg overflow-hidden border border-gray-100 flex-shrink-0 bg-gray-50 shadow-sm relative">
                  <img src={dest.imageUrl} alt={dest.nama} className="w-full h-full object-cover" />
                </div>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigate(dest);
                }}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-3 rounded-xl shadow-md transition-all active:scale-95 text-center flex items-center justify-center gap-1"
              >
                Menuju Lokasi
              </button>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Garis Rute (Directions) */}
      {routeCoordinates.length > 0 && selectedDestId && (
        <Polyline positions={routeCoordinates} color="#3b82f6" weight={7} opacity={0.8} />
      )}
    </MapContainer>
  );
}
