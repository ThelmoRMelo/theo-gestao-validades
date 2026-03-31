import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';

const DEACTIVATION_REASONS = [
  'Produto zerado (sem estoque)',
  'Transferido para outra unidade',
  'Lote encerrado manualmente',
  'Produto vencido descartado',
  'Produto avariado/danificado',
  'Uso interno/teste',
  'Outro',
] as const;

interface DeactivateLotModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  productName?: string;
}

const DeactivateLotModal = ({ open, onClose, onConfirm, productName }: DeactivateLotModalProps) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');

  const isOther = selectedReason === 'Outro';
  const isValid = selectedReason && (!isOther || customReason.trim().length > 0);

  const handleConfirm = () => {
    if (!isValid) return;
    const finalReason = isOther ? customReason.trim() : selectedReason;
    onConfirm(finalReason);
    setSelectedReason('');
    setCustomReason('');
  };

  const handleClose = () => {
    setSelectedReason('');
    setCustomReason('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="bg-card border-border max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground">Motivo da desativação do lote</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            {productName && <>Lote de <strong>{productName}</strong>. </>}
            Selecione o motivo para desativar este lote.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup value={selectedReason} onValueChange={setSelectedReason} className="space-y-3">
          {DEACTIVATION_REASONS.map((reason) => (
            <div key={reason} className="flex items-center space-x-3">
              <RadioGroupItem value={reason} id={reason} />
              <Label htmlFor={reason} className="text-foreground cursor-pointer text-sm">
                {reason}
              </Label>
            </div>
          ))}
        </RadioGroup>

        {isOther && (
          <Textarea
            placeholder="Descreva o motivo..."
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            className="bg-secondary border-border text-foreground"
            rows={3}
          />
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose} className="border-border text-foreground">
            Cancelar
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!isValid}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            Confirmar Desativação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DeactivateLotModal;
