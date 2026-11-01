// Charger interface aligned with Section 12 of prompt
export interface Charger {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  connector_type: string;
  power_kw: number;
  price_per_kwh: number;
  currency: string;
  availability_status: 'available' | 'occupied' | 'offline';
  host_rating: number | null;
  rating_count?: number;
  distance_km?: number | null;
  area_description?: string;
  host_id?: string;
  amenities?: string[];
  access_instructions?: string;
  verification_level?: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  roles: string[];
  verification_level: number;
  phone_verified: boolean;
}

export interface Booking {
  id: string;
  charger_id: string;
  charger_name?: string;
  start_time: string;
  end_time: string;
  status: 'pending' | 'confirmed' | 'active' | 'completed' | 'cancelled';
  requested_kwh: number;
  total_amount: number;
  currency: string;
  reference_code: string;
  access_instructions?: string;
  charger_address?: string;
}
