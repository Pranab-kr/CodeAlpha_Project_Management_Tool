import { Component, type ErrorInfo, type ReactNode } from "react";
import ErrorPage from "../pages/ErrorPage";

interface ErrorBoundaryState {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error("Unhandled UI error", error, info.componentStack);
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <ErrorPage onReload={() => window.location.reload()} />;
    }
    return this.props.children;
  }
}
