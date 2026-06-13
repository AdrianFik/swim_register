"use client";

import { useState, useEffect, useCallback } from "react";
import styles from "./PersonalBests.module.css";
import { parseSeconds } from "@/lib/zones";
import { Plus, Trophy, Calendar, Compass, RefreshCw } from "lucide-react";

interface Person {
  name: string;
  role: string;
}

interface PersonalBest {
  nombre: string;
  estilo: string;
  distancia: number;
  tiempo: string;
  fecha: string;
  piscina: string;
}

interface PersonalBestsProps {
  person: Person;
}

const ESTILOS_OPTIONS = [
  { value: "crol", label: "Crol / Libre" },
  { value: "espalda", label: "Espalda" },
  { value: "mariposa", label: "Mariposa" },
  { value: "braza", label: "Braza" },
  { value: "estilos", label: "Estilos (IM)" },
];

const DISTANCIAS_OPTIONS = [25, 50, 100, 200, 400, 800, 1500];

export default function PersonalBests({ person }: PersonalBestsProps) {
  const isCoach = person.role === "entrenador";

  // Nadadores y nadador seleccionado (solo si es coach)
  const [swimmers, setSwimmers] = useState<Person[]>([]);
  const [selectedSwimmerName, setSelectedSwimmerName] = useState<string>(
    isCoach ? "" : person.name
  );

  // Lista de marcas
  const [marcas, setMarcas] = useState<PersonalBest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Formulario
  const [estilo, setEstilo] = useState("crol");
  const [distancia, setDistancia] = useState(100);
  const [piscina, setPiscina] = useState("25m");
  const [tiempo, setTiempo] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().split("T")[0]);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Cargar nadadores si es coach
  useEffect(() => {
    if (isCoach) {
      async function fetchSwimmers() {
        try {
          const res = await fetch("/api/people");
          if (!res.ok) throw new Error("Error al cargar nadadores");
          const data: Person[] = await res.json();
          // Filtrar por nadadores
          setSwimmers(data.filter((p) => p.role === "nadador"));
        } catch (err) {
          console.error(err);
          setError("Error al cargar la lista de nadadores");
        }
      }
      fetchSwimmers();
    }
  }, [isCoach]);

  // Cargar marcas del nadador seleccionado
  const fetchMarcas = useCallback(async (swimmerName: string) => {
    if (!swimmerName) {
      setMarcas([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/marcas?personName=${encodeURIComponent(swimmerName)}`);
      if (!res.ok) throw new Error("Error al cargar marcas");
      const data = await res.json();
      setMarcas(data);
    } catch (err) {
      console.error(err);
      setError("No se pudieron cargar las marcas personales");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMarcas(selectedSwimmerName);
  }, [selectedSwimmerName, fetchMarcas]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSwimmerName) {
      setError("Debes seleccionar un nadador primero");
      return;
    }

    // Validar tiempo
    const seconds = parseSeconds(tiempo);
    if (seconds === null) {
      setError("Formato de tiempo inválido. Usa MM:SS.hh (ej: 1:04.5) o SS.hh (ej: 28.5)");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/marcas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: selectedSwimmerName,
          estilo,
          distancia,
          tiempo,
          fecha,
          piscina,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al guardar la marca");
      }

      setSuccessMsg("¡Marca guardada con éxito!");
      setTiempo(""); // Limpiar
      // Recargar marcas
      fetchMarcas(selectedSwimmerName);

      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar marca");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Marcas Personales (PBs)</h2>
        <p className={styles.subtitle}>
          Registra tus mejores marcas de referencia para ajustar las zonas de entrenamiento
        </p>
      </div>

      {/* Selector para entrenadores */}
      {isCoach && (
        <div className={styles.coachSelector}>
          <label htmlFor="swimmer-select" className={styles.label}>
            👤 Gestionar marcas del nadador:
          </label>
          <select
            id="swimmer-select"
            className={styles.select}
            value={selectedSwimmerName}
            onChange={(e) => setSelectedSwimmerName(e.target.value)}
          >
            <option value="">-- Seleccionar nadador --</option>
            {swimmers.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {!selectedSwimmerName ? (
        <div className={styles.emptyState}>
          <Trophy size={48} className={styles.emptyIcon} />
          <p>Selecciona un nadador para ver y gestionar sus marcas personales.</p>
        </div>
      ) : (
        <div className={styles.gridContainer}>
          {/* Formulario */}
          <div className={styles.cardForm}>
            <h3 className={styles.cardTitle}>
              <Plus size={18} /> Registrar Nueva Marca
            </h3>
            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Estilo</label>
                <select
                  className={styles.formInput}
                  value={estilo}
                  onChange={(e) => setEstilo(e.target.value)}
                >
                  {ESTILOS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Distancia (metros)</label>
                <select
                  className={styles.formInput}
                  value={distancia}
                  onChange={(e) => setDistancia(Number(e.target.value))}
                >
                  {DISTANCIAS_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d} metros
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Tipo de Piscina</label>
                <select
                  className={styles.formInput}
                  value={piscina}
                  onChange={(e) => setPiscina(e.target.value)}
                >
                  <option value="25m">Piscina Corta (25m)</option>
                  <option value="50m">Piscina Larga (50m)</option>
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Tiempo de PB</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="Ej: 1:04.5 o 28.5"
                  value={tiempo}
                  onChange={(e) => setTiempo(e.target.value)}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Fecha de marca</label>
                <input
                  type="date"
                  className={styles.formInput}
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                className={styles.submitButton}
                disabled={submitting}
              >
                {submitting ? "Guardando..." : "Guardar Marca"}
              </button>
            </form>

            {successMsg && <div className={styles.success}>{successMsg}</div>}
            {error && <div className={styles.error}>{error}</div>}
          </div>

          {/* Listado de Marcas */}
          <div className={styles.cardList}>
            <div className={styles.listHeader}>
              <h3 className={styles.cardTitle}>
                <Trophy size={18} /> Mis Registros ({marcas.length})
              </h3>
              <button
                onClick={() => fetchMarcas(selectedSwimmerName)}
                className={styles.refreshButton}
                aria-label="Recargar"
              >
                <RefreshCw size={14} className={loading ? styles.spinning : ""} />
              </button>
            </div>

            {loading && marcas.length === 0 ? (
              <div className={styles.loading}>
                <div className={styles.spinner} />
                <span>Cargando marcas...</span>
              </div>
            ) : marcas.length === 0 ? (
              <div className={styles.emptyList}>
                <Compass size={36} className={styles.emptyListIcon} />
                <p>No hay marcas personales guardadas para este nadador.</p>
                <p className={styles.hint}>¡Añade la primera marca usando el formulario!</p>
              </div>
            ) : (
              <div className={styles.pbList}>
                {marcas.map((pb, idx) => (
                  <div key={idx} className={styles.pbItem}>
                    <div className={styles.pbBadge}>
                      <span className={styles.pbStyleBadge}>
                        {ESTILOS_OPTIONS.find((o) => o.value === pb.estilo)?.label || pb.estilo}
                      </span>
                      <span className={styles.pbDistBadge}>{pb.distancia}m</span>
                      <span className={`${styles.pbPoolBadge} ${pb.piscina === "50m" ? styles.pbPoolLarga : ""}`}>
                        {pb.piscina}
                      </span>
                    </div>
                    <div className={styles.pbTime}>{pb.tiempo}</div>
                    <div className={styles.pbDate}>
                      <Calendar size={12} /> {pb.fecha}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
