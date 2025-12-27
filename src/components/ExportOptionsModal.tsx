import { useState } from 'react';
import { FileSpreadsheet, FileText, ArrowDownAZ, ArrowUpNarrowWide, ArrowDownNarrowWide } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

export type ExportSortOption = 'sector-az' | 'date-asc' | 'date-desc';

interface ExportOptionsModalProps {
  open: boolean;
  onClose: () => void;
  onExport: (format: 'excel' | 'pdf', sortOption: ExportSortOption) => void;
  variant?: 'default' | 'critical';
}

const ExportOptionsModal = ({ open, onClose, onExport, variant = 'default' }: ExportOptionsModalProps) => {
  const [sortOption, setSortOption] = useState<ExportSortOption>('sector-az');

  const handleExport = (format: 'excel' | 'pdf') => {
    onExport(format, sortOption);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-card border-border max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground text-center text-lg">
            Como deseja exportar?
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <RadioGroup
            value={sortOption}
            onValueChange={(value) => setSortOption(value as ExportSortOption)}
            className="space-y-3"
          >
            <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer transition-colors">
              <RadioGroupItem value="sector-az" id="sector-az" />
              <Label htmlFor="sector-az" className="flex items-center gap-2 cursor-pointer flex-1">
                <ArrowDownAZ className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Padrão do Sistema</p>
                  <p className="text-sm text-muted-foreground">A-Z Separando por Setores</p>
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer transition-colors">
              <RadioGroupItem value="date-asc" id="date-asc" />
              <Label htmlFor="date-asc" className="flex items-center gap-2 cursor-pointer flex-1">
                <ArrowUpNarrowWide className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Ordem Crescente da Validade</p>
                  <p className="text-sm text-muted-foreground">Mais próximos primeiro</p>
                </div>
              </Label>
            </div>

            <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-secondary/50 cursor-pointer transition-colors">
              <RadioGroupItem value="date-desc" id="date-desc" />
              <Label htmlFor="date-desc" className="flex items-center gap-2 cursor-pointer flex-1">
                <ArrowDownNarrowWide className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium text-foreground">Ordem Decrescente da Validade</p>
                  <p className="text-sm text-muted-foreground">Mais distantes primeiro</p>
                </div>
              </Label>
            </div>
          </RadioGroup>

          <div className="flex gap-3">
            <Button
              onClick={() => handleExport('excel')}
              className="flex-1 bg-green hover:bg-green/90 text-primary-foreground"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button
              onClick={() => handleExport('pdf')}
              className="flex-1 bg-coral hover:bg-coral/90 text-primary-foreground"
            >
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExportOptionsModal;
