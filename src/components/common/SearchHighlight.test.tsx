import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { setup } from "../../test/test-utils";
import { SearchHighlight } from "./SearchHighlight";

describe("SearchHighlight", () => {
  it("highlights matching terms without interpreting text as HTML", () => {
    setup(<SearchHighlight text="Rust <guide>" terms={["rust", "guide"]} />);

    expect(screen.getAllByTestId("search-highlight")).toHaveLength(2);
    expect(document.body.textContent).toContain("Rust <guide>");
  });

  it("prefers longer overlapping terms", () => {
    setup(<SearchHighlight text="project pro" terms={["project", "pro"]} />);

    expect(screen.getAllByTestId("search-highlight")[0]).toHaveTextContent("project");
    expect(screen.getAllByTestId("search-highlight")).toHaveLength(2);
  });
});
