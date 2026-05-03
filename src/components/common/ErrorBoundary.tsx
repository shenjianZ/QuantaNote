import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import i18n from "../../i18n";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="grid h-screen w-screen place-items-center bg-[var(--app-bg)] p-8">
          <div className="flex max-w-md flex-col items-center text-center">
            <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-red-500/10 text-red-400">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <h1 className="text-lg font-semibold text-[var(--text)]">
              {i18n.t("common:error.appError")}
            </h1>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {this.state.error?.message || i18n.t("common:error.unknownError")}
            </p>
            <button
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              type="button"
              onClick={this.handleReset}
            >
              <RotateCcw className="h-4 w-4" />
              {i18n.t("common:buttons.retry")}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
