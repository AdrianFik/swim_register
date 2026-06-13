import { NextRequest, NextResponse } from "next/server";
import { getTrainings } from "@/lib/sheets";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personName = searchParams.get("personName");

    if (!personName) {
      return NextResponse.json(
        { error: "El parámetro personName es requerido" },
        { status: 400 }
      );
    }

    const trainings = await getTrainings(personName);
    return NextResponse.json(trainings);
  } catch (error) {
    console.error("Error fetching trainings:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Error al cargar entrenamientos: ${errorMessage}` },
      { status: 500 }
    );
  }
}
