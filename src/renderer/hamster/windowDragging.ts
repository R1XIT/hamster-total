import { HamsterStateMachine } from './HamsterStateMachine';

const CLICK_MAX_DURATION_MS = 200;

export function setupDraggingAnimation(element: HTMLElement, stateMachine: HamsterStateMachine): void {
  let mouseDownAt: number | null = null;

  element.addEventListener('mousedown', () => {
    mouseDownAt = Date.now();
    stateMachine.startDragging();
  });
  window.addEventListener('mouseup', () => {
    const wasDragging = stateMachine.getState() === 'dragging';
    if (wasDragging) {
      stateMachine.stopDragging();
    }
    if (mouseDownAt !== null && Date.now() - mouseDownAt < CLICK_MAX_DURATION_MS) {
      stateMachine.triggerClickAnimation();
    }
    mouseDownAt = null;
  });
}
