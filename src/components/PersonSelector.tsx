"use client";

import { useState, useEffect } from "react";
import styles from "./PersonSelector.module.css";

interface Person {
  name: string;
  role: string;
}

interface PersonSelectorProps {
  onSelect: (person: Person) => void;
}

export default function PersonSelector({ onSelect }: PersonSelectorProps) {
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPeople() {
      try {
        const res = await fetch("/api/people");
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Error al cargar personas");
        }
        const data: Person[] = await res.json();
        setPeople(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Error al cargar personas"
        );
      } finally {
        setLoading(false);
      }
    }
    fetchPeople();
  }, []);

  const filtered = people.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <span>Cargando personas...</span>
      </div>
    );
  }

  if (error) {
    return <div className={styles.error}>{error}</div>;
  }

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>¿Quién ha entrenado?</h2>
      <p className={styles.subtitle}>
        Selecciona tu nombre para registrar el entrenamiento
      </p>

      {people.length > 4 && (
        <div className={styles.searchWrapper}>
          <input
            id="person-search"
            type="text"
            placeholder="Buscar persona..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
          <svg
            className={styles.searchIcon}
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>🏊</div>
          <p>No se encontraron personas</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((person) => (
            <button
              key={person.name}
              id={`person-${person.name.replace(/\s+/g, "-").toLowerCase()}`}
              className={styles.card}
              onClick={() => onSelect(person)}
            >
              <div className={styles.cardContent}>
                <div className={styles.cardName}>{person.name}</div>
                <span
                  className={`${styles.badge} ${
                    person.role === "entrenador"
                      ? styles.badgeEntrenador
                      : styles.badgeNadador
                  }`}
                >
                  {person.role === "entrenador" ? "🏅" : "🏊"}{" "}
                  {person.role}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
