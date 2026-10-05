import { NextResponse } from "next/server";
import { integrerFichier } from "@/lib/excel";

export async function POST(request) {
  try {
    const form = await request.formData();
    const fichier = form.get("fichier");
    if (!fichier || typeof fichier.arrayBuffer !== "function") {
      return NextResponse.json({ error: "Fichier Excel manquant." }, { status: 400 });
    }
    const buffer = Buffer.from(await fichier.arrayBuffer());
    const rapport = await integrerFichier(buffer);
    return NextResponse.json(rapport);
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Comparaison impossible." },
      { status: error.status || 500 }
    );
  }
}
