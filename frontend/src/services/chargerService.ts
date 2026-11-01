import axios from 'axios';
import { Charger } from '../types';
import { NAGPUR_DEMO_CHARGERS } from './demoData';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const client = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  timeout: 5000,
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('chargeneighbor_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const chargerService = {
  getNearbyChargers: async (lat: number, lng: number, radiusKm: number = 25): Promise<{ data: Charger[]; isDemo: boolean }> => {
    try {
      const res = await client.get(`/chargers/nearby?lat=${lat}&lng=${lng}&radius_km=${radiusKm}`);
      if (res.data && res.data.length > 0) {
        // Map backend charger schema to UI Charger type
        const mapped: Charger[] = res.data.map((c: any) => ({
          id: c.id,
          name: c.title,
          latitude: c.latitude,
          longitude: c.longitude,
          connector_type: c.connector_type,
          power_kw: c.power_kw,
          price_per_kwh: c.price_per_kwh_rupees || (c.price_per_kwh_paise / 100),
          currency: "INR",
          availability_status: c.status === 'active' ? 'available' : 'occupied',
          host_rating: c.avg_rating,
          rating_count: c.rating_count,
          distance_km: c.distance_km,
          area_description: c.address || c.city,
          amenities: ["Verified Grounding", "Residential Access"],
          verification_level: c.verification_level
        }));
        return { data: mapped, isDemo: false };
      }
    } catch (err) {
      console.warn("Backend unavailable or query failed; falling back to Nagpur demo fixture:", err);
    }
    
    // Fallback to explicit Nagpur demo fixtures
    return { data: NAGPUR_DEMO_CHARGERS, isDemo: true };
  },

  getChargerById: async (id: string): Promise<{ data: Charger; isDemo: boolean }> => {
    try {
      const res = await client.get(`/chargers/${id}`);
      const c = res.data;
      return {
        data: {
          id: c.id,
          name: c.title,
          latitude: c.latitude,
          longitude: c.longitude,
          connector_type: c.connector_type,
          power_kw: c.power_kw,
          price_per_kwh: c.price_per_kwh_rupees || (c.price_per_kwh_paise / 100),
          currency: "INR",
          availability_status: c.status === 'active' ? 'available' : 'occupied',
          host_rating: c.avg_rating,
          rating_count: c.rating_count,
          area_description: c.address,
          amenities: ["Covered Parking", "CCTV Surveillance", "Standard 16A Earth Point"],
          access_instructions: c.access_instructions,
          verification_level: c.verification_level
        },
        isDemo: false
      };
    } catch {
      const found = NAGPUR_DEMO_CHARGERS.find(ch => ch.id === id) || NAGPUR_DEMO_CHARGERS[0];
      return { data: found, isDemo: true };
    }
  },

  createBooking: async (payload: { charger_id: string; vehicle_id?: string; start_time: string; end_time: string; requested_kwh: number }) => {
    return client.post('/bookings', {
      charger_id: payload.charger_id,
      vehicle_id: payload.vehicle_id || "veh_default",
      start_time: payload.start_time,
      end_time: payload.end_time,
      requested_kwh: payload.requested_kwh,
      is_emergency: false
    });
  },

  getMyBookings: async () => {
    return client.get('/bookings');
  },

  createChargerListing: async (chargerData: any) => {
    return client.post('/host/chargers', chargerData);
  }
};
