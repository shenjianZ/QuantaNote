import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
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

  it("creates new tag and selects it", async () => {
    const createTagMock = vi.fn(async () => {});
    useTagStore.setState({ createTag: createTagMock });

    const { user } = setup(
      <TagPickerModal open={true} onClose={onClose} selectedTags={[]} onChange={onChange} />
    );

    const input = screen.getByPlaceholderText("标签名");
    await user.type(input, "新标签");
    await user.click(screen.getByText("添加"));

    expect(createTagMock).toHaveBeenCalledWith("新标签", "cyan");
    expect(onChange).toHaveBeenCalledWith(["新标签"]);
  });

  it("prevents duplicate tag creation but still selects", async () => {
    const createTagMock = vi.fn(async () => {});
    useTagStore.setState({ createTag: createTagMock });

    const { user } = setup(
      <TagPickerModal open={true} onClose={onClose} selectedTags={[]} onChange={onChange} />
    );

    const input = screen.getByPlaceholderText("标签名");
    await user.type(input, "rust");
    await user.click(screen.getByText("添加"));

    expect(createTagMock).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith(["rust"]);
  });
});
