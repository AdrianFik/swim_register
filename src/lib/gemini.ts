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

3. MÚLTIPLES BLOQUES Y DESGLOSE POR TIEMPOS:
   - Si el audio describe múltiples repeticiones de bloques con estilos diferentes (ej: "Bloque 1 mariposa ... Bloque 2 crol"), devuélvelos como objetos independientes.
   - Ejemplo: "2 veces (25 mariposa más 50 crol), haciendo el primer bloque de mariposa 25 en 10.4 y 50 en 25.7, y el segundo de crol 25 en 10.6 y 50 en 24.6" se traduce en 4 objetos JSON independientes:
     1. { "series": "1x25", "estilos": "mariposa", "tiempos": "10.4" }
     2. { "series": "1x50", "estilos": "mariposa", "tiempos": "25.7" }
     3. { "series": "1x25", "estilos": "crol", "tiempos": "10.6" }
     4. { "series": "1x50", "estilos": "crol", "tiempos": "24.6" }

4. COINCIDENCIA DE MULTIPLICADORES AL DESGLOSAR POR TIEMPOS INDIVIDUALES:
   - Si un bloque repetido se divide en filas/objetos separados porque se registran tiempos específicos o estilos para cada bloque individual, cada objeto resultante representa una única ejecución real. Por lo tanto, el multiplicador externo de repetición (ej: "2x") NO debe multiplicarse ni aplicarse en el campo "series" de los objetos resultantes. Cada uno debe llevar "1xDistancia" (ej: "1x25" o "1x50").
   - NUNCA devuelvas "2x(1x25)" si el objeto solo contiene un único tiempo individual (ej: "10.4") registrado para ese bloque específico.
   - Si no hay tiempos individuales y se mantiene la agrupación, entonces sí puedes conservar el multiplicador (ej: "2x(1x25)").

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
        notes: `[Error al procesar] ${responseText}`,
        piscina: "25m",
      } as any,
    ];
  }
}

const SESSION_EXTRACTION_PROMPT = `Eres un asistente de registro de entrenamientos de natación para un grupo de nadadores. Analiza este audio y extrae los tiempos de cada nadador en formato JSON.

Lista de nadadores activos y presentes en el entrenamiento (solo debes asociar tiempos a estos nombres exactos):
{swimmersList}

Fecha de referencia (hoy): {currentDate}

CONFIGURACIÓN DEL BLOQUE DE ENTRENAMIENTO ACTUAL:
- Descripción del Bloque: {blockDescription}
- Intensidad base: {intensity}
- Descanso/Intervalo base: {rest}
- Piscina: {pool}

REGLAS CRÍTICAS DE EXTRACCIÓN:
1. Identifica qué nadador o nadadores se mencionan en la grabación de voz y los tiempos de repetición asociados a cada uno.
2. Mapea nombres de forma inteligente. Si el audio dice un apodo o nombre parcial (ej: "Adri" o "Fik"), compáralo con la lista de nadadores activos y asígnalo al nombre oficial correspondiente (ej: "Adrián Fik"). Si no coincide con ninguno, ignóralo o no lo incluyes.
3. Extrae los tiempos individuales en orden cronológico tal como se mencionan para cada nadador.
4. APLICA LA LÓGICA MATEMÁTICA Y DE RENDIMIENTO DE NATACIÓN CRUZADA CON LA CONFIGURACIÓN DEL BLOQUE (especialmente la distancia) PARA CORREGIR ALUCINACIONES ACÚSTICAS O ABREVIACIONES EN LA GRABACIÓN. Por ejemplo, si la distancia del bloque es de 100 metros y se escucha que el nadador hizo "quince" (o "quince segundos"), debes interpretar y corregir ese tiempo a "1:15" (un minuto y quince segundos), ya que es físicamente imposible nadar 100 metros en 15 segundos. Sin embargo, si la distancia del bloque es de 50 metros o menor, un tiempo de "quince" es perfectamente viable y debes dejarlo como "15" o "15s". Utiliza este razonamiento para resolver discrepancias acústicas o atajos de voz que producirían marcas incoherentes.
5. Los tiempos deben ser representados como cadenas de texto en formato limpio (ej: "1:04.5", "32.5", "1:12.3", "58.9" o "1:15").
6. OPCIONAL: Si para una repetición específica se menciona explícitamente un estilo de natación (ej: "crol", "espalda", "mariposa", "braza", "estilos") o material (ej: "aletas", "palas", "tabla", "pull-buoy") que sea diferente al resto o digno de mención, puedes registrarlo en los arrays opcionales "estilos" o "materiales" correspondientes a esa posición. Si no se especifican para cada repetición, no incluyas estos campos o déjalos vacíos.

Estructura de cada objeto en el array JSON resultante:
[
  {
    "nombre": "Nombre Oficial del Nadador",
    "tiempos": ["tiempo1", "tiempo2", ...],
    "estilos": ["estilo1", "estilo2", ...], // opcional (mismo largo que tiempos, ej. "mariposa")
    "materiales": ["material1", "material2", ...] // opcional (mismo largo que tiempos, ej. "aletas")
  }
]

Ejemplo de audio: "Adrián hizo 1:12, quince y 1:13. Juan hizo 1:15 con aletas." (para un bloque de 100 metros)
Resultado JSON esperado:
[
  { 
    "nombre": "Adrián Fik", 
    "tiempos": ["1:12", "1:15", "1:13"] 
  },
  { 
    "nombre": "Juan Pérez", 
    "tiempos": ["1:15"],
    "materiales": ["aletas"]
  }
]

IMPORTANTE:
- Responde ÚNICAMENTE con el Array JSON (ej: [{...}, {...}]), sin markdown, sin backticks, sin explicaciones.
- Si no se escucha a ningún nadador de la lista, devuelve un array vacío [].
- Responde siempre en español.`;

export async function processSessionAudio(
  audioBuffer: Buffer,
  mimeType: string,
  swimmersList: string[],
  currentDate: string,
  config: {
    blockDescription: string;
    intensity: string;
    rest: string;
    pool: string;
  }
): Promise<any[]> {
  const ai = getGenAI();
  const model = ai.getGenerativeModel({ model: "gemini-2.5-flash" }); // Use gemini-2.5-flash as the standard/updated model

  const prompt = SESSION_EXTRACTION_PROMPT
    .replace("{swimmersList}", swimmersList.join(", "))
    .replace("{currentDate}", currentDate)
    .replace("{blockDescription}", config.blockDescription)
    .replace("{intensity}", config.intensity)
    .replace("{rest}", config.rest)
    .replace("{pool}", config.pool);

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

  let jsonStr = responseText;
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (err) {
    console.error("Error parsing Gemini session result:", responseText, err);
    return [];
  }
}

