"use client";

import toast, { Toaster } from "react-hot-toast";

export default function AutoUpdateUrl({ url }: { url: string }) {
  return (
    <div>
      <p>AutoUpdateUrl: </p>
      <code className="p-5 w-3/4 my-5 mx-0 ml-auto overflow-x-scroll">{`${url}`}</code>
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
