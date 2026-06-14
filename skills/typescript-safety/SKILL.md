---
name: typescript-safety
description: Safety guidelines for strict TypeScript code, preventing 'any' usage, and typing API boundaries (Gemini and Sheets).
---

# TypeScript Safety & Tipo Estricto

Este skill define los lineamientos para garantizar la seguridad de tipos en SwimLog, mitigando errores en tiempo de ejecución al interactuar con servicios externos (Gemini AI y Google Sheets API).

---

## 1. Prohibición de `any` y Uso de Tipos Seguros

- **No usar `any`**: El uso de `any` está prohibido ya que anula la seguridad del compilador.
- **Alternativa `unknown`**: Si el tipo de datos no se conoce de antemano (ej. respuestas de API, inputs del usuario), decláralo como `unknown` y usa guardas de tipo o validadores para estrechar el tipo.
- **Guardas de Tipo (Type Guards)**:
  ```typescript
  function isTrainingData(data: unknown): data is TrainingData {
    return (
      typeof data === 'object' &&
      data !== null &&
      'fecha' in data &&
      'series' in data
    );
  }
  ```

---

## 2. Tipado Estricto de la API de Gemini (Entrada/Salida)

- **Esquema de Respuesta Estructurada**: Al invocar a Gemini en [src/lib/gemini.ts](file:///c:/Users/adria/swim_register/src/lib/gemini.ts) utilizando el modelo `gemini-3.5-flash`, define siempre un esquema JSON estricto (`responseSchema` si la librería lo admite, o instrucciones precisas en el prompt de sistema) y una interfaz de TypeScript que coincida exactamente con la salida esperada.
- **Validación Post-Parsing**: Tras obtener el texto de la IA y hacer `JSON.parse()`, valida los campos clave antes de pasarlos a los componentes de UI o al módulo de guardado.
  ```typescript
  interface GeminiTrainingOutput {
    series: string;
    estilos: string;
    tiempos: string;
    intensidad: string;
    material: string;
    pulso?: number;
    notas?: string;
  }
  ```

---

## 3. Límites de Datos de Google Sheets

- **Modelos de Datos Claros**: Mantén interfaces de TypeScript explícitas para las filas de cada pestaña de Google Sheets:
  - `TrainingData` para los entrenamientos de los nadadores.
  - `PBRecord` para las marcas personales (PBs) en la pestaña `Marcas`.
  - `PersonRecord` para nadadores y entrenadores en la pestaña `Personas`.
- **Validación de Cabeceras**: Al agregar registros usando `appendTraining` o realizar migraciones en [src/lib/sheets.ts](file:///c:/Users/adria/swim_register/src/lib/sheets.ts), asegúrate de que el orden y la cantidad de elementos en el array de valores (`values: any[][]`) correspondan exactamente con las propiedades de la interfaz y las cabeceras de la pestaña.
