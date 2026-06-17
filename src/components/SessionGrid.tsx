"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSessionState, RepCell, GeminiImportItem, groupSwimmerReps, transformGridToSheets } from "@/lib/sessionContext";
import { extractDistance, normalizeStyle } from "@/lib/zones";
import styles from "./SessionGrid.module.css";

export default function SessionGrid() {
  const { state, editCell, fillFromGemini, clearSession } = useSessionState();
  const { config, activeSwimmers, grid } = state;

  // Modales y estados de edición
  const [editingCell, setEditingCell] = useState<{ swimmer: string; index: number } | null>(null);
  const [cellTime, setCellTime] = useState("");
  const [cellStyle, setCellStyle] = useState("");
  const [cellMaterial, setCellMaterial] = useState("");

  // Grabación de audio
  const [recordState, setRecordState] = useState<"idle" | "recording" | "processing">("idle");
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Previsualización de extracción por voz
  const [voiceResult, setVoiceResult] = useState<GeminiImportItem[] | null>(null);

  // Estado de guardado general
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const defaultStyle = config ? normalizeStyle(config.blockDescription) : "crol";
  const defaultMaterial = "Sin material";

  // Cerrar timer
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Abrir modal de edición
  const handleOpenEdit = (swimmer: string, index: number) => {
    const cell = grid[swimmer]?.[index];
    setEditingCell({ swimmer, index });
    setCellTime(cell?.time || "");
    setCellStyle(cell?.style || "");
    setCellMaterial(cell?.material || "");
    setErrorMessage(null);
  };

  const handleSaveCell = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCell) return;

    const formattedTime = cellTime.trim() === "" ? null : cellTime.trim();
    editCell(editingCell.swimmer, editingCell.index, {
      time: formattedTime,
      style: cellStyle.trim() !== "" ? cellStyle.trim() : undefined,
      material: cellMaterial.trim() !== "" ? cellMaterial.trim() : undefined,
    });

    setEditingCell(null);
  };

  const handleDeleteCell = () => {
    if (!editingCell) return;
    editCell(editingCell.swimmer, editingCell.index, {
      time: null,
      style: undefined,
      material: undefined,
    });
    setEditingCell(null);
  };

  // Lógica de grabación de audio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      let mimeType = "audio/webm;codecs=opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "audio/webm";
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = "audio/mp4";
          if (!MediaRecorder.isTypeSupported(mimeType)) {
            mimeType = "";
          }
        }
      }

      const mediaRecorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const audioBlob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType || "audio/webm",
        });
        await processAudioBlob(audioBlob, mediaRecorder.mimeType || "audio/webm");
      };

      mediaRecorder.start(250);
      setRecordState("recording");
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch {
      setErrorMessage("No se pudo acceder al micrófono para grabar.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recordState === "recording") {
      mediaRecorderRef.current.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setRecordState("processing");
    }
  };

  const processAudioBlob = async (blob: Blob, mimeType: string) => {
    if (!config) return;
    try {
      setErrorMessage(null);
      const formData = new FormData();
      formData.append(
        "audio",
        blob,
        `recording.${mimeType.includes("mp4") ? "mp4" : "webm"}`
      );
      formData.append("swimmers", JSON.stringify(activeSwimmers));
      formData.append("config", JSON.stringify(config));
      formData.append("currentDate", config.date);

      const res = await fetch("/api/process-session-audio", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al procesar el audio");
      }

      const data: GeminiImportItem[] = await res.json();
      setVoiceResult(data);
      setRecordState("idle");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error al procesar audio");
      setRecordState("idle");
    }
  };

  const handleApplyVoice = () => {
    if (voiceResult) {
      fillFromGemini(voiceResult);
      setVoiceResult(null);
    }
  };

  const handleDiscardVoice = () => {
    setVoiceResult(null);
  };

  // Finalizar y Guardar en Sheets
  const handleSaveSession = async () => {
    if (!config) return;
    
    // Validar si hay tiempos registrados
    const swimmersWithData = activeSwimmers.filter((name) =>
      grid[name]?.some((cell) => cell.time !== null)
    );

    if (swimmersWithData.length === 0) {
      setErrorMessage("No hay marcas/tiempos registrados para guardar.");
      return;
    }

    setSaving(true);
    setErrorMessage(null);
    setSaveMessage("Guardando marcas de natación...");

    try {
      const distance = extractDistance(config.blockDescription) || 100;

      // Iterar por nadador y enviar sus filas agrupadas
      for (const name of swimmersWithData) {
        const swimmerCells = grid[name] || [];
        const trainingDataList = transformGridToSheets(
          swimmerCells,
          config,
          distance,
          defaultStyle,
          defaultMaterial
        );

        if (trainingDataList.length === 0) continue;

        const res = await fetch("/api/save-training", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            personName: name,
            data: trainingDataList,
          }),
        });

        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error || `Error al guardar los datos de ${name}`);
        }
      }

      setSaveMessage("¡Entrenamiento guardado con éxito!");
      setTimeout(() => {
        clearSession();
      }, 1500);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error de red al guardar.");
      setSaveMessage(null);
    } finally {
      setSaving(false);
    }
  };

  const handleCancelSession = () => {
    if (confirm("¿Estás seguro de que quieres cancelar y borrar esta sesión? Todos los datos se perderán.")) {
      clearSession();
    }
  };

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  if (!config) return null;

  return (
    <div className={styles.container}>
      {/* Resumen Cabecera */}
      <div className={styles.headerCard}>
        <div className={styles.headerInfo}>
          <div className={styles.blockInfo}>
            <span className={styles.blockIcon}>🏊‍♂️</span>
            <div>
              <h2 className={styles.blockDesc}>{config.blockDescription}</h2>
              <span className={styles.blockMeta}>
                {config.intensity} • {config.pool} • {config.date} {config.rest && `• ${config.rest}`}
              </span>
            </div>
          </div>
          <button className={styles.cancelBtn} onClick={handleCancelSession}>
            Borrar
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className={styles.errorToast}>
          <span>{errorMessage}</span>
          <button className={styles.errorClose} onClick={() => setErrorMessage(null)}>✕</button>
        </div>
      )}

      {saveMessage && (
        <div className={styles.successToast}>
          <div className={styles.spinnerSmall} />
          <span>{saveMessage}</span>
        </div>
      )}

      {/* Cuadrícula Interactiva */}
      <div className={styles.gridSection}>
        <h3 className={styles.sectionTitle}>📋 Tabla de Tiempos</h3>
        
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.thSwimmer}>Nadador</th>
                {Array.from({ length: config.totalColumns }).map((_, i) => (
                  <th key={i} className={styles.thRep}>#{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeSwimmers.map((name) => (
                <tr key={name}>
                  <td className={styles.tdSwimmerName}>{name}</td>
                  {Array.from({ length: config.totalColumns }).map((_, idx) => {
                    const cell = grid[name]?.[idx];
                    const hasTime = cell?.time !== null && cell?.time !== "";
                    const isCustom = cell && (cell.style || cell.material);
                    
                    return (
                      <td key={idx} className={styles.tdRepCell}>
                        <button
                          id={`cell-${name.replace(/\s+/g, "-").toLowerCase()}-${idx}`}
                          className={`${styles.cellBtn} ${hasTime ? styles.cellFilled : styles.cellEmpty} ${isCustom ? styles.cellCustom : ""}`}
                          onClick={() => handleOpenEdit(name, idx)}
                          title={isCustom ? `Estilo: ${cell.style || defaultStyle}, Mat: ${cell.material || defaultMaterial}` : undefined}
                        >
                          {hasTime ? cell.time : "+"}
                          {isCustom && <span className={styles.customIndicator}>•</span>}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sección Grabación por Voz y Guardado */}
      <div className={styles.actionSection}>
        {/* Grabador de Audio */}
        <div className={styles.voiceCard}>
          <h4 className={styles.voiceTitle}>🎙️ Registrar por Voz</h4>
          <p className={styles.voiceHelp}>
            Menciona a los nadadores y sus marcas. Ej: "Adrián 1:12, 1:13. Juan 1:15."
          </p>

          <div className={styles.recordControls}>
            {recordState === "processing" ? (
              <div className={styles.processingWrapper}>
                <div className={styles.processingSpinner} />
                <span>Analizando audio grupal...</span>
              </div>
            ) : (
              <div className={styles.recordBtnRow}>
                <button
                  type="button"
                  className={`${styles.recordBtn} ${recordState === "recording" ? styles.recordBtnActive : ""}`}
                  onClick={recordState === "idle" ? startRecording : stopRecording}
                >
                  {recordState === "recording" ? (
                    <>
                      <div className={styles.stopIcon} /> Detener ({formatTime(duration)})
                    </>
                  ) : (
                    <>
                      <span className={styles.micIcon}>🎤</span> Grabar Audio
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {recordState === "recording" && (
            <div className={styles.waveContainer}>
              <div className={`${styles.wave} ${styles.wave1}`} />
              <div className={`${styles.wave} ${styles.wave2}`} />
              <div className={`${styles.wave} ${styles.wave3}`} />
            </div>
          )}

          {/* Resultado de la extracción de voz para previsualizar */}
          {voiceResult && (
            <div className={styles.voicePreview}>
              <h5 className={styles.previewTitle}>Resultados Extraídos:</h5>
              <div className={styles.previewList}>
                {voiceResult.map((item, i) => (
                  <div key={i} className={styles.previewItem}>
                    <strong>{item.nombre}:</strong> {item.tiempos.join(", ")}
                    {(item.estilos || item.materiales) && (
                      <span className={styles.previewMeta}>
                        {item.estilos && ` (${item.estilos.join(", ")})`}
                        {item.materiales && ` [${item.materiales.join(", ")}]`}
                      </span>
                    )}
                  </div>
                ))}
              </div>
              <div className={styles.previewActions}>
                <button className={styles.applyBtn} onClick={handleApplyVoice}>
                  ✓ Volcar a la tabla
                </button>
                <button className={styles.discardBtn} onClick={handleDiscardVoice}>
                  Descartar
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Botón Principal Guardar */}
        <button
          className={styles.saveSessionBtn}
          onClick={handleSaveSession}
          disabled={saving}
        >
          {saving ? "Guardando..." : "💾 Finalizar y Guardar Sesión"}
        </button>
      </div>

      {/* Modal Modal/Popup de Edición Celda */}
      {editingCell && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h4 className={styles.modalTitle}>
              Repetición #{editingCell.index + 1} de {editingCell.swimmer}
            </h4>
            
            <form onSubmit={handleSaveCell}>
              <div className={styles.inputGroup}>
                <label htmlFor="time">Tiempo *</label>
                <input
                  id="time"
                  type="text"
                  placeholder="Ej: 1:12.4, 32.5, 15"
                  value={cellTime}
                  onChange={(e) => setCellTime(e.target.value)}
                  className={styles.input}
                  autoFocus
                />
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="style">Estilo (Especial)</label>
                <input
                  id="style"
                  type="text"
                  placeholder={`Defecto: ${defaultStyle}`}
                  value={cellStyle}
                  onChange={(e) => setCellStyle(e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={styles.inputGroup}>
                <label htmlFor="material">Material (Especial)</label>
                <input
                  id="material"
                  type="text"
                  placeholder={`Defecto: ${defaultMaterial}`}
                  value={cellMaterial}
                  onChange={(e) => setCellMaterial(e.target.value)}
                  className={styles.input}
                />
              </div>

              <div className={styles.modalActions}>
                <button type="submit" className={styles.modalSaveBtn}>
                  Guardar
                </button>
                {grid[editingCell.swimmer]?.[editingCell.index]?.time && (
                  <button type="button" className={styles.modalDeleteBtn} onClick={handleDeleteCell}>
                    Borrar
                  </button>
                )}
                <button type="button" className={styles.modalCancelBtn} onClick={() => setEditingCell(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
