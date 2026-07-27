export function extractDroppedFilePath(
  event: DragEvent,
  getPathForFile: (file: File) => string
): string | null {
  const files = event.dataTransfer?.files;
  if (!files || files.length === 0) return null;
  return getPathForFile(files[0]);
}

export function setupDragAndDrop(
  element: HTMLElement,
  getPathForFile: (file: File) => string,
  onFileDropped: (filePath: string) => void
): void {
  // The hamster element no longer uses `-webkit-app-region: drag` (window moves
  // are handled manually in JS), so native file `drop` events fire normally —
  // no app-region toggling needed. We only have to preventDefault on dragover so
  // the browser accepts the drop.
  element.addEventListener('dragover', (event) => {
    event.preventDefault();
  });
  element.addEventListener('drop', (event) => {
    event.preventDefault();
    const filePath = extractDroppedFilePath(event, getPathForFile);
    if (filePath) onFileDropped(filePath);
  });
}
