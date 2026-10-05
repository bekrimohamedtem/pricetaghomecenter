import { NextResponse } from "next/server";
import { genererDescription } from "@/lib/gemini";

export async function POST(request) {
  try {
    const corps = await request.json();
    const resultat = await genererDescription(corps.designation || "", corps.reference || "");
    return NextResponse.json(resultat);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Génération impossible." },
      { status: error.status || 500 }
    );
  }
}
