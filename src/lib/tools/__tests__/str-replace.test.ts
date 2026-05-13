import { describe, test, expect, vi, beforeEach } from "vitest";
import { buildStrReplaceTool } from "@/lib/tools/str-replace";
import { VirtualFileSystem } from "@/lib/file-system";

const createMockFs = () =>
  ({
    viewFile: vi.fn(),
    createFileWithParents: vi.fn(),
    replaceInFile: vi.fn(),
    insertInFile: vi.fn(),
    rename: vi.fn(),
    deleteFile: vi.fn(),
    getAllFiles: vi.fn(),
  }) as unknown as VirtualFileSystem;

describe("buildStrReplaceTool", () => {
  let mockFs: VirtualFileSystem;
  let tool: ReturnType<typeof buildStrReplaceTool>;

  beforeEach(() => {
    mockFs = createMockFs();
    tool = buildStrReplaceTool(mockFs);
  });

  test("has the correct tool id", () => {
    expect(tool.id).toBe("str_replace_editor");
  });

  describe("view command", () => {
    test("calls viewFile with path", async () => {
      vi.mocked(mockFs.viewFile).mockReturnValue("line 1\nline 2");
      const result = await tool.execute({
        command: "view",
        path: "/App.jsx",
      });
      expect(mockFs.viewFile).toHaveBeenCalledWith("/App.jsx", undefined);
      expect(result).toBe("line 1\nline 2");
    });

    test("passes view_range when provided", async () => {
      vi.mocked(mockFs.viewFile).mockReturnValue("line 1");
      await tool.execute({ command: "view", path: "/App.jsx", view_range: [1, 5] });
      expect(mockFs.viewFile).toHaveBeenCalledWith("/App.jsx", [1, 5]);
    });

    test("passes undefined view_range when omitted", async () => {
      vi.mocked(mockFs.viewFile).mockReturnValue("");
      await tool.execute({ command: "view", path: "/App.jsx" });
      expect(mockFs.viewFile).toHaveBeenCalledWith("/App.jsx", undefined);
    });
  });

  describe("create command", () => {
    test("calls createFileWithParents with path and content", async () => {
      vi.mocked(mockFs.createFileWithParents).mockReturnValue("Created /App.jsx");
      const result = await tool.execute({
        command: "create",
        path: "/App.jsx",
        file_text: "const App = () => <div>Hello</div>;",
      });
      expect(mockFs.createFileWithParents).toHaveBeenCalledWith(
        "/App.jsx",
        "const App = () => <div>Hello</div>;"
      );
      expect(result).toBe("Created /App.jsx");
    });

    test("uses empty string when file_text is omitted", async () => {
      vi.mocked(mockFs.createFileWithParents).mockReturnValue("Created /empty.js");
      await tool.execute({ command: "create", path: "/empty.js" });
      expect(mockFs.createFileWithParents).toHaveBeenCalledWith("/empty.js", "");
    });

    test("creates nested file paths", async () => {
      vi.mocked(mockFs.createFileWithParents).mockReturnValue(
        "Created /components/Button.jsx"
      );
      await tool.execute({
        command: "create",
        path: "/components/Button.jsx",
        file_text: "export const Button = () => <button />;",
      });
      expect(mockFs.createFileWithParents).toHaveBeenCalledWith(
        "/components/Button.jsx",
        "export const Button = () => <button />;"
      );
    });
  });

  describe("str_replace command", () => {
    test("calls replaceInFile with old and new strings", async () => {
      vi.mocked(mockFs.replaceInFile).mockReturnValue("Replaced in /App.jsx");
      const result = await tool.execute({
        command: "str_replace",
        path: "/App.jsx",
        old_str: "Hello",
        new_str: "World",
      });
      expect(mockFs.replaceInFile).toHaveBeenCalledWith("/App.jsx", "Hello", "World");
      expect(result).toBe("Replaced in /App.jsx");
    });

    test("uses empty strings when old_str and new_str are omitted", async () => {
      vi.mocked(mockFs.replaceInFile).mockReturnValue("Replaced");
      await tool.execute({ command: "str_replace", path: "/App.jsx" });
      expect(mockFs.replaceInFile).toHaveBeenCalledWith("/App.jsx", "", "");
    });

    test("handles multiline replacements", async () => {
      vi.mocked(mockFs.replaceInFile).mockReturnValue("Replaced");
      await tool.execute({
        command: "str_replace",
        path: "/App.jsx",
        old_str: "line1\nline2\nline3",
        new_str: "new_line1\nnew_line2",
      });
      expect(mockFs.replaceInFile).toHaveBeenCalledWith(
        "/App.jsx",
        "line1\nline2\nline3",
        "new_line1\nnew_line2"
      );
    });
  });

  describe("insert command", () => {
    test("calls insertInFile with line number and content", async () => {
      vi.mocked(mockFs.insertInFile).mockReturnValue("Inserted in /App.jsx");
      const result = await tool.execute({
        command: "insert",
        path: "/App.jsx",
        insert_line: 5,
        new_str: "import React from 'react';",
      });
      expect(mockFs.insertInFile).toHaveBeenCalledWith(
        "/App.jsx",
        5,
        "import React from 'react';"
      );
      expect(result).toBe("Inserted in /App.jsx");
    });

    test("defaults insert_line to 0 when omitted", async () => {
      vi.mocked(mockFs.insertInFile).mockReturnValue("Inserted");
      await tool.execute({ command: "insert", path: "/App.jsx", new_str: "// comment" });
      expect(mockFs.insertInFile).toHaveBeenCalledWith("/App.jsx", 0, "// comment");
    });

    test("defaults new_str to empty string when omitted", async () => {
      vi.mocked(mockFs.insertInFile).mockReturnValue("Inserted");
      await tool.execute({ command: "insert", path: "/App.jsx", insert_line: 3 });
      expect(mockFs.insertInFile).toHaveBeenCalledWith("/App.jsx", 3, "");
    });
  });

  describe("undo_edit command", () => {
    test("returns unsupported error message", async () => {
      const result = await tool.execute({ command: "undo_edit", path: "/App.jsx" });
      expect(result).toContain("undo_edit command is not supported");
      expect(result).toContain("str_replace");
    });

    test("does not call any file system methods", async () => {
      await tool.execute({ command: "undo_edit", path: "/App.jsx" });
      expect(mockFs.viewFile).not.toHaveBeenCalled();
      expect(mockFs.createFileWithParents).not.toHaveBeenCalled();
      expect(mockFs.replaceInFile).not.toHaveBeenCalled();
      expect(mockFs.insertInFile).not.toHaveBeenCalled();
    });
  });
});
