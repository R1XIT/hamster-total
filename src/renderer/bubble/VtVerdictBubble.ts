export interface VtVerdictView {
  clean: number;
  total: number;
  detected: number;
  engines: { name: string; passed: boolean }[];
}

export interface VtVerdictBubbleCallbacks {
  onDelete: () => void;
  onKeep: () => void;
}

export class VtVerdictBubble {
  private element: HTMLDivElement;

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'vt-bubble hidden';
    container.appendChild(this.element);
  }

  show(view: VtVerdictView, cb: VtVerdictBubbleCallbacks): void {
    this.element.innerHTML = '';

    const count = document.createElement('p');
    count.className = view.detected > 0 ? 'vt-count danger' : 'vt-count';
    count.textContent = `Прошёл ${view.clean} / ${view.total}`;
    this.element.appendChild(count);

    const list = document.createElement('ul');
    list.className = 'vt-engines hidden';
    for (const engine of view.engines) {
      const li = document.createElement('li');
      li.textContent = `${engine.passed ? '✓' : '✗'} ${engine.name}`;
      list.appendChild(li);
    }

    const toggle = document.createElement('button');
    toggle.textContent = 'Список антивирусов';
    toggle.addEventListener('click', () => list.classList.toggle('hidden'));
    this.element.appendChild(toggle);
    this.element.appendChild(list);

    const actions = document.createElement('div');
    actions.className = 'vt-actions';
    const del = document.createElement('button');
    del.textContent = 'Удалить';
    del.addEventListener('click', () => {
      cb.onDelete();
      this.hide();
    });
    const keep = document.createElement('button');
    keep.textContent = 'Оставить';
    keep.addEventListener('click', () => {
      cb.onKeep();
      this.hide();
    });
    actions.appendChild(del);
    actions.appendChild(keep);
    this.element.appendChild(actions);

    this.element.classList.remove('hidden');
  }

  hide(): void {
    this.element.classList.add('hidden');
  }

  isVisible(): boolean {
    return !this.element.classList.contains('hidden');
  }
}
