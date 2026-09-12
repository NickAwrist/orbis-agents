import { StrictMode, Suspense, lazy } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App";

const Root =
  import.meta.env.DEV && window.location.pathname === "/dev/messages"
    ? lazy(() => import("./dev/MessageDemo"))
    : import.meta.env.DEV && window.location.pathname === "/dev/images"
      ? lazy(() => import("./dev/ImageLoadingDemo"))
      : App;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Suspense fallback={null}>
      <Root />
    </Suspense>
  </StrictMode>,
);
