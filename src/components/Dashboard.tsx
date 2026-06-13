"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import styles from "./Dashboard.module.css";
import {
  extractDistance,
  extractAverageSeconds,
  normalizeStyle,
  formatSeconds,
} from "@/lib/zones";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { TrendingUp, Calendar, Compass, RefreshCw, BarChart2 } from "lucide-react";

interface Person {
  name: string;
  role: string;
}

interface TrainingData {
  fecha: string;
  series: string;
  estilos: string;
  tiempos: string;
  intensidad: string;
  material: string;
  pulso: string;
  notas: string;
}

interface DashboardProps {
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

export default function Dashboard({ person }: DashboardProps) {
  const isCoach = person.role === "entrenador";

  // Nadadores y nadador seleccionado (solo si es coach)
  const [swimmers, setSwimmers] = useState<Person[]>([]);
  const [selectedSwimmerName, setSelectedSwimmerName] = useState<string>(
    isCoach ? "" : person.name
  );

  // Historial de entrenamientos
  const [trainings, setTrainings] = useState<TrainingData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros de gráficos
  const [selectedStyle, setSelectedStyle] = useState("crol");
  const [selectedDistance, setSelectedDistance] = useState(100);
  const [chartType, setChartType] = useState<"trend" | "distribution">("trend");

  // Cargar nadadores si es coach
  useEffect(() => {
    if (isCoach) {
      async function fetchSwimmers() {
        try {
          const res = await fetch("/api/people");
          if (!res.ok) throw new Error("Error al cargar nadadores");
          const data: Person[] = await res.json();
          setSwimmers(data.filter((p) => p.role === "nadador"));
        } catch (err) {
          console.error(err);
          setError("Error al cargar la lista de nadadores");
        }
      }
      fetchSwimmers();
    }
  }, [isCoach]);

  // Cargar entrenamientos
  const fetchTrainings = useCallback(async (swimmerName: string) => {
    if (!swimmerName) {
      setTrainings([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trainings?personName=${encodeURIComponent(swimmerName)}`);
      if (!res.ok) throw new Error("Error al cargar entrenamientos");
      const data = await res.json();
      setTrainings(data);
    } catch (err) {
      console.error(err);
      setError("No se pudo cargar el historial de entrenamientos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrainings(selectedSwimmerName);
  }, [selectedSwimmerName, fetchTrainings]);

  // Procesar entrenamientos para el gráfico de línea
  const chartData = useMemo(() => {
    if (trainings.length === 0) return [];

    const dataPoints: { dateStr: string; dateVal: Date; seconds: number }[] = [];

    for (const t of trainings) {
      if (!t.fecha || !t.series || !t.tiempos) continue;

      const style = normalizeStyle(t.estilos);
      const distance = extractDistance(t.series);
      const avgSecs = extractAverageSeconds(t.tiempos);

      // Si coincide con los filtros
      if (style === selectedStyle && distance === selectedDistance && avgSecs !== null) {
        dataPoints.push({
          dateStr: t.fecha,
          dateVal: new Date(t.fecha),
          seconds: Math.round(avgSecs * 100) / 100,
        });
      }
    }

    // Ordenar cronológicamente
    return dataPoints
      .sort((a, b) => a.dateVal.getTime() - b.dateVal.getTime())
      .map((dp) => ({
        date: dp.dateStr,
        seconds: dp.seconds,
      }));
  }, [trainings, selectedStyle, selectedDistance]);

  // Procesar entrenamientos para el gráfico de torta de intensidades
  const intensityData = useMemo(() => {
    if (trainings.length === 0) return [];

    const counts: Record<string, number> = {};
    for (const t of trainings) {
      if (!t.intensidad) continue;
      let zone = t.intensidad.trim();
      zone = zone.charAt(0).toUpperCase() + zone.slice(1).toLowerCase();
      if (zone.toLowerCase() === "vo2max") {
        zone = "VO2Max";
      }
      counts[zone] = (counts[zone] || 0) + 1;
    }

    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [trainings]);

  const ZONE_COLORS: Record<string, string> = {
    "Velocidad": "#f43f5e",
    "Anaeróbico": "#f97316",
    "VO2Max": "#eab308",
    "Aeróbico intenso": "#10b981",
    "Aeróbico medio": "#06b6d4",
    "Aeróbico ligero": "#3b82f6",
    "Suave": "#64748b",
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Panel de Estadísticas</h2>
        <p className={styles.subtitle}>
          Visualiza la evolución y el progreso de los ritmos medios en tus bloques de entrenamiento
        </p>
      </div>

      {/* Selector para entrenadores */}
      {isCoach && (
        <div className={styles.coachSelector}>
          <label htmlFor="dashboard-swimmer-select" className={styles.label}>
            👤 Ver estadísticas del nadador:
          </label>
          <select
            id="dashboard-swimmer-select"
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
          <BarChart2 size={48} className={styles.emptyIcon} />
          <p>Selecciona un nadador para visualizar sus gráficos de progreso.</p>
        </div>
      ) : (
        <div className={styles.dashboardGrid}>
          {/* Barra de Filtros */}
          <div className={styles.filtersCard}>
            <h3 className={styles.filtersTitle}>Filtros del Bloque</h3>
            <div className={styles.filterGroups}>
              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Estilo</label>
                <select
                  className={styles.filterSelect}
                  value={selectedStyle}
                  onChange={(e) => setSelectedStyle(e.target.value)}
                >
                  {ESTILOS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.filterGroup}>
                <label className={styles.filterLabel}>Distancia de Serie</label>
                <select
                  className={styles.filterSelect}
                  value={selectedDistance}
                  onChange={(e) => setSelectedDistance(Number(e.target.value))}
                >
                  {DISTANCIAS_OPTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d} metros
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.refreshWrapper}>
              <button
                onClick={() => fetchTrainings(selectedSwimmerName)}
                className={styles.refreshBtn}
                disabled={loading}
              >
                <RefreshCw size={14} className={loading ? styles.spinning : ""} />
                Actualizar datos
              </button>
            </div>
          </div>

          {/* Gráfico */}
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <div className={styles.chartTabs}>
                <button
                  className={`${styles.chartTab} ${chartType === "trend" ? styles.activeTab : ""}`}
                  onClick={() => setChartType("trend")}
                >
                  Evolución de Ritmo
                </button>
                <button
                  className={`${styles.chartTab} ${chartType === "distribution" ? styles.activeTab : ""}`}
                  onClick={() => setChartType("distribution")}
                >
                  Distribución de Trabajo
                </button>
              </div>
              {chartType === "trend" && (
                <span className={styles.chartFilterBadge}>
                  {ESTILOS_OPTIONS.find((o) => o.value === selectedStyle)?.label} - {selectedDistance}m
                </span>
              )}
            </div>

            {loading ? (
              <div className={styles.loadingContainer}>
                <div className={styles.spinner} />
                <span>Cargando datos...</span>
              </div>
            ) : chartType === "trend" ? (
              chartData.length === 0 ? (
                <div className={styles.emptyChart}>
                  <Compass size={40} className={styles.emptyChartIcon} />
                  <p>No se encontraron entrenamientos para estos filtros.</p>
                  <p className={styles.hint}>
                    Asegúrate de registrar entrenamientos indicando la distancia de las series (ej: {selectedDistance}m) y el estilo ({selectedStyle}).
                  </p>
                </div>
              ) : (
                <div className={styles.chartWrapper}>
                  <ResponsiveContainer width="100%" height={320}>
                    <LineChart
                      data={chartData}
                      margin={{ top: 20, right: 20, left: 10, bottom: 20 }}
                    >
                      <defs>
                        <linearGradient id="colorSeconds" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#0284c7" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.05)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="date"
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        dy={10}
                      />
                      <YAxis
                        stroke="#64748b"
                        fontSize={11}
                        tickLine={false}
                        dx={-10}
                        domain={["auto", "auto"]}
                        tickFormatter={(val) => formatSeconds(val)}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(15, 23, 42, 0.9)",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          borderRadius: "12px",
                          boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)",
                        }}
                        labelStyle={{ color: "#94a3b8", fontWeight: 600, marginBottom: "4px" }}
                        itemStyle={{ color: "#38bdf8" }}
                        labelFormatter={(label) => `Fecha: ${label}`}
                        formatter={(value: any) => [value ? formatSeconds(Number(value)) : "", "Tiempo Medio"]}
                      />
                      <Line
                        type="monotone"
                        dataKey="seconds"
                        stroke="#38bdf8"
                        strokeWidth={3}
                        dot={{ fill: "#38bdf8", stroke: "rgba(15,23,42,0.9)", strokeWidth: 2, r: 6 }}
                        activeDot={{ r: 8, strokeWidth: 0 }}
                        animationDuration={1500}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className={styles.chartFooterInfo}>
                    <TrendingUp size={14} /> Tiempos más bajos representan ritmos más veloces (mejor rendimiento).
                  </div>
                </div>
              )
            ) : (
              // Distribución de zonas (Torta/Donut)
              intensityData.length === 0 ? (
                <div className={styles.emptyChart}>
                  <Compass size={40} className={styles.emptyChartIcon} />
                  <p>No hay datos de intensidad registrados aún para este nadador.</p>
                </div>
              ) : (
                <div className={styles.chartWrapper}>
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie
                        data={intensityData}
                        cx="50%"
                        cy="45%"
                        innerRadius={65}
                        outerRadius={95}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {intensityData.map((entry, index) => {
                          const color = ZONE_COLORS[entry.name] || "#8b5cf6";
                          return <Cell key={`cell-${index}`} fill={color} />;
                        })}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "rgba(15, 23, 42, 0.9)",
                          border: "1px solid rgba(255, 255, 255, 0.1)",
                          borderRadius: "12px",
                          boxShadow: "0 10px 15px -3px rgba(0,0,0,0.3)",
                        }}
                        itemStyle={{ color: "#fff" }}
                        formatter={(value: any, name: any) => [`${value} series`, `Zona: ${name}`]}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={40}
                        iconType="circle"
                        iconSize={8}
                        formatter={(value) => (
                          <span style={{ color: "#cbd5e1", fontSize: "12px", fontWeight: 500 }}>
                            {value}
                          </span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
