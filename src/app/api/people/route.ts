import { NextResponse } from "next/server";
import { getPeople } from "@/lib/sheets";

export async function GET() {
  try {
    const people = await getPeople();
    return NextResponse.json(people);
  } catch (error) {
    console.error("Error fetching people:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `Error de conexión: ${errorMessage}` },
      { status: 500 }
    );
  }
}
