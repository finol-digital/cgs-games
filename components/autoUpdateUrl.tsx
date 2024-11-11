"use client";

import toast, { Toaster } from "react-hot-toast";

export default function AutoUpdateUrl({ url }: { url: string }) {
  return (
    <div>
      <p>AutoUpdateUrl: </p>
      <code className="url-snippet">{`${url}`}</code>
      <button
        onClick={() => {
          navigator.clipboard.writeText(url);
          toast("Copied!");
        }}
      >
        Copy
      </button>
      <Toaster />
    </div>
  );
}
