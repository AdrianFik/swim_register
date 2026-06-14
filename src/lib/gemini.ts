import { GoogleGenerativeAI } from "@google/generative-ai";
import { TrainingData } from "./sheets";

let genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (genAI) return genAI;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  genAI = new GoogleGenerativeAI(apiKey);
  return genAI;
}

const EXTRACTION_PROMPT = `Eres un asistente de registro de entrenamientos de natación para nadadores y entrenadores. Analiza este audio y extrae los datos en formato JSON.

El entrenamiento es de: {personName}
Fecha de referencia (hoy): {currentDate}

REGLAS CRÍTICAS DE EXTRACCIÓN Y DIVISIÓN:
1. DIVISIÓN DE SERIES COMBINADAS POR DISTANCIA / ESTILO:
   - Si un bloque describe una combinación de diferentes distancias o estilos (ej: "haciendo mariposa - 25m: 10.4s, 50m: 25.7s" o "2 veces 25m mariposa más 50m crol") con tiempos específicos para cada una de las partes, DEBES dividirlo en objetos independientes en el array JSON.
   - NUNCA unas distancias diferentes (ej: "1x25 + 1x50") con sus respectivos tiempos en una sola fila. Deben ir en filas separadas.
   - Ejemplo: "Bloque 1 mariposa: 25m en 10.4s, 50m en 25.7s" se divide estrictamente en:
     - Objeto 1: { "series": "1x25", "estilos": "mariposa", "tiempos": "10.4" }
     - Objeto 2: { "series": "1x50", "estilos": "mariposa", "tiempos": "25.7" }

2. PREVENIR CONFUSIÓN ENTRE TIEMPOS Y SERIES:
   - NUNCA uses los tiempos de rendimiento o segundos cronometrados (ej: "10.4s", "25.7s", "10.6s", "24.6s") para interpretar o estructurar la serie.
   - Ejemplo erróneo a evitar: Traducir "10.4 segundos" a "10x25" o "24.6 segundos" a "24x6".
   - Los tiempos cronometrados pertenecen exclusivamente al campo "tiempos" y la estructura de la serie (repeticiones y metros) pertenece exclusivamente al campo "series".

3. MÚLTIPLES BLOQUES:
   - Si el audio describe múltiples repeticiones de bloques con estilos diferentes (ej: "Bloque 1 mariposa ... Bloque 2 crol"), devuélvelos como objetos independientes.
   - Ejemplo: "2 veces (25 mariposa más 50 crol), haciendo el primer bloque de mariposa 25 en 10.4 y 50 en 25.7, y el segundo de crol 25 en 10.6 y 50 en 24.6" se traduce en 4 objetos JSON independientes:
     1. { "series": "1x25", "estilos": "mariposa", "tiempos": "10.4" }
     2. { "series": "1x50", "estilos": "mariposa", "tiempos": "25.7" }
     3. { "series": "1x25", "estilos": "crol", "tiempos": "10.6" }
     4. { "series": "1x50", "estilos": "crol", "tiempos": "24.6" }

Estructura de cada objeto en el array JSON:
1. fecha: string (YYYY-MM-DD). Si el audio menciona "ayer", "anteayer", "el lunes", "esta mañana", etc., calcula y ajusta la fecha tomando como base la fecha de referencia. Si no hay referencias temporales, usa la fecha de referencia. Debe replicarse en todos los bloques.

2. series: string. Traduce el lenguaje informal de natación a notación estructurada de la serie para ESTE bloque:
   - Traduce "X de Y" a "XxY". Ej: "20 de 100" -> "20x100", "20 de 25" -> "20x25".
   - Si se repite un bloque, usa paréntesis. Ej: "3 veces 20 de 25" -> "3x(20x25)".
   - Si es una única repetición, pon "1xDistancia" (ej: "1x25", "1x50", "1x100").
   - Si es una serie rota: "rotas de 100" -> "rotas de 100" o "series rotas de 100".
   - Si es un trabajo de volumen de fondo con especificación del último: "3 de 800, el último crono" -> "3x800 (último crono)", "un 800 crono" -> "1x800 crono".

3. estilos: string. Estilo de natación usado en este bloque, separados por coma si aplica.
   - Mapea siempre "maripa" o "mariposas" a "mariposa".
   - Valores permitidos: crol, espalda, mariposa, braza, estilos.

4. tiempos: string. Registra los tiempos, marcas o promedios específicos para este bloque.
   - Si se mencionan tiempos individuales: "10.4", "25.7", "1:15", "1:16". Registra solo los números limpios de tiempo separados por comas si hay varios. Ej: "1:15, 1:16".
   - Si se mencionan medias: "a media de 15 segundos" -> "15s" o "media: 15s".

5. intensidad: string. Clasifica la intensidad usando ÚNICAMENTE las siguientes etiquetas cerradas:
   - Ritmos: "Ritmo de 100", "Ritmo de 200", "Ritmo de 400", "Ritmo de 800", "Ritmo de 1500".
   - Zonas: "Velocidad", "Anaeróbico", "VO2Max", "Aeróbico intenso", "Aeróbico medio", "Aeróbico ligero", "Suave", "Crono".
   Si hay múltiples etiquetas aplicables, únelas separadas exactamente por " + " (ej: "Ritmo de 200 + Anaeróbico"). Si no aplica ninguna, deja vacío.

6. material: string. Extrae el material para este bloque (ej: "palas", "pull-buoy", "aletas", "tabla"). Si no se menciona ningún material, pon exactamente "Sin material" por defecto.

7. pulso: string (pulsaciones por minuto si se mencionan en este bloque, ej: "160 ppm"). Si no se menciona, deja vacío.

8. notas: string (cualquier otro comentario o sensación específico de este bloque).

9. piscina: string (valores permitidos: "25m" o "50m"). Debe ser el mismo en todos los bloques. Si se menciona piscina corta o de 25m, extrae "25m". Si se menciona piscina larga o de 50m, extrae "50m". Si no se menciona, devuelve "25m".

IMPORTANTE:
- Responde ÚNICAMENTE con el Array JSON (ej: [{...}, {...}]), sin markdown, sin backticks, sin explicaciones.
- Si un campo no se menciona en el audio, devuelve una cadena vacía "" (a excepción de material que debe ser "Sin material" y piscina que debe ser "25m").
- Responde siempre en español.`;

