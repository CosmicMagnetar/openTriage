import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

import { AblyProvider } from "ably/react";
import { getAblyClient } from "@/lib/ably";
import { setupAxiosInterceptors } from "@/lib/axiosSetup";

// Set up global axios interceptors for Authorization headers
setupAxiosInterceptors();

const client = getAblyClient();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <AblyProvider client={client}>
      <App />
    </AblyProvider>
  </React.StrictMode>,
);
