import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import * as db from '@/lib/db';
import { deleteLotWithSync, updateLot as updateLotWithSync } from '@/lib/sync';
import type { Produto, ProductLot } from '@/lib/db';
import { useApp } from '@/contexts/AppContext';
import ExportDropdown from '@/components/ExportDropdown';
import { ExportSortOption } from '@/components/ExportOptionsModal';
import { exportToExcel, exportToPDF, exportToExcelBySector, exportToPDFBySector } from '@/lib/exportUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import LotesGrid, { LoteComProduto } from '@/components/LotesGrid';
import LotesSummaryCard from '@/components/LotesSummaryCard';
import EditLotModal from '@/components/EditLotModal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const ValidadesCriticas = () => {
  const navigate = useNavigate();
  const { user, refreshCounts } = useApp();
  const [lotes, setLotes] = useState<LoteComProduto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loteToDelete, setLoteToDelete] = useState<LoteComProduto | null>(null);
  const [editingLot, setEditingLot] = useState<LoteComProduto | null>(null);

  useEffect(() => {
    loadLotes();
  }, []);

  const loadLotes = async () => {
    const [allLots, allProdutos] = await Promise.all([
      db.getAllLots(),
      db.getAllProdutos(),
    ]);

    const produtoMap = new Map(allProdutos.map(p => [p.barcode, p]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    
    // Data limite: 20 dias a partir de hoje (crítico)
    const criticalDate = new Date(today);
    criticalDate.setDate(today.getDate() + 20);
    const criticalDateStr = criticalDate.toISOString().split('T')[0];
    
    // Filtrar apenas lotes de produtos ATIVOS
    const activeBarcodes = new Set(allProdutos.filter(p => p.is_active !== false).map(p => p.barcode));
    
    // Lotes ativos, não vencidos, dentro de 20 dias
    const lotesCriticos = allLots
      .filter(l => 
        l.status === 'active' && 
        l.expiration_date >= todayStr &&
        l.expiration_date <= criticalDateStr &&
        activeBarcodes.has(l.barcode)
      )
      .map(lot => ({
        ...lot,
        produto: produtoMap.get(lot.barcode),
      }))
      .sort((a, b) => a.expiration_date.localeCompare(b.expiration_date));

    setLotes(lotesCriticos);
    setIsLoading(false);
  };

  const getDaysUntil = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(dateStr + 'T00:00:00');
    return Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  };

  const getUrgencyLabel = (days: number) => {
    if (days <= 0) return 'VENCIDO';
    if (days === 1) return 'AMANHÃ';
    if (days <= 7) return 'URGENTE';
    if (days <= 15) return 'CRÍTICO';
    if (days <= 30) return 'ATENÇÃO';
    return 'ALERTA';
  };

  // Ordenar lotes conforme opção selecionada
  const sortLotes = (lotesToSort: typeof lotes, sortOption: ExportSortOption) => {
    const sorted = [...lotesToSort];
    
    switch (sortOption) {
      case 'sector-az':
        // Ordenar por setor (A-Z) e depois por nome do produto (A-Z)
        sorted.sort((a, b) => {
          const sectorA = a.produto?.sector || 'Geral';
          const sectorB = b.produto?.sector || 'Geral';
          const sectorCompare = sectorA.localeCompare(sectorB, 'pt-BR');
          if (sectorCompare !== 0) return sectorCompare;
          
          const nameA = a.produto?.name || '';
          const nameB = b.produto?.name || '';
          return nameA.localeCompare(nameB, 'pt-BR');
        });
        break;
      case 'date-asc':
        sorted.sort((a, b) => a.expiration_date.localeCompare(b.expiration_date));
        break;
      case 'date-desc':
        sorted.sort((a, b) => b.expiration_date.localeCompare(a.expiration_date));
        break;
    }
    
    return sorted;
  };

  const getExportDataBySector = (sortOption: ExportSortOption) => {
    const sortedLotes = sortLotes(lotes, sortOption);
    const headers = ['Produto', 'Código', 'Qtd', 'Validade', 'Dias Rest.'];
    
    // Agrupar por setor
    const sectorMap = new Map<string, typeof sortedLotes>();
    for (const lote of sortedLotes) {
      const sector = lote.produto?.sector || 'Geral';
      if (!sectorMap.has(sector)) {
        sectorMap.set(sector, []);
      }
      sectorMap.get(sector)!.push(lote);
    }
    
    // Ordenar setores alfabeticamente
    const sortedSectors = Array.from(sectorMap.keys()).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    
    const sectors = sortedSectors.map(sector => {
      const sectorLotes = sectorMap.get(sector)!;
      // Ordenar produtos dentro do setor por nome A-Z
      sectorLotes.sort((a, b) => {
        const nameA = a.produto?.name || '';
        const nameB = b.produto?.name || '';
        return nameA.localeCompare(nameB, 'pt-BR');
      });
      
      return {
        sector,
        rows: sectorLotes.map(lote => {
          const days = getDaysUntil(lote.expiration_date);
          return [
            lote.produto?.name || 'Desconhecido',
            lote.barcode,
            lote.quantity.toString(),
            formatDate(lote.expiration_date),
            days === 1 ? '1 dia' : days <= 0 ? `${days} dias` : `${days} dias`,
          ];
        }),
      };
    });
    
    return {
      headers,
      sectors,
      title: 'Validades Críticas (Até 20 Dias)',
      totalLotes: sortedLotes.length,
    };
  };

  const getExportDataSimple = (sortOption: ExportSortOption) => {
    const sortedLotes = sortLotes(lotes, sortOption);
    const headers = ['Produto', 'Código de Barras', 'Setor', 'Quantidade', 'Validade', 'Dias Restantes', 'Urgência'];
    
    const rows = sortedLotes.map(lote => {
      const days = getDaysUntil(lote.expiration_date);
      return [
        lote.produto?.name || 'Desconhecido',
        lote.barcode,
        lote.produto?.sector || 'Geral',
        lote.quantity.toString(),
        formatDate(lote.expiration_date),
        days.toString(),
        getUrgencyLabel(days),
      ];
    });

    const sortLabel = sortOption === 'date-asc' 
      ? ' (Validade Crescente)' 
      : ' (Validade Decrescente)';

    return {
      headers,
      rows,
      title: 'Validades Críticas' + sortLabel,
    };
  };

  const handleExport = (format: 'excel' | 'pdf', sortOption: ExportSortOption) => {
    const filename = `validades-criticas-${new Date().toISOString().split('T')[0]}`;
    
    if (sortOption === 'sector-az') {
      // Exportação padrão do sistema com separação por setor
      const data = getExportDataBySector(sortOption);
      if (format === 'excel') {
        exportToExcelBySector(data, filename);
      } else {
        exportToPDFBySector(data, filename);
      }
    } else {
      // Exportação simples ordenada por validade
      const data = getExportDataSimple(sortOption);
      if (format === 'excel') {
        exportToExcel(data, filename);
      } else {
        exportToPDF(data, filename);
      }
    }
  };

  const canEditLot = (lot: LoteComProduto) => {
    if (!user) return false;
    const isOwnLot =
      lot.created_by === user.cloud_user_id ||
      lot.created_by === user.local_user_id;
    if (isOwnLot) return true;
    return user.can_edit_others_lots;
  };

  const canDeleteLot = (lot: LoteComProduto) => {
    if (!user) return false;
    const isOwnLot =
      lot.created_by === user.cloud_user_id ||
      lot.created_by === user.local_user_id;
    if (isOwnLot) return true;
    return user.can_delete_lots;
  };

  const handleToggleStatus = async (lote: LoteComProduto) => {
    if (!canEditLot(lote)) {
      toast.error('Você não tem permissão para alterar este lote');
      return;
    }
    const newStatus = lote.status === 'active' ? 'disabled' : 'active';
    await updateLotWithSync({ ...lote, status: newStatus });
    toast.success(newStatus === 'active' ? 'Lote ativado' : 'Lote desativado');
    await refreshCounts();
    loadLotes();
  };

  const handleEdit = (lote: LoteComProduto) => {
    if (!canEditLot(lote)) {
      toast.error('Você não tem permissão para editar este lote');
      return;
    }
    setEditingLot(lote);
  };

  const handleDeleteClick = (lote: LoteComProduto, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canDeleteLot(lote)) {
      toast.error('Você não tem permissão para excluir este lote');
      return;
    }
    setLoteToDelete(lote);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (loteToDelete) {
      await deleteLotWithSync(loteToDelete.id);
      toast.success('Lote excluído com sucesso');
      await refreshCounts();
      loadLotes();
    }
    setDeleteDialogOpen(false);
    setLoteToDelete(null);
  };

  const handleEditSave = async () => {
    setEditingLot(null);
    await refreshCounts();
    loadLotes();
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header - usando variável de tema */}
      <header className="py-6 px-4 flex items-center justify-between mb-6" style={{ background: 'var(--gradient-header-critical)' }}>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="w-10 h-10 rounded-xl bg-destructive-foreground/20 flex items-center justify-center transition-colors hover:bg-destructive-foreground/30"
          >
            <ArrowLeft className="w-5 h-5 text-destructive-foreground" />
          </button>
          <div>
            <h1 className="font-display text-xl font-bold text-destructive-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Validades Críticas
            </h1>
            <p className="text-destructive-foreground/80 text-sm">
              {lotes.length} lotes em alerta
            </p>
          </div>
        </div>
        <ExportDropdown 
          onExport={handleExport}
          variant="critical"
        />
      </header>

      <div className="px-4">
        {/* Card de Resumo */}
        {!isLoading && lotes.length > 0 && (
          <LotesSummaryCard lotes={lotes} variant="critical" />
        )}

        {/* Grid de Lotes */}
        <Card className="border-destructive/20">
          <CardHeader className="pb-3 border-b border-border">
            <CardTitle className="flex items-center gap-2 text-lg text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Lotes com Validade Crítica
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center">
                <div className="animate-pulse text-muted-foreground">Carregando...</div>
              </div>
            ) : lotes.length === 0 ? (
              <div className="p-8 text-center">
                <AlertTriangle className="w-12 h-12 text-green mx-auto mb-3" />
                <p className="text-green font-medium">Nenhuma validade crítica!</p>
                <p className="text-muted-foreground text-sm mt-1">
                  Todos os produtos estão com validade segura
                </p>
              </div>
            ) : (
              <LotesGrid
                lotes={lotes}
                user={user}
                onToggleStatus={handleToggleStatus}
                onEdit={handleEdit}
                onDelete={handleDeleteClick}
                canEditLot={canEditLot}
                canDeleteLot={canDeleteLot}
              />
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de Edição */}
      {editingLot && (
        <EditLotModal
          lot={editingLot}
          onClose={() => setEditingLot(null)}
          onSave={handleEditSave}
        />
      )}

      {/* Dialog de Exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Excluir Lote</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja excluir o lote de "{loteToDelete?.produto?.name}"? 
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-foreground hover:bg-secondary">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete} 
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ValidadesCriticas;
