import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, MessageCircle, RotateCcw, Sparkles, Trophy, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { NumeroVendido, Vencedor, padNum } from '@/lib/sorteios';
import './roleta-sorteio-modal.css';

type RoletaSorteioModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  premioNome: string;
  premioNumero: number;
  numeroFinal: number;
  concorrentes: NumeroVendido[];
  onConfirmarGanhador: (vencedor: Vencedor) => void;
};

type Fase = 'pronto' | 'girando' | 'parado';
type Rodada = { vencedor: NumeroVendido; cartoes: NumeroVendido[] };
type Confete = { left: number; delay: number; duration: number; color: string; rotation: number };

const CARD_WIDTH = 130;
const CARD_GAP = 12;
const CARD_FULL = CARD_WIDTH + CARD_GAP;
const TOTAL_CARDS = 55;
const WINNER_INDEX = 45;
const ANIMATION_DURATION_MS = 5500;
const CONFETTI_COLORS = ['#34d399', '#22d3ee', '#facc15', '#f472b6', '#a78bfa', '#fb923c'];

const criarRodada = (concorrentes: NumeroVendido[]): Rodada | null => {
  if (!concorrentes.length) return null;
  const vencedor = concorrentes[Math.floor(Math.random() * concorrentes.length)];
  const cartoes = Array.from({ length: TOTAL_CARDS }, (_, i) =>
    i === WINNER_INDEX ? vencedor : concorrentes[Math.floor(Math.random() * concorrentes.length)],
  );
  return { vencedor, cartoes };
};

