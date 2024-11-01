import { getAllGames } from "@/lib/firebase/firestore";
import { NextRequest, NextResponse } from "next/server";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS(req: NextRequest) {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  const allGames = await getAllGames();
  return new Response(JSON.stringify(allGames), {
    status: 200,
    headers: corsHeaders
  });
}
