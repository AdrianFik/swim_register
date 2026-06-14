import { describe, it, expect } from "vitest";
import {
  getConversionFactor100m,
  normalizeIntensity,
  findBestPB,
  calculateIntensityZone,
  getReferenceDistance,
} from "./zones";
import { PersonalBest } from "./sheets";

describe("Swimming Domain Logic & Calculations", () => {
  describe("getConversionFactor100m", () => {
    it("should return the correct conversion factors according to SKILL.md", () => {
      expect(getConversionFactor100m("crol")).toBe(1.6);
      expect(getConversionFactor100m("libre")).toBe(1.6);
      expect(getConversionFactor100m("espalda")).toBe(2.5);
      expect(getConversionFactor100m("braza")).toBe(2.3);
      expect(getConversionFactor100m("pecho")).toBe(2.3);
      expect(getConversionFactor100m("mariposa")).toBe(1.3);
      expect(getConversionFactor100m("maripa")).toBe(1.3);
      expect(getConversionFactor100m("estilos")).toBe(2.4);
      expect(getConversionFactor100m("combinado")).toBe(2.4);
    });
  });

  describe("normalizeIntensity", () => {
    it("should robustly clean diacritics, spaces, and casing", () => {
      expect(normalizeIntensity("VO2 Max")).toBe("vo2max");
      expect(normalizeIntensity("vo2max")).toBe("vo2max");
      expect(normalizeIntensity("Anaeróbico")).toBe("anaerobico");
      expect(normalizeIntensity("Anaerobico")).toBe("anaerobico");
      expect(normalizeIntensity("Aeróbico Intenso")).toBe("aerobicointenso");
      expect(normalizeIntensity("aerobico  intenso")).toBe("aerobicointenso");
      expect(normalizeIntensity("Ritmo de 200")).toBe("ritmode200");
    });
  });

  describe("findBestPB (Strict Lookup)", () => {
    const mockPbs: PersonalBest[] = [
      { nombre: "Adrian", estilo: "crol", distancia: 100, tiempo: "1:00.0", fecha: "2026-01-01", piscina: "25m" },
      { nombre: "Adrian", estilo: "crol", distancia: 50, tiempo: "28.0", fecha: "2026-01-01", piscina: "25m" },
    ];

    it("should return target distance if it exists in same pool", () => {
      const result = findBestPB(mockPbs, "crol", 100, "25m");
      expect(result).not.toBeNull();
      expect(result!.pb.distancia).toBe(100);
      expect(result!.scaled).toBe(false);
    });

    it("should return target distance if it exists in any pool", () => {
      const result = findBestPB(mockPbs, "crol", 100, "50m");
      expect(result).not.toBeNull();
      expect(result!.pb.distancia).toBe(100);
      expect(result!.scaled).toBe(false);
    });

    it("should return null (not scale to 100m) if target distance does not exist in any pool", () => {
      const result = findBestPB(mockPbs, "crol", 200, "25m");
      expect(result).toBeNull();
    });
  });

  describe("getReferenceDistance", () => {
    it("should get correct reference distance for zones", () => {
      // VO2Max & Anaeróbico use total block distance
      expect(getReferenceDistance("VO2Max", 50, "4x50")).toBe(200);
      expect(getReferenceDistance("Anaeróbico", 50, "4x50")).toBe(200);
      
      // Aeróbico intenso & medio use rep distance
      expect(getReferenceDistance("Aeróbico intenso", 200, "5x200")).toBe(200);
      expect(getReferenceDistance("Aeróbico medio", 400, "3x400")).toBe(400);

      // Velocidad uses 50m
      expect(getReferenceDistance("Velocidad", 100, "1x100")).toBe(50);

      // Aeróbico ligero & Suave use 100m
      expect(getReferenceDistance("Aeróbico ligero", 50, "8x50")).toBe(100);
      expect(getReferenceDistance("Suave", 200, "1x200")).toBe(100);
    });
  });

  describe("calculateIntensityZone", () => {
    const mockPbs: PersonalBest[] = [
      { nombre: "Adrian", estilo: "crol", distancia: 100, tiempo: "1:00.0", fecha: "2026-01-01", piscina: "25m" },
      { nombre: "Adrian", estilo: "crol", distancia: 50, tiempo: "28.0", fecha: "2026-01-01", piscina: "25m" },
      { nombre: "Adrian", estilo: "crol", distancia: 200, tiempo: "2:10.0", fecha: "2026-01-01", piscina: "25m" },
    ];

    it("should calculate correctly based on 25m normalized paces", () => {
      // Training: 4x50 crol, average time: 32.5s, pool: 50m.
      // Series total distance of inner block is 200m.
      // 1. Convert series rep to 25m: 32.5 - 1.6 * (50/100) = 32.5 - 0.8 = 31.7s per 50m.
      // 2. Series pace per 100m: 31.7 * (100 / 50) = 63.4s/100m.
      // 3. Target distance is 200m (since VO2Max uses total block distance 200m).
      // 4. PB 200m is 2:10.0 (130s). Pool is 25m.
      // 5. PB pace per 100m in 25m: 130 * (100 / 200) = 65s/100m.
      // 6. Percentage: (65 / 63.4) * 100 = 102.5%
      const result = calculateIntensityZone("4x50", "32.5", "crol", mockPbs, "50m", "VO2Max");
      expect(result).not.toBeNull();
      expect(result!.percentage).toBe(102.5);
      expect(result!.pbUsed.distancia).toBe(200);
      expect(result!.pbConverted).toBe(true); // PB pool 25m vs training pool 50m
    });

    it("should return null if there is no PB for the target distance", () => {
      // Looking for VO2Max on 5x400 (target distance 400m), but 400m PB doesn't exist
      const result = calculateIntensityZone("5x400", "5:00.0", "crol", mockPbs, "25m", "VO2Max");
      expect(result).toBeNull();
    });
  });
});
