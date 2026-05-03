import { Buffer } from "buffer";
import React from "react";
import ReactDOM from "react-dom/client";
import "react-docs-ui/style.css";
import { DocsApp, preloadDocsRuntime } from "react-docs-ui/docs-app";
import { MDX_COMPONENTS } from "../generated/mdx-components";
import { siteShikiBundle } from "../generated/shiki-bundle";

export function registerMdxComponents(components: Record<string, unknown>) {
    (globalThis as typeof globalThis & {
        __REACT_DOCS_UI_MDX_COMPONENTS__?: Record<string, unknown>;
    }).__REACT_DOCS_UI_MDX_COMPONENTS__ = components;
}

export function bootstrapDocsApp(components: Record<string, unknown>) {
    registerMdxComponents(components);
    preloadDocsRuntime();
}

export function startDocsApp() {
    window.Buffer = Buffer;
    bootstrapDocsApp(MDX_COMPONENTS);

    ReactDOM.createRoot(document.getElementById("root")!).render(
        React.createElement(
            React.StrictMode,
            null,
            React.createElement(DocsApp, { shikiBundle: siteShikiBundle }),
        ),
    );
}
