import { describe, test, expect, vi, beforeEach } from "vitest";
import { buildFileManagerTool } from "@/lib/tools/file-manager";
import { VirtualFileSystem } from "@/lib/file-system";

vi.mock("ai", () => ({
  tool: (config: unknown) => config,
}));

const createMockFs = () =>
  ({
    rename: vi.fn(),
    deleteFile: vi.fn(),
  }) as unknown as VirtualFileSystem;

describe("buildFileManagerTool", () => {
  let mockFs: VirtualFileSystem;
  let tool: { execute: (args: { command: string; path: string; new_path?: string }) => Promise<unknown> };

  beforeEach(() => {
    mockFs = createMockFs();
    tool = buildFileManagerTool(mockFs) as typeof tool;
  });

  describe("rename command", () => {
    test("renames a file successfully", async () => {
      vi.mocked(mockFs.rename).mockReturnValue(true);
      const result = await tool.execute({
        command: "rename",
        path: "/old/path.jsx",
        new_path: "/new/path.jsx",
      });
      expect(mockFs.rename).toHaveBeenCalledWith("/old/path.jsx", "/new/path.jsx");
      expect(result).toEqual({
        success: true,
        message: "Successfully renamed /old/path.jsx to /new/path.jsx",
      });
    });

    test("returns failure when rename fails", async () => {
      vi.mocked(mockFs.rename).mockReturnValue(false);
      const result = await tool.execute({
        command: "rename",
        path: "/nonexistent.jsx",
        new_path: "/dest.jsx",
      });
      expect(result).toEqual({
        success: false,
        error: "Failed to rename /nonexistent.jsx to /dest.jsx",
      });
    });

    test("returns error when new_path is missing", async () => {
      const result = await tool.execute({
        command: "rename",
        path: "/App.jsx",
      });
      expect(result).toEqual({
        success: false,
        error: "new_path is required for rename command",
      });
      expect(mockFs.rename).not.toHaveBeenCalled();
    });

    test("can rename directories", async () => {
      vi.mocked(mockFs.rename).mockReturnValue(true);
      const result = await tool.execute({
        command: "rename",
        path: "/components",
        new_path: "/ui",
      });
      expect(mockFs.rename).toHaveBeenCalledWith("/components", "/ui");
      expect(result).toMatchObject({ success: true });
    });

    test("can move files to different directories", async () => {
      vi.mocked(mockFs.rename).mockReturnValue(true);
      await tool.execute({
        command: "rename",
        path: "/App.jsx",
        new_path: "/src/App.jsx",
      });
      expect(mockFs.rename).toHaveBeenCalledWith("/App.jsx", "/src/App.jsx");
    });
  });

  describe("delete command", () => {
    test("deletes a file successfully", async () => {
      vi.mocked(mockFs.deleteFile).mockReturnValue(true);
      const result = await tool.execute({
        command: "delete",
        path: "/App.jsx",
      });
      expect(mockFs.deleteFile).toHaveBeenCalledWith("/App.jsx");
      expect(result).toEqual({
        success: true,
        message: "Successfully deleted /App.jsx",
      });
    });

    test("returns failure when file does not exist", async () => {
      vi.mocked(mockFs.deleteFile).mockReturnValue(false);
      const result = await tool.execute({
        command: "delete",
        path: "/nonexistent.jsx",
      });
      expect(result).toEqual({
        success: false,
        error: "Failed to delete /nonexistent.jsx",
      });
    });

    test("can delete nested files", async () => {
      vi.mocked(mockFs.deleteFile).mockReturnValue(true);
      const result = await tool.execute({
        command: "delete",
        path: "/components/Button/index.jsx",
      });
      expect(mockFs.deleteFile).toHaveBeenCalledWith("/components/Button/index.jsx");
      expect(result).toMatchObject({ success: true });
    });

    test("does not call rename when deleting", async () => {
      vi.mocked(mockFs.deleteFile).mockReturnValue(true);
      await tool.execute({ command: "delete", path: "/App.jsx" });
      expect(mockFs.rename).not.toHaveBeenCalled();
    });
  });
});
