import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { setup } from "../../test/test-utils";
import { TagPickerModal } from "./TagPickerModal";
import { useTagStore } from "../../stores/tagStore";

describe("TagPickerModal", () => {
  const onChange = vi.fn();
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useTagStore.setState({
      tags: [
        { name: "rust", color: "cyan" },
        { name: "react", color: "blue" },
      ],
      createTag: vi.fn(async () => {}),
    });
  });

  it("toggles tag selection on click", async () => {
    const { user } = setup(
      <TagPickerModal open={true} onClose={onClose} selectedTags={[]} onChange={onChange} />
    );

    await user.click(screen.getByText("#rust"));
    expect(onChange).toHaveBeenCalledWith(["rust"]);
  });

  it("deselects tag on second click", async () => {
    const { user } = setup(
      <TagPickerModal open={true} onClose={onClose} selectedTags={["rust"]} onChange={onChange} />
    );

    await user.click(screen.getByText("#rust"));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("filters tags by search", async () => {
    setup(
      <TagPickerModal open={true} onClose={onClose} selectedTags={[]} onChange={onChange} />
    );

    const input = screen.getByPlaceholderText("搜索标签");
    fireEvent.change(input, { target: { value: "rust" } });

    expect(screen.getByText("#rust")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("#react")).not.toBeInTheDocument();
    });
  });

  it("calls onOpenManager when manage button clicked", async () => {
    const onOpenManager = vi.fn();
    const { user } = setup(
      <TagPickerModal open={true} onClose={onClose} selectedTags={[]} onChange={onChange} onOpenManager={onOpenManager} />
    );

    await user.click(screen.getByText("管理标签..."));
    expect(onOpenManager).toHaveBeenCalled();
  });
});
