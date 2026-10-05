import { NextResponse } from "next/server";
import { lireArticles } from "@/lib/excel";

export async function GET() {
  try {
    const articles = await lireArticles();
    return NextResponse.json({ articles });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Lecture impossible." }, { status: 500 });
  }
}
