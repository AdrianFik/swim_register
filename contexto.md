# Contexto de Desarrollo y Arquitectura — SwimLog

Este documento sirve como archivo de contexto persistente para asegurar la continuidad del desarrollo de **SwimLog** entre diferentes sesiones y agentes de Inteligencia Artificial. Describe el funcionamiento actual, dependencias, variables y precauciones para no romper el sistema.

---

## 📌 Visión General
SwimLog es un MVP que permite registrar sesiones de entrenamiento de natación mediante notas de voz.
- **Flujo de datos**: Audio grabado en el cliente ➡️ API Route de Next.js ➡️ Gemini 3.5 Flash (extrae datos y estructura un JSON) ➡️ El usuario revisa y edita los datos ➡️ API Route de Next.js ➡️ Google Sheets API (escribe los datos en una hoja).

---

## 📂 Estructura de Archivos Clave
- [src/lib/sheets.ts](file:///c:/Users/adria/swim_register/src/lib/sheets.ts): Cliente de la API de Google Sheets. Controla la autenticación JWT y la inserción de filas.
- [src/lib/gemini.ts](file:///c:/Users/adria/swim_register/src/lib/gemini.ts): Cliente de Gemini. Contiene el prompt en español estructurado con ejemplos para interpretar distancias, descansos, intensidades y tiempos.
- [src/app/api/people/route.ts](file:///c:/Users/adria/swim_register/src/app/api/people/route.ts): Endpoint `GET /api/people` que devuelve la lista de nadadores/entrenadores.
- [src/app/api/process-audio/route.ts](file:///c:/Users/adria/swim_register/src/app/api/process-audio/route.ts): Endpoint `POST /api/process-audio` que recibe el Blob de audio en formato FormData y lo procesa con Gemini.
- [src/app/api/save-training/route.ts](file:///c:/Users/adria/swim_register/src/app/api/save-training/route.ts): Endpoint `POST /api/save-training` que hace append de los datos confirmados en la pestaña del nadador.
- [src/app/page.tsx](file:///c:/Users/adria/swim_register/src/app/page.tsx): Orquestador del flujo de la interfaz móvil en 3 pasos.
- [src/components/AudioRecorder.tsx](file:///c:/Users/adria/swim_register/src/components/AudioRecorder.tsx): Capturador del micrófono con timer y ondas animadas.

---

## 🔌 Conexiones y Variables de Entorno (.env.local)
La aplicación requiere las siguientes variables de entorno cargadas tanto localmente en `.env.local` como en el panel de administración de Vercel:
1. `GEMINI_API_KEY`: API Key de Google AI Studio configurada en plan de pago o con límites de cuota suficientes.
2. `GOOGLE_SHEETS_ID`: ID del Spreadsheet de Google Sheets.
3. `GOOGLE_SERVICE_ACCOUNT_EMAIL`: Correo de la cuenta de servicio (Service Account) de Google Cloud.
4. `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`: Clave privada del archivo JSON de credenciales.

⚠️ **IMPORTANTE**: La clave privada (`GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`) se limpia de espacios y comillas externas (`"` y `'`) en `sheets.ts` para tolerar pegados directos defectuosos en el panel de Vercel. Mantén esta lógica de limpieza siempre.

---

## 📊 Estructura de la Base de Datos (Google Sheets)
El Spreadsheet debe configurarse con:
- Una pestaña llamada **`Personas`** con las cabeceras exactas en la primera fila:
  - Celda A1: `Nombre`
  - Celda B1: `Rol` (los roles admitidos son `nadador` y `entrenador`).
  - La aplicación lee esta pestaña para renderizar la primera pantalla.
- La cuenta de servicio de Google debe estar agregada como **Editor** en el menú Compartir del Google Sheet.
- Cuando se guarda un entrenamiento, la app busca una pestaña con el nombre del nadador seleccionado. Si no existe, la crea dinámicamente con estas cabeceras en la primera fila:
  `Fecha | Series | Estilos | Tiempos | Intensidad | Material | Pulso | Notas`

---

## 🤖 Reglas del Prompt de Gemini (gemini.ts)
El prompt en `gemini.ts` está entrenado con reglas específicas de natación:
- Traducir "X de Y" a "XxY" (ej: "20 de 25" ➡️ `20x25`).
- Encapsular repeticiones con paréntesis: "3 veces 20 de 25" ➡️ `3x(20x25)`.
- Si se dice descanso o salida, adjuntarlo entre paréntesis en la serie: `(desc. 15s)` o `(salida 1:30)`.
- Mapear terminología coloquial de estilos: "maripa" ➡️ `mariposa`.
- Si no hay material, rellenar el campo de material obligatoriamente con `"Sin material"`.
- Los tiempos por partes deben ir separados por comas y los promedios deben indicar la media.

---

## ⚠️ Precauciones para el Futuro
- **Evitar reintroducir dependencias obsoletas**: No uses `config` con `api: { bodyParser: false }` en las API routes bajo Next.js App Router (provoca warnings en el build y es innecesario, la API nativa de NextRequest maneja formData sin problemas).
- **Modelo de Gemini**: Utiliza siempre un modelo compatible y disponible. A fecha de 2026, `gemini-3.5-flash` es el modelo activo por defecto en la aplicación y soporta audio nativo en español.
- **Formato de datos**: Cualquier adición de columnas a Google Sheets requiere sincronizar las cabeceras en `ensurePersonSheet()` y en la estructura de `TrainingData` en `sheets.ts`, además del formulario editable en `TrainingPreview.tsx`.
