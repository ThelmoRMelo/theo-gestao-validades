import { Package, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { LoteComProduto } from './LotesGrid';

interface LotesSummaryCardProps {
  lotes: LoteComProduto[];
  variant?: 'default' | 'critical';
}

export const LotesSummaryCard = ({ lotes, variant = 'default' }: LotesSummaryCardProps) => {
  // Conta cada lote individualmente (não soma unidades)
  const totalLotes = lotes.length;

  const Icon = variant === 'critical' ? AlertTriangle : Package;
  const iconColorClass = variant === 'critical' ? 'text-destructive' : 'text-primary';

  return (
    <Card className="glass-card border-border mb-4">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center`}>
              <Icon className={`w-5 h-5 ${iconColorClass}`} />
            </div>
            <div>
              <p className="text-3xl font-bold text-foreground">{totalLotes}</p>
              <p className="text-sm text-muted-foreground">
                {totalLotes === 1 ? 'Lote Ativo' : 'Lotes Ativos'}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LotesSummaryCard;
