import { PersonalBest } from "./sheets";

/**
 * Convierte un texto de tiempo (ej: "1:04.5", "32.5s", "32") a segundos.
 */
export function parseSeconds(timeStr: string): number | null {
  if (!timeStr) return null;
  const cleanStr = timeStr.trim().toLowerCase().replace("s", "");

  // Formato MM:SS.hh (ej: "1:04.5", "01:04,2")
  const minSecRegex = /^(\d+):(\d+(?:[.,]\d+)?)$/;
  const matchMinSec = cleanStr.match(minSecRegex);
  if (matchMinSec) {
    const mins = parseInt(matchMinSec[1], 10);
    const secs = parseFloat(matchMinSec[2].replace(",", "."));
    return mins * 60 + secs;
  }

  // Formato SS.hh (ej: "32.5", "32")
  const secRegex = /^(\d+(?:[.,]\d+)?)$/;
  const matchSec = cleanStr.match(secRegex);
  if (matchSec) {
    return parseFloat(matchSec[1].replace(",", "."));
  }

  return null;
}

/**
 * Convierte segundos a formato legible MM:SS.hh o SS.hh.
 */
export function formatSeconds(totalSeconds: number): string {
  if (isNaN(totalSeconds) || totalSeconds <= 0) return "0.0";
  
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  
  if (mins > 0) {
    const paddedSecs = secs < 10 ? `0${secs.toFixed(1)}` : secs.toFixed(1);
    return `${mins}:${paddedSecs}`;
  }
  
  return `${secs.toFixed(1)}s`;
}

/**
 * Extrae y promedia los tiempos indicados en el campo de tiempos.
 * Acepta listas separadas por comas, espacios o barras.
 */
export function extractAverageSeconds(tiemposStr: string): number | null {
  if (!tiemposStr) return null;

  // Reemplazar separadores comunes por comas, luego dividir
  const cleanStr = tiemposStr.replace(/[\/\s;]+/g, ",");
  const parts = cleanStr.split(",").map((p) => p.trim()).filter(Boolean);

  const secondsList: number[] = [];
  for (const part of parts) {
    const secs = parseSeconds(part);
    if (secs !== null) {
      secondsList.push(secs);
    }
  }

  if (secondsList.length === 0) return null;

  const sum = secondsList.reduce((a, b) => a + b, 0);
  return sum / secondsList.length;
}

/**
 * Extrae la distancia individual por repetición de la notación de la serie.
 * Ej: "20x25 (desc. 15s)" -> 25, "10x50" -> 50, "1x100" -> 100, "800m" -> 800.
 */
export function extractDistance(seriesStr: string): number | null {
  if (!seriesStr) return null;

  // 1. Buscar notación de repetición: "AxB", "A x B", "A*(B)"
  // Ej: 20x25, 4x100, 3x(20x25) - nos quedamos con el último bloque de distancia
  const axBRegex = /\b\d+\s*x\s*(\d+)\b/gi;
  let match;
  let lastDistanceMatch = null;
  
  // Hacemos un bucle para obtener la última coincidencia (ej: en 3x(20x25) queremos 25, no 20)
  while ((match = axBRegex.exec(seriesStr)) !== null) {
    lastDistanceMatch = parseInt(match[1], 10);
  }
  
  if (lastDistanceMatch !== null) {
    return lastDistanceMatch;
  }

  // 2. Buscar números seguidos de metros: "100m", "50 metros", "1500 mt"
  const distRegex = /\b(\d+)\s*(?:m|metros|mt|mts)\b/i;
  const matchDist = seriesStr.match(distRegex);
  if (matchDist) {
    return parseInt(matchDist[1], 10);
  }

  // 3. Fallback: Buscar cualquier número suelto que pueda ser una distancia estándar
  // (25, 50, 100, 200, 400, 800, 1500)
  const numbers = seriesStr.match(/\b(25|50|100|200|400|800|1500)\b/);
  if (numbers) {
    return parseInt(numbers[1], 10);
  }

  return null;
}

