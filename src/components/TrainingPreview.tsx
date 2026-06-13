"use client";

import { useState, useEffect } from "react";
import styles from "./TrainingPreview.module.css";
import { PersonalBest } from "@/lib/sheets";
import { calculateIntensityZone } from "@/lib/zones";

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

interface TrainingPreviewProps {
  personName: string;
  data: TrainingData;
  onSaved: () => void;
  onDiscard: () => void;
  onError: (message: string) => void;
}

const FIELDS: {
  key: keyof TrainingData;
  label: string;
  icon: string;
  placeholder: string;
  multiline?: boolean;
  type?: string;
}[] = [
  {
    key: "fecha",
    label: "Fecha",
    icon: "📅",
    placeholder: "YYYY-MM-DD",
    type: "date",
  },
  {
    key: "piscina",
    label: "Piscina",
    icon: "🏢",
    placeholder: "25m o 50m",
  },
  {
    key: "series",
    label: "Series",
    icon: "🏊",
    placeholder: "Ej: 4x100 crol, 8x50 espalda",
    multiline: true,
  },
  {
    key: "estilos",
    label: "Estilos",
    icon: "🌊",
    placeholder: "Ej: crol, espalda, mariposa",
  },
  {
    key: "tiempos",
    label: "Tiempos",
    icon: "⏱️",
    placeholder: "Ej: 1:20 por 100, 0:38 por 50",
  },
  {
    key: "intensidad",
    label: "Intensidad",
    icon: "💪",
    placeholder: "Ej: aeróbico, umbral, sprint",
  },
  {
    key: "material",
    label: "Material",
    icon: "🎽",
    placeholder: "Ej: palas, pull-buoy, aletas",
  },
  {
    key: "pulso",
    label: "Pulso",
    icon: "❤️",
    placeholder: "Ej: 72 ppm",
  },
  {
    key: "notas",
    label: "Notas",
    icon: "📝",
    placeholder: "Comentarios adicionales...",
    multiline: true,
  },
];

