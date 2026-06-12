import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SwimLog — Registro de Entrenamientos",
  description:
    "Registra tus entrenamientos de natación con notas de voz. Procesamiento por IA y almacenamiento automático en Google Sheets.",
  keywords: ["natación", "entrenamiento", "registro", "voz", "IA", "swimming"],
  authors: [{ name: "SwimLog" }],
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#060b18",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <header
          style={{
            position: "relative",
            zIndex: 10,
            padding: "var(--space-md) var(--space-lg)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-sm)",
          }}
        >
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle
              cx="14"
              cy="14"
              r="13"
              stroke="url(#logoGrad)"
              strokeWidth="2"
              fill="none"
            />
            <path
              d="M7 14C9 11 11 17 14 14C17 11 19 17 21 14"
              stroke="url(#logoGrad)"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
            <defs>
              <linearGradient
                id="logoGrad"
                x1="0"
                y1="0"
                x2="28"
                y2="28"
              >
                <stop stopColor="#06d6d6" />
                <stop offset="1" stopColor="#3b82f6" />
              </linearGradient>
            </defs>
          </svg>
          <span
            style={{
              fontSize: "1.15rem",
              fontWeight: 700,
              background: "linear-gradient(135deg, #06d6d6, #3b82f6)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              letterSpacing: "-0.02em",
            }}
          >
            SwimLog
          </span>
        </header>
        <main
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: "480px",
            margin: "0 auto",
            padding: "0 var(--space-lg) var(--space-3xl)",
          }}
        >
          {children}
        </main>
      </body>
    </html>
  );
}
