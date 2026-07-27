// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { extractDroppedFilePath } from './dragAndDrop';

describe('extractDroppedFilePath', () => {
  it('returns null when there are no files', () => {
    const event = { dataTransfer: { files: [] } } as unknown as DragEvent;
    const getPathForFile = vi.fn();
    expect(extractDroppedFilePath(event, getPathForFile)).toBeNull();
  });

  it('returns the resolved path of the first dropped file', () => {
    const fakeFile = {} as File;
    const event = { dataTransfer: { files: [fakeFile] } } as unknown as DragEvent;
    const getPathForFile = vi.fn().mockReturnValue('C:\\Users\\vlad\\Downloads\\file.exe');

    const result = extractDroppedFilePath(event, getPathForFile);

    expect(result).toBe('C:\\Users\\vlad\\Downloads\\file.exe');
    expect(getPathForFile).toHaveBeenCalledWith(fakeFile);
  });
});

describe('setupDragAndDrop', () => {
  // Note: jsdom's CSSOM (cssstyle) does not recognize the non-standard
  // `-webkit-app-region` property — it silently drops it regardless of whether it's
  // set via setProperty, cssText, or the style attribute (confirmed by direct jsdom
  // experimentation). Real Chromium/Electron supports it fine (it's already used in
  // index.html), so we assert via a spy on setProperty rather than reading the value
  // back through the CSSOM.
  it('toggles -webkit-app-region to no-drag on dragenter and back to drag on dragleave', async () => {
    const { setupDragAndDrop } = await import('./dragAndDrop');
    const element = document.createElement('div');
    document.body.appendChild(element);
    const setPropertySpy = vi.spyOn(element.style, 'setProperty');

    setupDragAndDrop(element, vi.fn(), vi.fn());

    element.dispatchEvent(new Event('dragenter', { bubbles: true }));
    expect(setPropertySpy).toHaveBeenLastCalledWith('-webkit-app-region', 'no-drag');

    element.dispatchEvent(new Event('dragleave', { bubbles: true }));
    expect(setPropertySpy).toHaveBeenLastCalledWith('-webkit-app-region', 'drag');
  });

  it('reverts -webkit-app-region to drag on drop', async () => {
    const { setupDragAndDrop } = await import('./dragAndDrop');
    const element = document.createElement('div');
    document.body.appendChild(element);
    const setPropertySpy = vi.spyOn(element.style, 'setProperty');

    setupDragAndDrop(element, vi.fn(), vi.fn());

    element.dispatchEvent(new Event('dragenter', { bubbles: true }));
    expect(setPropertySpy).toHaveBeenLastCalledWith('-webkit-app-region', 'no-drag');

    const dropEvent = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(dropEvent, 'dataTransfer', { value: { files: [] } });
    element.dispatchEvent(dropEvent);
    expect(setPropertySpy).toHaveBeenLastCalledWith('-webkit-app-region', 'drag');
  });
});
