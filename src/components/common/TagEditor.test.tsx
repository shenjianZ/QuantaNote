import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, setup } from "../../test/test-utils";
import { useTagStore } from "../../stores/tagStore";
import { TagEditor } from "./TagEditor";

describe("TagEditor", () => {
  beforeEach(() => {
    useTagStore.setState({
      tags: [
        { name: "rust", color: "cyan" },
        { name: "tauri", color: "blue" },
      ],
      itemTags: [],
      loading: false,
      error: null,
      createTag: vi.fn().mockResolvedValue(undefined),
    });
  });

  it("adds an existing tag from the select", async () => {
    const onChange = vi.fn();
    const { user } = setup(<TagEditor selectedTags={["rust"]} onChange={onChange} />);

    await user.selectOptions(screen.getByRole("combobox"), "tauri");

    expect(onChange).toHaveBeenCalledWith(["rust", "tauri"]);
  });

  it("creates and selects a new tag", async () => {
    const createTag = vi.fn().mockResolvedValue(undefined);
    const onChange = vi.fn();
    useTagStore.setState({ createTag });
    const { user } = setup(<TagEditor selectedTags={[]} onChange={onChange} />);

    await user.click(screen.getByTitle("新建标签"));
    await user.type(screen.getByPlaceholderText("标签名"), "资料");
    await user.click(screen.getByRole("button", { name: "添加" }));

    expect(createTag).toHaveBeenCalledWith("资料", "cyan");
    expect(onChange).toHaveBeenCalledWith(["资料"]);
  });

  it("removes a selected tag", async () => {
    const onChange = vi.fn();
    const { user } = setup(<TagEditor selectedTags={["rust", "tauri"]} onChange={onChange} />);

    await user.click(screen.getAllByRole("button")[0]);

    expect(onChange).toHaveBeenCalledWith(["tauri"]);
  });
});
