---
name: swimlog-domain
description: Domain rules for SwimLog, including swimming pace conversions, intensity zones, series structures, and PB comparisons.
---

# Lógica del Dominio Deportivo — SwimLog

Este skill describe las reglas de negocio, fórmulas matemáticas y lógica de natación implementadas en SwimLog. Úsalo como referencia al modificar o extender la lógica en [src/lib/zones.ts](file:///c:/Users/adria/swim_register/src/lib/zones.ts) o componentes del Dashboard.

---

## 1. Estructura y Formateo de Series

- **Notación XxY**: Las series deben formatearse usando `x` en lugar de "de" (ej. "20 de 25" se traduce a `20x25`).
- **Bloques Multiplicadores**: Agrupaciones repetitivas usan paréntesis (ej. "3 veces 20 de 25" se traduce a `3x(20x25)`).
- **Descansos e Intervalos de Salida**: Deben adjuntarse al final de la serie entre paréntesis:
  - Descanso fijo: `(desc. 15s)` o `(desc. 30s)`.
  - Intervalo de salida (crono corriendo): `(salida 1:30)` o `(salida 45s)`.
- **Nombres de Estilo**: Mapear términos coloquiales a estilos formales: "maripa" -> `mariposa`, "crol" o "libre" -> `crol` (o `libre` según el estándar de Sheets).
- **Materiales**: Si no se especifica material (ej. aletas, palas, pull, tabla), indicar siempre `"Sin material"`.

---

## 2. Soporte y Conversión de Piscinas (25m / 50m)

Para comparar ritmos de manera justa en los gráficos, todos los ritmos se normalizan al equivalente de **piscina de 25 metros**.
- **Factores de Conversión**: Se aplica un ajuste fijo por cada 100 metros dependiendo del estilo para pasar de 50m a 25m (restando) o viceversa:
  - **Crol / Libre**: 1.6 segundos
  - **Espalda**: 2.5 segundos
  - **Braza**: 2.3 segundos
  - **Mariposa**: 1.3 segundo
  - **Estilos (IM / Combinado)**: 2.4 segundos (promedio)

---

## 3. Zonas de Intensidad y Comparación de PBs

La intensidad de la serie se clasifica comparando el paso medio de la serie contra la mejor marca personal (PB - Personal Best) del nadador.

### Distancia de Referencia para el PB:
- **Ritmos de Trabajo Específicos** (ej. "Ritmo de 200"): Usa el PB de la distancia del ritmo (`100`, `200`, `400`, `800`, `1500` metros).
- **Velocidad**: Usa el PB de **50m**.
- **Suave** y **Aeróbico ligero**: Usa el PB de **100m**.
- **Aeróbico medio**, **Aeróbico intenso**, **VO2Max** y **Crono**: Usa la distancia de repetición individual de la serie (`repDistance`, ej. 400m en `5x400`).
- **Anaeróbico**: Usa la distancia total del bloque repetido (`blockDistance`, ej. 200m en `4x50` o `5x(4x50)`).
- **Búsqueda y Extrapolación**: Si no existe marca de la distancia objetivo, busca el PB de 100m (o cualquier otra marca disponible) y extrapola el ritmo, aplicando la conversión de piscina correspondiente si difieren los tamaños (25m vs. 50m).

---

## 4. Clasificación de Zonas de Intensidad

El porcentaje de velocidad se calcula como `(Tiempo de PB / Tiempo medio de la serie) * 100`. Las zonas se definen como:
1. **Crono** (100%): Bloques constituidos por una sola repetición (ej. serie única sin multiplicadores).
2. **Velocidad**: >= 97.5% de la velocidad de su PB de 50m.
3. **Anaeróbico**: >= 90.0% de su PB de la distancia del bloque.
4. **VO2Max**: >= 85.0% de su PB de la distancia de repetición.
5. **Aeróbico intenso**: >= 82.5% de su PB de la distancia de repetición.
6. **Aeróbico medio**: >= 77.5% de su PB de la distancia de repetición.
7. **Aeróbico ligero**: >= 70.0% de su PB de 100m.
8. **Suave**: < 70.0% de su PB de 100m.

### Ritmo de Carrera (Especial)
Se sugiere la etiqueta de **Ritmo de carrera** (ej. `Ritmo de 100`, `Ritmo de 200`, etc.) cuando el paso medio de la serie esté dentro de una tolerancia de **+/- 3.5%** del PB de la distancia objetivo.
