// Exécute un callback de réinitialisation dès le rendu d'ouverture (@beui/select).
import { useState } from 'react';

export function useOnOpen(open: boolean, start: () => void) {
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) start();
  }
}
