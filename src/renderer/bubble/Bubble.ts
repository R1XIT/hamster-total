export interface BubbleButton {
  label: string;
  onClick: () => void;
}

export class Bubble {
  private element: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'bubble hidden';
    container.appendChild(this.element);
  }

  show(message: string, buttons: BubbleButton[] = []): void {
    this.element.innerHTML = '';
    const text = document.createElement('p');
    text.textContent = message;
    this.element.appendChild(text);

    for (const button of buttons) {
      const btn = document.createElement('button');
      btn.textContent = button.label;
      btn.addEventListener('click', () => {
        button.onClick();
        this.hide();
      });
      this.element.appendChild(btn);
    }

    this.element.classList.remove('hidden');
  }

  hide(): void {
    this.element.classList.add('hidden');
  }

  isVisible(): boolean {
    return !this.element.classList.contains('hidden');
  }
}
