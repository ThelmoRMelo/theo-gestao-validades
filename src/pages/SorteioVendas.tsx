import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Undo2, Clock } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Sorteio, NumeroVendido, SorteioReserva, getSorteio, listVendidos, listarReservasPendentes, resolverReserva, darBaixa, estornar, parseNumeros, padNum, brl, onlyDigits } from '@/lib/sorteios';

const SorteioVendas = () => {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [s, setS] = useState<Sorteio | null>(null);
  const [vendidos, setVendidos] = useState<NumeroVendido[]>([]);
  const [reservas, setReservas] = useState<SorteioReserva[]>([]);
  const [agora, setAgora] = useState(Date.now());
  const [numerosTxt, setNumerosTxt] = useState('');
  const [nome, setNome] = useState('');
  const [tel, setTel] = useState('');
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [busca, setBusca] = useState('');

  const carregar = useCallback(async () => {
    try {
      const [listaVendidos, listaReservas] = await Promise.all([listVendidos(id), listarReservasPendentes(id)]);
      setVendidos(listaVendidos);
      setReservas(listaReservas);
    } catch { toast.error('Erro ao atualizar vendas e reservas'); }
  }, [id]);

  useEffect(() => {
    getSorteio(id).then((r) => setS(r ?? null));
    carregar();
    const ch = supabase
      .channel(`vendas-${id}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sorteio_numeros', filter: `sorteio_id=eq.${id}` }, () => carregar())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sorteio_reservas', filter: `sorteio_id=eq.${id}` }, () => carregar())
      .subscribe();
    const relogio = window.setInterval(() => setAgora(Date.now()), 1000);
    const atualizarExpiradas = window.setInterval(() => carregar(), 30_000);
    return () => { window.clearInterval(relogio); window.clearInterval(atualizarExpiradas); supabase.removeChannel(ch); };
  }, [id, carregar]);

  const setVendidosNum = useMemo(() => new Set(vendidos.map((v) => v.numero)), [vendidos]);
  const reservasAtivas = useMemo(() => reservas.filter((r) => new Date(r.expires_at).getTime() > agora), [reservas, agora]);
  const setReservadosNum = useMemo(() => new Set(reservasAtivas.flatMap((r) => r.numeros)), [reservasAtivas]);
  const escolhidos = parseNumeros(numerosTxt);

  if (!s) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Carregando…</div>;

  const foraFaixa = escolhidos.filter((n) => n < s.numeroInicial || n > s.numeroFinal);
  const jaVendidos = escolhidos.filter((n) => setVendidosNum.has(n));
  const jaReservados = escolhidos.filter((n) => setReservadosNum.has(n));
  const validos = escolhidos.filter((n) => !foraFaixa.includes(n) && !jaVendidos.includes(n) && !jaReservados.includes(n));
  const total = s.numeroFinal - s.numeroInicial + 1;
  const calcularTempoRestante = (expiresAt: string) => {
    const diff = Math.max(0, Math.floor((new Date(expiresAt).getTime() - agora) / 1000));
    const m = Math.floor(diff / 60);
    const seg = diff % 60;
    return `${m}m ${seg < 10 ? '0' : ''}${seg}s`;
  };

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
          <div className="glass-card rounded-xl p-3 text-center"><p className="text-xs text-muted-foreground">Disponíveis</p><p className="font-bold text-primary">{total - vendidos.length - setReservadosNum.size}</p></div>
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
                {jaReservados.length > 0 && <p className="text-amber-400">Em reserva ativa (use o pedido pendente para confirmar): {jaReservados.join(', ')}</p>}
              </div>
            )}
          </div>
          <div><Label>Nome do comprador *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={100} /></div>
          <div><Label>WhatsApp do comprador</Label><Input inputMode="numeric" value={tel} onChange={(e) => setTel(onlyDigits(e.target.value))} maxLength={13} /></div>
          <div><Label>Observação</Label><Input value={obs} onChange={(e) => setObs(e.target.value)} maxLength={200} placeholder="Ex.: pago via Pix" /></div>
          <Button className="w-full" disabled={salvando || validos.length === 0} onClick={confirmar}><CheckCircle2 className="w-4 h-4 mr-2" /> Confirmar venda / Dar baixa</Button>
        </div>

        <div className="glass-card rounded-xl p-4 space-y-3 border border-amber-500/30">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-foreground flex items-center gap-2"><Clock className="w-4 h-4 text-amber-400" /> Pedidos Pendentes ({reservasAtivas.length})</h2>
            <span className="text-xs text-muted-foreground">Reservas ativas de 30 min</span>
          </div>
          {reservasAtivas.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum pedido pendente no momento.</p>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {reservasAtivas.map((res) => {
                const telefoneWa = res.comprador_telefone.startsWith('55') ? res.comprador_telefone : `55${res.comprador_telefone}`;
                return <div key={res.id} className="border border-border rounded-xl p-3 bg-card/40 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground text-sm">{res.comprador_nome}</p>
                      <a href={`https://wa.me/${telefoneWa}`} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">WhatsApp: {res.comprador_telefone}</a>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-mono font-bold bg-amber-500/20 text-amber-400">Expira em: {calcularTempoRestante(res.expires_at)}</span>
                      <p className="text-xs font-bold text-primary mt-1">{brl(res.numeros.length * res.preco_unitario)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {res.numeros.map((n) => <span key={n} className="px-2 py-0.5 rounded bg-primary/20 text-primary text-xs font-mono font-bold">{padNum(n, s.numeroFinal)}</span>)}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 pt-1 border-t border-border/50">
                    <Button size="sm" variant="outline" onClick={() => {
                      setNumerosTxt(res.numeros.join(', ')); setNome(res.comprador_nome); setTel(res.comprador_telefone); setObs(`Pedido #${res.id.slice(0, 8)}`);
                      toast.info('Dados carregados. Para dar baixa manual nesses números, cancele a reserva primeiro.');
                    }}>Carregar no Form</Button>
                    <Button size="sm" variant="destructive" onClick={async () => {
                      if (!confirm(`Cancelar reserva de ${res.comprador_nome} e liberar os números?`)) return;
                      try { await resolverReserva(res.id, false); toast.success('Reserva cancelada e números liberados'); await carregar(); }
                      catch (err) { toast.error(err instanceof Error ? err.message : 'Erro ao cancelar reserva'); }
                    }}>Cancelar</Button>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={async () => {
                      try { await resolverReserva(res.id, true); toast.success(`Pedido de ${res.comprador_nome} confirmado e números baixados!`); await carregar(); }
                      catch (err) { toast.error(err instanceof Error ? err.message : 'Erro ao confirmar pedido'); }
                    }}><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Confirmar (1 clique)</Button>
                  </div>
                </div>;
              })}
            </div>
          )}
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
