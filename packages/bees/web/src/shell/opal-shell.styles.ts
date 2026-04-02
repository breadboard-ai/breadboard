import { css } from "lit";
export const styles = css`
  :host {
    display: flex;
    flex-direction: column;
    height: 100vh;
    font-family: var(--cg-font-sans, "Inter", system-ui, sans-serif);
    color: var(--cg-color-on-surface, #1c1b1f);
    background: var(--cg-color-surface-dim, #f5f3f0);
    overflow: hidden;
  }

  .shell-workspace {
    display: flex;
    flex: 1;
    overflow: hidden;
  }

  .shell-main-area {
    display: flex;
    flex-direction: column;
    flex: 1;
    overflow: hidden;
    background: var(--cg-color-surface, #fdfcfa);
  }
`;
