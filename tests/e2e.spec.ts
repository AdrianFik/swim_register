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
});
