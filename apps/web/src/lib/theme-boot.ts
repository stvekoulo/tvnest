// Applique la classe de thème enregistrée avant le premier rendu React.
try {
  const stored = localStorage.getItem('tvnest.theme.v1');
  const root = document.documentElement;
  if (stored === 'light') {
    root.classList.remove('dark');
    root.classList.add('light');
  } else {
    root.classList.remove('light');
    root.classList.add('dark');
  }
} catch {
  // Ignore localStorage access errors.
}
