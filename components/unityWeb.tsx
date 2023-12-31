"use client";

import { useCallback, useEffect, useState } from "react";
import { Unity, useUnityContext } from "react-unity-webgl";

export default function UnityWeb({
  url = "https://www.cardgamesimulator.com/games/Standard/Standard.json",
  name = "Card Game",
}: {
  url?: string;
  name?: string;
}) {
  const [isGameReady, setIsGameReady] = useState(false);
  const [hasGameStarted, setHasGameStarted] = useState(false);
  const {
    unityProvider,
    loadingProgression,
    isLoaded,
    sendMessage,
    requestFullscreen,
    addEventListener,
    removeEventListener,
  } = useUnityContext({
    loaderUrl: "/Unity/WebGL.loader.js",
    dataUrl: "/Unity/WebGL.data",
    frameworkUrl: "/Unity/WebGL.framework.js",
    codeUrl: "/Unity/WebGL.wasm",
    streamingAssetsUrl: "/StreamingAssets",
    companyName: "Finol Digital LLC",
    productName: "Card Game Simulator",
    productVersion: "1.0.0",
  });

  // We'll use a state to store the device pixel ratio.
  const [devicePixelRatio, setDevicePixelRatio] = useState(
    window.devicePixelRatio,
  );

  useEffect(
    function () {
      // A function which will update the device pixel ratio of the Unity
      // Application to match the device pixel ratio of the browser.
      const updateDevicePixelRatio = function () {
        setDevicePixelRatio(window.devicePixelRatio);
      };
      // A media matcher which watches for changes in the device pixel ratio.
      const mediaMatcher = window.matchMedia(
        `screen and (resolution: ${devicePixelRatio}dppx)`,
      );
      // Adding an event listener to the media matcher which will update the
      // device pixel ratio of the Unity Application when the device pixel
      // ratio changes.
      mediaMatcher.addEventListener("change", updateDevicePixelRatio);
      return function () {
        // Removing the event listener when the component unmounts.
        mediaMatcher.removeEventListener("change", updateDevicePixelRatio);
      };
    },
    [devicePixelRatio],
  );

  const handleGameReady = useCallback(() => {
    setIsGameReady(true);
  }, []);

  useEffect(() => {
    addEventListener("GameReady", handleGameReady);
    return () => {
      removeEventListener("GameReady", handleGameReady);
    };
  }, [addEventListener, removeEventListener, handleGameReady]);

  if (isGameReady && !hasGameStarted) {
    sendMessage("CardGameManager", "StartGetCardGame", url);
    setHasGameStarted(true);
  }

  return (
    <div style={{ width: "100%", height: "100%" }}>
      {!isLoaded && (
        <p>Loading CGS... {Math.round(loadingProgression * 100)}%</p>
      )}
      {isLoaded && (
        <div>
          <button onClick={() => requestFullscreen(true)}>
            Enter Fullscreen
          </button>
        </div>
      )}
      <Unity
        unityProvider={unityProvider}
        style={{
          visibility: isLoaded ? "visible" : "hidden",
          width: "100%",
          height: "100%",
        }}
        devicePixelRatio={devicePixelRatio}
      />
    </div>
  );
}
