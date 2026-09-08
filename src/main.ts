import "./styles.css";
import { initCardAssets } from "./card";
import { initApp } from "./ui/app";

void initCardAssets();
void initApp();

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      /* dev server has no dist/sw.js, and older browsers just won't offline-cache */
    });
  });
}
