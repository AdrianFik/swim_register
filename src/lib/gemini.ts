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

REGLA CRÍTICA:
Si el audio menciona múltiples bloques o series con diferentes estilos, distancias, tiempos o materiales (ej: un calentamiento suave, luego una serie de crol y después otra de mariposa), debes devolver una lista (array) de objetos JSON. Cada objeto de la lista representa un bloque o serie independiente. Si solo hay una única serie o bloque en el entrenamiento, devuelve un array de un solo objeto.

Estructura de cada objeto en el array JSON:
1. fecha: string (YYYY-MM-DD). Si el audio menciona "ayer", "anteayer", "el lunes", "esta mañana", etc., calcula y ajusta la fecha tomando como base la fecha de referencia. Si no hay referencias temporales, usa la fecha de referencia. Debe replicarse en todos los bloques.

2. series: string. Traduce el lenguaje informal de natación a notación estructurada de la serie para ESTE bloque:
   - Traduce "X de Y" a "XxY". Ej: "20 de 100" -> "20x100", "20 de 25" -> "20x25".
   - Si se repite un bloque, usa paréntesis. Ej: "3 veces 20 de 25" -> "3x(20x25)", "2 veces 2 por 50" -> "2x(2x50)".
   - Si se combinan bloques en el mismo grupo, únelos con "+". Ej: "un 100 con 30 segundos mas 2 de 50 con 20 segundos" -> "1x100 (desc. 30s) + 2x50 (desc. 20s)".
   - Incluye siempre el descanso ("desc.") o la salida ("salida") entre paréntesis dentro de la serie si se menciona. Ej: "4 de 50 con 20 segundos" -> "4x50 (desc. 20s)".
   - Si es una serie rota: "rotas de 100" -> "rotas de 100" o "series rotas de 100".
   - Si es un trabajo de volumen de fondo con especificación del último: "3 de 800, el último crono" -> "3x800 (último crono)", "un 800 crono" -> "1x800 crono".

3. estilos: string. Estilo de natación usado en este bloque, separados por coma si aplica.
   - Mapea siempre "maripa" o "mariposas" a "mariposa".
   - Valores permitidos: crol, espalda, mariposa, braza, estilos.

4. tiempos: string. Registra los tiempos, marcas o promedios específicos para este bloque.
   - Si se mencionan medias: "a media de 15 segundos" -> "media: 15s" o "15s".
   - Si se mencionan tiempos por partes: "1:15, 1:16, 1:14" -> "1:15, 1:16, 1:14".

5. intensidad: string. Clasifica la intensidad usando ÚNICAMENTE las siguientes etiquetas cerradas:
   - Ritmos: "Ritmo de 100", "Ritmo de 200", "Ritmo de 400", "Ritmo de 800", "Ritmo de 1500".
   - Zonas: "Velocidad", "Anaeróbico", "VO2Max", "Aeróbico intenso", "Aeróbico medio", "Aeróbico ligero", "Suave", "Crono".
   Si hay múltiples etiquetas aplicables (por ejemplo, un ritmo y una zona), únelas separadas exactamente por " + " (ej: "Ritmo de 200 + Anaeróbico"). Si no aplica ninguna, deja vacío.

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
