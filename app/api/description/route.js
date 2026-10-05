import { NextResponse } from "next/server";
import { enregistrerDescription } from "@/lib/excel";

export async function POST(request) {
  try {
    const corps = await request.json();
    await enregistrerDescription(corps);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error.message || "Enregistrement impossible." },
      { status: error.status || 500 }
    );
  }
}
