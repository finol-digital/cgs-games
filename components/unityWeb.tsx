"use client";
import { Unity, useUnityContext } from "react-unity-webgl";

export default function UnityWeb({
  url = "https://www.cardgamesimulator.com/games/Standard/Standard.json",
}: {
  url?: string;
}) {
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
