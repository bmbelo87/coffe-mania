import { login, LoginChallengeError } from '../game/session';
import { mountTurnstile, type TurnstileWidget } from './turnstile';

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Ocorreu um erro. Tente novamente.';
}

/**
 * Envio de formulário com o botão ocupado e a mensagem de erro no lugar certo. O texto do
 * erro vem do servidor, que valida tudo; o navegador só evita envios repetidos.
 */
export function handleSubmit(form: HTMLFormElement, error: HTMLElement, busyLabel: string, action: (data: FormData) => Promise<void>): void {
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const label = button.textContent ?? '';
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = busyLabel;
    error.textContent = '';
    try {
      await action(new FormData(form));
    } catch (reason) {
      error.textContent = errorMessage(reason);
    } finally {
      if (button.isConnected) { button.disabled = false; button.textContent = label; }
    }
  });
}

export const text = (data: FormData, name: string): string => String(data.get(name) ?? '');
export const checked = (data: FormData, name: string): boolean => data.get(name) === 'on';

/** Formulário de entrada; depois do login vai ao café (ou ao quarto pedido no endereço). */
export function mountLoginForm(content: HTMLElement, error: HTMLElement): void {
  content.innerHTML = `
    <form class="login-form">
      <label for="login-email">Email</label>
      <input id="login-email" name="email" type="email" autocomplete="username" required>
      <label for="login-password">Senha</label>
      <input id="login-password" name="password" type="password" autocomplete="current-password" required>
      <button class="login-primary" type="submit">Entrar</button>
    </form>
    <a class="login-link" href="/senha">Esqueci minha senha</a>`;
  const form = content.querySelector('form')!;
  let challenge: Promise<TurnstileWidget> | undefined;
  handleSubmit(form, error, 'Entrando…', async (data) => {
    const widget = challenge ? await challenge : undefined;
    try {
      await login(text(data, 'email').trim(), text(data, 'password'), widget?.token() ?? '');
    } catch (reason) {
      widget?.reset();
      if (reason instanceof LoginChallengeError && !challenge) {
        const slot = document.createElement('div');
        slot.className = 'login-turnstile';
        form.querySelector('button[type="submit"]')!.before(slot);
        challenge = mountTurnstile(slot, reason.siteKey);
      }
      throw reason;
    }
    const room = new URLSearchParams(window.location.search).get('room');
    window.location.assign(room ? '/play?room=' + encodeURIComponent(room) : '/play');
  });
}
