import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ExportOptionsModal, { ExportSortOption } from './ExportOptionsModal';

interface ExportDropdownProps {
  onExport: (format: 'excel' | 'pdf', sortOption: ExportSortOption) => void;
  variant?: 'default' | 'critical';
}

const ExportDropdown = ({ onExport, variant = 'default' }: ExportDropdownProps) => {
  const [modalOpen, setModalOpen] = useState(false);

  const buttonClass = variant === 'critical' 
    ? 'bg-destructive-foreground/20 border-destructive-foreground/40 text-destructive-foreground hover:bg-destructive-foreground/30' 
    : 'bg-primary-foreground/20 border-primary-foreground/40 text-primary-foreground hover:bg-primary-foreground/30';

  return (
    <>
      <Button 
        size="sm" 
        variant="outline" 
        className={buttonClass}
        onClick={() => setModalOpen(true)}
      >
        <Download className="w-4 h-4 mr-1" />
        Exportar
      </Button>

      <ExportOptionsModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onExport={onExport}
        variant={variant}
      />
    </>
  );
};

export default ExportDropdown;
