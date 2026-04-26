import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import "./styles/index.css";

// Demo mode is intentionally non-persistent: refreshing while inside the
// demo flow drops the demo flag and sends you back to the dashboard so
// the demo doesn't get stuck on a sub-page across reloads. Refreshes in
// normal (non-demo) usage stay on the current page.
const navEntry = performance.getEntriesByType("navigation")[0] as
  | PerformanceNavigationTiming
  | undefined;
if (navEntry?.type === "reload") {
  const url = new URL(window.location.href);
  const wasDemo =
    url.searchParams.get("demo") === "1" ||
    sessionStorage.getItem("calyx-demo") === "1";
  if (wasDemo) {
    sessionStorage.removeItem("calyx-demo");
    window.history.replaceState({}, "", "/dashboard");
  }
}

createRoot(document.getElementById("root")!).render(<App />);
