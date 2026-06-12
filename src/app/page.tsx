"use client";

import { useState, useCallback } from "react";
import PersonSelector from "@/components/PersonSelector";
import AudioRecorder from "@/components/AudioRecorder";
import TrainingPreview from "@/components/TrainingPreview";
import styles from "./page.module.css";

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

type Step = "select" | "record" | "preview";

export default function Home() {
  const [step, setStep] = useState<Step>("select");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [trainingData, setTrainingData] = useState<TrainingData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePersonSelect = useCallback((person: Person) => {
    setSelectedPerson(person);
    setStep("record");
    setError(null);
  }, []);

  const handleAudioResult = useCallback((data: TrainingData) => {
    setTrainingData(data);
    setStep("preview");
    setError(null);
  }, []);

  const handleBack = useCallback(() => {
    setStep("select");
    setSelectedPerson(null);
    setTrainingData(null);
    setError(null);
  }, []);

  const handleDiscard = useCallback(() => {
    setTrainingData(null);
    setStep("record");
    setError(null);
  }, []);

  const handleSaved = useCallback(() => {
    setStep("select");
    setSelectedPerson(null);
    setTrainingData(null);
    setError(null);
  }, []);

  const handleError = useCallback((message: string) => {
    setError(message);
    // Auto-dismiss después de 6 segundos
    setTimeout(() => setError(null), 6000);
  }, []);

  const stepIndex = step === "select" ? 0 : step === "record" ? 1 : 2;

  return (
    <div className={styles.container}>
      {/* Indicador de pasos */}
      <div className={styles.steps}>
        <div
          className={`${styles.stepDot} ${
            stepIndex === 0 ? styles.stepDotActive : ""
          } ${stepIndex > 0 ? styles.stepDotCompleted : ""}`}
        />
        <div
          className={`${styles.stepLine} ${
            stepIndex > 0 ? styles.stepLineActive : ""
          }`}
        />
        <div
          className={`${styles.stepDot} ${
            stepIndex === 1 ? styles.stepDotActive : ""
          } ${stepIndex > 1 ? styles.stepDotCompleted : ""}`}
        />
        <div
          className={`${styles.stepLine} ${
            stepIndex > 1 ? styles.stepLineActive : ""
          }`}
        />
        <div
          className={`${styles.stepDot} ${
            stepIndex === 2 ? styles.stepDotActive : ""
          }`}
        />
      </div>

      {/* Contenido del paso actual */}
      <div className={styles.stepContainer}>
        {step === "select" && (
          <PersonSelector onSelect={handlePersonSelect} />
        )}

        {step === "record" && selectedPerson && (
          <AudioRecorder
            personName={selectedPerson.name}
            onResult={handleAudioResult}
            onBack={handleBack}
            onError={handleError}
          />
        )}

        {step === "preview" && selectedPerson && trainingData && (
          <TrainingPreview
            personName={selectedPerson.name}
            data={trainingData}
            onSaved={handleSaved}
            onDiscard={handleDiscard}
            onError={handleError}
          />
        )}
      </div>

      {/* Toast de error */}
      {error && (
        <div className={styles.errorToast}>
          <span>{error}</span>
          <button
            className={styles.errorClose}
            onClick={() => setError(null)}
            aria-label="Cerrar error"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
