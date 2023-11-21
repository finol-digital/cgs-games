"use client";

export default function AutoUpdateUrl({ url }: { url: string }) {
  return (
    <div>
      <p>AutoUpdateUrl: </p>
      <code className="url-snippet">{`${url}`}</code>
      <button onClick={() => navigator.clipboard.writeText(url)}>Copy</button>
    </div>
  );
}
