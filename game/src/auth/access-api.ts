import type { PlayerSession } from '../game/session';
import { LEGAL_VERSION } from './legal';

/** Configuração pública do acesso (`/api/coffe/access/config`). */
export interface AccessConfig {
  legalVersion: string;
  minimumAge: number;
  turnstileSiteKey: string;
  contactEmail: string;
  /** Servidor de desenvolvimento sem SMTP: os emails ficam na caixa de saída local. */
  devMailbox: boolean;
}

const FALLBACK_CONFIG: AccessConfig = { legalVersion: LEGAL_VERSION, minimumAge: 18, turnstileSiteKey: '', contactEmail: '', devMailbox: false };
let configPromise: Promise<AccessConfig> | undefined;

export function loadAccessConfig(): Promise<AccessConfig> {
  return configPromise ??= fetch('/api/coffe/access/config', { credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(8000) })
    .then((response) => (response.ok ? response.json() as Promise<AccessConfig> : FALLBACK_CONFIG))
    .catch(() => FALLBACK_CONFIG);
}

async function send<T>(path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch('/api/coffe/' + path, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}), signal: AbortSignal.timeout(15000),
    });
  } catch {
    throw new Error('Não foi possível conectar ao servidor. Tente novamente.');
  }
  if (response.status === 429) throw new Error('Muitas tentativas seguidas. Aguarde um minuto e tente de novo.');
  const data = response.status === 204 ? null : await response.json().catch(() => null) as { message?: string } | null;
  if (!response.ok) throw new Error(data?.message || 'Algo deu errado. Tente novamente.');
  return data as T;
}

const legalVersion = LEGAL_VERSION;

export const accessApi = {
  joinWaitlist: (body: { name: string; email: string; memory: string; adult: boolean; privacy: boolean; turnstile: string; website: string }) =>
    send<{ ok: boolean }>('waitlist', { ...body, legalVersion }),
  confirmWaitlist: (token: string) => send<{ position: number }>('waitlist/confirm', { token }),
  checkInvite: (code: string) => send<{ email: string; expiresAt: number }>('invite/check', { code }),
  signup: (body: { code: string; name: string; password: string; passwordConfirm: string; adult: boolean; terms: boolean }) =>
    send<PlayerSession>('signup', { ...body, legalVersion }),
  forgotPassword: (email: string, turnstile: string) => send<{ ok: boolean }>('password/forgot', { email, turnstile }),
  resetPassword: (token: string, password: string, passwordConfirm: string) => send<null>('password/reset', { token, password, passwordConfirm }),
  changePassword: (current: string, password: string, passwordConfirm: string) => send<null>('account/password', { current, password, passwordConfirm }),
  deleteAccount: (password: string) => send<null>('account/delete', { password }),
};

/**
 * Segredos de links de email chegam no fragmento (`#…`), que o navegador não envia ao
 * servidor. Depois de lido, sai do endereço para não ficar no histórico.
 */
export function takeFragmentSecret(): string {
  const secret = decodeURIComponent(window.location.hash.slice(1)).trim();
  if (secret) history.replaceState(null, '', window.location.pathname + window.location.search);
  return secret;
}
