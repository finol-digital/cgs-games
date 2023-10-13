"use client";
import { Unity, useUnityContext } from "react-unity-webgl";

export default function Page({ params }: { params: { slug: string } }) {
  const { unityProvider } = useUnityContext({
    loaderUrl: "/Unity/WebGL.loader.js",
    dataUrl: "/Unity/WebGL.data",
    frameworkUrl: "/Unity/WebGL.framework.js",
    codeUrl: "/Unity/WebGL.wasm",
  });

  return (
    <>
      <Unity unityProvider={unityProvider} />
    </>
  );
}
