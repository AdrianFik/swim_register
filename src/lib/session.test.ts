import { describe, it, expect } from "vitest";
import { groupSwimmerReps, RepCell } from "./sessionContext";

describe("Session Swimmer Repetitions Grouping Logic", () => {
  const defaultStyle = "crol";
  const defaultMaterial = "Sin material";

  it("should return empty array if no reps are active (all times are null)", () => {
    const cells: RepCell[] = [
      { time: null },
      { time: null },
      { time: null },
    ];
    const result = groupSwimmerReps(cells, defaultStyle, defaultMaterial);
    expect(result).toEqual([]);
  });

  it("should group homogeneous reps into a single block", () => {
    const cells: RepCell[] = [
      { time: "1:12.4" },
      { time: "1:13.1" },
      { time: "1:12.9" },
    ];
    const result = groupSwimmerReps(cells, defaultStyle, defaultMaterial);
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      count: 3,
      times: ["1:12.4", "1:13.1", "1:12.9"],
      style: "crol",
      material: "Sin material",
    });
  });

  it("should group consecutive reps with custom style or material correctly", () => {
    const cells: RepCell[] = [
      { time: "32.4", style: "mariposa" },
      { time: "33.1", style: "mariposa" },
      { time: "32.9", style: "mariposa", material: "aletas" },
    ];
    const result = groupSwimmerReps(cells, defaultStyle, defaultMaterial);
    
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      count: 2,
      times: ["32.4", "33.1"],
      style: "mariposa",
      material: "Sin material",
    });
    expect(result[1]).toEqual({
      count: 1,
      times: ["32.9"],
      style: "mariposa",
      material: "aletas",
    });
  });

  it("should skip empty cells (time is null) and group active ones", () => {
    const cells: RepCell[] = [
      { time: "1:12.4" },
      { time: null },
      { time: "1:13.1" },
      { time: null },
      { time: "1:12.9" },
    ];
    const result = groupSwimmerReps(cells, defaultStyle, defaultMaterial);
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      count: 3,
      times: ["1:12.4", "1:13.1", "1:12.9"],
      style: "crol",
      material: "Sin material",
    });
  });

  it("should handle multiple transitions of styles and materials", () => {
    const cells: RepCell[] = [
      { time: "1:15.0", style: "crol", material: "palas" },
      { time: "1:16.0", style: "crol", material: "palas" },
      { time: "1:20.0", style: "espalda", material: "Sin material" },
      { time: "1:14.0", style: "crol", material: "palas" },
    ];
    const result = groupSwimmerReps(cells, defaultStyle, defaultMaterial);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({
      count: 2,
      times: ["1:15.0", "1:16.0"],
      style: "crol",
      material: "palas",
    });
    expect(result[1]).toEqual({
      count: 1,
      times: ["1:20.0"],
      style: "espalda",
      material: "Sin material",
    });
    expect(result[2]).toEqual({
      count: 1,
      times: ["1:14.0"],
      style: "crol",
      material: "palas",
    });
  });
});
