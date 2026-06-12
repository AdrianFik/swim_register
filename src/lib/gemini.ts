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

const EXTRACTION_PROMPT = `Eres un asistente de registro de entrenamientos de natación para nadadores y entrenadores. Analiza este audio y extrae los datos del entrenamiento en formato JSON.

El entrenamiento es de: {personName}
Fecha de referencia (hoy): {currentDate}

Reglas específicas de extracción y formateo:
1. fecha: string (YYYY-MM-DD). Si el audio menciona "ayer", "anteayer", "el lunes", "esta mañana", etc., calcula y ajusta la fecha tomando como base la fecha de referencia. Si no hay referencias temporales, usa la fecha de referencia.

2. series: string. Traduce el lenguaje informal de natación a notación estructurada:
   - Traduce "X de Y" a "XxY". Ej: "20 de 100" -> "20x100", "20 de 25" -> "20x25".
   - Si se repite un bloque, usa paréntesis. Ej: "3 veces 20 de 25" -> "3x(20x25)", "2 veces 2 por 50" -> "2x(2x50)".
   - Si se combinan bloques en el mismo grupo, únelos con "+". Ej: "un 100 con 30 segundos mas 2 de 50 con 20 segundos" -> "1x100 (desc. 30s) + 2x50 (desc. 20s)".
   - Incluye siempre el descanso ("desc.") o la salida ("salida") entre paréntesis dentro de la serie si se menciona. Ej: "4 de 50 con 20 segundos" -> "4x50 (desc. 20s)".
   - Si es una serie rota: "rotas de 100" -> "rotas de 100" o "series rotas de 100".
   - Si es un trabajo de volumen de fondo con especificación del último: "3 de 800, el último crono" -> "3x800 (último crono)", "un 800 crono" -> "1x800 crono".

3. estilos: string. Estilos de natación separados por coma.
   - Mapea siempre "maripa" o "mariposas" a "mariposa".
   - Valores permitidos: crol, espalda, mariposa, braza, estilos (ej: "crol, mariposa").

4. tiempos: string. Registra los tiempos, marcas o promedios.
   - Si se mencionan medias por repetición de tandas: "las 3 tandas de 20 de 25 a medias de 15, 16 y 15.5 segundos" -> "medias: 15s, 16s, 15.5s" o "1ª: 15s, 2ª: 16s, 3ª: 15.5s".
   - Si se mencionan tiempos por partes: "1:15, 1:16, 1:14" -> "1:15, 1:16, 1:14".
   - Si es un crono solo (ej: 800 crono en 9:55): "9:55" o "último 800 en 9:55".

5. intensidad: string. Mapea fielmente los términos usados en natación: "Aeróbico suave", "Aeróbico intenso", "Anaeróbico", "Velocidad", "Umbral", "Regenerativo", "Crono" u otras variantes mencionadas.

6. material: string. Si no se menciona ningún material, pon exactamente "Sin material" por defecto. Si se menciona, extrae el material (ej: "palas", "pull-buoy", "aletas", "tabla").

7. pulso: string (pulsaciones por minuto si se mencionan, ej: "160 ppm"). Si no se menciona, deja vacío.

8. notas: string (cualquier otro comentario o sensación).

IMPORTANTE:
- Responde ÚNICAMENTE con el JSON, sin markdown, sin backticks, sin explicaciones.
- Si un campo no se menciona en el audio, devuelve una cadena vacía "" (a excepción de material que debe ser "Sin material").
- Responde siempre en español.`;

/**
 * Procesa un audio con Gemini Flash y extrae datos estructurados del entrenamiento.
 */
export async function processAudio(
  audioBuffer: Buffer,
  mimeType: string,
  personName: string,
  currentDate: string
): Promise<TrainingData> {
  const ai = getGenAI();
  const model = ai.getGenerativeModel({ model: "gemini-3.5-flash" });

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
    const parsed = JSON.parse(jsonStr) as TrainingData;
    return {
      fecha: parsed.fecha || currentDate,
      series: parsed.series || "",
      estilos: parsed.estilos || "",
      tiempos: parsed.tiempos || "",
      intensidad: parsed.intensidad || "",
      material: parsed.material || "",
      pulso: parsed.pulso || "",
      notas: parsed.notas || "",
    };
  } catch {
    // Si falla el parseo, devolver los datos con la respuesta en notas
    return {
      fecha: currentDate,
      series: "",
      estilos: "",
      tiempos: "",
      intensidad: "",
      material: "",
      pulso: "",
      notas: `[Error al procesar] ${responseText}`,
    };
  }
}
