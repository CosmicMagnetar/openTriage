import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

import { setupAxiosInterceptors } from "@/lib/axiosSetup";

// Set up global axios interceptors for Authorization headers
setupAxiosInterceptors();

// Live updates use Socket.io (lib/live.js); no Ably client is started.
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
