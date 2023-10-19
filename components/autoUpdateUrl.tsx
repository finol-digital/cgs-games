"use client";

export default function AutoUpdateUrl({ url }: { url: string }) {
  return (
    <div>
      <p>
        {"AutoUpdateUrl: " + url + " "}
        <button onClick={() => navigator.clipboard.writeText(url)}>Copy</button>
      </p>
    </div>
  );
}
