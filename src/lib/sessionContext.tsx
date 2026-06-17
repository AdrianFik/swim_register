"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";

export interface SessionConfig {
  blockDescription: string; // Ej: "10x100 crol"
  intensity: string;        // Ej: "Aeróbico medio"
  rest: string;             // Ej: "desc. 15s" o "salida 1:30"
  pool: "25m" | "50m";
  date: string;             // YYYY-MM-DD
  totalColumns: number;     // Número total de columnas (repeticiones)
}

export interface RepCell {
  time: string | null;
  style?: string;
  material?: string;
}

export interface SessionState {
  config: SessionConfig | null;
  activeSwimmers: string[];
  grid: Record<string, RepCell[]>;
}

export interface GeminiImportItem {
  nombre: string;
  tiempos: string[];
  estilos?: string[];
  materiales?: string[];
}

export interface GroupedReps {
  count: number;
  times: string[];
  style: string;
  material: string;
}

export function groupSwimmerReps(
  cells: RepCell[],
  defaultStyle: string,
  defaultMaterial: string
): GroupedReps[] {
  const activeCells = cells.filter((c) => c.time !== null) as {
    time: string;
    style?: string;
    material?: string;
  }[];
  
  if (activeCells.length === 0) return [];
  
  const groups: GroupedReps[] = [];
  let currentGroup: GroupedReps = {
    count: 1,
    times: [activeCells[0].time],
    style: activeCells[0].style || defaultStyle,
    material: activeCells[0].material || defaultMaterial,
  };
  
  for (let i = 1; i < activeCells.length; i++) {
    const cell = activeCells[i];
    const cellStyle = cell.style || defaultStyle;
    const cellMaterial = cell.material || defaultMaterial;
    
    if (cellStyle === currentGroup.style && cellMaterial === currentGroup.material) {
      currentGroup.count++;
      currentGroup.times.push(cell.time);
    } else {
      groups.push(currentGroup);
      currentGroup = {
        count: 1,
        times: [cell.time],
        style: cellStyle,
        material: cellMaterial,
      };
    }
  }
  groups.push(currentGroup);
  return groups;
}

export interface SheetsRow {
  fecha: string;
  series: string;
  estilos: string;
  tiempos: string;
  intensidad: string;
  material: string;
  pulso: string;
  notas: string;
  piscina: string;
}

export function transformGridToSheets(
  cells: RepCell[],
  config: SessionConfig,
  distance: number,
  defaultStyle: string,
  defaultMaterial: string = "Sin material"
): SheetsRow[] {
  const grouped = groupSwimmerReps(cells, defaultStyle, defaultMaterial);
  return grouped.map((group) => ({
    fecha: config.date,
    series: `${group.count}x${distance}`,
    estilos: group.style,
    tiempos: group.times.join(", "),
    intensidad: config.intensity,
    material: group.material,
    pulso: "",
    notas: `Sesión Grupal. Bloque base: ${config.blockDescription}`,
    piscina: config.pool,
  }));
}

interface SessionContextType {
  state: SessionState;
  initSession: (config: SessionConfig, swimmers: string[]) => void;
  editCell: (swimmerName: string, repIndex: number, cellData: RepCell) => void;
  fillFromGemini: (importedData: GeminiImportItem[]) => void;
  clearSession: () => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  // Inicializamos el estado vacío o desde localStorage para persistencia durante la sesión
  const [state, setState] = useState<SessionState>({
    config: null,
    activeSwimmers: [],
    grid: {},
  });

  // Cargar estado inicial de localStorage si existe
  useEffect(() => {
    try {
      const saved = localStorage.getItem("swim_log_active_session");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.config && parsed.activeSwimmers) {
          setState(parsed);
        }
      }
    } catch (e) {
      console.error("Error al cargar sesión persistida:", e);
    }
  }, []);

  // Guardar en localStorage cuando cambie el estado (efecto secundario puro)
  useEffect(() => {
    try {
      if (state.config) {
        localStorage.setItem("swim_log_active_session", JSON.stringify(state));
      } else {
        localStorage.removeItem("swim_log_active_session");
      }
    } catch (e) {
      console.error("Error al guardar sesión en localStorage:", e);
    }
  }, [state]);

  const initSession = useCallback((config: SessionConfig, swimmers: string[]) => {
    const grid: Record<string, RepCell[]> = {};
    swimmers.forEach((name) => {
      grid[name] = Array.from({ length: config.totalColumns }, () => ({
        time: null,
      }));
    });

    setState({
      config,
      activeSwimmers: swimmers,
      grid,
    });
  }, []);

  const editCell = useCallback((swimmerName: string, repIndex: number, cellData: RepCell) => {
    setState((prev) => {
      if (!prev.grid[swimmerName]) return prev;

      const swimmerCells = [...prev.grid[swimmerName]];
      swimmerCells[repIndex] = {
        ...swimmerCells[repIndex],
        ...cellData,
      };

      return {
        ...prev,
        grid: {
          ...prev.grid,
          [swimmerName]: swimmerCells,
        },
      };
    });
  }, []);

  const fillFromGemini = useCallback((importedData: GeminiImportItem[]) => {
    setState((prev) => {
      if (!prev.config) return prev;

      const newGrid = { ...prev.grid };
      const { activeSwimmers, config } = prev;

      importedData.forEach((item) => {
        // Búsqueda inteligente de nadador por coincidencia difusa / insensible
        const queryName = item.nombre.toLowerCase().trim();
        const swimmerKey = activeSwimmers.find((s) => {
          const sLower = s.toLowerCase();
          return (
            sLower === queryName ||
            sLower.includes(queryName) ||
            queryName.includes(sLower)
          );
        });

        if (!swimmerKey || !newGrid[swimmerKey]) {
          console.warn(`No se encontró un nadador activo para la coincidencia: ${item.nombre}`);
          return;
        }

        const swimmerCells = [...newGrid[swimmerKey]];

        item.tiempos.forEach((timeVal, idx) => {
          // Encontrar la primera celda vacía (time === null)
          const emptyIndex = swimmerCells.findIndex((cell) => cell.time === null);

          if (emptyIndex !== -1 && emptyIndex < config.totalColumns) {
            swimmerCells[emptyIndex] = {
              time: timeVal,
              style: item.estilos?.[idx] || swimmerCells[emptyIndex].style,
              material: item.materiales?.[idx] || swimmerCells[emptyIndex].material,
            };
          }
        });

        newGrid[swimmerKey] = swimmerCells;
      });

      return {
        ...prev,
        grid: newGrid,
      };
    });
  }, []);

  const clearSession = useCallback(() => {
    setState({
      config: null,
      activeSwimmers: [],
      grid: {},
    });
  }, []);

  return (
    <SessionContext.Provider
      value={{
        state,
        initSession,
        editCell,
        fillFromGemini,
        clearSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSessionState() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error("useSessionState debe utilizarse dentro de un SessionProvider");
  }
  return context;
}
