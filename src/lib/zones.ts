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

/**
 * Devuelve el factor de conversión por cada 100m para un estilo dado (en segundos).
 * Crol: 1.6s, Espalda: 2.0s, Braza: 2.0s, Mariposa: 1.0s, Estilos: 1.65s (promedio).
 */
export function getConversionFactor100m(styleStr: string): number {
  const style = normalizeStyle(styleStr);
  if (style === "crol") return 1.6;
  if (style === "espalda") return 2.5;
  if (style === "braza") return 2.3;
  if (style === "mariposa") return 1.3;
  return 2.4; // Promedio de los estilos para IM/Estilos
}

/**
 * Extrae el bloque repetido principal eliminando multiplicadores externos y descripciones de descanso.
 * Ej: "5x(4x50) (desc. 20s)" -> "4x50"
 */
export function getInnerBlockString(seriesStr: string): string {
  if (!seriesStr) return "";
  
  // 1. Detectar multiplicador externo con paréntesis: ej. 5x(4x50) o 5*(4x50)
  const outerParenRegex = /\b\d+\s*(?:x|\*|de|veces)\s*\(([^)]+)\)/i;
  const match = seriesStr.match(outerParenRegex);
  if (match) {
    return match[1];
  }
  
  // 2. De lo contrario, limpiar descripciones de descanso y comentarios
  let clean = seriesStr;
  clean = clean.replace(/\((?:desc|salida|c\/|r\/|suave)[^)]*\)/gi, "");
  return clean;
}

/**
 * Calcula la distancia total de un bloque repetido principal (ej: "4x50" -> 200, "50 + 2x25" -> 100).
 */
export function calculateBlockDistance(blockStr: string): number | null {
  if (!blockStr) return null;

  const terms = blockStr.split("+").map((t) => t.trim()).filter(Boolean);
  let totalDistance = 0;
  let hasValidTerm = false;

  for (const term of terms) {
    // Buscar patrón AxB
    const axbRegex = /\b(\d+)\s*(?:x|\*|de|veces)\s*(\d+)\b/i;
    const axbMatch = term.match(axbRegex);
    if (axbMatch) {
      const reps = parseInt(axbMatch[1], 10);
      const dist = parseInt(axbMatch[2], 10);
      totalDistance += reps * dist;
      hasValidTerm = true;
      continue;
    }

    // Buscar número de distancia individual
    const singleRegex = /\b(\d+)\s*(?:m|metros|mt|mts)?\b/i;
    const singleMatch = term.match(singleRegex);
    if (singleMatch) {
      const dist = parseInt(singleMatch[1], 10);
      totalDistance += dist;
      hasValidTerm = true;
    }
  }

  return hasValidTerm ? totalDistance : null;
}

/**
 * Obtiene la distancia de referencia para un ritmo o zona de intensidad dada.
 */
export function getReferenceDistance(
  intensity: string,
  repDistance: number | null,
  seriesStr: string = ""
): number | null {
  if (!intensity) return repDistance;

  const cleanIntensity = intensity.toLowerCase();

  // 1. Prioridad: Ritmos específicos
  if (cleanIntensity.includes("ritmo de 100")) return 100;
  if (cleanIntensity.includes("ritmo de 200")) return 200;
  if (cleanIntensity.includes("ritmo de 400")) return 400;
  if (cleanIntensity.includes("ritmo de 800")) return 800;
  if (cleanIntensity.includes("ritmo de 1500")) return 1500;

  // 2. Zonas de intensidad
  if (cleanIntensity.includes("velocidad")) return 50;
  
  if (cleanIntensity.includes("anaeróbico") || cleanIntensity.includes("anaerobico")) {
    const innerBlock = getInnerBlockString(seriesStr);
    const blockDist = calculateBlockDistance(innerBlock);
    return blockDist || repDistance;
  }
  
  if (
    cleanIntensity.includes("vo2max") ||
    cleanIntensity.includes("aeróbico intenso") || cleanIntensity.includes("aerobico intenso") ||
    cleanIntensity.includes("aeróbico medio") || cleanIntensity.includes("aerobico medio")
  ) {
    return repDistance;
  }
  
  if (
    cleanIntensity.includes("aeróbico ligero") || cleanIntensity.includes("aerobico ligero") ||
    cleanIntensity.includes("suave")
  ) {
    return 100;
  }

  if (cleanIntensity.includes("crono")) return repDistance;

  return repDistance;
}

/**
 * Busca de forma robusta la mejor marca personal para un estilo y distancia dados.
 * Si no la encuentra, escala a partir de la de 100m u otra disponible.
 */
