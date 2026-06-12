# 🏊 SwimLog — Registro de Entrenamientos por Voz sin Fricción

SwimLog es una aplicación web fullstack y mobile-first diseñada específicamente para nadadores y entrenadores. Permite registrar las sesiones de entrenamiento directamente al salir de la piscina utilizando **notas de voz**, las cuales son interpretadas mediante Inteligencia Artificial y almacenadas de forma estructurada en **Google Sheets** (Google Drive).

---

## 📖 About (Sobre el Proyecto)
En el mundo de la natación competitiva y de alto rendimiento, registrar el volumen de metros, las series, las intensidades y los tiempos de descanso es crucial para planificar el progreso. Sin embargo, escribir los datos en una libreta mojada o en una app móvil con los dedos húmedos junto a la piscina genera muchísima fricción. 

**SwimLog soluciona esto eliminando las pantallas de escritura.** Con un solo botón, el nadador o entrenador graba una descripción rápida de la sesión (ej: *"Hoy he hecho 3 veces 20 de 25 crol a media de 15 segundos y al final un 800 crono en 9:55"*). La IA procesa, desglosa los datos complejos y los escribe directamente en la pestaña del nadador.

---

## ⚡ Características del MVP (Fase Actual)
* **Registro por Voz Nativo**: Grabación directa desde el micrófono del móvil usando la API `MediaRecorder` del navegador.
* **Procesamiento Inteligente con Gemini 3.5 Flash**: Interpretación avanzada en español del lenguaje informal de natación:
  - Traduce expresiones de series ("20 de 100", "3 veces 20 de 25") a formatos técnicos (`20x100`, `3x(20x25)`).
  - Extrae y adjunta tiempos de descanso a las series entre paréntesis (ej: `(desc. 15s)` o `(salida 1:30)`).
  - Mapea coloquialismos de estilos (ej: "maripa" ➡️ "mariposa").
  - Identifica tiempos detallados por series, cronos aislados o promedios.
  - Clasifica las intensidades (*Aeróbico intenso, anaeróbico, velocidad, umbral, regenerativo...*).
  - Si no se especifica material, asume automáticamente `"Sin material"`.
* **Confirmación Previa**: Flujo interactivo de 3 pasos (Selección de nadador ➡️ Grabación ➡️ Vista previa editable de los datos interpretados por la IA antes de guardarse).
* **Google Sheets como Base de Datos**: Cada nadador tiene su propia pestaña con sus entrenamientos ordenados en filas. Una pestaña maestra llamada `Personas` alimenta el selector de usuarios de la web.
* **Diseño Premium Acuático Oscuro**: Interfaz minimalista inspirada en el agua, con glassmorphism, mobile-first y animaciones fluidas de ondas de sonido.
* **Despliegue Serverless**: Todo en una sola aplicación Next.js alojada en Vercel.

---

## 🛠️ Tecnologías y Plataformas
* **Frontend**: React, Next.js (App Router), TypeScript.
* **Estilos**: Vanilla CSS con CSS Modules (con diseño fluido mobile-first, colores HSL acuáticos y modo oscuro).
* **IA / Transcripción**: SDK oficial de **Google AI Studio** utilizando el modelo de última generación **`gemini-3.5-flash`** para transcripción y extracción JSON estructurada en un único paso.
* **Almacenamiento**: Google Sheets API v4 mediante una **Google Service Account** (permisos de lectura/escritura server-to-server).
* **Hosting**: Desplegado en **Vercel** como Serverless Functions.

---

## 🔮 Roadmap / Próximos Pasos (Futuro)
* **Extracción de Estadísticas y Progreso**: 
  - Módulo de analíticas en la propia app para visualizar la evolución del volumen semanal (metros totales).
  - Gráficas de progresión de marcas en distancias clave (tiempos de cronos, series de 100m, etc.).
  - Comparativa de zonas de intensidad y porcentaje de estilos entrenados al mes.
* **Exportación de Informes**: Generación de PDFs semanales para que los entrenadores analicen el rendimiento del grupo.
* **PWA (Progressive Web App)**: Permitir la instalación de SwimLog en el móvil como una app nativa con acceso directo en la pantalla de inicio.

---

## 🚀 Instalación y Desarrollo Local

1. Clona el repositorio:
   ```bash
   git clone https://github.com/AdrianFik/swim_register.git
   cd swim_register
   ```

2. Instala las dependencias:
   ```bash
   npm install
   ```

3. Configura las variables de entorno:
   Crea un archivo `.env.local` en la raíz del proyecto y rellena los campos necesarios:
   ```env
   GEMINI_API_KEY=tu_api_key_de_google_ai_studio
   GOOGLE_SHEETS_ID=id_de_tu_spreadsheet
   GOOGLE_SERVICE_ACCOUNT_EMAIL=email-de-tu-cuenta-de-servicio@gserviceaccount.com
   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\ntu_clave_privada\n-----END PRIVATE KEY-----\n"
   ```

4. Lanza el servidor de desarrollo:
   ```bash
   npm run dev
   ```
   Abre [http://localhost:3000](http://localhost:3000) en tu navegador.
