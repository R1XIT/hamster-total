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
  // `-webkit-app-region: drag` (set on this element so the frameless window can be
  // moved by dragging the hamster) intercepts native OS drag-and-drop and prevents
  // `drop` events from ever firing. Temporarily switch to `no-drag` while an OS drag
  // is over the element, and restore `drag` once it leaves or completes.
  element.addEventListener('dragenter', () => {
    element.style.setProperty('-webkit-app-region', 'no-drag');
  });
  element.addEventListener('dragleave', () => {
    element.style.setProperty('-webkit-app-region', 'drag');
  });
  element.addEventListener('dragover', (event) => {
    event.preventDefault();
  });
  element.addEventListener('drop', (event) => {
    event.preventDefault();
    element.style.setProperty('-webkit-app-region', 'drag');
    const filePath = extractDroppedFilePath(event, getPathForFile);
    if (filePath) onFileDropped(filePath);
  });
}
