"use client";

import { useState, useCallback, useEffect } from "react";
import PersonSelector from "@/components/PersonSelector";
import AudioRecorder from "@/components/AudioRecorder";
import TrainingPreview from "@/components/TrainingPreview";
import Navigation, { TabType } from "@/components/Navigation";
import PersonalBests from "@/components/PersonalBests";
import Dashboard from "@/components/Dashboard";
import styles from "./page.module.css";
import { SessionProvider, useSessionState } from "@/lib/sessionContext";
import SessionConfigForm from "@/components/SessionConfigForm";
import SessionGrid from "@/components/SessionGrid";

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
  piscina: string;
}

type Step = "select" | "record" | "preview";

function HomeContent() {
  const [activeTab, setActiveTab] = useState<TabType>("register");
  const [step, setStep] = useState<Step>("select");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [trainingData, setTrainingData] = useState<TrainingData[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Modo de registro: individual vs grupal
  const [registerMode, setRegisterMode] = useState<"individual" | "grupal">("individual");
  const { state } = useSessionState();

  // Forzar modo grupal si hay una sesión activa
  useEffect(() => {
    if (state.config) {
      setRegisterMode("grupal");
    }
  }, [state.config]);

  const handlePersonSelect = useCallback((person: Person) => {
    setSelectedPerson(person);
    setStep("record");
    setError(null);
  }, []);

  const handleAudioResult = useCallback((data: TrainingData[]) => {
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

  const handleLogout = useCallback(() => {
    setSelectedPerson(null);
    setTrainingData(null);
    setStep("select");
    setActiveTab("register");
    setError(null);
  }, []);

  const handleError = useCallback((message: string) => {
    setError(message);
    setTimeout(() => setError(null), 6000);
  }, []);

  const stepIndex = step === "select" ? 0 : step === "record" ? 1 : 2;

  return (
    <div className={styles.container}>
      {/* Cabecera de la Aplicación */}
      <header className={styles.appHeader}>
        <div className={styles.logoArea}>
          <span className={styles.logoIcon}>🏊</span>
          <h1 className={styles.logoText}>SwimLog</h1>
        </div>
        {selectedPerson && (
          <div className={styles.userCard}>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{selectedPerson.name}</span>
              <span className={styles.userRole}>
                {selectedPerson.role === "entrenador" ? "🏅 Entrenador" : "🏊 Nadador"}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className={styles.logoutBtn}
              title="Cambiar de usuario"
            >
              Cambiar
            </button>
          </div>
        )}
      </header>

      {/* Contenido principal según la pestaña activa */}
      <main className={styles.mainContent}>
        {!selectedPerson ? (
          <div className={styles.stepContainer}>
            <PersonSelector onSelect={handlePersonSelect} />
          </div>
        ) : (
          <>
            {activeTab === "register" && (
              <div className={styles.stepWrapper}>
                {/* Selector de modo: individual vs grupal */}
                <div className={styles.modeToggleRow}>
                  <button
                    className={`${styles.modeToggleBtn} ${
                      registerMode === "individual" ? styles.modeToggleActive : ""
                    }`}
                    onClick={() => setRegisterMode("individual")}
                    disabled={state.config !== null}
                    title={
                      state.config !== null ? "Hay una sesión grupal activa en curso" : undefined
                    }
                  >
                    🏊 Registro Individual
                  </button>
                  <button
                    className={`${styles.modeToggleBtn} ${
                      registerMode === "grupal" ? styles.modeToggleActive : ""
                    }`}
                    onClick={() => setRegisterMode("grupal")}
                  >
                    👥 Sesión Grupal {state.config && <span className={styles.activeDot} />}
                  </button>
                </div>

                {registerMode === "individual" ? (
                  <>
                    {/* Indicador de pasos solo en la grabadora individual */}
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

                    <div className={styles.stepContainer}>
                      {step === "record" && (
                        <AudioRecorder
                          personName={selectedPerson.name}
                          onResult={handleAudioResult}
                          onBack={handleBack}
                          onError={handleError}
                        />
                      )}

                      {step === "preview" && trainingData && (
                        <TrainingPreview
                          personName={selectedPerson.name}
                          data={trainingData}
                          onSaved={handleSaved}
                          onDiscard={handleDiscard}
                          onError={handleError}
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <div className={styles.stepWrapper}>
                    {state.config === null ? <SessionConfigForm /> : <SessionGrid />}
                  </div>
                )}
              </div>
            )}

            {activeTab === "marcas" && (
              <PersonalBests person={selectedPerson} />
            )}

            {activeTab === "dashboard" && (
              <Dashboard person={selectedPerson} />
            )}
          </>
        )}
      </main>

      {/* Barra de navegación flotante inferior */}
      {selectedPerson && (
        <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      )}

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

export default function Home() {
  return (
    <SessionProvider>
      <HomeContent />
    </SessionProvider>
  );
}

