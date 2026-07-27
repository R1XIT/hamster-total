import { HamsterStateMachine } from './HamsterStateMachine';

const CLICK_MAX_DURATION_MS = 200;

/**
 * Wires manual window dragging + click detection onto the hamster element.
 *
 * The frameless window is moved from JS (not via CSS `-webkit-app-region: drag`)
 * because an OS drag region swallows DOM mouse and native `drop` events, which
 * broke the drag animation, wake-on-click, and file-eating. While the primary
 * button is held down we report pointer movement as screen-coordinate deltas
 * through `onDragMove`; index.ts forwards those to the main process, which
 * repositions the BrowserWindow.
 *
 * Screen coordinates (not client coordinates) are used so deltas stay correct
 * even as the window itself moves to follow the cursor.
 */
export function setupDraggingAnimation(
  element: HTMLElement,
  stateMachine: HamsterStateMachine,
  onDragMove: (dx: number, dy: number) => void = () => {}
): void {
  let mouseDownAt: number | null = null;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  element.addEventListener('mousedown', (event) => {
    mouseDownAt = Date.now();
    dragging = true;
    lastX = event.screenX;
    lastY = event.screenY;
    stateMachine.startDragging();
  });

  window.addEventListener('mousemove', (event) => {
    if (!dragging) return;
    const dx = event.screenX - lastX;
    const dy = event.screenY - lastY;
    lastX = event.screenX;
    lastY = event.screenY;
    if (dx !== 0 || dy !== 0) onDragMove(dx, dy);
  });

  window.addEventListener('mouseup', () => {
    if (dragging && stateMachine.getState() === 'dragging') {
      stateMachine.stopDragging();
    }
    dragging = false;
    if (mouseDownAt !== null && Date.now() - mouseDownAt < CLICK_MAX_DURATION_MS) {
      stateMachine.triggerClickAnimation();
    }
    mouseDownAt = null;
  });
}
