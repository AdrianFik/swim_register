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
              series: "4x50 crol",
              estilos: "crol",
              tiempos: "32.5",
              intensidad: "VO2Max",
              material: "Sin material",
              pulso: "160 ppm",
              notes: "Entrenamiento de prueba mockeado",
              piscina: "50m",
            },
          ]),
        });
      });

      // 6. Detener grabación para enviar a procesar
      await micButton.click();

      // 7. Esperar a la pantalla de Preview
      const previewHeader = page.locator("text=Revisa los datos");
      await expect(previewHeader).toBeVisible();

      // 8. Verificar cálculos matemáticos del preview (4x50 crol a 32.5s en 50m comparado con 200m PB de 2:10.0)
      const calcText = page.locator("text=Calculado: VO2Max (102.5% vel. ref. PB de 200m crol");
      await expect(calcText).toBeVisible();

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
