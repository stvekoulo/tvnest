// Modale de configuration et de saisie du code PIN à 4 chiffres du contrôle parental TVNest.
import { Shield, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/motion/button/base';
import { Input } from '@/components/motion/input';
import { hashParentalPin, isValidPinFormat, verifyParentalPin } from '@/lib/parental-pin';

export type ParentalPinModalMode = 'setup' | 'unlock' | 'change';

interface ParentalLockModalProps {
  mode: ParentalPinModalMode | null;
  expectedPinHash?: string;
  onClose: () => void;
  onComplete: (result: { enabled: boolean; pinHash?: string }) => Promise<void>;
}

export function ParentalLockModal({
  mode,
  expectedPinHash,
  onClose,
  onComplete,
}: ParentalLockModalProps) {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
    setError(null);
    setSubmitting(false);
  }, [mode]);

  useEffect(() => {
    if (!mode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, onClose]);

  if (!mode) return null;

  const sanitizeDigits = (v: string) => v.replace(/\D+/g, '').slice(0, 4);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      if (mode === 'unlock') {
        const valid = await verifyParentalPin(currentPin, expectedPinHash);
        if (!valid) {
          setError('Code PIN incorrect.');
          return;
        }
        await onComplete({ enabled: false });
        onClose();
        return;
      }

      if (mode === 'change') {
        const valid = await verifyParentalPin(currentPin, expectedPinHash);
        if (!valid) {
          setError('Le code PIN actuel est incorrect.');
          return;
        }
      }

      if (!isValidPinFormat(newPin)) {
        setError('Saisissez un code PIN à 4 chiffres.');
        return;
      }
      if (newPin !== confirmPin) {
        setError('La confirmation ne correspond pas au nouveau code PIN.');
        return;
      }
      const pinHash = await hashParentalPin(newPin);
      await onComplete({ enabled: true, pinHash });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    mode === 'setup'
      ? 'Définir un code PIN parental'
      : mode === 'unlock'
        ? 'Désactiver le contrôle parental'
        : 'Modifier le code PIN parental';

  return (
    <div
      data-tvnest-overlay=""
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-[28px] border border-border bg-card p-6 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-9 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Shield className="size-4" />
            </span>
            <div>
              <h2 className="font-display text-base font-extrabold text-foreground">{title}</h2>
              <p className="text-xs text-muted-foreground">
                Code à 4 chiffres stocké sous empreinte SHA-256 locale.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-elevated text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {error ? (
          <p className="rounded-xl border border-rose-500/35 bg-rose-500/15 px-3.5 py-2 text-xs font-medium text-rose-400">
            {error}
          </p>
        ) : null}

        {mode === 'unlock' || mode === 'change' ? (
          <Input
            type="password"
            label="Code PIN actuel (4 chiffres)"
            value={currentPin}
            onChange={(v) => setCurrentPin(sanitizeDigits(v))}
            placeholder="••••"
          />
        ) : null}

        {mode === 'setup' || mode === 'change' ? (
          <div className="grid grid-cols-2 gap-3">
            <Input
              type="password"
              label="Nouveau PIN (4 chiffres)"
              value={newPin}
              onChange={(v) => setNewPin(sanitizeDigits(v))}
              placeholder="••••"
            />
            <Input
              type="password"
              label="Confirmer le PIN"
              value={confirmPin}
              onChange={(v) => setConfirmPin(sanitizeDigits(v))}
              placeholder="••••"
            />
          </div>
        ) : null}

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" variant="primary" disabled={submitting}>
            {mode === 'unlock' ? 'Déverrouiller' : 'Valider le code PIN'}
          </Button>
        </div>
      </form>
    </div>
  );
}
