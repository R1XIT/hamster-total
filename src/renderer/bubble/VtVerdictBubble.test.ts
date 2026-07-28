// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { VtVerdictBubble, VtVerdictView } from './VtVerdictBubble';

const cleanView: VtVerdictView = {
  clean: 58,
  total: 70,
  detected: 0,
  engines: [{ name: 'EngineA', passed: true }],
};

const dirtyView: VtVerdictView = {
  clean: 60,
  total: 70,
  detected: 10,
  engines: [
    { name: 'EngineA', passed: true },
    { name: 'EngineC', passed: false },
  ],
};

describe('VtVerdictBubble', () => {
  it('is hidden by default', () => {
    const bubble = new VtVerdictBubble(document.createElement('div'));
    expect(bubble.isVisible()).toBe(false);
  });

  it('renders "Прошёл X / Y" and shows the bubble', () => {
    const container = document.createElement('div');
    const bubble = new VtVerdictBubble(container);
    bubble.show(cleanView, { onDelete: vi.fn(), onKeep: vi.fn() });
    expect(bubble.isVisible()).toBe(true);
    expect(container.querySelector('.vt-count')?.textContent).toBe('Прошёл 58 / 70');
    // Guards against a class-name regression: the card must inherit the
    // proven `.bubble` shell (position/size/background) or it renders
    // unstyled and off-screen in the small frameless window.
    expect(container.querySelector('.bubble.vt-bubble')).not.toBeNull();
  });

  it('marks the count as danger when there are detections', () => {
    const container = document.createElement('div');
    new VtVerdictBubble(container).show(dirtyView, { onDelete: vi.fn(), onKeep: vi.fn() });
    expect(container.querySelector('.vt-count')?.classList.contains('danger')).toBe(true);
  });

  it('toggles the engine list, rendering ✓/✗ per engine', () => {
    const container = document.createElement('div');
    new VtVerdictBubble(container).show(dirtyView, { onDelete: vi.fn(), onKeep: vi.fn() });
    const list = container.querySelector('.vt-engines') as HTMLElement;
    expect(list.classList.contains('hidden')).toBe(true);
    const items = list.querySelectorAll('li');
    expect(items[0].textContent).toBe('✓ EngineA');
    expect(items[1].textContent).toBe('✗ EngineC');

    const toggle = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent === 'Список антивирусов'
    ) as HTMLButtonElement;
    toggle.click();
    expect(list.classList.contains('hidden')).toBe(false);
  });

  it('invokes onDelete / onKeep and hides', () => {
    const container = document.createElement('div');
    const bubble = new VtVerdictBubble(container);
    const onDelete = vi.fn();
    const onKeep = vi.fn();
    bubble.show(cleanView, { onDelete, onKeep });

    const del = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Удалить') as HTMLButtonElement;
    del.click();
    expect(onDelete).toHaveBeenCalledOnce();
    expect(bubble.isVisible()).toBe(false);

    bubble.show(cleanView, { onDelete, onKeep });
    const keep = Array.from(container.querySelectorAll('button')).find((b) => b.textContent === 'Оставить') as HTMLButtonElement;
    keep.click();
    expect(onKeep).toHaveBeenCalledOnce();
    expect(bubble.isVisible()).toBe(false);
  });
});
