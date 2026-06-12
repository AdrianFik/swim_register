import { NextRequest, NextResponse } from "next/server";
import { appendTraining, TrainingData } from "@/lib/sheets";

interface SaveTrainingBody {
  personName: string;
  data: TrainingData;
}

export async function POST(request: NextRequest) {
  try {
    const body: SaveTrainingBody = await request.json();

    if (!body.personName || !body.data) {
      return NextResponse.json(
        { error: "Faltan datos: personName o data" },
        { status: 400 }
      );
    }

    await appendTraining(body.personName, body.data);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving training:", error);
    return NextResponse.json(
      { error: "Error al guardar el entrenamiento en Google Sheets." },
      { status: 500 }
    );
  }
}
