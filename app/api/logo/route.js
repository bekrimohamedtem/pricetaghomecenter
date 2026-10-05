import { NextResponse } from "next/server";
import fs from "fs";
import { logoPath } from "@/lib/excel";

export async function GET() {
  const chemin = logoPath();
  if (!fs.existsSync(chemin)) {
    return NextResponse.json({ error: "Logo introuvable." }, { status: 404 });
  }
  const fichier = fs.readFileSync(chemin);
  return new NextResponse(fichier, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
