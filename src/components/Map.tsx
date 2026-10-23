import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap, Tooltip } from 'react-leaflet';
import L from 'leaflet';

// Fix for default marker icon in Leaflet
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

interface MapViewProps {
  center?: { lat: number; lng: number };
  markers?: Array<{ id: string; position: { lat: number; lng: number }; title?: string; icon?: string }>;
  onMapClick?: (e: { lat: number; lng: number }) => void;
  onMarkerClick?: (id: string) => void;
  zoom?: number;
}

function MapEvents({ onMapClick }: { onMapClick?: (e: { lat: number; lng: number }) => void }) {
  useMapEvents({
    click: (e) => {
      onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

function ChangeView({ center, zoom, isFollowing, setIsFollowing }: { center: { lat: number; lng: number }; zoom: number; isFollowing: boolean; setIsFollowing: (val: boolean) => void }) {
  const map = useMap();
  
  useEffect(() => {
    if (isFollowing) {
      map.setView([center.lat, center.lng], zoom);
    }
  }, [center, zoom, map, isFollowing]);

  useMapEvents({
    dragstart: () => {
      setIsFollowing(false);
    },
    zoomstart: () => {
      setIsFollowing(false);
    }
  });

  return null;
}

export default function MapView({ center, markers = [], onMapClick, onMarkerClick, zoom = 14 }: MapViewProps) {
  const [currentCenter, setCurrentCenter] = useState<{ lat: number; lng: number }>(center || { lat: 36.8065, lng: 10.1815 });
  const [isFollowing, setIsFollowing] = useState(true);

  useEffect(() => {
    if (center) {
      // Compare values to avoid unnecessary state updates
      setCurrentCenter(prev => {
        if (prev.lat === center.lat && prev.lng === center.lng) return prev;
        return center;
      });
    }
  }, [center]);

  return (
    <div className="w-full h-full relative z-0">
      <MapContainer 
        center={[currentCenter.lat, currentCenter.lng]} 
        zoom={zoom} 
        scrollWheelZoom={true}
        className="h-full w-full"
        style={{ height: '100%', width: '100%', zIndex: -1 }}
        zoomControl={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapEvents onMapClick={onMapClick} />
        <ChangeView center={currentCenter} zoom={zoom} isFollowing={isFollowing} setIsFollowing={setIsFollowing} />
        {markers.filter(m => m && m.position && typeof m.position.lat === 'number' && typeof m.position.lng === 'number').map((marker) => (
          <Marker
            key={marker.id}
            position={[marker.position.lat, marker.position.lng]}
            eventHandlers={{
              click: () => onMarkerClick?.(marker.id),
            }}
          >
            {marker.title && (
              <Tooltip direction="top" offset={[0, -40]} opacity={1} permanent={false}>
                {marker.title}
              </Tooltip>
            )}
          </Marker>
        ))}
      </MapContainer>

      {/* Re-center Button */}
      {!isFollowing && center && (
        <button
          onClick={() => {
            setIsFollowing(true);
            setCurrentCenter(center);
          }}
          className="absolute bottom-24 right-4 z-[1000] bg-white p-3 rounded-full shadow-lg border border-gray-200 text-blue-600 hover:bg-gray-50 active:scale-95 transition-all"
          title="إعادة التمركز على موقعك"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
        </button>
      )}
    </div>
  );
}
