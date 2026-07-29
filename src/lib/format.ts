/** Formatação regional — responsabilidade do frontend. */

import { format, formatDistanceToNow } from 'date-fns';
import { ptBR, enUS } from 'date-fns/locale';

type Lang = 'pt-BR' | 'en-US';

function locale(lang: Lang) {
  return lang === 'pt-BR' ? ptBR : enUS;
}

export function formatDate(iso: string, lang: Lang): string {
  return format(new Date(iso), 'dd MMM yyyy, HH:mm', { locale: locale(lang) });
}

export function formatRelative(iso: string, lang: Lang): string {
  return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: locale(lang) });
}

export function formatNumber(value: number, lang: Lang): string {
  return new Intl.NumberFormat(lang).format(value);
}

export function formatCurrency(value: number, lang: Lang): string {
  const currency = lang === 'pt-BR' ? 'BRL' : 'EUR';
  return new Intl.NumberFormat(lang, { style: 'currency', currency }).format(value);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
