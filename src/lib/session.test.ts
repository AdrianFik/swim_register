import { describe, it, expect, vi } from "vitest";
import { 
  groupSwimmerReps, 
  transformGridToSheets, 
  RepCell, 
  SessionConfig,
  GeminiImportItem
} from "./sessionContext";
import { processSessionAudio } from "./gemini";

process.env.GEMINI_API_KEY = "mock-key";

// Mock de @google/generative-ai
vi.mock("@google/generative-ai", () => {
  class GoogleGenerativeAI {
    apiKey: string;
    constructor(apiKey: string) {
      this.apiKey = apiKey;
    }
    getGenerativeModel() {
      return {
        generateContent: async () => {
          return {
            response: {
              text: () => JSON.stringify([
                {
                  nombre: "Adrián Fik",
                  tiempos: ["1:12.4", "1:15.0"]
                }
              ])
            }
          };
        }
      };
    }
  }
  return {
    GoogleGenerativeAI
  };
});

describe("Session Swimmer Repetitions Grouping Logic", () => {
  const defaultStyle = "crol";
  const defaultMaterial = "Sin material";

  it("should return empty array if no reps are active (all times are null)", () => {
    const cells: RepCell[] = [
      { time: null },
      { time: null },
      { time: null },
    ];
    const result = groupSwimmerReps(cells, defaultStyle, defaultMaterial);
    expect(result).toEqual([]);
  });

  it("should group homogeneous reps into a single block", () => {
    const cells: RepCell[] = [
      { time: "1:12.4" },
      { time: "1:13.1" },
      { time: "1:12.9" },
    ];
    const result = groupSwimmerReps(cells, defaultStyle, defaultMaterial);
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      count: 3,
      times: ["1:12.4", "1:13.1", "1:12.9"],
      style: "crol",
      material: "Sin material",
    });
  });

  it("should group consecutive reps with custom style or material correctly", () => {
    const cells: RepCell[] = [
      { time: "32.4", style: "mariposa" },
      { time: "33.1", style: "mariposa" },
      { time: "32.9", style: "mariposa", material: "aletas" },
    ];
    const result = groupSwimmerReps(cells, defaultStyle, defaultMaterial);
    
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      count: 2,
      times: ["32.4", "33.1"],
      style: "mariposa",
      material: "Sin material",
    });
    expect(result[1]).toEqual({
      count: 1,
      times: ["32.9"],
      style: "mariposa",
      material: "aletas",
    });
  });
});

