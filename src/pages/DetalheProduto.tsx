import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Package, Layers, Plus, Edit2, Trash2, Calendar, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useApp } from '@/contexts/AppContext';
import { toast } from 'sonner';
import * as db from '@/lib/db';
import { deleteLotWithSync } from '@/lib/sync';
import type { Produto, ProductLot } from '@/lib/db';
import EditLotModal from '@/components/EditLotModal';

const DetalheProduto = () => {
  const navigate = useNavigate();
  const { barcode } = useParams<{ barcode: string }>();
  const { user, refreshCounts } = useApp();
  
  const [produto, setProduto] = useState<Produto | null>(null);
  const [lots, setLots] = useState<ProductLot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingLot, setEditingLot] = useState<ProductLot | null>(null);

  useEffect(() => {
    if (barcode) loadProduto();
  }, [barcode]);

  const loadProduto = async () => {
    if (!barcode) return;
    
    const prod = await db.getProdutoByBarcode(barcode);
    const prodLots = await db.getLotsByBarcode(barcode);
    
    setProduto(prod || null);
    setLots(prodLots.sort((a, b) => a.expiration_date.localeCompare(b.expiration_date)));
    setIsLoading(false);
  };

  const handleDeleteLot = async (lotId: string) => {
    const lot = lots.find(l => l.id === lotId);
    if (!lot) return;

    // Usuário pode excluir seus próprios lotes OU lotes de outros se tiver permissão
    const isOwnLot =
      lot.created_by === user?.cloud_user_id ||
      lot.created_by === user?.local_user_id;
    const canDelete = isOwnLot || user?.can_delete_lots;

    if (!canDelete) {
      toast.error('Você não tem permissão para excluir este lote');
      return;
    }

    if (confirm('Deseja realmente excluir este lote?')) {
      await deleteLotWithSync(lotId);
      await loadProduto();
      await refreshCounts();
      toast.success('Lote excluído!');
    }
  };

  const canEditLot = (lot: ProductLot) => {
    if (!user) return false;
    const isOwnLot =
      lot.created_by === user.cloud_user_id ||
      lot.created_by === user.local_user_id;
    if (isOwnLot) return true;
    return user.can_edit_others_lots;
  };

  const canDeleteLot = (lot: ProductLot) => {
    if (!user) return false;
    const isOwnLot =
      lot.created_by === user.cloud_user_id ||
      lot.created_by === user.local_user_id;
    if (isOwnLot) return true;
    return user.can_delete_lots;
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  };

  const getDaysUntil = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(dateStr + 'T00:00:00');
    return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getStatusColor = (dateStr: string, status: string) => {
    if (status === 'disabled') return 'border-muted-foreground/50 bg-muted/30';
    const days = getDaysUntil(dateStr);
    if (days < 0) return 'border-destructive bg-destructive/10';
    if (days <= 7) return 'border-coral bg-coral/10';
    if (days <= 30) return 'border-orange bg-orange/10';
    if (days <= 60) return 'border-yellow bg-yellow/10';
    return 'border-green bg-green/10';
  };

  const getStatusLabel = (dateStr: string, status: string) => {
    if (status === 'disabled') return 'Desativado';
    const days = getDaysUntil(dateStr);
    if (days < 0) return 'Vencido';
    if (days === 0) return 'Vence hoje';
    if (days === 1) return 'Vence amanhã';
    return `${days} dias`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!produto) {
    return (
      <div className="min-h-screen p-4">
        <div className="glass-card p-8 text-center">
          <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">Produto não encontrado</p>
          <Button onClick={() => navigate('/consultar')} className="mt-4">
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <header className="header-gradient flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-primary-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="font-display text-lg font-bold text-primary-foreground line-clamp-1">
            {produto.name}
          </h1>
          <p className="text-primary-foreground/80 text-sm">
            {produto.barcode}
          </p>
        </div>
      </header>

      <div className="px-4 space-y-4">
        {/* Info do Produto */}
        <div className="glass-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-xl bg-cyan/20 flex items-center justify-center">
              <Package className="w-6 h-6 text-cyan" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">{produto.name}</h2>
              <p className="text-sm text-muted-foreground">Setor: {produto.sector}</p>
            </div>
          </div>
          <div className="flex gap-4 text-sm">
            <span className="text-muted-foreground">
              Alerta: <span className="text-orange">{produto.alert_days} dias</span>
            </span>
            <span className="text-muted-foreground">
              Lotes: <span className="text-cyan">{lots.filter(l => l.status === 'active').length} ativos</span>
            </span>
          </div>
        </div>

        {/* Título Lotes + Botão Adicionar */}
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-foreground flex items-center gap-2">
            <Layers className="w-5 h-5 text-orange" />
            Lotes ({lots.length})
          </h3>
          <Button
            onClick={() => navigate(`/cadastrar?barcode=${barcode}`)}
            size="sm"
            className="btn-neon"
          >
            <Plus className="w-4 h-4 mr-1" />
            Novo Lote
          </Button>
        </div>

        {/* Lista de Lotes */}
        <div className="space-y-3">
          {lots.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <Layers className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum lote cadastrado</p>
            </div>
          ) : (
            lots.map((lot) => (
              <div
                key={lot.id}
                className={`glass-card p-4 border-l-4 ${getStatusColor(lot.expiration_date, lot.status)}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="flex items-center gap-1 text-sm">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold text-foreground">
                          {formatDate(lot.expiration_date)}
                        </span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        lot.status === 'disabled' 
                          ? 'bg-muted text-muted-foreground'
                          : getDaysUntil(lot.expiration_date) <= 30 
                            ? 'bg-coral/20 text-coral'
                            : 'bg-green/20 text-green'
                      }`}>
                        {getStatusLabel(lot.expiration_date, lot.status)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Hash className="w-4 h-4" />
                      Quantidade: <span className="text-foreground font-medium">{lot.quantity}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    {canEditLot(lot) && (
                      <button
                        onClick={() => setEditingLot(lot)}
                        className="p-2 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                      >
                        <Edit2 className="w-4 h-4 text-cyan" />
                      </button>
                    )}
                    {canDeleteLot(lot) && (
                      <button
                        onClick={() => handleDeleteLot(lot.id)}
                        className="p-2 rounded-lg bg-destructive/20 hover:bg-destructive/30 transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal de Edição */}
      {editingLot && (
        <EditLotModal
          lot={editingLot}
          onClose={() => setEditingLot(null)}
          onSave={async () => {
            await loadProduto();
            await refreshCounts();
            setEditingLot(null);
          }}
        />
      )}
    </div>
  );
};

export default DetalheProduto;
