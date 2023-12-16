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
  console.log("api/proxy GET " + url);
  const response = await fetch(url);
  return new Response(response.body);
}