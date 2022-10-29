import React from "react";
import ReactDOM from "react-dom/client";
import "./style.css";
import { Application } from "./components/Application";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Application />
  </React.StrictMode>
);
