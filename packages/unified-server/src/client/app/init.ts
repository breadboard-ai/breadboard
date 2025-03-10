// An empty "export" line convinces LSPs that this is an ESModule file, and
// that top-level "await" is ok
export {};

async function fetchBoard() {
  const boardUrl = window.location.pathname.replace("app", "board/boards");
  const response = await fetch(boardUrl);
  if (!response.ok) {
    throw new Error("Failed to fetch board");
  }

  return response.json();
}
const board = await fetchBoard();

// TODO Make an app view
console.log(JSON.stringify(board));
