import { Calendar, Pencil, Trash2, Eye } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { Produto, ProductLot, LocalUser } from '@/lib/db';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';

export interface LoteComProduto extends ProductLot {
  produto?: Produto;
}

interface LotesGridProps {
  lotes: LoteComProduto[];
  user: LocalUser | null;
  onToggleStatus: (lote: LoteComProduto) => void;
  onEdit: (lote: LoteComProduto) => void;
  onDelete: (lote: LoteComProduto, e: React.MouseEvent) => void;
  canEditLot: (lot: LoteComProduto) => boolean;
  canDeleteLot: (lot: LoteComProduto) => boolean;
}

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

const getDaysBadgeVariant = (days: number): 'destructive' | 'secondary' | 'default' => {
  if (days <= 7) return 'destructive';
  if (days <= 30) return 'secondary';
  return 'default';
};

const getStatusBadgeVariant = (status: string): 'default' | 'secondary' => {
  return status === 'active' ? 'default' : 'secondary';
};

export const LotesGrid = ({
  lotes,
  user,
  onToggleStatus,
  onEdit,
  onDelete,
  canEditLot,
  canDeleteLot,
}: LotesGridProps) => {
  const navigate = useNavigate();

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="border-border">
            {/* ORDEM FIXA: Código, Descrição, Setor, Qtd, Dias, Validade, Status, Ações */}
            <TableHead className="text-foreground whitespace-nowrap">Código</TableHead>
            <TableHead className="text-foreground min-w-[200px]">Descrição</TableHead>
            <TableHead className="text-foreground whitespace-nowrap">Setor</TableHead>
            <TableHead className="text-foreground text-center whitespace-nowrap">Qtd</TableHead>
            <TableHead className="text-foreground text-center whitespace-nowrap">Dias</TableHead>
            <TableHead className="text-foreground whitespace-nowrap">Validade</TableHead>
            <TableHead className="text-foreground text-center whitespace-nowrap">Status</TableHead>
            <TableHead className="text-foreground text-right whitespace-nowrap">Ações</TableHead>
            <TableHead className="text-foreground whitespace-nowrap">Criado em</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lotes.map((lote) => {
            const days = getDaysUntil(lote.expiration_date);
            const canEdit = canEditLot(lote);
            const canDelete = canDeleteLot(lote);

            return (
              <TableRow
                key={lote.id}
                className="border-border hover:bg-secondary/50 transition-colors"
              >
                {/* 1. Código de Barras */}
                <TableCell className="text-muted-foreground text-xs font-mono whitespace-nowrap">
                  {lote.barcode}
                </TableCell>

                {/* 2. Descrição do Produto - SEM TRUNCAMENTO, quebra linha */}
                <TableCell className="text-foreground font-medium min-w-[200px]">
                  <div className="whitespace-normal break-words">
                    {lote.produto?.name || 'Produto não encontrado'}
                  </div>
                </TableCell>

                {/* 3. Setor */}
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {lote.produto?.sector || 'Geral'}
                </TableCell>

                {/* 4. Quantidade do Lote */}
                <TableCell className="text-center text-foreground font-semibold">
                  {lote.quantity}
                </TableCell>

                {/* 5. Dias Restantes */}
                <TableCell className="text-center">
                  <Badge
                    variant={getDaysBadgeVariant(days)}
                    className={days <= 7 ? 'animate-pulse' : ''}
                  >
                    {days}d
                  </Badge>
                </TableCell>

                {/* 6. Data de Validade */}
                <TableCell className="whitespace-nowrap">
                  <span className="flex items-center gap-1 text-sm text-foreground">
                    <Calendar className="w-3 h-3 text-muted-foreground" />
                    {formatDate(lote.expiration_date)}
                  </span>
                </TableCell>

                {/* 7. Status do Lote (Toggle) */}
                <TableCell className="text-center">
                  {canEdit ? (
                    <Switch
                      checked={lote.status === 'active'}
                      onCheckedChange={() => onToggleStatus(lote)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <Badge variant={getStatusBadgeVariant(lote.status || 'active')}>
                      {lote.status === 'active' ? 'Ativo' : 'Desativado'}
                    </Badge>
                  )}
                </TableCell>

                {/* 8. Controles / Ações */}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {/* Visualizar */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => navigate(`/produto/${lote.barcode}`)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>

                    {/* Editar Lote */}
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-primary"
                        onClick={() => onEdit(lote)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                    )}

                    {/* Excluir Lote */}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={(e) => onDelete(lote, e)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default LotesGrid;
