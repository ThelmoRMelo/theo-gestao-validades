import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Undo2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Sorteio, NumeroVendido, getSorteio, listVendidos, darBaixa, estornar, parseNumeros, padNum, brl, onlyDigits } from '@/lib/sorteios';

const SorteioVendas = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [s, setS] = useState<Sorteio | null>(null);
  const [vendidos, setVendidos] = useState<NumeroVendido[]>([]);
  const [numerosTxt, setNumerosTxt] = useState('');
  const [nome, setNome] = useState('');
  const [tel, setTel] = useState('');
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async () => {
    setVendidos(await listVendidos(id));
  }, [id]);

  useEffect(() => {
    getSorteio(id).then((r) => setS(r ?? null));
    carregar();
    const ch = supabase
      .channel(`vendas-${id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sorteio_numeros', filter: `sorteio_id=eq.${id}` }, () => carregar())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, carregar]);

  const setVendidosNum = useMemo(() => new Set(vendidos.map((v) => v.numero)), [vendidos]);
  const escolhidos = parseNumeros(numerosTxt);

  if (!s) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando…</div>;

  const foraFaixa = escolhidos.filter((n) => n < s.numeroInicial || n > s.numeroFinal);
  const jaVendidos = escolhidos.filter((n) => setVendidosNum.has(n));
  const validos = escolhidos.filter((n) => !foraFaixa.includes(n) && !jaVendidos.includes(n));
  const total = s.numeroFinal - s.numeroInicial + 1;

  const confirmar = async () => {
    if (!nome.trim()) return toast.error('Informe o nome do comprador');
    if (!validos.length) return toast.error('Nenhum número válido para dar baixa');
    setSalvando(true);
    try {
      await darBaixa(id, validos, nome.trim(), tel, obs.trim());
      toast.success(`${validos.length} número(s) baixado(s) para ${nome.trim()}`);
      setNumerosTxt(''); setNome(''); setTel(''); setObs('');
      carregar();
    } catch (e) {
      toast.error('Algum número já foi vendido. Atualize e tente novamente.');
      carregar();
    } finally { setSalvando(false); }
  };

  const filtrados = vendidos.filter((v) => !busca || v.comprador_nome.toLowerCase().includes(busca.toLowerCase()) || String(v.numero).includes(busca));

  return (
    <div className="min-h-screen pb-8">
      <header className="header-gradient flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/ferramentas/sorteios')} className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center" aria-label="Voltar">
          <ArrowLeft className="w-5 h-5 text-primary-foreground" />
        </button>
        <h1 className="font-display text-lg font-bold text-primary-foreground truncate">Baixa de números · {s.nome}</h1>
      </header>

      <div className="px-4 max-w-2xl mx-auto space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-card rounded-xl p-3 text-center"><p className="text-xs text-muted-foreground">Vendidos</p><p className="font-bold text-primary">{vendidos.length}</p></div>
          <div className="glass-card rounded-xl p-3 text-center"><p className="text-xs text-muted-foreground">Disponíveis</p><p className="font-bold text-primary">{total - vendidos.length}</p></div>
          <div className="glass-card rounded-xl p-3 text-center"><p className="text-xs text-muted-foreground">Arrecadado</p><p className="font-bold text-primary">{brl(vendidos.length * s.precoUnitario)}</p></div>
        </div>

        <div className="glass-card rounded-xl p-4 space-y-3">
          <h2 className="font-semibold text-foreground">Dar baixa (venda confirmada)</h2>
          <div>
            <Label>Números * (ex.: 07, 14, 25-27)</Label>
            <Input value={numerosTxt} onChange={(e) => setNumerosTxt(e.target.value)} placeholder="Cole aqui os números da mensagem do WhatsApp" />
            {escolhidos.length > 0 && (
              <div className="text-xs mt-1 space-y-0.5">
                {validos.length > 0 && <p className="text-primary">Para baixar: {validos.map((n) => padNum(n, s.numeroFinal)).join(', ')} · {brl(validos.length * s.precoUnitario)}</p>}
                {jaVendidos.length > 0 && <p className="text-destructive">Já vendidos (ignorados): {jaVendidos.join(', ')}</p>}
                {foraFaixa.length > 0 && <p className="text-destructive">Fora da faixa (ignorados): {foraFaixa.join(', ')}</p>}
              </div>
            )}
          </div>
          <div><Label>Nome do comprador *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={100} /></div>
          <div><Label>WhatsApp do comprador</Label><Input inputMode="numeric" value={tel} onChange={(e) => setTel(onlyDigits(e.target.value))} maxLength={13} /></div>
          <div><Label>Observação</Label><Input value={obs} onChange={(e) => setObs(e.target.value)} maxLength={200} placeholder="Ex.: pago via Pix" /></div>
          <Button className="w-full" disabled={salvando} onClick={confirmar}><CheckCircle2 className="w-4 h-4 mr-2" /> Confirmar venda / Dar baixa</Button>
        </div>

        <div className="glass-card rounded-xl p-4 space-y-3">
          <h2 className="font-semibold text-foreground">Números vendidos</h2>
          <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por número ou nome" />
          {filtrados.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum número vendido.</p>}
          <div className="max-h-96 overflow-y-auto space-y-2">
            {filtrados.map((v) => (
              <div key={v.id} className="flex items-center justify-between gap-2 border border-border rounded-lg p-2">
                <div className="min-w-0">
                  <p className="text-sm text-foreground"><span className="font-mono font-bold text-primary">{padNum(v.numero, s.numeroFinal)}</span> · {v.comprador_nome}</p>
                  <p className="text-xs text-muted-foreground truncate">{v.comprador_telefone} {v.observacao && `· ${v.observacao}`} · {new Date(v.created_at).toLocaleString('pt-BR')}</p>
                </div>
                <Button size="sm" variant="secondary" onClick={async () => {
                  if (!confirm(`Estornar o número ${v.numero}? Ele volta a ficar disponível.`)) return;
                  try { await estornar(v.id); toast.success('Número liberado'); carregar(); } catch { toast.error('Erro ao estornar'); }
                }}><Undo2 className="w-3 h-3 mr-1" /> Estornar</Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SorteioVendas;
