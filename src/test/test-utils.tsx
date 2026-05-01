import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

export * from "@testing-library/react";

export function setup(ui: ReactElement) {
  return {
    user: userEvent.setup(),
    ...render(ui),
  };
}
