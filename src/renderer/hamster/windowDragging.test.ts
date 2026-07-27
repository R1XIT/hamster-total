// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupDraggingAnimation } from './windowDragging';

function buildStateMachine(state: string) {
  return {
    getState: vi.fn().mockReturnValue(state),
    startDragging: vi.fn(),
    stopDragging: vi.fn(),
    triggerClickAnimation: vi.fn(),
    notifyActivity: vi.fn(),
  };
}

describe('setupDraggingAnimation', () => {
  it('calls startDragging on mousedown and stopDragging on mouseup', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const stateMachine = buildStateMachine('dragging');

    setupDraggingAnimation(element, stateMachine as never);

    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(stateMachine.startDragging).toHaveBeenCalledOnce();

    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    expect(stateMachine.stopDragging).toHaveBeenCalledOnce();
  });

  it('reports screen-coordinate deltas via onDragMove while dragging', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const stateMachine = buildStateMachine('dragging');
    const onDragMove = vi.fn();

    setupDraggingAnimation(element, stateMachine as never, onDragMove);

    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, screenX: 100, screenY: 100 }));
    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, screenX: 130, screenY: 90 }));

    expect(onDragMove).toHaveBeenCalledWith(30, -10);
  });

  it('does not report movement via onDragMove before mousedown', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const stateMachine = buildStateMachine('idle');
    const onDragMove = vi.fn();

    setupDraggingAnimation(element, stateMachine as never, onDragMove);

    window.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, screenX: 130, screenY: 90 }));

    expect(onDragMove).not.toHaveBeenCalled();
  });

  it('does not call stopDragging on mouseup if not currently dragging', () => {
    const element = document.createElement('div');
    document.body.appendChild(element);
    const stateMachine = buildStateMachine('idle');

    setupDraggingAnimation(element, stateMachine as never);
    window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

    expect(stateMachine.stopDragging).not.toHaveBeenCalled();
  });

  describe('click detection', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('triggers click animation on a fast mousedown -> mouseup', () => {
      const element = document.createElement('div');
      document.body.appendChild(element);
      const stateMachine = buildStateMachine('dragging');

      setupDraggingAnimation(element, stateMachine as never);

      vi.setSystemTime(1000);
      element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

      vi.setSystemTime(1050); // 50ms later, well under the threshold
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      expect(stateMachine.triggerClickAnimation).toHaveBeenCalledOnce();
    });

    it('does not trigger click animation when mouseup happens after the click threshold', () => {
      const element = document.createElement('div');
      document.body.appendChild(element);
      const stateMachine = buildStateMachine('dragging');

      setupDraggingAnimation(element, stateMachine as never);

      vi.setSystemTime(1000);
      element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

      vi.setSystemTime(1500); // 500ms later, past the threshold
      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      expect(stateMachine.triggerClickAnimation).not.toHaveBeenCalled();
    });

    it('does not trigger click animation on mouseup with no preceding mousedown', () => {
      const element = document.createElement('div');
      document.body.appendChild(element);
      const stateMachine = buildStateMachine('idle');

      setupDraggingAnimation(element, stateMachine as never);

      window.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));

      expect(stateMachine.triggerClickAnimation).not.toHaveBeenCalled();
    });
  });
});
