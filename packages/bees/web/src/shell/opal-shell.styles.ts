import { css } from "lit";
export const styles = css`
  :host {
    display: flex;
    flex-direction: column;
    height: 100vh;
    font-family: var(--cg-font-sans, "Inter", system-ui, sans-serif);
    color: var(--cg-color-on-surface, #e5e1e6);
    background: var(--cg-color-surface-dim, #1a1b1e);
    overflow: hidden;
  }
`;
