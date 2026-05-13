import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { PreviewFrame } from "@/components/preview/PreviewFrame";

vi.mock("@/lib/contexts/file-system-context", () => ({
  useFileSystem: vi.fn(),
}));

vi.mock("@/lib/transform/jsx-transformer", () => ({
  createImportMap: vi.fn(),
  createPreviewHTML: vi.fn(),
}));

vi.mock("lucide-react", () => ({
  AlertCircle: () => <div data-testid="alert-icon" />,
}));

import { useFileSystem } from "@/lib/contexts/file-system-context";
import { createImportMap, createPreviewHTML } from "@/lib/transform/jsx-transformer";

const mockUseFileSystem = vi.mocked(useFileSystem);
const mockCreateImportMap = vi.mocked(createImportMap);
const mockCreatePreviewHTML = vi.mocked(createPreviewHTML);

function setupFileSystem(files: Map<string, string> = new Map(), refreshTrigger = 0) {
  mockUseFileSystem.mockReturnValue({
    getAllFiles: vi.fn().mockReturnValue(files),
    refreshTrigger,
  } as any);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateImportMap.mockReturnValue({
    importMap: {},
    styles: "",
    errors: [],
  } as any);
  mockCreatePreviewHTML.mockReturnValue("<html><body>Preview</body></html>");
});

describe("PreviewFrame", () => {
  describe("first load state (no files)", () => {
    test("shows welcome screen on initial render with no files", () => {
      setupFileSystem(new Map());
      render(<PreviewFrame />);
      expect(screen.getByText("Welcome to UI Generator")).toBeInTheDocument();
    });

    test("shows prompt to create a component", () => {
      setupFileSystem(new Map());
      render(<PreviewFrame />);
      expect(
        screen.getByText(/Ask the AI to create your first component/i)
      ).toBeInTheDocument();
    });

    test("does not render iframe on first load with no files", () => {
      setupFileSystem(new Map());
      render(<PreviewFrame />);
      expect(screen.queryByTitle("Preview")).not.toBeInTheDocument();
    });
  });

  describe("with files present", () => {
    test("renders the preview iframe when App.jsx exists", () => {
      const files = new Map([
        ["/App.jsx", "export default function App() { return <div>Hello</div>; }"],
      ]);
      setupFileSystem(files);
      render(<PreviewFrame />);
      expect(screen.getByTitle("Preview")).toBeInTheDocument();
    });

    test("renders the iframe when App.tsx exists", () => {
      const files = new Map([
        ["/App.tsx", "export default function App() { return <div>Hello</div>; }"],
      ]);
      setupFileSystem(files);
      render(<PreviewFrame />);
      expect(screen.getByTitle("Preview")).toBeInTheDocument();
    });

    test("renders the iframe when index.jsx exists", () => {
      const files = new Map([
        ["/index.jsx", "export default function App() { return <div>Hello</div>; }"],
      ]);
      setupFileSystem(files);
      render(<PreviewFrame />);
      expect(screen.getByTitle("Preview")).toBeInTheDocument();
    });

    test("renders the iframe when index.tsx exists", () => {
      const files = new Map([
        ["/index.tsx", "export default function App() { return <div>Hello</div>; }"],
      ]);
      setupFileSystem(files);
      render(<PreviewFrame />);
      expect(screen.getByTitle("Preview")).toBeInTheDocument();
    });

    test("renders the iframe when src/App.jsx exists", () => {
      const files = new Map([
        ["/src/App.jsx", "export default function App() { return <div>Hello</div>; }"],
      ]);
      setupFileSystem(files);
      render(<PreviewFrame />);
      expect(screen.getByTitle("Preview")).toBeInTheDocument();
    });

    test("calls createImportMap with the file map", () => {
      const files = new Map([["/App.jsx", "const App = () => <div />;"]]);
      setupFileSystem(files);
      render(<PreviewFrame />);
      expect(mockCreateImportMap).toHaveBeenCalledWith(files);
    });

    test("calls createPreviewHTML with entry point and import map data", () => {
      const files = new Map([["/App.jsx", "const App = () => <div />;"]]);
      const importMapResult = { importMap: { react: "url" }, styles: "body{}", errors: [] };
      mockCreateImportMap.mockReturnValue(importMapResult as any);
      setupFileSystem(files);
      render(<PreviewFrame />);
      expect(mockCreatePreviewHTML).toHaveBeenCalledWith(
        "/App.jsx",
        importMapResult.importMap,
        importMapResult.styles,
        importMapResult.errors
      );
    });

    test("falls back to any .jsx file when no known entry point exists", () => {
      const files = new Map([["/components/Button.jsx", "export const Button = () => null;"]]);
      setupFileSystem(files);
      render(<PreviewFrame />);
      expect(screen.getByTitle("Preview")).toBeInTheDocument();
    });
  });

  describe("error states", () => {
    test("shows no preview message when files exist but none are JSX/TSX", () => {
      const files = new Map([["/styles.css", "body { margin: 0; }"]]);
      setupFileSystem(files);
      render(<PreviewFrame />);
      expect(screen.getByText("No Preview Available")).toBeInTheDocument();
    });

    test("shows alert icon in error state", () => {
      const files = new Map([["/styles.css", "body { margin: 0; }"]]);
      setupFileSystem(files);
      render(<PreviewFrame />);
      expect(screen.getByTestId("alert-icon")).toBeInTheDocument();
    });

    test("shows helpful error message when no React component found", () => {
      const files = new Map([["/README.md", "# My Project"]]);
      setupFileSystem(files);
      render(<PreviewFrame />);
      expect(screen.getByText("No Preview Available")).toBeInTheDocument();
    });

    test("re-renders correctly when refreshTrigger changes", () => {
      const files = new Map([["/App.jsx", "const App = () => <div />;"]]);
      const { rerender } = render(<PreviewFrame />);

      setupFileSystem(files, 0);
      rerender(<PreviewFrame />);
      expect(screen.getByTitle("Preview")).toBeInTheDocument();
    });
  });

  describe("iframe attributes", () => {
    test("iframe has correct title", () => {
      const files = new Map([["/App.jsx", "const App = () => <div />;"]]);
      setupFileSystem(files);
      render(<PreviewFrame />);
      const iframe = screen.getByTitle("Preview");
      expect(iframe).toBeInTheDocument();
    });

    test("iframe has border-0 class", () => {
      const files = new Map([["/App.jsx", "const App = () => <div />;"]]);
      setupFileSystem(files);
      render(<PreviewFrame />);
      const iframe = screen.getByTitle("Preview");
      expect(iframe).toHaveClass("border-0");
    });
  });
});
