import { NextRequest } from "next/server";

const stripTrailingSlash = (str: string) => {
  return str.endsWith("/") ? str.slice(0, -1) : str;
};

export async function GET(
  request: NextRequest,
  context: { params: { url: string[] } },
) {
  const [host, ...path] = [...context.params.url];
  let uri = stripTrailingSlash("https://" + host + "/" + path.join("/"));
  if (request.nextUrl.searchParams) {
    uri = uri + "?" + request.nextUrl.searchParams.toString();
  }
  const url = new URL(uri);
  console.log("Request /api/proxy GET " + url);
  const response = await fetch(url);
  return new Response(response.body);
}

async function streamToString(stream: any) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function POST(
  request: Request,
  context: { params: { url: string[] } },
) {
  const [host, ...path] = [...context.params.url];
  let uri = stripTrailingSlash("https://" + host + "/" + path.join("/"));
  const url = new URL(uri);
  const requestJson = await streamToString(request.body);
  console.log("Request /api/proxy POST " + url) + " " + requestJson;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: requestJson,
  });
  return response;
}
