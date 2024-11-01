import { NextRequest, NextResponse } from "next/server";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  if (request.method === "OPTIONS") {
    return NextResponse.json({}, { headers: corsHeaders });
  }

  response.headers.append(
    "Access-Control-Allow-Origin",
    corsHeaders["Access-Control-Allow-Origin"],
  );
  response.headers.append(
    "Access-Control-Allow-Methods",
    corsHeaders["Access-Control-Allow-Methods"],
  );
  response.headers.append(
    "Access-Control-Allow-Headers",
    corsHeaders["Access-Control-Allow-Headers"],
  );

  // Further middleware processing here

  return response;
}
