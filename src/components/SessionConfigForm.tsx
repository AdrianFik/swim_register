"use client";

import { useState, useEffect, useCallback } from "react";
import { useSessionState, SessionConfig } from "@/lib/sessionContext";
import styles from "./SessionConfigForm.module.css";

interface Person {
  name: string;
  role: string;
}

export default function SessionConfigForm() {
  const { initSession } = useSessionState();
  
  // Form states
  const [blockDescription, setBlockDescription] = useState("");
  const [intensity, setIntensity] = useState("Aeróbico medio");
  const [rest, setRest] = useState("");
  const [pool, setPool] = useState<"25m" | "50m">("25m");
  const [date, setDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split("T")[0];
  });
  const [totalColumns, setTotalColumns] = useState<number>(10);
  
  // Swimmer loading & selection
  const [swimmers, setSwimmers] = useState<Person[]>([]);
  const [selectedSwimmers, setSelectedSwimmers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch swimmers
  useEffect(() => {
    async function fetchSwimmers() {
      try {
        const res = await fetch("/api/people");
        if (!res.ok) {
          throw new Error("No se pudieron cargar los nadadores");
        }
        const data: Person[] = await res.json();
        // Filtrar nadadores, pero si no hay, usar todos los que no sean entrenadores
        const onlySwimmers = data.filter((p) => p.role === "nadador");
        setSwimmers(onlySwimmers.length > 0 ? onlySwimmers : data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error de red");
      } finally {
        setLoading(false);
      }
    }
    fetchSwimmers();
  }, []);

  // Auto-parse block description to set totalColumns
  const handleBlockChange = (val: string) => {
    setBlockDescription(val);
    
    // Check for range multiplier like "5-7x100"
    const rangeMatch = val.match(/\b(\d+)\s*-\s*(\d+)\s*(?:x|\*|de|veces)/i);
    if (rangeMatch) {
      const maxReps = parseInt(rangeMatch[2], 10);
      if (!isNaN(maxReps) && maxReps > 0) {
        setTotalColumns(maxReps);
        return;
      }
    }
    
    // Check for single multiplier like "10x100" or "10 x 100" or "10 de 100"
    const singleMatch = val.match(/\b(\d+)\s*(?:x|\*|de|veces)\b/i);
    if (singleMatch) {
      const reps = parseInt(singleMatch[1], 10);
      if (!isNaN(reps) && reps > 0) {
        setTotalColumns(reps);
        return;
      }
    }
  };

  const handleSwimmerToggle = (name: string) => {
    setSelectedSwimmers((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
    );
  };

  const handleSelectAll = () => {
    if (selectedSwimmers.length === swimmers.length) {
      setSelectedSwimmers([]);
    } else {
      setSelectedSwimmers(swimmers.map((s) => s.name));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockDescription.trim()) {
      setError("Por favor, introduce la descripción del bloque.");
      return;
    }
    if (selectedSwimmers.length === 0) {
      setError("Por favor, selecciona al menos un nadador para la sesión.");
      return;
    }
    if (totalColumns <= 0 || totalColumns > 30) {
      setError("El número de repeticiones debe ser entre 1 y 30.");
      return;
    }

    const config: SessionConfig = {
      blockDescription: blockDescription.trim(),
      intensity,
      rest: rest.trim(),
      pool,
      date,
      totalColumns,
    };

    initSession(config, selectedSwimmers);
  };

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>Cargando nadadores activos...</span>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2 className={styles.title}>Iniciar Nueva Sesión Grupal</h2>
      <p className={styles.subtitle}>Configura el entrenamiento antes de tirarte al agua</p>

      {error && <div className={styles.errorBanner}>{error}</div>}

      {/* Grid de configuración */}
      <div className={styles.section}>
        <h3 className={styles.sectionTitle}>⚙️ Configuración del Bloque</h3>
        
        <div className={styles.inputGroup}>
          <label htmlFor="blockDescription">Descripción de la Serie *</label>
          <input
            id="blockDescription"
            type="text"
            placeholder="Ej: 10x100 crol, 5-7x100, 4x(4x50)"
            value={blockDescription}
            onChange={(e) => handleBlockChange(e.target.value)}
            required
            className={styles.input}
          />
        </div>

        <div className={styles.row}>
          <div className={styles.inputGroup}>
            <label htmlFor="intensity">Intensidad</label>
            <select
              id="intensity"
              value={intensity}
              onChange={(e) => setIntensity(e.target.value)}
              className={styles.select}
            >
              <option value="Crono">Crono (100% PB)</option>
              <option value="Velocidad">{"Velocidad (>=97.5%)"}</option>
              <option value="Anaeróbico">{"Anaeróbico (>=90%)"}</option>
              <option value="VO2Max">{"VO2Max (>=85%)"}</option>
              <option value="Aeróbico intenso">{"Aeróbico intenso (>=82.5%)"}</option>
              <option value="Aeróbico medio">{"Aeróbico medio (>=77.5%)"}</option>
              <option value="Aeróbico ligero">{"Aeróbico ligero (>=70%)"}</option>
              <option value="Suave">{"Suave (<70%)"}</option>
            </select>
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="rest">Descanso / Salida</label>
            <input
              id="rest"
              type="text"
              placeholder="Ej: desc. 15s, salida 1:30"
              value={rest}
              onChange={(e) => setRest(e.target.value)}
              className={styles.input}
            />
          </div>
        </div>

        <div className={styles.row}>
          <div className={styles.inputGroup}>
            <label htmlFor="pool">Piscina</label>
            <div className={styles.toggleGroup}>
              <button
                type="button"
                className={`${styles.toggleBtn} ${pool === "25m" ? styles.toggleActive : ""}`}
                onClick={() => setPool("25m")}
              >
                25m (Corta)
              </button>
              <button
                type="button"
                className={`${styles.toggleBtn} ${pool === "50m" ? styles.toggleActive : ""}`}
                onClick={() => setPool("50m")}
              >
                50m (Larga)
              </button>
            </div>
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="totalColumns">Columnas (Repeticiones)</label>
            <input
              id="totalColumns"
              type="number"
              min="1"
              max="30"
              value={totalColumns}
              onChange={(e) => setTotalColumns(parseInt(e.target.value, 10) || 1)}
              className={styles.input}
            />
          </div>
        </div>

        <div className={styles.inputGroup}>
          <label htmlFor="date">Fecha de la sesión</label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={styles.input}
          />
        </div>
      </div>

      {/* Swimmers Checklist */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3 className={styles.sectionTitle}>🏊 Seleccionar Participantes ({selectedSwimmers.length})</h3>
          <button
            type="button"
            className={styles.selectAllBtn}
            onClick={handleSelectAll}
          >
            {selectedSwimmers.length === swimmers.length ? "Desmarcar todos" : "Seleccionar todos"}
          </button>
        </div>

        <div className={styles.swimmerGrid}>
          {swimmers.map((swimmer) => {
            const isSelected = selectedSwimmers.includes(swimmer.name);
            return (
              <button
                key={swimmer.name}
                type="button"
                className={`${styles.swimmerCard} ${isSelected ? styles.swimmerSelected : ""}`}
                onClick={() => handleSwimmerToggle(swimmer.name)}
              >
                <div className={styles.swimmerCheckbox}>
                  {isSelected && <span className={styles.checkIcon}>✓</span>}
                </div>
                <span className={styles.swimmerName}>{swimmer.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      <button type="submit" className={styles.submitBtn}>
        🚀 Iniciar Sesión de Entrenamiento
      </button>
    </form>
  );
}
