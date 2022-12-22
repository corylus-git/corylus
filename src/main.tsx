import React from "react";
import ReactDOM from "react-dom/client";
import "./style.css";
import '@szhsin/react-menu/dist/index.css';
import '@szhsin/react-menu/dist/transitions/slide.css';
import { Application } from "./components/Application";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Application />
  </React.StrictMode>
);
