import { NextRequest, NextResponse } from "next/server";
import { processAudio } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const personName = formData.get("personName") as string | null;
    const currentDate = formData.get("currentDate") as string | null;

    if (!audioFile || !personName || !currentDate) {
      return NextResponse.json(
        { error: "Faltan datos: audio, personName o currentDate" },
        { status: 400 }
      );
    }

    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = audioFile.type || "audio/webm";

    const trainingData = await processAudio(
      buffer,
      mimeType,
      personName,
      currentDate
    );

    return NextResponse.json(trainingData);
  } catch (error) {
    console.error("Error processing audio:", error);
    return NextResponse.json(
      { error: "Error al procesar el audio con Gemini. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
