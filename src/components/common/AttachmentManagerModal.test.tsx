import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { setup } from "../../test/test-utils";
import { AttachmentManagerModal } from "./AttachmentManagerModal";
import { useAttachmentStore } from "../../stores/attachmentStore";

vi.mock("@tauri-apps/plugin-opener", () => ({
  openPath: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (p: string) => `asset://localhost/${p}`,
  invoke: vi.fn(),
}));

describe("AttachmentManagerModal", () => {
  const onClose = vi.fn();
  const deleteAttachmentMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAttachmentStore.setState({
      attachments: [],
      loading: false,
      error: null,
      fetchAttachments: vi.fn(),
      addAttachment: vi.fn(),
      deleteAttachment: deleteAttachmentMock,
    });
  });

  it("shows empty state when no attachments", () => {
    setup(
      <AttachmentManagerModal open={true} onClose={onClose} itemId="item-1" />
    );
    expect(screen.getByText("暂无附件")).toBeInTheDocument();
  });

  it("lists attachments with filename and size", () => {
    useAttachmentStore.setState({
      attachments: [
        {
          id: "att-1",
          item_id: "item-1",
          filename: "test.pdf",
          file_path: "/path/test.pdf",
          mime_type: "application/pdf",
          file_size: 2048,
          created_at: "2026-01-01",
        },
      ],
    });

    setup(
      <AttachmentManagerModal open={true} onClose={onClose} itemId="item-1" />
    );
    expect(screen.getByText("test.pdf")).toBeInTheDocument();
    expect(screen.getByText(/2\.0 KB/)).toBeInTheDocument();
  });

  it("calls deleteAttachment on delete click", async () => {
    useAttachmentStore.setState({
      attachments: [
        {
          id: "att-1",
          item_id: "item-1",
          filename: "test.txt",
          file_path: "/path/test.txt",
          mime_type: "text/plain",
          file_size: 100,
          created_at: "2026-01-01",
        },
      ],
    });

    const { user } = setup(
      <AttachmentManagerModal open={true} onClose={onClose} itemId="item-1" />
    );

    const deleteBtn = screen.getByTitle("删除附件");
    await user.click(deleteBtn);
    expect(deleteAttachmentMock).toHaveBeenCalledWith("att-1");
  });

  it("shows image thumbnail for image mime", () => {
    useAttachmentStore.setState({
      attachments: [
        {
          id: "att-2",
          item_id: "item-1",
          filename: "photo.png",
          file_path: "/path/photo.png",
          mime_type: "image/png",
          file_size: 5000,
          created_at: "2026-01-01",
        },
      ],
    });

    const { container } = setup(
      <AttachmentManagerModal open={true} onClose={onClose} itemId="item-1" />
    );
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toContain("asset://localhost/");
  });

  it("calls fetchAttachments on open with itemId", () => {
    const fetchMock = vi.fn();
    useAttachmentStore.setState({ fetchAttachments: fetchMock });

    setup(
      <AttachmentManagerModal open={true} onClose={onClose} itemId="item-1" />
    );
    expect(fetchMock).toHaveBeenCalledWith("item-1");
  });
});
