// Modale d'ajout de sources IPTV TVNest avec champs @beui/input et bouton d'état animé.
import { FileText, FolderOpen, Globe, Radio, Server, X } from 'lucide-react';
import { useState } from 'react';
import { Button, StatefulButton, type ButtonState } from '@/components/motion/button';
import { Input } from '@/components/motion/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/motion/tabs';
import { TvNestLogo } from '@/components/shell/tvnest-logo';

interface SourceImportModalProps {
  open: boolean;
  onClose: () => void;
  addSource: {
    m3uUrl: (url: string, title: string, ua?: string) => Promise<void>;
    m3uFile: () => Promise<void>;
    m3uText: (text: string, title: string) => Promise<void>;
    xtream: (p: {
      title: string;
      serverUrl: string;
      username: string;
      password: string;
    }) => Promise<void>;
    stalker: (p: {
      title: string;
      portalUrl: string;
      macAddress: string;
    }) => Promise<void>;
  };
}

export function SourceImportModal({ open, onClose, addSource }: SourceImportModalProps) {
  const [btnState, setBtnState] = useState<ButtonState>('idle');
  const [err, setErr] = useState<string | null>(null);

  const [title, setTitle] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [userAgent, setUserAgent] = useState('');
  const [rawM3u, setRawM3u] = useState('');

  const [xtServer, setXtServer] = useState('');
  const [xtUser, setXtUser] = useState('');
  const [xtPass, setXtPass] = useState('');

  const [stUrl, setStUrl] = useState('');
  const [stMac, setStMac] = useState('00:1A:79:');

  if (!open) return null;

  const exec = async (fn: () => Promise<void>) => {
    setBtnState('loading');
    setErr(null);
    try {
      await fn();
      setBtnState('success');
      setTimeout(() => {
        setBtnState('idle');
        onClose();
      }, 450);
    } catch (e) {
      setBtnState('error');
      setErr((e as Error).message || 'Erreur lors de la connexion');
    }
  };

  return (
    <div data-tvnest-overlay="" className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
      <div className="w-full max-w-xl overflow-hidden rounded-[30px] border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TvNestLogo size="sm" />
            <div>
              <h2 className="font-display text-lg font-extrabold text-foreground">
                Connecter une source IPTV
              </h2>
              <p className="text-xs text-muted-foreground">
                Indexation directe dans le moteur SQLite natif TVNest.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-elevated text-muted-foreground hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        <Tabs defaultValue="xtream" className="mt-5">
          <TabsList className="flex w-full flex-wrap">
            <TabsTrigger value="xtream">
              <Server className="size-3.5" /> Xtream
            </TabsTrigger>
            <TabsTrigger value="url">
              <Globe className="size-3.5" /> M3U URL
            </TabsTrigger>
            <TabsTrigger value="file">
              <FolderOpen className="size-3.5" /> Fichier
            </TabsTrigger>
            <TabsTrigger value="text">
              <FileText className="size-3.5" /> Texte
            </TabsTrigger>
            <TabsTrigger value="stalker">
              <Radio className="size-3.5" /> Stalker
            </TabsTrigger>
          </TabsList>

          {err ? (
            <div className="mt-4 rounded-2xl border border-rose-500/35 bg-rose-500/15 px-4 py-2.5 text-xs font-medium text-rose-400">
              {err}
            </div>
          ) : null}

          <TabsContent value="xtream" className="mt-4 space-y-3">
            <Input
              placeholder="Nom du portail Xtream"
              value={title}
              onChange={setTitle}
            />
            <Input
              type="url"
              placeholder="URL Serveur (ex: http://line.exemple.tv:8080)"
              value={xtServer}
              onChange={setXtServer}
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                placeholder="Identifiant (Username)"
                value={xtUser}
                onChange={setXtUser}
              />
              <Input
                type="password"
                placeholder="Mot de passe"
                value={xtPass}
                onChange={setXtPass}
              />
            </div>
            <StatefulButton
              size="lg"
              variant="primary"
              state={btnState}
              disabled={!xtServer.trim() || !xtUser.trim()}
              loadingText="Synchronisation SQLite..."
              successText="Portail connecté"
              onClick={() =>
                exec(() =>
                  addSource.xtream({
                    title,
                    serverUrl: xtServer,
                    username: xtUser,
                    password: xtPass,
                  })
                )
              }
              className="w-full"
            >
              Synchroniser Live, Films & Séries
            </StatefulButton>
          </TabsContent>

          <TabsContent value="url" className="mt-4 space-y-3">
            <Input
              placeholder="Nom de la playlist (ex: Bouquet Principal)"
              value={title}
              onChange={setTitle}
            />
            <Input
              type="url"
              placeholder="https://serveur.com/playlist.m3u8"
              value={m3uUrl}
              onChange={setM3uUrl}
            />
            <Input
              placeholder="User-Agent personnalisé (optionnel)"
              value={userAgent}
              onChange={setUserAgent}
            />
            <StatefulButton
              size="lg"
              variant="primary"
              state={btnState}
              disabled={!m3uUrl.trim()}
              loadingText="Téléchargement M3U..."
              onClick={() => exec(() => addSource.m3uUrl(m3uUrl, title, userAgent))}
              className="w-full"
            >
              Importer la playlist M3U
            </StatefulButton>
          </TabsContent>

          <TabsContent value="file" className="mt-4">
            <div className="rounded-2xl border border-dashed border-border bg-elevated p-6 text-center">
              <FolderOpen className="mx-auto size-8 text-primary" />
              <p className="mt-2 text-xs font-bold text-foreground">
                Sélectionner un fichier .m3u ou .m3u8 sur votre disque
              </p>
              <Button
                size="lg"
                variant="primary"
                onClick={() => exec(() => addSource.m3uFile())}
                className="mt-4"
              >
                Parcourir le disque local
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="text" className="mt-4 space-y-3">
            <Input placeholder="Titre de la playlist" value={title} onChange={setTitle} />
            <textarea
              rows={5}
              placeholder="#EXTM3U&#10;#EXTINF:-1,Ma Chaîne&#10;https://..."
              value={rawM3u}
              onChange={(e) => setRawM3u(e.target.value)}
              className="w-full rounded-xl border border-border bg-elevated p-3.5 font-mono text-xs text-foreground outline-none focus:border-primary"
            />
            <StatefulButton
              size="lg"
              variant="primary"
              state={btnState}
              disabled={!rawM3u.trim()}
              onClick={() => exec(() => addSource.m3uText(rawM3u, title))}
              className="w-full"
            >
              Analyser et enregistrer
            </StatefulButton>
          </TabsContent>

          <TabsContent value="stalker" className="mt-4 space-y-3">
            <Input
              placeholder="Nom du portail Stalker / Ministra"
              value={title}
              onChange={setTitle}
            />
            <Input
              type="url"
              placeholder="URL Portail (ex: http://portal.tv/stalker_portal/c)"
              value={stUrl}
              onChange={setStUrl}
            />
            <Input
              placeholder="Adresse MAC (00:1A:79:XX:XX:XX)"
              value={stMac}
              onChange={setStMac}
            />
            <StatefulButton
              size="lg"
              variant="primary"
              state={btnState}
              disabled={!stUrl.trim() || !stMac.trim()}
              onClick={() =>
                exec(() =>
                  addSource.stalker({ title, portalUrl: stUrl, macAddress: stMac })
                )
              }
              className="w-full"
            >
              Connecter le portail MAC
            </StatefulButton>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
