import React, { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Charger } from '../../types';
import { searchLocationNominatim, GeocodingResult } from '../../services/geocodingService';
import { Navigation, Search, MapPin, Zap, Star, ShieldCheck, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

// Fix Leaflet Default Marker icon paths in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom Green Charging Marker SVG Icon
const createChargerIcon = (isSelected: boolean) => {
  return L.divIcon({
    className: 'custom-charger-pin',
    html: `
      <div style="
        background-color: ${isSelected ? '#14532D' : '#15803D'};
        width: 38px;
        height: 38px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        border: 2px solid #FFFFFF;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      ">
        <svg style="transform: rotate(45deg); width: 18px; height: 18px; fill: none; stroke: #FFFFFF; stroke-width: 2.5;" viewBox="0 0 24 24">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
        </svg>
      </div>
    `,
    iconSize: [38, 38],
    iconAnchor: [19, 38],
    popupAnchor: [0, -38],
  });
};

// Custom User Location Marker Icon
const userLocationIcon = L.divIcon({
  className: 'custom-user-pin',
  html: `<div class="user-location-marker"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

// Helper component to smoothly center/fly map when center coordinates change
const MapController = ({ center, zoom }: { center: [number, number]; zoom: number }) => {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 1.2 });
  }, [center, zoom, map]);
  return null;
};

interface ChargerMapProps {
  chargers: Charger[];
  selectedChargerId: string | null;
  onSelectCharger: (charger: Charger) => void;
  isLoading?: boolean;
  onLocationChange?: (lat: number, lng: number) => void;
}

export const ChargerMap: React.FC<ChargerMapProps> = ({
  chargers,
  selectedChargerId,
  onSelectCharger,
  isLoading = false,
  onLocationChange
}) => {
  // Default coordinate: Nagpur, Maharashtra (or from .env)
  const defaultLat = parseFloat(import.meta.env.VITE_MAP_DEFAULT_LAT || '21.1458');
  const defaultLng = parseFloat(import.meta.env.VITE_MAP_DEFAULT_LNG || '79.0882');
  const tileUrl = import.meta.env.VITE_MAP_TILE_URL || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const [mapCenter, setMapCenter] = useState<[number, number]>([defaultLat, defaultLng]);
  const [mapZoom, setMapZoom] = useState<number>(13);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [locationStatus, setLocationStatus] = useState<string>('');
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // If a charger is selected externally (e.g., from card click), focus on it
  useEffect(() => {
    if (selectedChargerId) {
      const found = chargers.find(c => c.id === selectedChargerId);
      if (found) {
        setMapCenter([found.latitude, found.longitude]);
        setMapZoom(15);
      }
    }
  }, [selectedChargerId, chargers]);

  // Handle Location Search with Debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    if (val.trim().length >= 3) {
      setIsSearching(true);
      searchTimeoutRef.current = setTimeout(async () => {
        const results = await searchLocationNominatim(val);
        setSearchResults(results);
        setIsSearching(false);
      }, 500);
    } else {
      setSearchResults([]);
      setIsSearching(false);
    }
  };

  const handleSelectSearchResult = (result: GeocodingResult) => {
    setMapCenter([result.lat, result.lng]);
    setMapZoom(14);
    setSearchResults([]);
    setSearchQuery(result.display_name.split(',')[0]);
    if (onLocationChange) onLocationChange(result.lat, result.lng);
  };

  // Browser Geolocation ("Use My Location")
  const handleUseMyLocation = () => {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation is not supported by your browser.');
      return;
    }
    setLocationStatus('Detecting your GPS position...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        setMapCenter([latitude, longitude]);
        setMapZoom(14);
        setLocationStatus('');
        if (onLocationChange) onLocationChange(latitude, longitude);
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setLocationStatus('Location permission denied. Please allow location access or search above.');
        } else {
          setLocationStatus('Location position currently unavailable.');
        }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  return (
    <div className="relative w-full h-full min-h-[500px] flex flex-col rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-white">
      
      {/* Search & Location Bar Overlay */}
      <div className="absolute top-4 left-4 right-4 z-[500] flex flex-col md:flex-row items-center gap-2">
        <div className="relative flex-1 w-full">
          <div className="flex items-center bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-200 shadow-md">
            <Search className="w-5 h-5 text-slate-400 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Search locality, city or landmark in India (e.g. Nagpur, Civil Lines)..."
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            {isSearching && <Loader2 className="w-4 h-4 animate-spin text-brand-700 ml-2 shrink-0" />}
          </div>

          {/* Search Dropdown Results */}
          {searchResults.length > 0 && (
            <div className="absolute top-full mt-1.5 left-0 right-0 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden z-[600] max-h-60 overflow-y-auto">
              {searchResults.map((res, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSelectSearchResult(res)}
                  className="w-full text-left px-4 py-2.5 hover:bg-brand-50 border-b border-slate-100 last:border-none flex items-start gap-2 text-xs text-slate-700 transition"
                >
                  <MapPin className="w-4 h-4 text-brand-700 shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{res.display_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Use My Location Button */}
        <button
          onClick={handleUseMyLocation}
          className="w-full md:w-auto shrink-0 flex items-center justify-center gap-2 bg-white/95 backdrop-blur-md hover:bg-brand-50 text-brand-700 text-xs font-semibold px-4 py-2.5 rounded-xl border border-slate-200 shadow-md transition"
        >
          <Navigation className="w-4 h-4" />
          <span>Use my location</span>
        </button>
      </div>

      {/* Location warning or status banner */}
      {locationStatus && (
        <div className="absolute top-20 left-4 right-4 z-[500] bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3.5 py-2 rounded-xl flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{locationStatus}</span>
          </div>
          <button onClick={() => setLocationStatus('')} className="font-bold ml-2">×</button>
        </div>
      )}

      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute bottom-6 right-6 z-[500] bg-white/90 backdrop-blur-md border border-slate-200 shadow-md px-3.5 py-2 rounded-xl flex items-center gap-2 text-xs font-medium text-brand-800">
          <Loader2 className="w-4 h-4 animate-spin text-brand-700" />
          <span>Loading verified neighborhood chargers...</span>
        </div>
      )}

      {/* Main Interactive Leaflet Map */}
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        scrollWheelZoom={true}
        className="w-full h-full flex-1"
      >
        <MapController center={mapCenter} zoom={mapZoom} />

        {/* Real OpenStreetMap Tiles with attribution */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors'
          url={tileUrl}
        />

        {/* User Current Location Marker */}
        {userLocation && (
          <Marker position={userLocation} icon={userLocationIcon}>
            <Popup>
              <div className="p-2 text-center text-xs font-medium text-slate-800">
                📍 You are here
              </div>
            </Popup>
          </Marker>
        )}

        {/* Real Charger Pins */}
        {chargers.map((charger) => {
          const isSelected = charger.id === selectedChargerId;
          return (
            <Marker
              key={charger.id}
              position={[charger.latitude, charger.longitude]}
              icon={createChargerIcon(isSelected)}
              eventHandlers={{
                click: () => onSelectCharger(charger),
              }}
            >
              <Popup>
                <div className="p-3 max-w-[260px] text-slate-900">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <h4 className="font-bold text-sm text-slate-900 leading-tight">{charger.name}</h4>
                    {charger.verification_level ? (
                      <span className="shrink-0 flex items-center gap-0.5 bg-emerald-50 text-brand-700 text-[10px] font-bold px-1.5 py-0.5 rounded border border-emerald-200">
                        <ShieldCheck className="w-3 h-3" /> L{charger.verification_level}
                      </span>
                    ) : null}
                  </div>

                  <p className="text-xs text-slate-500 mb-2">
                    {charger.area_description || 'Neighborhood residential location'}
                  </p>

                  <div className="grid grid-cols-2 gap-1.5 text-[11px] bg-slate-50 p-2 rounded-lg mb-2.5">
                    <div>
                      <span className="text-slate-400 block text-[9px]">TYPE & SPEED</span>
                      <span className="font-bold text-brand-700">{charger.power_kw} kW ({charger.connector_type})</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[9px]">RATE</span>
                      <span className="font-bold text-slate-900">₹{charger.price_per_kwh}/kWh</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-600 mb-3">
                    <span className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span className="font-semibold">{charger.host_rating || 'New'}</span>
                    </span>
                    <span className="text-emerald-600 font-medium capitalize">
                      ● {charger.availability_status}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Link
                      to={`/chargers/${charger.id}`}
                      className="flex-1 text-center py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold transition"
                    >
                      Details
                    </Link>
                    <Link
                      to={`/book/${charger.id}`}
                      className="flex-1 text-center py-1.5 px-2 bg-brand-700 hover:bg-brand-800 text-white rounded-lg text-xs font-semibold transition"
                    >
                      Reserve
                    </Link>
                  </div>
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

    </div>
  );
};
