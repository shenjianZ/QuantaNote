import { useEffect, useRef } from "react";
import Vditor from "vditor";
import "vditor/dist/index.css";

interface VditorEditorProps {
  initialValue: string;
  onChange: (value: string) => void;
  theme?: "dark" | "light";
}

export function VditorEditor({ initialValue, onChange, theme = "dark" }: VditorEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const vditorRef = useRef<Vditor | null>(null);
  const onChangeRef = useRef(onChange);
  const skipNextChange = useRef(false);
  const readyRef = useRef(false);

  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;
    readyRef.current = false;

    const vditor = new Vditor(containerRef.current, {
      mode: "ir",
      height: "100%",
      theme: theme === "dark" ? "dark" : "classic",
      icon: "ant",
      cache: { enable: false },
      value: initialValue,
      input: (value) => {
        if (skipNextChange.current) {
          skipNextChange.current = false;
          return;
        }
        onChangeRef.current(value);
      },
      placeholder: "开始输入...",
      toolbar: [
        "headings", "bold", "italic", "strike", "|",
        "list", "ordered-list", "check", "|",
        "quote", "code", "inline-code", "|",
        "link", "table", "|",
        "undo", "redo",
      ],
      preview: {
        theme: { current: theme === "dark" ? "dark" : "light" },
      },
      counter: { enable: true },
      after: () => {
        readyRef.current = true;
      },
    });

    vditorRef.current = vditor;

    return () => {
      try {
        if (readyRef.current) {
          vditor.destroy();
        }
      } catch { /* ignore */ }
      vditorRef.current = null;
      readyRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync external content changes
  useEffect(() => {
    const vditor = vditorRef.current;
    if (!vditor || !readyRef.current) return;
    const current = vditor.getValue();
    if (current !== initialValue) {
      skipNextChange.current = true;
      vditor.setValue(initialValue);
    }
  }, [initialValue]);

  // Sync theme changes
  useEffect(() => {
    const vditor = vditorRef.current;
    if (!vditor || !readyRef.current) return;
    try {
      vditor.setTheme(
        theme === "dark" ? "dark" : "classic",
        theme === "dark" ? "dark" : "light",
        theme === "dark" ? "dark" : "classic",
      );
    } catch { /* ignore if not initialized yet */ }
  }, [theme]);

  return <div ref={containerRef} style={{ height: "100%" }} />;
}