export function findBestPB(
  pbs: PersonalBest[],
  style: string,
  targetDistance: number,
  pool: string
): { pb: PersonalBest; scaled: boolean } | null {
  const normalizedStyle = normalizeStyle(style);
  const normalizedPool = pool.trim().toLowerCase();

  const search = (d: number, p?: string) => {
    return pbs.find((pb) => {
      const sMatch = normalizeStyle(pb.estilo) === normalizedStyle;
      const dMatch = pb.distancia === d;
      const pMatch = p ? pb.piscina.trim().toLowerCase() === p : true;
      return sMatch && dMatch && pMatch;
    });
  };

  // 1. Distancia objetivo, misma piscina
  let pb = search(targetDistance, normalizedPool);
  if (pb) return { pb, scaled: false };

  // 2. Distancia objetivo, cualquier piscina
  pb = search(targetDistance);
  if (pb) return { pb, scaled: false };

  // 3. 100m PB, misma piscina (escalar)
  pb = search(100, normalizedPool);
  if (pb) return { pb, scaled: true };

  // 4. 100m PB, cualquier piscina (escalar)
  pb = search(100);
  if (pb) return { pb, scaled: true };

  // 5. Cualquier PB del mismo estilo, misma piscina (escalar)
  pb = pbs.find((pb) => normalizeStyle(pb.estilo) === normalizedStyle && pb.piscina.trim().toLowerCase() === normalizedPool);
  if (pb) return { pb, scaled: true };

  // 6. Cualquier PB del mismo estilo, cualquier piscina (escalar)
  pb = pbs.find((pb) => normalizeStyle(pb.estilo) === normalizedStyle);
  if (pb) return { pb, scaled: true };

  // 7. 100m Crol PB, misma piscina (escalar universal)
  pb = pbs.find((pb) => normalizeStyle(pb.estilo) === "crol" && pb.distancia === 100 && pb.piscina.trim().toLowerCase() === normalizedPool);
  if (pb) return { pb, scaled: true };

  // 8. 100m Crol PB, cualquier piscina
  pb = pbs.find((pb) => normalizeStyle(pb.estilo) === "crol" && pb.distancia === 100);
  if (pb) return { pb, scaled: true };

  // 9. Cualquier PB
  if (pbs.length > 0) {
    return { pb: pbs[0], scaled: true };
  }

  return null;
}

export interface ZoneResult {
  zone: string;
  percentage: number;
  pbUsed: PersonalBest;
  scaled: boolean;
  pbConverted: boolean;
  suggestedLabels: string[];
}

/**
 * Detecta si el entrenamiento consta de una sola repetición (sin multiplicadores mayores a 1).
 */
export function isSingleRepetition(seriesStr: string): boolean {
  if (!seriesStr) return false;
  const clean = seriesStr.trim().toLowerCase();
  
  // Si tiene el signo '+', indica múltiples bloques combinados
  if (clean.includes("+")) return false;

  const multiplierRegex = /\b(\d+)\s*(?:x|\*|de|veces\b)/gi;
  let match;
  let hasMultiplierGreaterThanOne = false;
  while ((match = multiplierRegex.exec(clean)) !== null) {
    const mult = parseInt(match[1], 10);
    if (mult > 1) {
      hasMultiplierGreaterThanOne = true;
    }
  }
  if (hasMultiplierGreaterThanOne) {
    return false;
  }
  return true;
}

/**
 * Calcula la zona de intensidad sugerida o calcula el porcentaje basado en la intensidad existente,
 * considerando el estilo, serie, tiempos, marcas personales y piscina.
 */
