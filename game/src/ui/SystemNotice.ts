import './system-notice.css';

import type { FinalClose, OperationNotice } from '../game/room-realtime';

function countdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const pad = (value: number) => String(value).padStart(2, '0');
  const hours = Math.floor(total / 3600);
  return (hours > 0 ? `${hours}:` : '') + `${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}`;
}

const FINAL_TEXT: Record<Exclude<FinalClose, 'maintenance'>, { title: string; text: string; button: string }> = {
  replaced: {
    title: 'Café aberto em outra janela',
    text: 'Você abriu o Café Mania em outra janela ou aparelho. Só uma pode ficar conectada por vez.',
    button: 'Jogar aqui',
  },
  outdated: {
    title: 'Nova versão disponível',
    text: 'O Café Mania foi atualizado. Recarregue a página para continuar jogando.',
    button: 'Atualizar',
  },
};

/**
 * Avisos do servidor sobre a página do jogo: a faixa da manutenção programada (com a
 * contagem no relógio do servidor) e o cartão das desconexões finais. É texto de sistema,
 * no mesmo padrão da tela de login, fora do canvas.
 */
export class SystemNotice {
  private banner?: HTMLElement;
  private timer?: ReturnType<typeof setInterval>;
  private offset = 0;

  constructor(private readonly staff: boolean, private readonly host: HTMLElement = document.body) {}

  status(notice: OperationNotice): void {
    this.offset = notice.serverNow - Date.now();
    clearInterval(this.timer);
    if (notice.mode === 'open') { this.banner?.remove(); this.banner = undefined; return; }
    const render = () => {
      const now = Date.now() + this.offset;
      const pending = notice.mode === 'maintenance' && (notice.startsAt ?? 0) > now;
      let text: string;
      if (pending) {
        text = `Manutenção em ${countdown((notice.startsAt ?? 0) - now)}. ${notice.message ?? ''}`.trim();
        if (this.staff) text += ' A equipe continua conectada.';
      } else {
        text = notice.mode === 'closed' ? 'Alpha encerrado para os jogadores: só a equipe está conectada.' : 'Manutenção em andamento: só a equipe está conectada.';
      }
      this.showBanner(text);
    };
    render();
    this.timer = setInterval(render, 1000);
  }

  final(reason: FinalClose): void {
    clearInterval(this.timer);
    this.banner?.remove();
    if (reason === 'maintenance') { window.location.replace('/'); return; }
    const content = FINAL_TEXT[reason];
    const overlay = document.createElement('div');
    overlay.className = 'system-notice-overlay';
    overlay.setAttribute('role', 'alertdialog');
    overlay.setAttribute('aria-modal', 'true');
    const card = document.createElement('section');
    card.className = 'system-notice-card';
    const title = document.createElement('h2');
    title.textContent = content.title;
    const text = document.createElement('p');
    text.textContent = content.text;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'system-notice-button';
    button.textContent = content.button;
    button.addEventListener('click', () => window.location.reload());
    card.append(title, text, button);
    overlay.append(card);
    this.host.append(overlay);
    button.focus();
  }

  private showBanner(text: string): void {
    if (!this.banner) {
      this.banner = document.createElement('div');
      this.banner.className = 'system-notice-banner';
      this.banner.setAttribute('role', 'status');
      this.host.append(this.banner);
    }
    this.banner.textContent = text;
  }

  destroy(): void {
    clearInterval(this.timer);
    this.banner?.remove();
  }
}
