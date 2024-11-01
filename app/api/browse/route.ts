import { getAllGames } from "@/lib/firebase/firestore";
import { NextResponse } from "next/server";

export async function GET() {
  const allGames = await getAllGames();
  return new NextResponse(JSON.stringify(allGames), {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
