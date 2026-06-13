"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import styles from "./Dashboard.module.css";
import {
  extractDistance,
  extractAverageSeconds,
  normalizeStyle,
  formatSeconds,
  getConversionFactor100m,
  parseSeconds,
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
  ReferenceLine,
} from "recharts";
import { TrendingUp, Calendar, Compass, RefreshCw, BarChart2 } from "lucide-react";

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

interface TrainingData {
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

const WORK_TYPES_OPTIONS = [
  {
    group: "Ritmos de Trabajo",
    items: [
      { value: "Ritmo de 100", label: "Ritmo de 100" },
      { value: "Ritmo de 200", label: "Ritmo de 200" },
      { value: "Ritmo de 400", label: "Ritmo de 400" },
      { value: "Ritmo de 800", label: "Ritmo de 800" },
      { value: "Ritmo de 1500", label: "Ritmo de 1500" },
    ],
  },
  {
    group: "Zonas de Intensidad",
    items: [
      { value: "Velocidad", label: "Velocidad" },
      { value: "Anaeróbico", label: "Anaeróbico" },
      { value: "VO2Max", label: "VO2Max" },
      { value: "Aeróbico intenso", label: "Aeróbico intenso" },
      { value: "Aeróbico medio", label: "Aeróbico medio" },
      { value: "Aeróbico ligero", label: "Aeróbico ligero" },
      { value: "Suave", label: "Suave" },
      { value: "Crono", label: "Crono" },
    ],
  },
];

export default function Dashboard({ person }: DashboardProps) {
  const isCoach = person.role === "entrenador";

  // Nadadores y nadador seleccionado (solo si es coach)
  const [swimmers, setSwimmers] = useState<Person[]>([]);
  const [selectedSwimmerName, setSelectedSwimmerName] = useState<string>(
    isCoach ? "" : person.name
  );

  // Historial de entrenamientos y marcas personales
  const [trainings, setTrainings] = useState<TrainingData[]>([]);
  const [pbs, setPbs] = useState<PersonalBest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filtros de gráficos
  const [selectedStyle, setSelectedStyle] = useState("crol");
  const [selectedWorkType, setSelectedWorkType] = useState("Ritmo de 200");
  const [chartType, setChartType] = useState<"trend" | "distribution">("trend");

  // Cargar marcas personales (PBs) del nadador seleccionado
  useEffect(() => {
    if (!selectedSwimmerName) {
      setPbs([]);
      return;
    }
    async function fetchPbs() {
      try {
        const res = await fetch(`/api/marcas?personName=${encodeURIComponent(selectedSwimmerName)}`);
        if (res.ok) {
          const data = await res.json();
          setPbs(data);
        }
      } catch (err) {
        console.error("Error loading PBs in dashboard:", err);
      }
    }
    fetchPbs();
  }, [selectedSwimmerName]);

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

  // Procesar entrenamientos para el gráfico de línea (unificado a piscina de 25m)
  const chartData = useMemo(() => {
    if (trainings.length === 0) return [];

    const dataPoints: {
      dateStr: string;
      dateVal: Date;
      seconds: number;
      originalAverageSecs: number;
      pool: string;
      series: string;
    }[] = [];

    for (const t of trainings) {
      if (!t.fecha || !t.series || !t.tiempos) continue;

      const style = normalizeStyle(t.estilos);
      const distance = extractDistance(t.series);
      const avgSecs = extractAverageSeconds(t.tiempos);
      const pool = (t.piscina || "25m").trim().toLowerCase();

      // Si coincide con el estilo y la intensidad contiene la etiqueta seleccionada
      const matchesStyle = style === selectedStyle;
      const matchesWorkType =
        t.intensidad &&
        t.intensidad.toLowerCase().includes(selectedWorkType.toLowerCase());

      if (matchesStyle && matchesWorkType && distance && avgSecs !== null) {
        let pace100 = avgSecs * (100 / distance);
        if (pool === "50m") {
          const factor100m = getConversionFactor100m(style);
          pace100 = pace100 - factor100m;
        }

        dataPoints.push({
          dateStr: t.fecha,
          dateVal: new Date(t.fecha),
          seconds: Math.round(pace100 * 10) / 10,
          originalAverageSecs: avgSecs,
          pool: pool,
          series: t.series,
        });
      }
    }

    // Ordenar cronológicamente
    return dataPoints
      .sort((a, b) => a.dateVal.getTime() - b.dateVal.getTime())
      .map((dp) => ({
        date: dp.dateStr,
        seconds: dp.seconds,
        originalAverageSecs: dp.originalAverageSecs,
        pool: dp.pool,
        series: dp.series,
      }));
  }, [trainings, selectedStyle, selectedWorkType]);

  // Procesar entrenamientos para el gráfico de torta de intensidades
  const intensityData = useMemo(() => {
    if (trainings.length === 0) return [];

    const counts: Record<string, number> = {};
    for (const t of trainings) {
      if (!t.intensidad) continue;
      const parts = t.intensidad.split("+").map((s) => s.trim()).filter(Boolean);
      for (const part of parts) {
        let matched = "";
        const allClosedLabels = [
          "Ritmo de 100",
          "Ritmo de 200",
          "Ritmo de 400",
          "Ritmo de 800",
          "Ritmo de 1500",
          "Velocidad",
          "Anaeróbico",
          "VO2Max",
          "Aeróbico intenso",
          "Aeróbico medio",
          "Aeróbico ligero",
          "Suave",
          "Crono",
        ];
        const found = allClosedLabels.find((l) => l.toLowerCase() === part.toLowerCase());
        if (found) {
          matched = found;
        } else {
          matched = part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
          if (matched.toLowerCase() === "vo2max") matched = "VO2Max";
        }
        counts[matched] = (counts[matched] || 0) + 1;
      }
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
    "Crono": "#ec4899",
    "Ritmo de 100": "#8b5cf6",
    "Ritmo de 200": "#a855f7",
    "Ritmo de 400": "#c084fc",
    "Ritmo de 800": "#d8b4fe",
    "Ritmo de 1500": "#e9d5ff",
  };

  const targetPaceSeconds = useMemo(() => {
    if (pbs.length === 0) return null;

    const style = normalizeStyle(selectedStyle);
    let targetPct = 0;
    let targetDistance = 100;
    let isRhythm = false;

    if (selectedWorkType.startsWith("Ritmo de ")) {
      isRhythm = true;
      targetDistance = parseInt(selectedWorkType.replace("Ritmo de ", ""), 10);
      targetPct = 100;
    } else {
      const zoneName = selectedWorkType.trim();
      if (zoneName === "Crono") targetPct = 100;
      else if (zoneName === "Velocidad") targetPct = 97.5;
      else if (zoneName === "Anaeróbico") targetPct = 90.0;
      else if (zoneName === "VO2Max") targetPct = 85.0;
      else if (zoneName === "Aeróbico intenso") targetPct = 82.5;
      else if (zoneName === "Aeróbico medio") targetPct = 77.5;
      else if (zoneName === "Aeróbico ligero") targetPct = 70.0;
      else if (zoneName === "Suave") targetPct = 60.0;
      else targetPct = 60.0;
    }

    let pbToUse: PersonalBest | undefined;
    
    pbToUse = pbs.find(
      (pb) =>
        normalizeStyle(pb.estilo) === style &&
        pb.distancia === targetDistance &&
        pb.piscina.trim().toLowerCase() === "25m"
    );
    if (!pbToUse) {
      pbToUse = pbs.find(
        (pb) =>
          normalizeStyle(pb.estilo) === style &&
          pb.distancia === targetDistance
      );
    }
    if (!pbToUse && !isRhythm) {
      pbToUse = pbs.find(
        (pb) =>
          normalizeStyle(pb.estilo) === style &&
          pb.distancia === 100
      );
      if (!pbToUse) {
        pbToUse = pbs.find((pb) => normalizeStyle(pb.estilo) === style);
      }
    }
    if (!pbToUse) {
      pbToUse = pbs[0];
    }

    if (!pbToUse) return null;

    const pbSeconds = parseSeconds(pbToUse.tiempo);
    if (!pbSeconds) return null;

    const pbPool = pbToUse.piscina.trim().toLowerCase();
    let pbSecondsConverted = pbSeconds;
    if (pbPool === "50m") {
      const factor100m = getConversionFactor100m(pbToUse.estilo);
      const factor = factor100m * (pbToUse.distancia / 100);
      pbSecondsConverted = pbSeconds - factor;
    }

    const pbPace100 = pbSecondsConverted * (100 / pbToUse.distancia);
    const targetPace = pbPace100 / (targetPct / 100);
    return Math.round(targetPace * 10) / 10;
  }, [pbs, selectedStyle, selectedWorkType]);

  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!targetPaceSeconds) {
      return (
        <circle
          cx={cx}
          cy={cy}
          r={5}
          fill="#38bdf8"
          stroke="rgba(15,23,42,0.9)"
          strokeWidth={2}
        />
      );
    }

    const complies = payload.seconds <= targetPaceSeconds;
    const fillColor = complies ? "#10b981" : "#ef4444";

    return (
      <circle
        cx={cx}
        cy={cy}
        r={6}
        fill={fillColor}
        stroke="rgba(15,23,42,0.9)"
        strokeWidth={2}
      />
    );
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const formattedTime = formatSeconds(data.seconds);
      const originalTimeFormatted = formatSeconds(data.originalAverageSecs);
      
      const calcDetails = data.pool === "50m"
        ? `Se convirtió el ritmo de 50m (${originalTimeFormatted}) restando el factor de conversión para obtener el equivalente por cada 100m en 25m (${formattedTime}).`
        : `Se calculó el ritmo medio por cada 100m en piscina de 25m (${formattedTime}) a partir del tiempo original (${originalTimeFormatted}) sin conversión.`;

      return (
        <div className={styles.customTooltip}>
          <div className={styles.tooltipDate}>Fecha: {label}</div>
          <div className={styles.tooltipSection}>
            <span className={styles.tooltipLabel}>Bloque del que procede:</span>
            <span className={styles.tooltipValue}>{data.series}</span>
          </div>
          <div className={styles.tooltipSection}>
            <span className={styles.tooltipLabel}>Cálculo realizado:</span>
            <span className={styles.tooltipValue}>{calcDetails}</span>
          </div>
        </div>
      );
    }
    return null;
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
                <label className={styles.filterLabel}>Tipo de Trabajo</label>
                <select
                  className={styles.filterSelect}
                  value={selectedWorkType}
                  onChange={(e) => setSelectedWorkType(e.target.value)}
                >
                  {WORK_TYPES_OPTIONS.map((group) => (
                    <optgroup key={group.group} label={group.group}>
                      {group.items.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </optgroup>
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
                  {ESTILOS_OPTIONS.find((o) => o.value === selectedStyle)?.label} - {selectedWorkType}
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
                    Asegúrate de registrar entrenamientos indicando el estilo ({selectedStyle}) y que estén etiquetados con el tipo de trabajo "{selectedWorkType}".
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
                      <Tooltip content={<CustomTooltip />} />
                      {targetPaceSeconds && (
                        <ReferenceLine
                          y={targetPaceSeconds}
                          stroke="#eab308"
                          strokeDasharray="4 4"
                          strokeWidth={2}
                          label={{
                            value: `Ritmo teórico: ${formatSeconds(targetPaceSeconds)} (${selectedWorkType.startsWith("Ritmo") ? "100" : selectedWorkType === "Velocidad" ? "97.5" : selectedWorkType === "Anaeróbico" ? "90.0" : selectedWorkType === "VO2Max" ? "85.0" : selectedWorkType === "Aeróbico intenso" ? "82.5" : selectedWorkType === "Aeróbico medio" ? "77.5" : selectedWorkType === "Aeróbico ligero" ? "70.0" : selectedWorkType === "Crono" ? "100" : "60.0"}%)`,
                            position: "top",
                            fill: "#eab308",
                            fontSize: 10,
                            fontWeight: 600,
                          }}
                        />
                      )}
                      <Line
                        type="monotone"
                        dataKey="seconds"
                        stroke="#38bdf8"
                        strokeWidth={3}
                        dot={<CustomDot />}
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
