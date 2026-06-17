import { test, expect } from "@playwright/test";
import path from "path";

test.describe("SwimLog Mobile Flow E2E Tests", () => {
  test("should select swimmer, record audio, preview calculations, and save to sheets", async ({ page }) => {
    try {
      // 1. Mock de la API de personas
      await page.route("**/api/people", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([{ name: "Adrian", role: "nadador" }]),
        });
      });

      // 2. Mock de la API de marcas personales
      await page.route("**/api/marcas?personName=Adrian", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            { nombre: "Adrian", estilo: "crol", distancia: 100, tiempo: "1:00.0", fecha: "2026-01-01", piscina: "25m" },
            { nombre: "Adrian", estilo: "crol", distancia: 50, tiempo: "28.0", fecha: "2026-01-01", piscina: "25m" },
            { nombre: "Adrian", estilo: "crol", distancia: 200, tiempo: "2:10.0", fecha: "2026-01-01", piscina: "25m" },
            { nombre: "Adrian", estilo: "mariposa", distancia: 25, tiempo: "12.0", fecha: "2026-01-01", piscina: "25m" },
            { nombre: "Adrian", estilo: "mariposa", distancia: 50, tiempo: "26.0", fecha: "2026-01-01", piscina: "25m" },
          ]),
        });
      });

      // Navegar a la Home
      await page.goto("/");

      // 3. Verificar que aparece el selector de nadadores y hacer click en Adrian
      const adrianButton = page.locator("#person-adrian");
      await expect(adrianButton).toBeVisible();
      await adrianButton.click();

      // 4. Verificar que cambia a la pantalla de grabación
      const micButton = page.locator("#record-button");
      await expect(micButton).toBeVisible();
      await expect(page.locator("text=Pulsa el botón y describe tu sesión.")).toBeVisible();

      // 5. Iniciar grabación simulada
      await micButton.click();
      await page.waitForTimeout(1500); // Grabar durante 1.5s

      // Mockear la respuesta del procesado de audio de Gemini
      await page.route("**/api/process-audio", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              fecha: "2026-06-14",
              series: "1x25",
              estilos: "mariposa",
              tiempos: "10.4",
              intensidad: "Crono",
              material: "Sin material",
              pulso: "160 ppm",
              notes: "Bloque 1 - 25 mariposa",
              piscina: "25m",
            },
            {
              fecha: "2026-06-14",
              series: "1x50",
              estilos: "mariposa",
              tiempos: "25.7",
              intensidad: "Crono",
              material: "Sin material",
              pulso: "160 ppm",
              notes: "Bloque 1 - 50 mariposa",
              piscina: "25m",
            },
            {
              fecha: "2026-06-14",
              series: "1x25",
              estilos: "crol",
              tiempos: "10.6",
              intensidad: "Crono",
              material: "Sin material",
              pulso: "165 ppm",
              notes: "Bloque 2 - 25 crol",
              piscina: "25m",
            },
            {
              fecha: "2026-06-14",
              series: "1x50",
              estilos: "crol",
              tiempos: "24.6",
              intensidad: "Crono",
              material: "Sin material",
              pulso: "165 ppm",
              notes: "Bloque 2 - 50 crol",
              piscina: "25m",
            },
          ]),
        });
      });

      // 6. Detener grabación para enviar a procesar
      await micButton.click();

      // 7. Esperar a la pantalla de Preview
      const previewHeader = page.locator("text=Revisa los datos");
      await expect(previewHeader).toBeVisible();

      // 8. Verificar cálculos matemáticos del preview para los diferentes bloques
      // Bloque 1 (25m mariposa): tempo 10.4s vs PB 12.0s -> 115.4%
      const calcText1 = page.locator("text=Calculado: Crono (115.4% vel. ref. PB de 25m mariposa");
      await expect(calcText1).toBeVisible();

      // Bloque 4 (50m crol): tempo 24.6s vs PB 28.0s -> 113.8%
      const calcText4 = page.locator("text=Calculado: Crono (113.8% vel. ref. PB de 50m crol");
      await expect(calcText4).toBeVisible();

      // 9. Mockear guardado en Google Sheets
      await page.route("**/api/save-training", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      });

      // 10. Click en guardar y verificar el resultado de éxito
      const saveButton = page.locator("#save-training-button");
      await expect(saveButton).toBeVisible();
      await saveButton.evaluate((el: HTMLElement) => el.click());

      const successMessage = page.locator("text=¡Entrenamientos guardados!");
      await expect(successMessage).toBeVisible();

      // 11. Volver a empezar
      const startNewBtn = page.locator("#new-training-button");
      await expect(startNewBtn).toBeVisible();
      await startNewBtn.evaluate((el: HTMLElement) => el.click());

      // Verificar que estamos de vuelta en la pantalla de selección
      await expect(page.locator("#person-adrian")).toBeVisible();
    } catch (e) {
      await page.screenshot({ path: path.join(process.cwd(), "failure.png"), fullPage: true });
      throw e;
    }
  });

  test("should initialize group session, edit cell, record group audio, and save", async ({ page }) => {
    try {
      // 1. Mock de la API de personas con Adrián y Juan
      await page.route("**/api/people", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            { name: "Adrian", role: "nadador" },
            { name: "Juan", role: "nadador" },
          ]),
        });
      });

      // Navegar a la Home
      await page.goto("/");

      // Seleccionar Adrian para entrar a la app
      const adrianButton = page.locator("#person-adrian");
      await expect(adrianButton).toBeVisible();
      await adrianButton.click();

      // Cambiar a la pestaña de Sesión Grupal
      const groupTabToggle = page.locator("text=Sesión Grupal");
      await expect(groupTabToggle).toBeVisible();
      await groupTabToggle.click();

      // Verificar que estamos en el formulario de configuración
      await expect(page.locator("text=Iniciar Nueva Sesión Grupal")).toBeVisible();

      // Rellenar formulario
      await page.fill("#blockDescription", "10x100 crol");
      await page.selectOption("#intensity", "Aeróbico medio");
      await page.fill("#rest", "desc. 15s");
      await page.fill("#totalColumns", "4");

      // Seleccionar nadadores (Adrian y Juan) en el formulario
      const checkAdrian = page.locator("button:has-text('Adrian')");
      const checkJuan = page.locator("button:has-text('Juan')");
      await checkAdrian.click();
      await checkJuan.click();

      // Enviar formulario
      const initButton = page.locator("button:has-text('Iniciar Sesión de Entrenamiento')");
      await initButton.click();

      // Verificar que entramos a la cuadrícula y que la cabecera del bloque es visible
      await expect(page.locator("text=10x100 crol")).toBeVisible();
      await expect(page.locator("text=Aeróbico medio • 25m")).toBeVisible();

      // 2. Edición Manual Celda
      // Hacer click en la celda del nadador 'Adrian' columna #2 (repIndex 1)
      const cellAdrianRep2 = page.locator("#cell-adrian-1");
      await expect(cellAdrianRep2).toBeVisible();
      await cellAdrianRep2.click();

      // Rellenar el modal de edición
      await expect(page.locator("text=Repetición #2 de Adrian")).toBeVisible();
      await page.fill("#time", "1:15.0");
      await page.fill("#style", "crol");
      await page.fill("#material", "Sin material");
      
      const saveCellBtn = page.locator("button:has-text('Guardar')");
      await saveCellBtn.click();

      // Verificar que la celda tiene la marca manual
      await expect(cellAdrianRep2).toHaveText("1:15.0");

      // 3. Procesamiento por voz grupal
      // Mockear la respuesta de Gemini para el audio grupal
      await page.route("**/api/process-session-audio", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              nombre: "Adrian",
              tiempos: ["1:12.5", "1:13.0"]
            },
            {
              nombre: "Juan",
              tiempos: ["1:15.5", "1:16.0"]
            }
          ]),
        });
      });

      // Hacer click en Grabar Audio
      const micButton = page.locator("button:has-text('Grabar Audio')");
      await expect(micButton).toBeVisible();
      await micButton.click();
      await page.waitForTimeout(1000); // Grabar 1s
      
      // Detener grabación
      await page.locator("button:has-text('Detener')").click();

      // Verificar que aparece la previsualización de la IA
      await expect(page.locator("text=Resultados Extraídos:")).toBeVisible();
      await expect(page.locator("text=Adrian: 1:12.5, 1:13.0")).toBeVisible();
      await expect(page.locator("text=Juan: 1:15.5, 1:16.0")).toBeVisible();

      // Volcar marcas a la tabla
      const applyBtn = page.locator("button:has-text('Volcar a la tabla')");
      await applyBtn.click();

      // Verificar que las celdas se hayan rellenado secuencialmente:
      // - Adrian rep 0 (Rep #1): "1:12.5"
      // - Adrian rep 1 (Rep #2): "1:15.0" (respetado el valor manual original)
      // - Adrian rep 2 (Rep #3): "1:13.0"
      await expect(page.locator("#cell-adrian-0")).toHaveText("1:12.5");
      await expect(page.locator("#cell-adrian-1")).toHaveText("1:15.0");
      await expect(page.locator("#cell-adrian-2")).toHaveText("1:13.0");

      // - Juan rep 0 (Rep #1): "1:15.5"
      // - Juan rep 1 (Rep #2): "1:16.0"
      await expect(page.locator("#cell-juan-0")).toHaveText("1:15.5");
      await expect(page.locator("#cell-juan-1")).toHaveText("1:16.0");

      // 4. Guardar sesión
      // Mockear guardado en sheets
      await page.route("**/api/save-training", async (route) => {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ success: true }),
        });
      });

      const finishBtn = page.locator("button:has-text('Finalizar y Guardar Sesión')");
      await expect(finishBtn).toBeVisible();
      await finishBtn.click();

      // Verificar mensaje de éxito
      await expect(page.locator("text=¡Entrenamiento guardado con éxito!")).toBeVisible();
    } catch (e) {
      await page.screenshot({ path: path.join(process.cwd(), "failure.png"), fullPage: true });
      throw e;
    }
  });
});
