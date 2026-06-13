# Contexto de Desarrollo y Arquitectura — SwimLog

Este documento sirve como archivo de contexto persistente para asegurar la continuidad del desarrollo de **SwimLog** entre diferentes sesiones y agentes de Inteligencia Artificial. Describe el funcionamiento actual, dependencias, variables y precauciones para no romper el sistema.

---

## 📌 Visión General
SwimLog es un MVP que permite registrar sesiones de entrenamiento de natación mediante notas de voz.
- **Flujo de datos**: Audio grabado en el cliente ➡️ API Route de Next.js ➡️ Gemini 3.5 Flash (extrae datos y estructura un JSON con múltiples bloques) ➡️ El usuario revisa, edita y refina cada bloque ➡️ API Route de Next.js ➡️ Google Sheets API (escribe los datos en lote en la hoja de cálculo).

---

## 📂 Estructura de Archivos Clave
- [src/lib/sheets.ts](file:///c:/Users/adria/swim_register/src/lib/sheets.ts): Cliente de la API de Google Sheets. Controla la autenticación JWT, la creación/migración de pestañas, el histórico de entrenamientos y la gestión de marcas personales (PBs).
- [src/lib/gemini.ts](file:///c:/Users/adria/swim_register/src/lib/gemini.ts): Cliente de Gemini. Prompt de sistema en español estructurado para procesar audios y extraer una lista de múltiples bloques de series de entrenamiento.
- [src/lib/zones.ts](file:///c:/Users/adria/swim_register/src/lib/zones.ts): Lógica de dominio. Contiene funciones para el análisis y formateo de tiempos, la extracción de distancias de series, la clasificación de zonas de intensidad e intensidades tipo "Crono" (bloques de repetición única), y las conversiones de ritmo/100m entre piscinas de 25m y 50m.
- [src/app/api/people/route.ts](file:///c:/Users/adria/swim_register/src/app/api/people/route.ts): Endpoint `GET /api/people` que devuelve la lista de nadadores/entrenadores.
- [src/app/api/marcas/route.ts](file:///c:/Users/adria/swim_register/src/app/api/marcas/route.ts): Endpoint `GET / POST` para consultar y registrar marcas personales (PBs) por distancia, estilo y tipo de piscina.
- [src/app/api/trainings/route.ts](file:///c:/Users/adria/swim_register/src/app/api/trainings/route.ts): Endpoint `GET /api/trainings` para recuperar el histórico completo de entrenamientos de un nadador.
- [src/app/api/process-audio/route.ts](file:///c:/Users/adria/swim_register/src/app/api/process-audio/route.ts): Endpoint `POST /api/process-audio` que recibe el Blob de audio y devuelve el JSON estructurado con múltiples entrenamientos.
- [src/app/api/save-training/route.ts](file:///c:/Users/adria/swim_register/src/app/api/save-training/route.ts): Endpoint `POST /api/save-training` que guarda por lotes los entrenamientos confirmados.
- [src/app/page.tsx](file:///c:/Users/adria/swim_register/src/app/page.tsx): Orquestador principal del flujo de la interfaz móvil.
- [src/components/AudioRecorder.tsx](file:///c:/Users/adria/swim_register/src/components/AudioRecorder.tsx): Capturador del micrófono con timer y ondas animadas.
- [src/components/TrainingPreview.tsx](file:///c:/Users/adria/swim_register/src/components/TrainingPreview.tsx): Vista de tarjetas apiladas para previsualizar, editar individualmente y guardar en lote todos los bloques extraídos.
- [src/components/Dashboard.tsx](file:///c:/Users/adria/swim_register/src/components/Dashboard.tsx): Panel de estadísticas interactivo que renderiza gráficos de evolución de ritmo y distribución de zonas (con Recharts), filtros avanzados y hover tooltips con detalles matemáticos.
- [src/components/PersonalBests.tsx](file:///c:/Users/adria/swim_register/src/components/PersonalBests.tsx): Panel de gestión para registrar marcas personales directamente en el Google Sheet.

---

## 🔌 Conexiones y Variables de Entorno (.env.local)
La aplicación requiere las siguientes variables de entorno cargadas tanto localmente en `.env.local` como en el panel de administración de Vercel:
1. `GEMINI_API_KEY`: API Key de Google AI Studio.
2. `GOOGLE_SHEETS_ID`: ID del Spreadsheet de Google Sheets.
3. `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Correo de la Service Account.
4. `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: Clave privada del archivo JSON de credenciales.

⚠️ **IMPORTANTE**: La clave privada (`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`) se limpia de espacios y comillas externas (`"` y `'`) en `sheets.ts` para tolerar pegados directos defectuosos en el panel de Vercel. Mantén esta lógica de limpieza siempre.

---

## 📊 Estructura de la Base de Datos (Google Sheets)
El Spreadsheet se configura con:
- Una pestaña llamada **`Personas`** con las cabeceras exactas en la primera fila:
  - Celda A1: `Nombre`
  - Celda B1: `Rol` (admitidos: `nadador` y `entrenador`).
- Una pestaña llamada **`Marcas`** (PBs) con las cabeceras exactas:
  - `Nombre | Estilo | Distancia | Tiempo | Fecha | Piscina`
- Pestañas individuales para cada nadador creadas dinámicamente con estas cabeceras:
  - `Fecha | Series | Estilos | Tiempos | Intensidad | Material | Pulso | Notas | Piscina`

🔄 **MIGRACIONES AUTOMÁTICAS**:
Al interactuar con las marcas o guardar entrenamientos, `sheets.ts` verifica la existencia de la columna `Piscina` tanto en la pestaña del nadador como en la de `Marcas`. Si falta, la agrega automáticamente al final para evitar roturas de compatibilidad con versiones previas de la hoja de cálculo.

---

## 🤖 Reglas del Prompt de Gemini (gemini.ts)
El prompt en `gemini.ts` está optimizado para:
- Traducir "X de Y" a "XxY" (ej: "20 de 25" ➡️ `20x25`).
- Encapsular repeticiones con paréntesis: "3 veces 20 de 25" ➡️ `3x(20x25)`.
- Si se dice descanso o salida, adjuntarlo entre paréntesis en la serie: `(desc. 15s)` o `(salida 1:30)`.
- Mapear terminología coloquial de estilos: "maripa" ➡️ `mariposa`.
- Rellenar obligatoriamente con `"Sin material"` si no se detecta ningún material.
- Extraer **múltiples bloques/series** en un solo audio si el nadador describe más de un bloque en la misma nota de voz, devolviéndolos como un array JSON de entrenamientos.

---

## ⚠️ Precauciones para el Futuro
- **Evitar reintroducir dependencias obsoletas**: No uses `config` con `api: { bodyParser: false }` en las API routes bajo Next.js App Router (provoca warnings en el build y es innecesario).
- **Modelo de Gemini**: Utiliza siempre un modelo compatible y disponible. Actualmente se usa `gemini-3.5-flash` en español.
- **Formato de datos**: Cualquier adición de columnas a Google Sheets requiere sincronizar las cabeceras en `ensurePersonSheet()`, `sheets.ts` (`TrainingData` / `appendTraining`) y el formulario en `TrainingPreview.tsx`.
- **Ejes de Gráficos**: En el Dashboard, los gráficos de **Zonas de Intensidad** no muestran los tiempos en el eje Y para evitar confusiones de escala; los gráficos de **Ritmos de Trabajo** sí muestran los ritmos como tiempos MM:SS en el eje Y.

---

## 🚀 Lógica de Negocio y Funcionalidades Implementadas

### 1. Soporte de Longitud de Piscina (25m / 50m)
- La aplicación permite seleccionar el tipo de piscina (`25m` o `50m`) al capturar el entrenamiento y al registrar marcas personales (PBs).
- **Conversiones del Entrenador**: Para comparar ritmos de manera equitativa en los gráficos, se aplican factores de conversión por cada 100 metros según el estilo:
  - **Crol / Libre**: 1.6s
  - **Espalda**: 2.0s
  - **Braza**: 2.0s
  - **Mariposa**: 1.0s
  - **Estilos (IM)**: 1.65s (promedio)
- Todos los ritmos del Dashboard se normalizan al equivalente de **piscina de 25m** antes de graficarse.

### 2. Estandarización de Zonas de Ritmo e Intensidad
- Las intensidades y ritmos se comparan contra las mejores marcas personales (PBs) del nadador.
- **Comparación por Distancia Específica**: El porcentaje de velocidad se calcula utilizando la marca personal de la **distancia exacta** de la serie (ej: si se nada 200m, se compara contra el PB de 200m del estilo; si no existe, escala a 100m, aplicando conversiones si difiere la piscina).
- Las zonas se clasifican de acuerdo a los límites establecidos por el entrenador:
  - **Crono** (100%): Bloques constituidos por una sola repetición (ej: una serie única sin multiplicadores).
  - **Velocidad**: >= 97.5% de la velocidad de su PB.
  - **Anaeróbico**: >= 90.0% de su PB.
  - **VO2Max**: >= 85.0% de su PB.
  - **Aeróbico intenso**: >= 82.5% de su PB.
  - **Aeróbico medio**: >= 77.5% de su PB.
  - **Aeróbico ligero**: >= 70.0% de su PB.
  - **Suave**: < 70.0% de su PB.
- Adicionalmente, el sistema sugiere etiquetas de **Ritmo de carrera** (ej: `Ritmo de 100`, `Ritmo de 200`, `Ritmo de 400`, `Ritmo de 800`, `Ritmo de 1500`) cuando el paso medio de la serie está dentro de una tolerancia de +/- 3.5% del PB de esa distancia objetivo.

### 3. Dashboard Interactivo y Gráficos (Recharts)
- **Gráfico de Evolución**: Representa los tiempos de ritmo o porcentajes de velocidad a lo largo del tiempo.
- **Línea de Referencia**: Muestra una línea horizontal punteada de color amarillo que indica el ritmo teórico esperado (PB o límite de zona) para ese tipo de trabajo.
- **Color de Puntos Dinámico**: Los puntos del gráfico son de color **verde** si el nadador cumple o mejora el ritmo teórico/límite de zona de esa intensidad, y **rojo** si se sitúa por debajo.
- **Tooltip Personalizado**: Al hacer hover sobre un punto de datos, el tooltip indica el bloque exacto de entrenamiento del cual procede y el desglose de cálculos realizados (incluyendo la conversión de piscina si aplica).
- **Distribución de Zonas**: Un gráfico de dona interactivo muestra la frecuencia de las series realizadas en cada zona de intensidad o ritmo de trabajo.