export const RoletaSorteioModal = ({
  open, onOpenChange, premioNome, premioNumero, numeroFinal, concorrentes, onConfirmarGanhador,
}: RoletaSorteioModalProps) => {
  const [fase, setFase] = useState<Fase>('pronto');
  const [somHabilitado, setSomHabilitado] = useState(true);
  const [offset, setOffset] = useState(0);
  const [cartoes, setCartoes] = useState<NumeroVendido[]>([]);
  const [vencedor, setVencedor] = useState<NumeroVendido | null>(null);
  const [vencedorSorteado, setVencedorSorteado] = useState<NumeroVendido | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const concorrentesRef = useRef(concorrentes);
  const somRef = useRef(somHabilitado);
  const faseRef = useRef(fase);
  const tickTimerRef = useRef<number | null>(null);
  const finishTimerRef = useRef<number | null>(null);
  const frameRef = useRef<number | null>(null);
  concorrentesRef.current = concorrentes;
  somRef.current = somHabilitado;
  faseRef.current = fase;

  const confetes = useMemo<Confete[]>(() => Array.from({ length: 84 }, () => ({
    left: Math.random() * 100,
    delay: Math.random() * 0.9,
    duration: 2.2 + Math.random() * 2.2,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    rotation: Math.floor(Math.random() * 360),
  })), []);

  const getAudioContext = useCallback(() => {
    try {
      if (!audioCtxRef.current) {
        const audioWindow = window as typeof window & { webkitAudioContext?: typeof AudioContext };
        const AudioContextConstructor = window.AudioContext || audioWindow.webkitAudioContext;
        if (AudioContextConstructor) audioCtxRef.current = new AudioContextConstructor();
      }
      if (audioCtxRef.current?.state === 'suspended') void audioCtxRef.current.resume().catch(() => undefined);
      return audioCtxRef.current;
    } catch {
      return null;
    }
  }, []);

  const playTick = useCallback(() => {
    if (!somRef.current) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(480, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(140, ctx.currentTime + 0.04);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.04);
    } catch { /* áudio pode ser bloqueado pelo navegador */ }
  }, [getAudioContext]);

  const playVitoria = useCallback(() => {
    if (!somRef.current) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
        const inicio = ctx.currentTime + idx * 0.1;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, inicio);
        gain.gain.setValueAtTime(0.15, inicio);
        gain.gain.exponentialRampToValueAtTime(0.001, inicio + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(inicio);
        osc.stop(inicio + 0.55);
      });
    } catch { /* áudio pode ser bloqueado pelo navegador */ }
  }, [getAudioContext]);

  const limparTimers = useCallback(() => {
    if (tickTimerRef.current !== null) window.clearTimeout(tickTimerRef.current);
    if (finishTimerRef.current !== null) window.clearTimeout(finishTimerRef.current);
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    tickTimerRef.current = null;
    finishTimerRef.current = null;
    frameRef.current = null;
  }, []);

  const iniciarAnimacao = useCallback((sorteio: Rodada) => {
    if (faseRef.current === 'girando') return;
    limparTimers();
    faseRef.current = 'girando';
    setFase('girando');
    setVencedorSorteado(null);
    void getAudioContext();

    const larguraVisor = containerRef.current?.clientWidth || 400;
    const centroVisor = larguraVisor / 2;
    const centroVencedor = WINNER_INDEX * CARD_FULL + CARD_WIDTH / 2;
    // O trilho não tem padding horizontal, então ambos os centros usam a mesma origem.
    const destinoFinal = Math.max(0, centroVencedor - centroVisor);
    frameRef.current = window.requestAnimationFrame(() => setOffset(destinoFinal));

    const inicio = Date.now();
    const tocarTique = () => {
      const decorrido = Date.now() - inicio;
      if (decorrido >= ANIMATION_DURATION_MS || faseRef.current !== 'girando') return;
      playTick();
      const progresso = Math.min(decorrido / ANIMATION_DURATION_MS, 1);
      const proximoIntervalo = 40 + Math.pow(progresso, 3) * 380;
      tickTimerRef.current = window.setTimeout(tocarTique, proximoIntervalo);
    };
    tocarTique();

    finishTimerRef.current = window.setTimeout(() => {
      if (tickTimerRef.current !== null) window.clearTimeout(tickTimerRef.current);
      tickTimerRef.current = null;
      setOffset(destinoFinal);
      faseRef.current = 'parado';
      setFase('parado');
      setVencedorSorteado(sorteio.vencedor);
      playVitoria();
    }, ANIMATION_DURATION_MS + 150);
  }, [getAudioContext, limparTimers, playTick, playVitoria]);

  // Seleciona o vencedor assim que o modal abre e mantém a rodada estável durante a animação.
  useEffect(() => {
    if (!open) {
      limparTimers();
      faseRef.current = 'pronto';
      setFase('pronto');
      setOffset(0);
      setCartoes([]);
      setVencedor(null);
      setVencedorSorteado(null);
      return;
    }
    const novaRodada = criarRodada(concorrentesRef.current);
    faseRef.current = 'pronto';
    setFase('pronto');
    setOffset(0);
    setCartoes(novaRodada?.cartoes ?? []);
    setVencedor(novaRodada?.vencedor ?? null);
  }, [open, limparTimers]);

  useEffect(() => () => {
    limparTimers();
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') void audioCtxRef.current.close();
  }, [limparTimers]);

  const iniciarGiro = () => {
    if (fase !== 'pronto' || !vencedor || cartoes.length === 0) return;
    iniciarAnimacao({ vencedor, cartoes });
  };

  const rodarNovamente = () => {
    if (fase !== 'parado') return;
    const novaRodada = criarRodada(concorrentesRef.current);
    if (!novaRodada) return;
    setCartoes(novaRodada.cartoes);
    setVencedor(novaRodada.vencedor);
    setOffset(0);
    setVencedorSorteado(null);
    faseRef.current = 'pronto';
    setFase('pronto');
    // Deixa o trilho reiniciar na origem antes de iniciar o próximo giro.
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = window.requestAnimationFrame(() => iniciarAnimacao(novaRodada));
    });
  };

  const handleConfirmar = () => {
    if (!vencedorSorteado) return;
    onConfirmarGanhador({ num: vencedorSorteado.numero, nome: vencedorSorteado.comprador_nome });
    onOpenChange(false);
  };

  const telefoneLimpo = vencedorSorteado?.comprador_telefone.replace(/\D/g, '');
  const telefoneWhatsapp = telefoneLimpo ? (telefoneLimpo.startsWith('55') ? telefoneLimpo : `55${telefoneLimpo}`) : '';
  const linkWhatsApp = telefoneWhatsapp && vencedorSorteado
    ? `https://wa.me/${telefoneWhatsapp}?text=${encodeURIComponent(`Olá, ${vencedorSorteado.comprador_nome}! 🎉\nParabéns! Você acaba de ser contemplado no ${premioNumero}º Prêmio (${premioNome}) com o número ${padNum(vencedorSorteado.numero, numeroFinal)}!`)}`
    : null;

  return (
    <Dialog open={open} onOpenChange={(val) => fase !== 'girando' && onOpenChange(val)}>
      {fase === 'parado' && <div className="roleta-confetti-layer" aria-hidden="true">{confetes.map((p, i) => <span key={i} className="roleta-confetti-piece" style={{ left: `${p.left}%`, animationDelay: `${p.delay}s`, animationDuration: `${p.duration}s`, backgroundColor: p.color, transform: `rotate(${p.rotation}deg)` }} />)}</div>}
      <DialogContent className="w-[94vw] max-w-lg max-h-[92vh] overflow-y-auto bg-zinc-950 border-emerald-500/30 text-zinc-100 p-4 sm:p-6 mx-auto rounded-2xl shadow-2xl">
        <DialogHeader className="flex flex-row items-center justify-between pb-2 border-b border-zinc-800 pr-8">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Roleta Oficial de Apuração</span>
            <DialogTitle className="text-lg font-bold text-white mt-1">{premioNumero}º Prêmio · {premioNome}</DialogTitle>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setSomHabilitado((prev) => !prev)} className="text-zinc-400 hover:text-white" title={somHabilitado ? 'Desativar som' : 'Ativar som'} aria-label={somHabilitado ? 'Desativar som' : 'Ativar som'}>
            {somHabilitado ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4" />}
          </Button>
        </DialogHeader>

        <div className="relative my-6 select-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-20 pointer-events-none"><div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[14px] border-t-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" /></div>
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-2 z-20 pointer-events-none"><div className="w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-b-[14px] border-b-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]" /></div>
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-0.5 bg-gradient-to-b from-emerald-400 via-emerald-300 to-emerald-400 opacity-70 z-10 pointer-events-none shadow-[0_0_12px_rgba(52,211,153,0.9)]" />
          <div className="absolute inset-y-0 left-0 w-12 sm:w-20 bg-gradient-to-r from-zinc-950 to-transparent z-10 pointer-events-none" />
          <div className="absolute inset-y-0 right-0 w-12 sm:w-20 bg-gradient-to-l from-zinc-950 to-transparent z-10 pointer-events-none" />
          <div ref={containerRef} className="w-full h-36 bg-zinc-900/90 rounded-2xl border border-zinc-800 flex items-center overflow-hidden relative shadow-inner">
            <div className="flex items-center" style={{ gap: `${CARD_GAP}px`, transform: `translateX(-${offset}px)`, transition: fase === 'girando' ? `transform ${ANIMATION_DURATION_MS}ms cubic-bezier(0.12, 0.8, 0.15, 1)` : 'none' }}>
              {cartoes.map((item, idx) => {
                const isWinner = fase === 'parado' && idx === WINNER_INDEX;
                return <div key={idx} style={{ width: `${CARD_WIDTH}px` }} className={`h-24 rounded-xl flex flex-col items-center justify-center p-2 text-center shrink-0 border transition-all duration-300 ${isWinner ? 'bg-gradient-to-b from-emerald-500/20 to-emerald-950 border-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.5)] scale-105' : 'bg-zinc-800/80 border-zinc-700/60 text-zinc-300'}`}>
                  <span className={`font-mono text-xl font-black ${isWinner ? 'text-emerald-300' : 'text-zinc-100'}`}>{padNum(item.numero, numeroFinal)}</span>
                  <span className="text-xs text-zinc-400 truncate max-w-full font-medium mt-1">{item.comprador_nome || 'Anônimo'}</span>
                </div>;
              })}
            </div>
          </div>
        </div>

        <div className="w-full max-w-md mx-auto space-y-3">
        {fase === 'pronto' && <div className="text-center space-y-4"><p className="text-sm text-zinc-400"><strong className="text-emerald-400">{concorrentes.length}</strong> números concorrem a este prêmio.</p><Button size="lg" onClick={iniciarGiro} disabled={!vencedor} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-base h-12 shadow-[0_0_20px_rgba(5,150,105,0.4)]"><Trophy className="w-5 h-5 mr-2" /> Rodar Roleta da Sorte</Button></div>}
        {fase === 'girando' && <div className="text-center py-2 animate-pulse"><span className="text-sm font-semibold tracking-wider text-emerald-400 uppercase">Desacelerando... Quem será o contemplado?</span></div>}
        {fase === 'parado' && vencedorSorteado && <div className="space-y-4 animate-in fade-in zoom-in-95 duration-500">
          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-950/80 via-zinc-900 to-emerald-950/80 border border-emerald-500/50 text-center space-y-1 relative overflow-hidden">
            <span className="inline-block text-[11px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/20 px-2.5 py-0.5 rounded-full mb-1">Contemplado no {premioNumero}º Prêmio</span>
            <div className="font-mono text-4xl font-extrabold text-emerald-300 tracking-tight">Nº {padNum(vencedorSorteado.numero, numeroFinal)}</div>
            <div className="text-lg font-bold text-white">{vencedorSorteado.comprador_nome}</div>
            {vencedorSorteado.comprador_telefone && <div className="text-xs text-zinc-400 font-mono">Tel: {vencedorSorteado.comprador_telefone}</div>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {linkWhatsApp && <Button asChild variant="outline" className="w-full border-emerald-500/50 text-emerald-400 hover:bg-emerald-950/50"><a href={linkWhatsApp} target="_blank" rel="noopener noreferrer"><MessageCircle className="w-4 h-4 mr-2" /> Notificar WhatsApp</a></Button>}
            <Button variant="ghost" onClick={rodarNovamente} className="w-full text-zinc-400 hover:text-white"><RotateCcw className="w-4 h-4 mr-2" /> Rodar Novamente</Button>
          </div>
          <Button size="lg" onClick={handleConfirmar} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold h-12 shadow-[0_0_16px_rgba(5,150,105,0.4)]"><CheckCircle2 className="w-5 h-5 mr-2" /> Confirmar e Salvar no {premioNumero}º Prêmio</Button>
        </div>}
        </div>
      </DialogContent>
    </Dialog>
  );
};
