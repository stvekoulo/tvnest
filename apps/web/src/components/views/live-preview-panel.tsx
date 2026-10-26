// Panneau latéral Live TV : aperçu de la chaîne en cours et son programme (grands écrans).
import { Maximize2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/motion/button/base';
import { PlayerSlot } from '@/components/player/player-host';
import { fetchChannelSchedule } from '@/services/ipc-system.service';
import type { EpgProgram, UnifiedMedia } from '@/types/iptv.types';

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export function LivePreviewPanel({ channel, onExpandTheater }: { channel: UnifiedMedia; onExpandTheater: () => void }) {
  const [schedule, setSchedule] = useState<EpgProgram[]>([]);

  useEffect(() => {
    if (!channel.tvgId) {
      setSchedule([]);
      return;
    }
    fetchChannelSchedule(channel.tvgId)
      .then((list) => setSchedule(list.slice(0, 8)))
      .catch(() => setSchedule([]));
  }, [channel.tvgId]);

  return (
    <aside className="hidden w-[320px] shrink-0 flex-col border-l border-border bg-surface p-5 xl:flex">
      <div className="relative aspect-video w-full overflow-hidden rounded-[22px] border border-border bg-black shadow-lg">
        <PlayerSlot />
      </div>

      <div className="mt-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold text-foreground">{channel.title}</h3>
          <p className="truncate text-xs text-muted-foreground">{channel.category}</p>
        </div>
        <Button size="sm" variant="primary" onClick={onExpandTheater}>
          <Maximize2 className="size-3.5" />
          Cinéma
        </Button>
      </div>

      <div className="mt-5 flex-1 overflow-y-auto">
        <h4 className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Au programme</h4>
        {schedule.length === 0 ? (
          <p className="text-xs text-muted-foreground">Pas de programme disponible pour cette chaîne.</p>
        ) : (
          <div className="space-y-2">
            {schedule.map((prog, idx) => (
              <div key={idx} className="rounded-2xl border border-border bg-card p-3">
                <p className="text-xs font-semibold text-foreground">{prog.title}</p>
                <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">
                  {time(prog.start)} – {time(prog.stop)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}
