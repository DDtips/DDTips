/**
 * FRED API klient — St. Louis Fed Economic Data
 */

const FRED_BASE_URL = "https://api.stlouisfed.org/fred/series/observations";

export interface FredObservation {
  date: string;
  value: string;
}

export async function fetchFredSeries(
  seriesId: string,
  limit: number = 13,
  revalidate: number = 3600
): Promise<FredObservation[]> {
  const apiKey = process.env.FRED_API_KEY;
  
  if (!apiKey) {
    console.warn("[FRED] API ključ ni nastavljen v .env.local");
    return [];
  }

  const params = new URLSearchParams({
    series_id: seriesId,
    api_key: apiKey,
    file_type: "json",
    sort_order: "desc",
    limit: limit.toString(),
  });

  const url = `${FRED_BASE_URL}?${params.toString()}`;

  try {
    const res = await fetch(url, {
      next: { revalidate },
    });

    if (!res.ok) {
      console.error(`[FRED] HTTP ${res.status} za ${seriesId}`);
      return [];
    }

    const data = await res.json();
    return (data.observations || []) as FredObservation[];
  } catch (err) {
    console.error(`[FRED] Napaka za ${seriesId}:`, err);
    return [];
  }
}

export function parseValue(value: string): number | null {
  if (value === "." || value === "" || value == null) return null;
  const n = parseFloat(value);
  return isNaN(n) ? null : n;
}

export function calcYoYChange(observations: FredObservation[]): number | null {
  if (!observations || observations.length < 13) return null;
  
  const latest = parseValue(observations[0].value);
  const yearAgo = parseValue(observations[12].value);
  
  if (latest === null || yearAgo === null || yearAgo === 0) return null;
  
  return ((latest - yearAgo) / yearAgo) * 100;
}
