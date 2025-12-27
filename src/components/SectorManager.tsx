import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Save, 
  X,
  FolderOpen 
} from 'lucide-react';
import * as db from '@/lib/db';
import { createSector, updateSector, deleteSectorWithSync } from '@/lib/sync';
import { toast } from 'sonner';
import type { Sector } from '@/lib/db';

interface SectorManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onSectorsChange?: (sectors: Sector[]) => void;
}

export function SectorManager({ isOpen, onClose, onSectorsChange }: SectorManagerProps) {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newSectorName, setNewSectorName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [sectorToDelete, setSectorToDelete] = useState<Sector | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSectors();
    }
  }, [isOpen]);

  const loadSectors = async () => {
    setIsLoading(true);
    const allSectors = await db.getAllSectors();
    setSectors(allSectors);
    setIsLoading(false);
  };

  const handleCreateSector = async () => {
    if (!newSectorName.trim()) {
      toast.error('Nome do setor é obrigatório');
      return;
    }

    // Check for duplicate
    if (sectors.some(s => s.name.toLowerCase() === newSectorName.trim().toLowerCase())) {
      toast.error('Já existe um setor com este nome');
      return;
    }

    try {
      const newSector = await createSector(newSectorName.trim());
      const updatedSectors = [...sectors, newSector];
      setSectors(updatedSectors);
      setNewSectorName('');
      onSectorsChange?.(updatedSectors);
      toast.success('Setor criado com sucesso');
    } catch (error) {
      console.error('Erro ao criar setor:', error);
      toast.error('Erro ao criar setor');
    }
  };

  const startEditing = (sector: Sector) => {
    setEditingId(sector.id);
    setEditingName(sector.name);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleUpdateSector = async (id: string) => {
    if (!editingName.trim()) {
      toast.error('Nome do setor é obrigatório');
      return;
    }

    // Check for duplicate (excluding current)
    if (sectors.some(s => s.id !== id && s.name.toLowerCase() === editingName.trim().toLowerCase())) {
      toast.error('Já existe um setor com este nome');
      return;
    }

    try {
      await updateSector(id, editingName.trim());
      const updatedSectors = sectors.map(s => 
        s.id === id ? { ...s, name: editingName.trim() } : s
      );
      setSectors(updatedSectors);
      setEditingId(null);
      setEditingName('');
      onSectorsChange?.(updatedSectors);
      toast.success('Setor atualizado');
    } catch (error) {
      console.error('Erro ao atualizar setor:', error);
      toast.error('Erro ao atualizar setor');
    }
  };

  const handleDeleteClick = (sector: Sector) => {
    setSectorToDelete(sector);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!sectorToDelete) return;

    try {
      await deleteSectorWithSync(sectorToDelete.id);
      const updatedSectors = sectors.filter(s => s.id !== sectorToDelete.id);
      setSectors(updatedSectors);
      onSectorsChange?.(updatedSectors);
      toast.success('Setor excluído');
    } catch (error) {
      console.error('Erro ao excluir setor:', error);
      toast.error('Erro ao excluir setor');
    } finally {
      setDeleteDialogOpen(false);
      setSectorToDelete(null);
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderOpen className="w-5 h-5 text-primary" />
              Gerenciar Setores
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {/* Add new sector */}
            <div className="flex gap-2">
              <Input
                value={newSectorName}
                onChange={(e) => setNewSectorName(e.target.value)}
                placeholder="Nome do novo setor"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateSector()}
              />
              <Button onClick={handleCreateSector} size="icon">
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Sector list */}
            <div className="space-y-2">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground animate-pulse">
                  Carregando...
                </div>
              ) : sectors.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum setor cadastrado
                </div>
              ) : (
                sectors.map((sector) => (
                  <div
                    key={sector.id}
                    className="flex items-center gap-2 p-3 border rounded-lg bg-card"
                  >
                    {editingId === sector.id ? (
                      <>
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="flex-1"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleUpdateSector(sector.id);
                            if (e.key === 'Escape') cancelEditing();
                          }}
                        />
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-green"
                          onClick={() => handleUpdateSector(sector.id)}
                        >
                          <Save className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={cancelEditing}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1 font-medium">{sector.name}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => startEditing(sector)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteClick(sector)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Setor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o setor "{sectorToDelete?.name}"?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default SectorManager;
