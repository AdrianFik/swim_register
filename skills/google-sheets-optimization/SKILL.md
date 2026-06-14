---
name: google-sheets-optimization
description: Guidelines for managing and optimizing Google Sheets API calls in SwimLog to avoid rate limits, handle quotas, and perform batch operations.
---

# Google Sheets API - Optimización y Escalabilidad

Este skill documenta los patrones recomendados para utilizar Google Sheets como base de datos en SwimLog, previniendo errores de cuota (Rate Limits) y optimizando el tiempo de respuesta.

---

## 1. Operaciones por Lote (Batching)

- **Evitar llamadas en bucle**: Nunca invoques llamadas individuales a la API de Google Sheets dentro de bucles `for` o `map`.
  - *Incorrecto*:
    ```typescript
    for (const row of rows) {
      await sheets.spreadsheets.values.append({ ...row }); // Genera múltiples llamadas HTTP
    }
    ```
  - *Correcto*:
    ```typescript
    await sheets.spreadsheets.values.append({
      range: 'Hoja!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows.map(r => [r.col1, r.col2, r.col3]) } // Una sola llamada
    });
    ```
- **Uso de `batchUpdate`**: Para realizar múltiples modificaciones heterogéneas (ej. formatear celdas, crear pestañas y escribir datos al mismo tiempo), agrupa las peticiones en una llamada `batchUpdate`.

---

## 2. Gestión de Cuotas y Errores 429 (Rate Limits)

- **Límites de la API**: Google Sheets API tiene límites estrictos de peticiones por minuto y por proyecto (habitualmente 60 a 300 peticiones).
- **Control de Excepciones**: En el backend de Next.js, envuelve los accesos a Google Sheets en bloques `try/catch` y detecta si el error se debe a una cuota excedida (status `429`).
- **Lógica de Reintento**: Si la aplicación escala o realiza cargas pesadas, implementa un reintento con retroceso exponencial (Exponential Backoff) para esperar un tiempo prudencial antes de reintentar la operación fallida.

---

## 3. Caché y Lectura Eficiente

- **Caché en Memoria / Request**: Datos estáticos o semi-estáticos como la lista de nadadores/entrenadores (pestaña `Personas`) no cambian con frecuencia. Considere cachearlos durante el ciclo de vida de la petición para evitar leer Sheets en cada renderizado de la UI.
- **Rango de Lectura**: Al leer de una pestaña, especifica rangos acotados (ej. `Personas!A2:B100`) en lugar de solicitar toda la hoja si sabes que el tamaño es limitado.

---

## 4. Gestión Dinámica de Cabeceras

- **Lógica de Migración**: Mantén la función de verificación de columnas (como la migración dinámica de la columna `Piscina` implementada en [src/lib/sheets.ts](file:///c:/Users/adria/swim_register/src/lib/sheets.ts)). Si se introduce un nuevo campo en la aplicación, la lógica de guardado debe verificar si la cabecera correspondiente existe en la primera fila de la hoja de cálculo. De lo contrario, debe añadirla automáticamente al final para no romper la compatibilidad con hojas antiguas.
