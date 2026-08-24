import React from "react";
import { createRoot } from "react-dom/client";
import "../../app/globals.css";
import { TailTotsApp } from "../../app/components/TailTotsApp";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <TailTotsApp />
  </React.StrictMode>,
);
