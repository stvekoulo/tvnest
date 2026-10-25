import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Retire les emojis (drapeaux, pictogrammes) que les fournisseurs IPTV glissent dans les
// noms de chaînes et de groupes. ©, ® et ™ sont conservés.
const EMOJI_RE =
  /(?![©®™])[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}]|[\u{FE0F}\u{200D}\u{20E3}]/gu;

export function stripEmoji(text: string): string;
export function stripEmoji(text: string | undefined): string | undefined;
export function stripEmoji(text: string | undefined): string | undefined {
  if (!text) return text;
  const cleaned = text
    .replace(EMOJI_RE, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s|:\-–—]+|[\s|:\-–—]+$/g, '')
    .trim();
  return cleaned || text.trim();
}