/**
 * Procesa un audio con Gemini Flash y extrae datos estructurados del entrenamiento.
 */
export async function processAudio(
  audioBuffer: Buffer,
  mimeType: string,
  personName: string,
  currentDate: string
): Promise<TrainingData[]> {
  const ai = getGenAI();
  const model = ai.getGenerativeModel({ model: "gemini-3.1-flash-lite" });

  const prompt = EXTRACTION_PROMPT.replace("{personName}", personName).replace(
    "{currentDate}",
    currentDate
  );

  const audioBase64 = audioBuffer.toString("base64");

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType,
        data: audioBase64,
      },
    },
    { text: prompt },
  ]);

  const responseText = result.response.text().trim();

  // Intentar parsear limpiando posibles wrappers de markdown
  let jsonStr = responseText;
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const parsed = JSON.parse(jsonStr);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list.map((item: any) => ({
      fecha: item.fecha || currentDate,
      series: item.series || "",
      estilos: item.estilos || "",
      tiempos: item.tiempos || "",
      intensidad: item.intensidad || "",
      material: item.material || "",
      pulso: item.pulso || "",
      notas: item.notas || "",
      piscina: item.piscina || "25m",
    }));
  } catch {
    // Si falla el parseo, devolver los datos con la respuesta en notas
    return [
      {
        fecha: currentDate,
        series: "",
        estilos: "",
        tiempos: "",
        intensidad: "",
        material: "",
        pulso: "",
        notas: `[Error al procesar] ${responseText}`,
        piscina: "25m",
      },
    ];
  }
}