export function calculateIntensityZone(
  seriesStr: string,
  tiemposStr: string,
  estiloStr: string,
  pbs: PersonalBest[],
  piscinaEntrenamiento: string = "25m",
  currentIntensity: string = ""
): ZoneResult | null {
  const distance = extractDistance(seriesStr);
  const avgSeconds = extractAverageSeconds(tiemposStr);
  if (!distance || !avgSeconds || pbs.length === 0) return null;

  const style = normalizeStyle(estiloStr);
  const pool = piscinaEntrenamiento.trim().toLowerCase();

  // Determinar distancia objetivo para buscar el PB
  let targetDist: number | null = null;
  let isPredicting = false;

  if (currentIntensity) {
    targetDist = getReferenceDistance(currentIntensity, distance, seriesStr);
  } else {
    isPredicting = true;
  }

  let pbResult: { pb: PersonalBest; scaled: boolean } | null = null;

  if (isPredicting) {
    // Si estamos autocalculando/sugiriendo la intensidad
    // Evaluamos de mayor a menor intensidad según los porcentajes definidos
    const singleRep = isSingleRepetition(seriesStr);
    if (singleRep) {
      pbResult = findBestPB(pbs, style, distance, pool);
      if (pbResult) {
        const { pb, scaled } = pbResult;
        const pbSeconds = parseSeconds(pb.tiempo);
        if (pbSeconds) {
          const pbPool = pb.piscina.trim().toLowerCase();
          
          const factor100m = getConversionFactor100m(style);
          const seriesPace100 = avgSeconds * (100 / distance);
          const seriesPace100_25 = seriesPace100 - (pool === "50m" ? factor100m : 0);
          
          const pbFactor100m = getConversionFactor100m(pb.estilo);
          const pbPace100 = pbSeconds * (100 / pb.distancia);
          const pbPace100_25 = pbPace100 - (pbPool === "50m" ? pbFactor100m : 0);
          
          const pbConverted = pbPool !== pool;
          const percentage = (pbPace100_25 / seriesPace100_25) * 100;
          return {
            zone: "Crono",
            percentage: Math.round(percentage * 10) / 10,
            pbUsed: pb,
            scaled,
            pbConverted,
            suggestedLabels: ["Crono"],
          };
        }
      }
    }

    // Evaluar secuencialmente
    const checks = [
      { zone: "Velocidad", refDist: 50, threshold: 97.5 },
      { zone: "Anaeróbico", refDist: calculateBlockDistance(getInnerBlockString(seriesStr)) || distance, threshold: 90.0 },
      { zone: "VO2Max", refDist: distance, threshold: 85.0 },
      { zone: "Aeróbico intenso", refDist: distance, threshold: 82.5 },
      { zone: "Aeróbico medio", refDist: distance, threshold: 77.5 },
      { zone: "Aeróbico ligero", refDist: 100, threshold: 70.0 }
    ];

    for (const ch of checks) {
      const resPb = findBestPB(pbs, style, ch.refDist, pool);
      if (resPb) {
        const pbSecs = parseSeconds(resPb.pb.tiempo);
        if (pbSecs) {
          const pbPool = resPb.pb.piscina.trim().toLowerCase();
          
          const factor100m = getConversionFactor100m(style);
          const seriesPace100 = avgSeconds * (100 / distance);
          const seriesPace100_25 = seriesPace100 - (pool === "50m" ? factor100m : 0);
          
          const pbFactor100m = getConversionFactor100m(resPb.pb.estilo);
          const pbPace100 = pbSecs * (100 / resPb.pb.distancia);
          const pbPace100_25 = pbPace100 - (pbPool === "50m" ? pbFactor100m : 0);
          
          const pbConverted = pbPool !== pool;
          const percentage = (pbPace100_25 / seriesPace100_25) * 100;

          if (percentage >= ch.threshold) {
            const suggestedLabels = [ch.zone];
            const targetDistances = [100, 200, 400, 800, 1500];
            for (const d of targetDistances) {
              const distPbRes = findBestPB(pbs, style, d, pool);
              if (distPbRes) {
                const distPbSecs = parseSeconds(distPbRes.pb.tiempo);
                if (distPbSecs) {
                  const distPbPool = distPbRes.pb.piscina.trim().toLowerCase();
                  
                  const distPbFactor100m = getConversionFactor100m(distPbRes.pb.estilo);
                  const distPbPace100 = distPbSecs * (100 / d);
                  const distPbPace100_25 = distPbPace100 - (distPbPool === "50m" ? distPbFactor100m : 0);
                  
                  const diffPercent = Math.abs(seriesPace100_25 - distPbPace100_25) / distPbPace100_25;
                  if (diffPercent <= 0.035) {
                    suggestedLabels.push(`Ritmo de ${d}`);
                  }
                }
              }
            }

            const ritmosOrder = ["Ritmo de 100", "Ritmo de 200", "Ritmo de 400", "Ritmo de 800", "Ritmo de 1500"];
            suggestedLabels.sort((a, b) => {
              const aIsRitmo = ritmosOrder.includes(a);
              const bIsRitmo = ritmosOrder.includes(b);
              if (aIsRitmo && !bIsRitmo) return -1;
              if (!aIsRitmo && bIsRitmo) return 1;
              if (aIsRitmo && bIsRitmo) return ritmosOrder.indexOf(a) - ritmosOrder.indexOf(b);
              return 0;
            });

            return {
              zone: ch.zone,
              percentage: Math.round(percentage * 10) / 10,
              pbUsed: resPb.pb,
              scaled: resPb.scaled,
              pbConverted,
              suggestedLabels,
            };
          }
        }
      }
    }

    targetDist = 100; // Por defecto suave usa de referencia la marca de 100m
  }

  // Buscar el PB para el targetDist calculado
  if (!targetDist) {
    targetDist = distance;
  }
  pbResult = findBestPB(pbs, style, targetDist, pool);
  if (!pbResult) return null;

  const { pb: pbToUse, scaled } = pbResult;
  const pbSeconds = parseSeconds(pbToUse.tiempo);
  if (!pbSeconds) return null;

  const pbPool = pbToUse.piscina.trim().toLowerCase();
  
  const factor100m = getConversionFactor100m(style);
  const seriesPace100 = avgSeconds * (100 / distance);
  const seriesPace100_25 = seriesPace100 - (pool === "50m" ? factor100m : 0);
  
  const pbFactor100m = getConversionFactor100m(pbToUse.estilo);
  const pbPace100 = pbSeconds * (100 / pbToUse.distancia);
  const pbPace100_25 = pbPace100 - (pbPool === "50m" ? pbFactor100m : 0);
  
  const pbConverted = pbPool !== pool;
  const percentage = (pbPace100_25 / seriesPace100_25) * 100;

  const suggestedLabels = currentIntensity
    ? currentIntensity.split("+").map((s) => s.trim()).filter(Boolean)
    : [isPredicting ? "Suave" : "Crono"];

  return {
    zone: isPredicting ? "Suave" : (suggestedLabels[0] || "Crono"),
    percentage: Math.round(percentage * 10) / 10,
    pbUsed: pbToUse,
    scaled,
    pbConverted,
    suggestedLabels,
  };
}
