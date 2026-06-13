"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import styles from "./AudioRecorder.module.css";

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

interface AudioRecorderProps {
  personName: string;
  onResult: (data: TrainingData) => void;
  onBack: () => void;
  onError: (message: string) => void;
}

export default function AudioRecorder({
  personName,
  onResult,
  onBack,
  onError,
}: AudioRecorderProps) {
  const [state, setState] = useState<"idle" | "recording" | "processing">(
    "idle"
  );
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Limpiar timer al desmontar
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Seleccionar el mejor formato disponible
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
        // Parar todas las pistas
        stream.getTracks().forEach((track) => track.stop());

        const audioBlob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType || "audio/webm",
        });

        await processAudioBlob(audioBlob, mediaRecorder.mimeType || "audio/webm");
      };

      mediaRecorder.start(250); // Recoger datos cada 250ms
      setState("recording");
      setDuration(0);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch {
      onError(
        "No se pudo acceder al micrófono. Asegúrate de dar permisos en tu navegador."
      );
    }
  }, [onError]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && state === "recording") {
      mediaRecorderRef.current.stop();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setState("processing");
    }
  }, [state]);

  const processAudioBlob = async (blob: Blob, mimeType: string) => {
    try {
      const today = new Date();
      const currentDate = today.toISOString().split("T")[0];

      const formData = new FormData();
      formData.append(
        "audio",
        blob,
        `recording.${mimeType.includes("mp4") ? "mp4" : "webm"}`
      );
      formData.append("personName", personName);
      formData.append("currentDate", currentDate);

      const res = await fetch("/api/process-audio", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error al procesar el audio");
      }

      const trainingData: TrainingData = await res.json();
      onResult(trainingData);
    } catch (err) {
      onError(
        err instanceof Error ? err.message : "Error al procesar el audio"
      );
      setState("idle");
    }
  };

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  if (state === "processing") {
    return (
      <div className={styles.processing}>
        <div className={styles.processingSpinner} />
        <div className={styles.processingText}>
          Procesando audio...
        </div>
        <div className={styles.processingSubtext}>
          Analizando y estructurando datos del entrenamiento
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.personInfo}>
        <span>🏊</span>
        <span className={styles.personName}>{personName}</span>
        <button
          id="back-button"
          className={styles.backButton}
          onClick={onBack}
        >
          Cambiar
        </button>
      </div>

      <p className={styles.instruction}>
        {state === "idle" ? (
          <>
            Pulsa el botón y describe tu sesión.{" "}
            <span className={styles.instructionHighlight}>
              Menciona el bloque, estilo, tiempos y pulso.
            </span>
          </>
        ) : (
          <>Pulsa para detener la grabación</>
        )}
      </p>

      <div
        className={`${styles.recordWrapper} ${
          state === "recording" ? styles.recording : ""
        }`}
      >
        <div className={`${styles.wave} ${styles.wave1}`} />
        <div className={`${styles.wave} ${styles.wave2}`} />
        <div className={`${styles.wave} ${styles.wave3}`} />

        <button
          id="record-button"
          className={`${styles.recordButton} ${
            state === "recording" ? styles.active : styles.idle
          }`}
          onClick={state === "idle" ? startRecording : stopRecording}
          aria-label={state === "idle" ? "Iniciar grabación" : "Detener grabación"}
        >
          {state === "idle" ? (
            <svg
              className={styles.micIcon}
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="2" width="6" height="12" rx="3" />
              <path d="M5 10a7 7 0 0 0 14 0" />
              <line x1="12" y1="22" x2="12" y2="17" />
            </svg>
          ) : (
            <div className={styles.stopIcon} />
          )}
        </button>
      </div>

      {state === "recording" && (
        <>
          <div className={styles.timer}>{formatTime(duration)}</div>
          <div className={styles.timerLabel}>
            <div className={styles.recordingDot} />
            Grabando
          </div>
        </>
      )}
    </div>
  );
}
