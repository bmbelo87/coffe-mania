import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/600.css';
import './login.css';

import { logout, logoutEverywhere, type OperationStatus, type PlayerSession } from '../game/session';
import { errorMessage, mountLoginForm } from './forms';
import { renderLanding } from './LandingPage';

function card(host: HTMLElement): HTMLElement {
  host.innerHTML = `
    <main class="login-card">
      <h1>Café Mania</h1>
      <div class="login-content"></div>
      <p class="login-error" role="alert" aria-live="polite"></p>
    </main>`;
  return host.querySelector<HTMLElement>('.login-content')!;
}

function formatInstant(ms: number): string {
  return new Date(ms).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(', ', ' às ');
}

/** Faixa acima do conteúdo: manutenção programada, ou a equipe entrando com o jogo fechado. */
function statusNote(content: HTMLElement, status: OperationStatus | null, session: PlayerSession | null): void {
  if (!status || status.mode === 'open') return;
  let text = '';
  if (status.mode === 'maintenance' && !status.active && status.startsAt) text = `Manutenção programada para ${formatInstant(status.startsAt)}.`;
  else if (status.active && session?.staff) text = status.mode === 'closed' ? 'Alpha encerrado: você entra como equipe.' : 'Manutenção em andamento: você entra como equipe.';
  if (!text) return;
  const note = document.createElement('p');
  note.className = 'login-status-note';
  note.textContent = text;
  content.before(note);
}

function bindAction(button: HTMLButtonElement, error: HTMLElement, action: () => Promise<void>): void {
  button.addEventListener('click', async () => {
    button.disabled = true;
    error.textContent = '';
    try { await action(); } catch (reason) { error.textContent = errorMessage(reason); button.disabled = false; }
  });
}

/** Jogo travado para jogadores: só a mensagem, e o login fica escondido para a equipe. */
function renderLocked(host: HTMLElement, content: HTMLElement, error: HTMLElement, session: PlayerSession | null, status: OperationStatus): void {
  content.innerHTML = `
    <p class="login-status-title"></p>
    <p class="login-subtitle login-status-message"></p>
    <p class="login-status-eta"></p>`;
  content.querySelector<HTMLElement>('.login-status-title')!.textContent = status.mode === 'closed' ? 'Alpha encerrado' : 'Em manutenção';
  content.querySelector<HTMLElement>('.login-status-message')!.textContent = status.message ?? '';
  const eta = content.querySelector<HTMLElement>('.login-status-eta')!;
  if (status.mode === 'maintenance' && status.endsAt) eta.textContent = `Previsão de volta: ${formatInstant(status.endsAt)}.`;
  else eta.remove();
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'login-secondary';
  if (session) {
    button.textContent = 'Sair';
    bindAction(button, error, async () => { await logout(); renderLoginPage(host, null, status); });
  } else {
    button.textContent = 'Entrar como equipe';
    button.addEventListener('click', () => renderLoginPage(host, null, status, true));
  }
  content.append(button);
}

export function renderLoginPage(host: HTMLElement, session: PlayerSession | null, status: OperationStatus | null = null, staffLogin = false): void {
  // Visitors see the project page with the waitlist; the plain card is for staff during a lock.
  if (!session && !staffLogin && !status?.active) {
    renderLanding(host);
    return;
  }
  document.body.classList.remove('landing-page');
  document.body.classList.add('auth-page');
  const content = card(host);
  const error = host.querySelector<HTMLElement>('.login-error')!;
  if (status?.active && !session?.staff && !staffLogin) {
    renderLocked(host, content, error, session, status);
    return;
  }
  statusNote(content, status, session);
  if (session) {
    content.innerHTML = `
      <p class="login-welcome"></p>
      <a class="login-primary" href="/play">Jogar</a>
      <button class="login-secondary" type="button" data-action="logout">Sair</button>
      <a class="login-link" href="/conta">Minha conta</a>
      <button class="login-link" type="button" data-action="logout-all">Sair de todos os aparelhos</button>`;
    content.querySelector<HTMLElement>('.login-welcome')!.textContent = session.displayName;
    const requestedRoom = new URLSearchParams(window.location.search).get('room');
    if (requestedRoom) content.querySelector('a')!.setAttribute('href', '/play?room=' + encodeURIComponent(requestedRoom));
    bindAction(content.querySelector<HTMLButtonElement>('[data-action="logout"]')!, error, async () => {
      await logout();
      renderLoginPage(host, null, status);
    });
    bindAction(content.querySelector<HTMLButtonElement>('[data-action="logout-all"]')!, error, async () => {
      await logoutEverywhere();
      renderLoginPage(host, null, status);
    });
    return;
  }
  mountLoginForm(content, error);
}

export function renderSessionError(host: HTMLElement, error: unknown): void {
  document.body.classList.add('auth-page');
  const content = card(host);
  host.querySelector<HTMLElement>('.login-error')!.textContent = errorMessage(error);
  content.innerHTML = '<button class="login-primary" type="button">Tentar novamente</button>';
  content.querySelector('button')!.addEventListener('click', () => window.location.reload());
}
