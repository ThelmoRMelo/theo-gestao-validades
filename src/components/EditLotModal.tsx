import { useState } from 'react';
import { X, Save, Calendar, Hash, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { updateLot } from '@/lib/sync';
import type { ProductLot } from '@/lib/db';

interface EditLotModalProps {
  lot: ProductLot;
  onClose: () => void;
  onSave: () => Promise<void>;
}

const EditLotModal = ({ lot, onClose, onSave }: EditLotModalProps) => {
  const [expirationDate, setExpirationDate] = useState(lot.expiration_date);
  const [quantity, setQuantity] = useState(lot.quantity.toString());
  const [status, setStatus] = useState(lot.status);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!expirationDate) {
      toast.error('Data de validade é obrigatória');
      return;
    }

    setIsLoading(true);

    try {
      const result = await updateLot({
        ...lot,
        expiration_date: expirationDate,
        quantity: parseInt(quantity) || 1,
        status,
      });

      if (!result.success) {
        toast.error(result.error || 'Erro ao atualizar lote');
        setIsLoading(false);
        return;
      }

      toast.success('Lote atualizado!');
      await onSave();
    } catch (error) {
      console.error('Erro ao atualizar lote:', error);
      toast.error('Erro ao atualizar lote');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="glass-card w-full max-w-md relative z-10 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display text-xl font-bold text-primary">Editar Lote</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label className="flex items-center gap-2 text-muted-foreground mb-2">
              <Calendar className="w-4 h-4" />
              Data de Validade
            </Label>
            <Input
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              className="input-futuristic"
            />
          </div>

          <div>
            <Label className="flex items-center gap-2 text-muted-foreground mb-2">
              <Hash className="w-4 h-4" />
              Quantidade
            </Label>
            <Input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="input-futuristic"
            />
          </div>

          <div>
            <Label className="flex items-center gap-2 text-muted-foreground mb-2">
              <Power className="w-4 h-4" />
              Status
            </Label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStatus('active')}
                className={`flex-1 py-3 rounded-xl transition-all ${
                  status === 'active'
                    ? 'bg-green/20 border-2 border-green text-green'
                    : 'bg-secondary text-secondary-foreground border-2 border-transparent'
                }`}
              >
                Ativo
              </button>
              <button
                type="button"
                onClick={() => setStatus('disabled')}
                className={`flex-1 py-3 rounded-xl transition-all ${
                  status === 'disabled'
                    ? 'bg-muted border-2 border-muted-foreground text-muted-foreground'
                    : 'bg-secondary text-secondary-foreground border-2 border-transparent'
                }`}
              >
                Desativado
              </button>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="btn-neon flex-1"
            >
              {isLoading ? 'Salvando...' : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Salvar
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditLotModal;
