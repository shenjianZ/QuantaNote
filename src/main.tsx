import "./i18n";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

const params = new URLSearchParams(window.location.search);
const mode = params.get("mode");

if (mode === "floating-ball") {
    import("./components/floatingball/FloatingBall").then(({ FloatingBall }) => {
        ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
            <React.StrictMode>
                <FloatingBall />
            </React.StrictMode>,
        );
    });
} else if (mode === "quick-note") {
    import("./components/floatingball/QuickNotePage").then(({ QuickNotePage }) => {
        ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
            <React.StrictMode>
                <QuickNotePage />
            </React.StrictMode>,
        );
    });
} else {
    ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>,
    );
}
