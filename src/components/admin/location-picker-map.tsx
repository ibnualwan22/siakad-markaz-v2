"use client";

import { useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const customIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconAnchor: [12, 41],
  popupAnchor: [0, -41],
});
L.Marker.prototype.options.icon = customIcon;

function ClickHandler({ onLocationSelect }: { onLocationSelect: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationPickerMap({
  initialPosition,
  onLocationSelect,
}: {
  initialPosition?: [number, number] | null;
  onLocationSelect: (lat: number, lng: number) => void;
}) {
  const defaultPos: [number, number] = [-7.747, 112.183]; // Kampung Inggris
  const center = initialPosition && !isNaN(initialPosition[0]) && !isNaN(initialPosition[1]) 
                 ? initialPosition 
                 : defaultPos;
                 
  const markerRef = useRef<L.Marker>(null);

  // Jika initialPosition valid dan bukan 0, set position, jika tidak pakai center default
  const markerPos = initialPosition && initialPosition[0] !== 0 && initialPosition[1] !== 0
        ? initialPosition
        : center;

  return (
    <div className="w-full h-[300px] rounded-xl overflow-hidden border border-gray-300 relative z-0">
      <MapContainer
        center={center}
        zoom={16}
        style={{ width: "100%", height: "100%" }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; OpenStreetMap contributors'
        />
        
        <ClickHandler onLocationSelect={onLocationSelect} />
        
        <Marker 
          position={markerPos} 
          draggable={true}
          ref={markerRef}
          eventHandlers={{
            dragend: () => {
              const marker = markerRef.current;
              if (marker) {
                const pos = marker.getLatLng();
                onLocationSelect(pos.lat, pos.lng);
              }
            },
          }}
        />
      </MapContainer>
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-[1000] bg-white/90 backdrop-blur text-[10px] font-bold px-3 py-1.5 rounded-full shadow-md text-gray-700 pointer-events-none">
        Klik di peta atau geser pin
      </div>
    </div>
  );
}
