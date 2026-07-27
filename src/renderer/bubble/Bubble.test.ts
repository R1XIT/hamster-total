// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { Bubble } from './Bubble';

describe('Bubble', () => {
  it('is hidden by default', () => {
    const container = document.createElement('div');
    const bubble = new Bubble(container);
    expect(bubble.isVisible()).toBe(false);
  });

  it('shows a message with buttons and invokes onClick, then hides', () => {
    const container = document.createElement('div');
    const bubble = new Bubble(container);
    const onDelete = vi.fn();

    bubble.show('Threat found', [{ label: 'Удалить', onClick: onDelete }]);
    expect(bubble.isVisible()).toBe(true);

    const button = container.querySelector('button') as HTMLButtonElement;
    expect(button.textContent).toBe('Удалить');
    button.click();

    expect(onDelete).toHaveBeenCalledOnce();
    expect(bubble.isVisible()).toBe(false);
  });
});
