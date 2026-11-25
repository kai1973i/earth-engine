import { createRoot } from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import "@terrascope/ui-kit/styles.css";
import "./app.css";
import { App } from "./App.js";

const root = document.getElementById("app");
if (!root) throw new Error("The application root element is missing.");

createRoot(root).render(<App />);
