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
  it('calls onFileDropped with the resolved path of a dropped file', async () => {
    const { setupDragAndDrop } = await import('./dragAndDrop');
    const element = document.createElement('div');
    document.body.appendChild(element);
    const fakeFile = {} as File;
    const getPathForFile = vi.fn().mockReturnValue('C:\\Users\\vlad\\Downloads\\file.exe');
    const onFileDropped = vi.fn();

    setupDragAndDrop(element, getPathForFile, onFileDropped);

    const dropEvent = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(dropEvent, 'dataTransfer', { value: { files: [fakeFile] } });
    element.dispatchEvent(dropEvent);

    expect(onFileDropped).toHaveBeenCalledWith('C:\\Users\\vlad\\Downloads\\file.exe');
  });

  it('does not call onFileDropped when the drop has no files', async () => {
    const { setupDragAndDrop } = await import('./dragAndDrop');
    const element = document.createElement('div');
    document.body.appendChild(element);
    const onFileDropped = vi.fn();

    setupDragAndDrop(element, vi.fn(), onFileDropped);

    const dropEvent = new Event('drop', { bubbles: true, cancelable: true }) as DragEvent;
    Object.defineProperty(dropEvent, 'dataTransfer', { value: { files: [] } });
    element.dispatchEvent(dropEvent);

    expect(onFileDropped).not.toHaveBeenCalled();
  });
});
