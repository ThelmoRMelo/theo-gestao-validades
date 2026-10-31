import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Trophy, Dices } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Sorteio, NumeroVendido, Vencedor, getSorteio, listVendidos, homologarApuracao, padNum, chavePessoa } from '@/lib/sorteios';
const SorteioApuracao = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [sorteio, setSorteio] = useState<Sorteio | null>(null);
  const [vendidos, setVendidos] = useState<NumeroVendido[]>([]);
  const [ganhadores, setGanhadores] = useState<(Vencedor | null)[]>([]);
  const [entrada, setEntrada] = useState<string[]>([]);
  const [premioUnico, setPremioUnico] = useState(false);
  const [animando, setAnimando] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);
  useEffect(() => { getSorteio(id).then((s) => { setSorteio(s ?? null); if (s) { setGanhadores(s.premios.map((_, i) => s.ganhadores[i] ?? null)); setEntrada(s.premios.map(() => '')); setPremioUnico(s.premioUnico); } }); listVendidos(id).then(setVendidos).catch(() => toast.error('Erro ao carregar números vendidos')); }, [id]);
  const premios = sorteio?.premios ?? [];
  const chaveDoNumero = (num: number) => { const v = vendidos.find((x) => x.numero === num); return v ? chavePessoa(v.comprador_nome, v.comprador_telefone) : ''; };
  // Pessoas já premiadas em outros prêmios (exceto o prêmio atual).
  const premiadasExceto = (indice: number) => new Set(ganhadores.flatMap((g, i) => (g && i !== indice ? [chaveDoNumero(g.num)] : [])));
  const concorrentesPara = (indice: number) => {
    const bloqueadas = premioUnico ? premiadasExceto(indice) : new Set<string>();
    return vendidos.filter((v) => !ganhadores.some((g, i) => i !== indice && g?.num === v.numero) && !bloqueadas.has(chavePessoa(v.comprador_nome, v.comprador_telefone)));
  };
  const vencedorDe = (num: number): Vencedor | null => { const comprador = vendidos.find((v) => v.numero === num); return comprador ? { num, nome: comprador.comprador_nome } : null; };
  const sortear = (indice: number) => {
    const concorrentes = concorrentesPara(indice);
    if (concorrentes.length === 0) return toast.error('Não há números vendidos disponíveis para este prêmio');
    setAnimando(indice);
    let ticks = 0;
    const timer = window.setInterval(() => {
      const escolhido = concorrentes[Math.floor(Math.random() * concorrentes.length)];
      setGanhadores((prev) => prev.map((g, i) => i === indice ? { num: escolhido.numero, nome: escolhido.comprador_nome } : g));
      if (++ticks >= 18) { window.clearInterval(timer); setAnimando(null); }
    }, 70);
  };
  const usarEntrada = (indice: number) => {
    const num = Number(entrada[indice]);
    if (!Number.isInteger(num)) return toast.error('Digite um número válido');
    const encontrado = vencedorDe(num);
    if (!encontrado) return toast.error('Este número não consta entre os vendidos');
    if (ganhadores.some((g, i) => i !== indice && g?.num === num)) return toast.error('Esse número já foi sorteado em outro prêmio');
    if (premioUnico) {
      const k = chaveDoNumero(num);
      const anterior = ganhadores.findIndex((g, i) => g && i !== indice && chaveDoNumero(g.num) === k);
      if (anterior >= 0) return toast.error(`Este comprador (${encontrado.nome}) já foi contemplado no ${anterior + 1}º Prêmio.`);
    }
    setGanhadores((prev) => prev.map((g, i) => i === indice ? encontrado : g));
  };
  const homologar = async () => {
    const primeiro = ganhadores[0];
    if (!primeiro) return toast.error('Defina o ganhador do 1º prêmio');
    setSalvando(true);
    try {
      await homologarApuracao(id, ganhadores);
      toast.success('Apuração homologada e sorteio encerrado'); navigate('/ferramentas/sorteios');
    } catch { toast.error('Erro ao salvar a apuração'); } finally { setSalvando(false); }
  };
  if (!sorteio) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando sorteio…</div>;
  return <div className="min-h-screen pb-8">
    <header className="header-gradient flex items-center gap-4 mb-6"><button onClick={() => navigate('/ferramentas/sorteios')} className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center" aria-label="Voltar"><ArrowLeft className="w-5 h-5 text-primary-foreground" /></button><h1 className="font-display text-lg font-bold text-primary-foreground truncate">Apuração · {sorteio.nome}</h1></header>
    <main className="px-4 max-w-2xl mx-auto space-y-4">
      <div className="glass-card rounded-xl p-4"><p className="text-sm text-muted-foreground">Somente números vendidos concorrem.</p><p className="text-2xl font-bold text-primary">{vendidos.length} <span className="text-sm font-normal text-muted-foreground">número(s) elegíveis</span></p></div>
      <div className="glass-card rounded-xl p-4 flex items-start justify-between gap-3"><div><Label htmlFor="unico-apuracao">Prêmio único por participante</Label><p className="text-xs text-muted-foreground">{premioUnico ? 'Quem já ganhou não concorre aos próximos prêmios.' : 'A mesma pessoa pode ganhar mais de um prêmio.'}{sorteio.premioUnico !== premioUnico && ' (alterado em relação à regra do sorteio)'}</p></div><Switch id="unico-apuracao" checked={premioUnico} onCheckedChange={setPremioUnico} /></div>
      {premios.map((premio, i) => premio && <section key={i} className="glass-card rounded-xl p-4 space-y-3">
        <h2 className="font-semibold text-foreground">{i + 1}º Prêmio · {premio}</h2>
        <div className="flex items-center gap-3"><Button disabled={animando !== null || !vendidos.length} onClick={() => sortear(i)}><Dices className="w-4 h-4 mr-2" />{animando === i ? 'Sorteando…' : `Sortear ${i + 1}º Prêmio`}</Button>{ganhadores[i] && <p className="text-sm"><b className="text-primary">Nº {padNum(ganhadores[i]!.num, sorteio.numeroFinal)}</b> · {ganhadores[i]!.nome}</p>}</div>
        <div className="space-y-2"><Label htmlFor={`manual-${i}`}>Entrada manual (Loteria Federal / globo)</Label><div className="flex gap-2"><Input id={`manual-${i}`} type="number" value={entrada[i]} onChange={(e) => setEntrada((v) => v.map((x, j) => j === i ? e.target.value : x))} placeholder="Número vendido" /><Button variant="secondary" onClick={() => usarEntrada(i)}>Identificar</Button></div>{Number(entrada[i]) > 0 && vencedorDe(Number(entrada[i])) && <p className="text-xs text-muted-foreground">Comprador: {vencedorDe(Number(entrada[i]))?.nome}</p>}</div>
      </section>)}
      <Button className="w-full" disabled={salvando || !ganhadores[0] || sorteio.status === 'encerrado'} onClick={homologar}><Trophy className="w-4 h-4 mr-2" />{salvando ? 'Salvando…' : 'Homologar e Salvar Ganhadores'}</Button>
      {sorteio.status === 'encerrado' && <p className="text-center text-sm text-muted-foreground">Este sorteio já está encerrado.</p>}
    </main>
  </div>;
};
export default SorteioApuracao;
