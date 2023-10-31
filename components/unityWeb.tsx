"use client";

import { useEffect, useState } from "react";
import { Unity, useUnityContext } from "react-unity-webgl";

export default function UnityWeb({
  url = "https://www.cardgamesimulator.com/games/Standard/Standard.json",
}: {
  url?: string;
}) {
  const { unityProvider, loadingProgression, isLoaded, sendMessage } =
    useUnityContext({
      loaderUrl: "/Unity/WebGL.loader.js",
      dataUrl: "/Unity/WebGL.data",
      frameworkUrl: "/Unity/WebGL.framework.js",
      codeUrl: "/Unity/WebGL.wasm",
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

  //  if (isLoaded === true) {
  //    sendMessage("CardGameManager", "StartGetCardGame", url);
  //  }

  return (
    <div style={{ width: "100%", height: "100%" }}>
      {!isLoaded && (
        <p>Loading CGS... {Math.round(loadingProgression * 100)}%</p>
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