export default function TrainingPreview({
  personName,
  data,
  onSaved,
  onDiscard,
  onError,
}: TrainingPreviewProps) {
  const [formData, setFormData] = useState<TrainingData>({ ...data });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  
  const [pbs, setPbs] = useState<PersonalBest[]>([]);
  const [calcZoneInfo, setCalcZoneInfo] = useState<string | null>(null);

  // Cargar PBs del nadador
  useEffect(() => {
    async function loadPbs() {
      try {
        const res = await fetch(
          `/api/marcas?personName=${encodeURIComponent(personName)}`
        );
        if (res.ok) {
          const data: PersonalBest[] = await res.json();
          setPbs(data);
        }
      } catch (err) {
        console.error("Error loading PBs in preview:", err);
      }
    }
    loadPbs();
  }, [personName]);

  // Autocalcular zona en tiempo real cuando cambian series, tiempos, estilo o piscina
  useEffect(() => {
    if (pbs.length === 0 || !formData.series || !formData.tiempos) {
      setCalcZoneInfo(null);
      return;
    }
    
    const result = calculateIntensityZone(
      formData.series,
      formData.tiempos,
      formData.estilos,
      pbs,
      formData.piscina
    );

    if (result) {
      setFormData((prev) => ({
        ...prev,
        intensidad: result.suggestedLabels.join(" + "),
      }));
      setCalcZoneInfo(
        `Calculado: ${result.suggestedLabels.join(" + ")} (${result.percentage}% vel. ref. PB de ${result.pbUsed.distancia}m ${result.pbUsed.estilo}${result.scaled ? " extrapolado" : ""}${result.pbConverted ? ` conv. de ${result.pbUsed.piscina}` : ""})`
      );
    } else {
      setCalcZoneInfo(null);
    }
  }, [formData.series, formData.tiempos, formData.estilos, formData.piscina, pbs]);

  const updateField = (key: keyof TrainingData, value: string) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const selectedLabels = formData.intensidad
    ? formData.intensidad.split("+").map((s) => s.trim()).filter(Boolean)
    : [];

  const toggleLabel = (label: string) => {
    let nextLabels;
    if (selectedLabels.includes(label)) {
      nextLabels = selectedLabels.filter((l) => l !== label);
    } else {
      nextLabels = [...selectedLabels, label];
    }

    const ritmosOrder = ["Ritmo de 100", "Ritmo de 200", "Ritmo de 400", "Ritmo de 800", "Ritmo de 1500"];
    nextLabels.sort((a, b) => {
      const aIsRitmo = ritmosOrder.includes(a);
      const bIsRitmo = ritmosOrder.includes(b);
      if (aIsRitmo && !bIsRitmo) return -1;
      if (!aIsRitmo && bIsRitmo) return 1;
      if (aIsRitmo && bIsRitmo) return ritmosOrder.indexOf(a) - ritmosOrder.indexOf(b);
      return 0;
    });

    updateField("intensidad", nextLabels.join(" + "));
  };


  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/save-training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          personName,
          data: formData,
        }),
      });

      if (!res.ok) {
        const resData = await res.json();
        throw new Error(resData.error || "Error al guardar");
      }

      setSuccess(true);
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "Error al guardar el entrenamiento"
      );
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <div className={styles.success}>
        <div className={styles.successIcon}>
          <svg
            className={styles.successCheckmark}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              className={styles.successCheckmarkPath}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <div className={styles.successTitle}>
          ¡Entrenamiento guardado!
        </div>
        <div className={styles.successSubtitle}>
          Los datos se han añadido a la hoja de{" "}
          <strong>{personName}</strong> en Google Sheets
        </div>
        <button
          id="new-training-button"
          className={styles.newButton}
          onClick={onSaved}
        >
          Registrar otro entrenamiento
        </button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Revisa los datos</h2>
        <span className={styles.personBadge}>{personName}</span>
      </div>

      <div className={styles.card}>
        {FIELDS.map((field) => (
          <div key={field.key} className={styles.field}>
            <label
              htmlFor={`field-${field.key}`}
              className={styles.fieldLabel}
            >
              <span className={styles.fieldIcon}>{field.icon}</span>
              {field.label}
            </label>
            {field.key === "piscina" ? (
              <select
                id={`field-${field.key}`}
                className={styles.fieldSelect}
                value={formData[field.key]}
                onChange={(e) => updateField(field.key, e.target.value)}
              >
                <option value="25m">Piscina Corta (25m)</option>
                <option value="50m">Piscina Larga (50m)</option>
              </select>
            ) : field.key === "intensidad" ? (
              <div className={styles.chipsContainer} id={`field-${field.key}`}>
                <div className={styles.chipGroupLabel}>Ritmos de Trabajo</div>
                <div className={styles.chipsRow}>
                  {["Ritmo de 100", "Ritmo de 200", "Ritmo de 400", "Ritmo de 800", "Ritmo de 1500"].map((label) => {
                    const isSelected = selectedLabels.includes(label);
                    return (
                      <button
                        key={label}
                        type="button"
                        className={`${styles.chip} ${isSelected ? styles.chipActive : ""}`}
                        onClick={() => toggleLabel(label)}
                      >
                        {label.replace("Ritmo de ", "")}
                      </button>
                    );
                  })}
                </div>

                <div className={styles.chipGroupLabel}>Zonas de Intensidad</div>
                <div className={styles.chipsRow}>
                  {["Velocidad", "Anaeróbico", "VO2Max", "Aeróbico intenso", "Aeróbico medio", "Aeróbico ligero", "Suave", "Crono"].map((label) => {
                    const isSelected = selectedLabels.includes(label);
                    return (
                      <button
                        key={label}
                        type="button"
                        className={`${styles.chip} ${isSelected ? styles.chipActive : ""}`}
                        onClick={() => toggleLabel(label)}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : field.type === "date" ? (
              <input
                id={`field-${field.key}`}
                type="date"
                className={styles.fieldInputDate}
                value={formData[field.key]}
                onChange={(e) => updateField(field.key, e.target.value)}
              />
            ) : field.multiline ? (
              <textarea
                id={`field-${field.key}`}
                className={styles.fieldInput}
                rows={2}
                value={formData[field.key]}
                placeholder={field.placeholder}
                onChange={(e) => updateField(field.key, e.target.value)}
              />
            ) : (
              <input
                id={`field-${field.key}`}
                type="text"
                className={styles.fieldInput}
                value={formData[field.key]}
                placeholder={field.placeholder}
                onChange={(e) => updateField(field.key, e.target.value)}
              />
            )}
            {field.key === "intensidad" && calcZoneInfo && (
              <span className={styles.calcZoneHelp}>{calcZoneInfo}</span>
            )}
          </div>
        ))}
      </div>

      <div className={styles.actions}>
        <button
          id="save-training-button"
          className={styles.saveButton}
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <>
              <span className={styles.saving} />
              Guardando...
            </>
          ) : (
            <>✓ Guardar entrenamiento</>
          )}
        </button>
        <button
          id="discard-button"
          className={styles.discardButton}
          onClick={onDiscard}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
