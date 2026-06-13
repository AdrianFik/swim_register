"use client";

import styles from "./Navigation.module.css";
import { Mic, Award, TrendingUp } from "lucide-react";

export type TabType = "register" | "marcas" | "dashboard";

interface NavigationProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  disabled?: boolean;
}

export default function Navigation({
  activeTab,
  setActiveTab,
  disabled = false,
}: NavigationProps) {
  return (
    <nav className={styles.nav}>
      <button
        className={`${styles.navItem} ${activeTab === "register" ? styles.active : ""}`}
        onClick={() => !disabled && setActiveTab("register")}
        disabled={disabled}
        id="nav-tab-register"
      >
        <Mic className={styles.icon} size={20} />
        <span className={styles.label}>Registrar</span>
      </button>

      <button
        className={`${styles.navItem} ${activeTab === "marcas" ? styles.active : ""}`}
        onClick={() => !disabled && setActiveTab("marcas")}
        disabled={disabled}
        id="nav-tab-marcas"
      >
        <Award className={styles.icon} size={20} />
        <span className={styles.label}>Marcas (PBs)</span>
      </button>

      <button
        className={`${styles.navItem} ${activeTab === "dashboard" ? styles.active : ""}`}
        onClick={() => !disabled && setActiveTab("dashboard")}
        disabled={disabled}
        id="nav-tab-dashboard"
      >
        <TrendingUp className={styles.icon} size={20} />
        <span className={styles.label}>Estadísticas</span>
      </button>
    </nav>
  );
}
