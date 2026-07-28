export interface VtDropZoneOptions {
  lupaEl: HTMLElement;
  dragSurface: EventTarget;
  getPathForFile: (file: File) => string;
  onScan: (filePath: string) => void;
}

function isFileDrag(event: DragEvent): boolean {
  const types = event.dataTransfer?.types;
  return types ? Array.from(types).includes('Files') : false;
}

export function setupLupaScanTarget(opts: VtDropZoneOptions): void {
  const { lupaEl, dragSurface, getPathForFile, onScan } = opts;
  let depth = 0;

  const show = (): void => lupaEl.classList.remove('hidden');
  const hide = (): void => {
    depth = 0;
    lupaEl.classList.add('hidden');
  };

  dragSurface.addEventListener('dragenter', (event) => {
    if (!isFileDrag(event as DragEvent)) return;
    depth += 1;
    show();
  });
  dragSurface.addEventListener('dragover', (event) => (event as DragEvent).preventDefault());
  dragSurface.addEventListener('dragleave', () => {
    depth -= 1;
    if (depth <= 0) hide();
  });
  dragSurface.addEventListener('drop', () => hide());
  window.addEventListener('dragend', () => hide());

  lupaEl.addEventListener('dragover', (event) => event.preventDefault());
  lupaEl.addEventListener('drop', (event) => {
    const drag = event as DragEvent;
    drag.preventDefault();
    drag.stopPropagation();
    hide();
    const files = drag.dataTransfer?.files;
    if (!files || files.length === 0) return;
    onScan(getPathForFile(files[0]));
  });
}
