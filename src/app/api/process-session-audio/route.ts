import { NextRequest, NextResponse } from "next/server";
import { processSessionAudio } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio") as File | null;
    const swimmersStr = formData.get("swimmers") as string | null;
    const configStr = formData.get("config") as string | null;
    const currentDate = formData.get("currentDate") as string | null;

    if (!audioFile || !swimmersStr || !configStr || !currentDate) {
      return NextResponse.json(
        { error: "Faltan datos: audio, swimmers, config o currentDate" },
        { status: 400 }
      );
    }

    const swimmers = JSON.parse(swimmersStr);
    const config = JSON.parse(configStr);

    const arrayBuffer = await audioFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = audioFile.type || "audio/webm";

    const extracted = await processSessionAudio(
      buffer,
      mimeType,
      swimmers,
      currentDate,
      config
    );

    return NextResponse.json(extracted);
  } catch (error) {
    console.error("Error processing session audio:", error);
    return NextResponse.json(
      { error: "Error al procesar el audio grupal con Gemini. Inténtalo de nuevo." },
      { status: 500 }
    );
  }
}
