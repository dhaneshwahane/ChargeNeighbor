import axios from 'axios';

export interface GeocodingResult {
  display_name: string;
  lat: number;
  lng: number;
}

export const searchLocationNominatim = async (query: string): Promise<GeocodingResult[]> => {
  if (!query || query.trim().length < 3) return [];
  
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: query,
        format: 'json',
        addressdetails: 1,
        limit: 5,
        countrycodes: 'in', // default prioritized to India
      },
      headers: {
        'Accept-Language': 'en',
      },
      timeout: 4000,
    });

    return response.data.map((item: any) => ({
      display_name: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }));
  } catch (error) {
    console.warn('Geocoding service error or rate-limited:', error);
    return [];
  }
};
