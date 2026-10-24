interface TurnstileApi {
  render(container: HTMLElement, options: { sitekey: string; language?: string; theme?: string }): string;
  getResponse(widgetId: string): string | undefined;
  reset(widgetId: string): void;
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

export interface TurnstileWidget { token(): string; reset(): void }

const NONE: TurnstileWidget = { token: () => '', reset: () => {} };
let scriptPromise: Promise<TurnstileApi> | undefined;

function loadScript(): Promise<TurnstileApi> {
  return scriptPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('Turnstile indisponível.')));
    script.onerror = () => { scriptPromise = undefined; reject(new Error('Turnstile indisponível.')); };
    document.head.append(script);
  });
}

/**
 * Verificação anti-robô dos formulários públicos (Cloudflare Turnstile). Sem chave
 * configurada (desenvolvimento), não aparece nada e o servidor também não exige.
 */
export async function mountTurnstile(container: HTMLElement, siteKey: string): Promise<TurnstileWidget> {
  if (!siteKey) { container.remove(); return NONE; }
  try {
    const api = await loadScript();
    const id = api.render(container, { sitekey: siteKey, language: 'pt-br', theme: 'light' });
    return { token: () => api.getResponse(id) ?? '', reset: () => api.reset(id) };
  } catch {
    container.textContent = 'Não foi possível carregar a verificação anti-robô. Recarregue a página.';
    return NONE;
  }
}
