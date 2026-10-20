import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import "./index.css";
import EntryRouter from "./EntryRouter.jsx";
import AppUpdates from "./AppUpdates.jsx";
import "./Product.css";
import "./Dark.css";
import "./Member.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <EntryRouter />
    <AppUpdates />
  </StrictMode>,
);
