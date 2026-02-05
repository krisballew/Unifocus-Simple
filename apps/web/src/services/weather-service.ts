/**
 * Weather Service
 * Provides current weather data using Open-Meteo (free, no API key required)
 */

export interface WeatherData {
  temperature: number;
  condition: string;
  icon: string;
}

/**
 * Convert latitude/longitude to weather condition and icon
 * Uses Open-Meteo free weather API
 */
export async function getWeatherForLocation(
  latitude: number,
  longitude: number
): Promise<WeatherData> {
  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto`
    );

    if (!response.ok) {
      throw new Error('Weather API failed');
    }

    const data = await response.json();
    const current = data.current;

    // Map weather codes to conditions
    const weatherCode = current.weather_code || 0;
    const temp = Math.round(current.temperature_2m || 72);
    const { condition, icon } = mapWeatherCode(weatherCode);

    return {
      temperature: temp,
      condition,
      icon,
    };
  } catch (error) {
    // Fallback on error
    console.error('Weather fetch error:', error);
    return {
      temperature: 72,
      condition: 'Clear',
      icon: '☀️',
    };
  }
}

/**
 * Map WMO weather codes to readable conditions and emoji icons
 * Reference: https://open-meteo.com/en/docs
 */
function mapWeatherCode(code: number): { condition: string; icon: string } {
  if (code === 0 || code === 1) {
    return { condition: 'Sunny', icon: '☀️' };
  } else if (code === 2) {
    return { condition: 'Partly Cloudy', icon: '⛅' };
  } else if (code === 3) {
    return { condition: 'Cloudy', icon: '☁️' };
  } else if (code === 45 || code === 48) {
    return { condition: 'Foggy', icon: '🌫️' };
  } else if (code === 51 || code === 53 || code === 55 || code === 61 || code === 63 || code === 65) {
    return { condition: 'Rainy', icon: '🌧️' };
  } else if (code === 71 || code === 73 || code === 75 || code === 77) {
    return { condition: 'Snowing', icon: '❄️' };
  } else if (code === 80 || code === 81 || code === 82) {
    return { condition: 'Rain Showers', icon: '🌧️' };
  } else if (code === 85 || code === 86) {
    return { condition: 'Snow Showers', icon: '❄️' };
  } else if (code === 95 || code === 96 || code === 99) {
    return { condition: 'Thunderstorm', icon: '⛈️' };
  }

  return { condition: 'Clear', icon: '☀️' };
}
