// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { setupLupaScanTarget } from './vtDropZone';

function fileDragEvent(type: string, files: File[] = []): DragEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(event, 'dataTransfer', { value: { types: ['Files'], files } });
  return event;
}

describe('setupLupaScanTarget', () => {
  it('reveals the lupa when a file is dragged over the surface', () => {
    const lupaEl = document.createElement('div');
    lupaEl.className = 'hidden';
    const surface = document.createElement('div');
    document.body.appendChild(surface);
    setupLupaScanTarget({ lupaEl, dragSurface: surface, getPathForFile: vi.fn(), onScan: vi.fn() });

    surface.dispatchEvent(fileDragEvent('dragenter'));
    expect(lupaEl.classList.contains('hidden')).toBe(false);
  });

  it('hides the lupa again after the drag leaves', () => {
    const lupaEl = document.createElement('div');
    const surface = document.createElement('div');
    document.body.appendChild(surface);
    setupLupaScanTarget({ lupaEl, dragSurface: surface, getPathForFile: vi.fn(), onScan: vi.fn() });

    surface.dispatchEvent(fileDragEvent('dragenter'));
    surface.dispatchEvent(fileDragEvent('dragleave'));
    expect(lupaEl.classList.contains('hidden')).toBe(true);
  });

  it('routes a drop on the lupa to onScan with the resolved path', () => {
    const lupaEl = document.createElement('div');
    document.body.appendChild(lupaEl);
    const surface = document.createElement('div');
    const onScan = vi.fn();
    const fakeFile = {} as File;
    setupLupaScanTarget({
      lupaEl,
      dragSurface: surface,
      getPathForFile: () => 'C:\\Users\\vlad\\Downloads\\f.exe',
      onScan,
    });

    lupaEl.dispatchEvent(fileDragEvent('drop', [fakeFile]));
    expect(onScan).toHaveBeenCalledWith('C:\\Users\\vlad\\Downloads\\f.exe');
    expect(lupaEl.classList.contains('hidden')).toBe(true);
  });

  it('ignores a drop on the lupa with no files', () => {
    const lupaEl = document.createElement('div');
    document.body.appendChild(lupaEl);
    const onScan = vi.fn();
    setupLupaScanTarget({ lupaEl, dragSurface: document.createElement('div'), getPathForFile: vi.fn(), onScan });

    lupaEl.dispatchEvent(fileDragEvent('drop', []));
    expect(onScan).not.toHaveBeenCalled();
  });
});