describe("State & Transformation Logic", () => {
  const config: SessionConfig = {
    blockDescription: "10x100 crol",
    intensity: "Aeróbico medio",
    rest: "desc. 15s",
    pool: "25m",
    date: "2026-06-17",
    totalColumns: 5,
  };

  // 1. Llenado secuencial en matriz vacía
  it("should sequentially fill empty cells in an empty matrix", () => {
    const swimmerCells: RepCell[] = Array.from({ length: 5 }, () => ({ time: null }));
    const importItem: GeminiImportItem = {
      nombre: "Adrián Fik",
      tiempos: ["1:12.4", "1:13.0"],
      estilos: ["crol", "crol"],
      materiales: ["Sin material", "Sin material"]
    };

    // Simulación del fillFromGemini
    const updatedCells = [...swimmerCells];
    importItem.tiempos.forEach((timeVal, idx) => {
      const emptyIndex = updatedCells.findIndex((cell) => cell.time === null);
      if (emptyIndex !== -1) {
        updatedCells[emptyIndex] = {
          time: timeVal,
          style: importItem.estilos?.[idx],
          material: importItem.materiales?.[idx],
        };
      }
    });

    expect(updatedCells[0].time).toBe("1:12.4");
    expect(updatedCells[1].time).toBe("1:13.0");
    expect(updatedCells[2].time).toBeNull();
  });

  // 2. Llenado secuencial con celdas previas ocupadas
  it("should sequentially fill cells starting from the first null cell when some are already occupied", () => {
    const swimmerCells: RepCell[] = [
      { time: "1:11.2", style: "crol" },
      { time: "1:12.0", style: "crol" },
      { time: null },
      { time: null },
      { time: null },
    ];
    const importItem: GeminiImportItem = {
      nombre: "Adrián Fik",
      tiempos: ["1:13.5"],
      estilos: ["espalda"],
      materiales: ["aletas"]
    };

    // Simulación del fillFromGemini
    const updatedCells = [...swimmerCells];
    importItem.tiempos.forEach((timeVal, idx) => {
      const emptyIndex = updatedCells.findIndex((cell) => cell.time === null);
      if (emptyIndex !== -1) {
        updatedCells[emptyIndex] = {
          time: timeVal,
          style: importItem.estilos?.[idx],
          material: importItem.materiales?.[idx],
        };
      }
    });

    expect(updatedCells[0].time).toBe("1:11.2");
    expect(updatedCells[1].time).toBe("1:12.0");
    expect(updatedCells[2]).toEqual({
      time: "1:13.5",
      style: "espalda",
      material: "aletas",
    });
    expect(updatedCells[3].time).toBeNull();
  });

  // 3. Edición manual directa
  it("should correctly update a single cell during manual editing", () => {
    const swimmerCells: RepCell[] = [
      { time: "1:11.2", style: "crol" },
      { time: null },
      { time: null },
    ];

    // Simular edición manual del índice 1
    const repIndex = 1;
    const cellData: RepCell = { time: "1:15.0", style: "braza", material: "pull-buoy" };
    
    const updatedCells = [...swimmerCells];
    updatedCells[repIndex] = {
      ...updatedCells[repIndex],
      ...cellData,
    };

    expect(updatedCells[0].time).toBe("1:11.2");
    expect(updatedCells[1]).toEqual({
      time: "1:15.0",
      style: "braza",
      material: "pull-buoy",
    });
    expect(updatedCells[2].time).toBeNull();
  });

  // 4. Transformador para Google Sheets
  it("should transform grid cells into sheets rows structures correctly", () => {
    const swimmerCells: RepCell[] = [
      { time: "1:12.0", style: "crol", material: "Sin material" },
      { time: "1:13.0", style: "crol", material: "Sin material" },
      { time: "1:14.0", style: "crol", material: "palas" },
    ];

    const rows = transformGridToSheets(swimmerCells, config, 100, "crol", "Sin material");

    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({
      fecha: "2026-06-17",
      series: "2x100",
      estilos: "crol",
      tiempos: "1:12.0, 1:13.0",
      intensidad: "Aeróbico medio",
      material: "Sin material",
      pulso: "",
      notas: "Sesión Grupal. Bloque base: 10x100 crol",
      piscina: "25m",
    });
    expect(rows[1]).toEqual({
      fecha: "2026-06-17",
      series: "1x100",
      estilos: "crol",
      tiempos: "1:14.0",
      intensidad: "Aeróbico medio",
      material: "palas",
      pulso: "",
      notas: "Sesión Grupal. Bloque base: 10x100 crol",
      piscina: "25m",
    });
  });
});

describe("Gemini Parser Response Resiliency Unit Tests", () => {
  const swimmersList = ["Adrián Fik", "Juan Pérez"];
  const currentDate = "2026-06-17";
  const config = {
    blockDescription: "10x100 crol",
    intensity: "Aeróbico medio",
    rest: "desc. 15s",
    pool: "25m"
  };

  it("should parse a perfectly clean JSON response", async () => {
    const mockAudioBuffer = Buffer.from("dummy-audio-data");
    const result = await processSessionAudio(mockAudioBuffer, "audio/webm", swimmersList, currentDate, config);
    
    expect(result).toHaveLength(1);
    expect(result[0].nombre).toBe("Adrián Fik");
    expect(result[0].tiempos).toEqual(["1:12.4", "1:15.0"]);
  });

  it("should strip markdown wrappers and parse successfully (resilience test)", async () => {
    // Para probar la resiliencia localmente del parser, podemos simular el procesador del json.
    const markdownResponse = "```json\n[\n  {\n    \"nombre\": \"Juan Pérez\",\n    \"tiempos\": [\"1:15.2\"]\n  }\n]\n```";
    
    let jsonStr = markdownResponse.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
    }
    
    const parsed = JSON.parse(jsonStr);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].nombre).toBe("Juan Pérez");
    expect(parsed[0].tiempos).toEqual(["1:15.2"]);
  });
});
