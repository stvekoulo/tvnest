// Point de reprise d'un film ou d'un épisode : quand proposer « Reprendre / Recommencer ».

/** En dessous, ce n'est pas un visionnage entamé (bande-annonce, clic par erreur). */
export const RESUME_MIN_SECONDS = 30;
/** Plus près de la fin, l'œuvre est considérée comme vue : on repart du début. */
export const RESUME_END_MARGIN_SECONDS = 60;

export function shouldOfferResume(positionSeconds: number, durationSeconds?: number): boolean {
  if (!(positionSeconds >= RESUME_MIN_SECONDS)) return false;
  if (!durationSeconds || durationSeconds <= 0) return true;
  return (
    positionSeconds < durationSeconds * 0.95 &&
    durationSeconds - positionSeconds > RESUME_END_MARGIN_SECONDS
  );
}

/** 754 → « 12:34 », 4521 → « 1:15:21 ». */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