/**
 * Normaliza el nombre del estilo para facilitar la búsqueda.
 */
export function normalizeStyle(styleStr: string): string {
  if (!styleStr) return "crol";
  const str = styleStr.toLowerCase().trim();
  if (str.includes("crol") || str.includes("libre") || str.includes("libres")) return "crol";
  if (str.includes("espalda")) return "espalda";
  if (str.includes("mariposa") || str.includes("maripa")) return "mariposa";
  if (str.includes("braza") || str.includes("pecho")) return "braza";
  if (str.includes("estilo") || str.includes("combinado") || str.includes("medley")) return "estilos";
  return "crol"; // Valor por defecto
}

export interface ZoneResult {
  zone: string;
  percentage: number;
  pbUsed: PersonalBest;
  scaled: boolean;
}

/**
 * Calcula la zona de intensidad sugerida basándose en la serie, tiempo medio, estilo y los PBs.
 */
export function calculateIntensityZone(
  seriesStr: string,
  tiemposStr: string,
  estiloStr: string,
  pbs: PersonalBest[]
): ZoneResult | null {
  const distance = extractDistance(seriesStr);
  const avgSeconds = extractAverageSeconds(tiemposStr);
  if (!distance || !avgSeconds || pbs.length === 0) return null;

  const style = normalizeStyle(estiloStr);

  // Intentar encontrar el PB ideal
  let pbToUse: PersonalBest | undefined;
  let scaled = false;

  // 1. Buscar PB del mismo estilo y misma distancia exacta
  pbToUse = pbs.find(
    (pb) => normalizeStyle(pb.estilo) === style && pb.distancia === distance
  );

  // 2. Si no hay distancia exacta, buscar PB de 100m del mismo estilo
  if (!pbToUse) {
    pbToUse = pbs.find(
      (pb) => normalizeStyle(pb.estilo) === style && pb.distancia === 100
    );
    if (pbToUse) scaled = true;
  }

  // 3. Si no hay 100m, buscar cualquier PB del mismo estilo
  if (!pbToUse) {
    pbToUse = pbs.find((pb) => normalizeStyle(pb.estilo) === style);
    if (pbToUse) scaled = true;
  }

  // 4. Si no hay PB del mismo estilo, buscar PB de 100m Crol (referencia universal)
  if (!pbToUse) {
    pbToUse = pbs.find(
      (pb) => normalizeStyle(pb.estilo) === "crol" && pb.distancia === 100
    );
    if (pbToUse) scaled = true;
  }

  // 5. Si aún no hay nada, usar cualquier primer PB disponible
  if (!pbToUse) {
    pbToUse = pbs[0];
    scaled = true;
  }

  const pbSeconds = parseSeconds(pbToUse.tiempo);
  if (!pbSeconds) return null;

  // Convertir ritmos a base 100m para comparar de forma uniforme
  const seriesPace100 = avgSeconds * (100 / distance);
  const pbPace100 = pbSeconds * (100 / pbToUse.distancia);

  // Calcular porcentaje de velocidad en relación al PB (velocidad = distancia / tiempo)
  // % = (velocidad_serie / velocidad_PB) * 100 = (pbPace100 / seriesPace100) * 100
  const percentage = (pbPace100 / seriesPace100) * 100;

  // Determinar zona según estándares del entrenador
  let zone = "Suave";
  if (percentage >= 97.5) {
    zone = "Velocidad";
  } else if (percentage >= 90.0) {
    zone = "Anaeróbico";
  } else if (percentage >= 85.0) {
    zone = "VO2Max";
  } else if (percentage >= 82.5) {
    zone = "Aeróbico intenso";
  } else if (percentage >= 77.5) {
    zone = "Aeróbico medio";
  } else if (percentage >= 70.0) {
    zone = "Aeróbico ligero";
  } else {
    zone = "Suave";
  }

  return {
    zone,
    percentage: Math.round(percentage * 10) / 10,
    pbUsed: pbToUse,
    scaled,
  };
}
