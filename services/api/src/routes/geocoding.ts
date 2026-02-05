import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';

interface GeocodingResponse {
  latitude: number;
  longitude: number;
}

/**
 * Geocoding Routes
 * Proxies requests to OpenStreetMap Nominatim API to avoid CORS issues
 */
export async function geocodingRoutes(server: FastifyInstance) {
  /**
   * GET /geocode - Geocode an address to latitude/longitude
   * Query params:
   *   - address (string, required): The address to geocode
   */
  server.get<{ Querystring: { address: string } }>(
    '/geocode',
    async (request: FastifyRequest<{ Querystring: { address: string } }>, reply: FastifyReply) => {
      const { address } = request.query;

      if (!address || address.trim().length === 0) {
        return reply.status(400).send({ error: 'Address parameter is required' });
      }

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`,
          {
            headers: {
              'User-Agent': 'Unifocus-API/1.0',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Nominatim API returned ${response.status}`);
        }

        const results = (await response.json()) as Array<{ lat: string; lon: string }>;

        if (results.length === 0) {
          return reply.status(404).send({ error: 'No results found for address' });
        }

        const result = results[0];
        const geoResponse: GeocodingResponse = {
          latitude: parseFloat(result.lat),
          longitude: parseFloat(result.lon),
        };

        return reply.send(geoResponse);
      } catch (error) {
        server.log.error('Geocoding error:', error as any);
        return reply.status(500).send({ error: 'Failed to geocode address' });
      }
    }
  );

  /**
   * GET /timezone - Get timezone from coordinates
   * Query params:
   *   - lat (number, required): Latitude
   *   - lng (number, required): Longitude
   */
  server.get<{ Querystring: { lat: string; lng: string } }>(
    '/timezone',
    async (
      request: FastifyRequest<{ Querystring: { lat: string; lng: string } }>,
      reply: FastifyReply
    ) => {
      const { lat, lng } = request.query;

      if (!lat || !lng) {
        return reply.status(400).send({ error: 'lat and lng parameters are required' });
      }

      try {
        // Use a simple timezone lookup based on coordinates
        // For a production app, you'd want to use a proper timezone API or database
        // For now, we'll use a basic mapping based on US longitude ranges
        const longitude = parseFloat(lng);
        const latitude = parseFloat(lat);

        let zoneName = 'America/New_York'; // Default to Eastern

        // Simple US timezone mapping by longitude (west is more negative)
        // Eastern: roughly -75 to -80 and east (NYC: -74, Miami: -80)
        // Central: roughly -85 to -100 (Chicago: -87, Dallas: -96)
        // Mountain: roughly -102 to -111 (Denver: -104)
        // Pacific: roughly -114 and west (LA: -118, San Francisco: -122)
        if (longitude <= -114) {
          zoneName = 'America/Los_Angeles'; // Pacific
        } else if (longitude <= -102) {
          zoneName = 'America/Denver'; // Mountain
        } else if (longitude <= -85) {
          zoneName = 'America/Chicago'; // Central
        } else {
          zoneName = 'America/New_York'; // Eastern (default)
        }

        server.log.info(`Timezone lookup: lat=${latitude}, lng=${longitude} => ${zoneName}`);

        return reply.send({ zoneName });
      } catch (error) {
        server.log.error('Timezone lookup error:', error as any);
        return reply.status(500).send({ error: 'Failed to lookup timezone' });
      }
    }
  );
}
