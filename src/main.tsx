import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./rebrand.css";
import "./features.css";
import "./support.css";
import "./admin.css";
import "./backend.css";
import "./refinements.css";
import "./launch.css";
import App from "./App";
import { AccountProvider } from "./context/AccountContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AccountProvider>
      <App />
    </AccountProvider>
  </StrictMode>
);
