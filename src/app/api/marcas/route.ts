import { NextRequest, NextResponse } from "next/server";
import { getMarcas, addOrUpdateMarca } from "@/lib/sheets";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const personName = searchParams.get("personName") || undefined;
    
    const marcas = await getMarcas(personName);
    return NextResponse.json(marcas);
  } catch (error) {
    console.error("Error fetching marcas:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Error al cargar marcas: ${errorMessage}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { nombre, estilo, distancia, tiempo, fecha } = body;

    if (!nombre || !estilo || !distancia || !tiempo || !fecha) {
      return NextResponse.json(
        { error: "Faltan campos obligatorios: nombre, estilo, distancia, tiempo, fecha" },
        { status: 400 }
      );
    }

    await addOrUpdateMarca(nombre, estilo, Number(distancia), tiempo, fecha);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving marca:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Error al guardar la marca personal: ${errorMessage}` },
      { status: 500 }
    );
  }
}
