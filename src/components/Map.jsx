import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

// Leafletのデフォルトアイコンを設定
let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const Map = ({ markers, onMapReady }) => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markerGroupRef = useRef(null);

  useEffect(() => {
    // マップの初期化
    if (!mapInstanceRef.current) {
      const map = L.map(mapRef.current).setView([35.6762, 139.6503], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      const markerGroup = L.featureGroup().addTo(map);
      markerGroupRef.current = markerGroup;
      mapInstanceRef.current = map;

      if (onMapReady) {
        onMapReady(map, markerGroup);
      }
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerGroupRef.current = null;
      }
    };
  }, [onMapReady]);

  // マーカーの更新
  useEffect(() => {
    if (!markerGroupRef.current || !mapInstanceRef.current) return;

    markerGroupRef.current.clearLayers();

    markers.forEach((markerData) => {
      const marker = L.marker([markerData.lat, markerData.lon], {
        title: markerData.label || markerData.address
      }).bindPopup(`
        <div style="font-size: 12px;">
          ${markerData.label ? `<div style="font-weight: bold; color: #4CAF50; margin-bottom: 4px;">${markerData.label}</div>` : ''}
          <strong>${markerData.address}</strong>
        </div>
      `);
      markerGroupRef.current.addLayer(marker);
    });

    // マーカーが存在する場合は、すべてのマーカーが見えるように調整
    if (markers.length > 0 && markerGroupRef.current.getLayers().length > 0) {
      mapInstanceRef.current.fitBounds(markerGroupRef.current.getBounds().pad(0.1));
    }
  }, [markers]);

  return <div ref={mapRef} className="map-container" />;
};

export default Map;
