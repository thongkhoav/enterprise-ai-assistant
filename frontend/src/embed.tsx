import React from "react";
import ReactDOM from "react-dom/client";

import { EmbedApp } from "./EmbedApp";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <EmbedApp />
  </React.StrictMode>,
);
