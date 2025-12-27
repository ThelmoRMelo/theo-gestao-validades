import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Package, Barcode, Save, ScanLine, Layers, Calendar, Settings2 } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import * as db from '@/lib/db';
import { createProduto, createLot } from '@/lib/sync';
import type { Produto, Sector } from '@/lib/db';
import BarcodeScanner from '@/components/BarcodeScanner';
import QuantityCalculator from '@/components/QuantityCalculator';
import SectorManager from '@/components/SectorManager';

const CadastrarProduto = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, refreshCounts } = useApp();
  
  // Dados do PRODUTO
  const [barcode, setBarcode] = useState(searchParams.get('barcode') || '');
  const [name, setName] = useState('');
  const [sector, setSector] = useState('Geral');
  const [alertDays, setAlertDays] = useState('60');
  const [sectors, setSectors] = useState<Sector[]>([]);
  
  // Dados do LOTE (opcional)
  const [lotExpirationDate, setLotExpirationDate] = useState('');
  const [lotQuantity, setLotQuantity] = useState(0);
  
  // Estados de controle
  const [existingProduct, setExistingProduct] = useState<Produto | null>(null);
  const [productSaved, setProductSaved] = useState(false);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [isLoadingLot, setIsLoadingLot] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isSectorManagerOpen, setIsSectorManagerOpen] = useState(false);

  const handleBarcodeScanned = (scannedBarcode: string) => {
    setBarcode(scannedBarcode);
  };

  useEffect(() => {
    loadSectors();
  }, []);

  useEffect(() => {
    if (barcode.length >= 8) {
      checkExistingProduct();
    } else {
      setExistingProduct(null);
      setProductSaved(false);
    }
  }, [barcode]);

  const loadSectors = async () => {
    const localSectors = await db.getAllSectors();
    if (localSectors.length > 0) {
      setSectors(localSectors);
    } else {
      setSectors([
        { id: '1', name: 'Geral' },
        { id: '2', name: 'Mercearia' },
        { id: '3', name: 'Bebidas' },
        { id: '4', name: 'Frios' },
        { id: '5', name: 'Hortifruti' },
        { id: '6', name: 'Limpeza' },
        { id: '7', name: 'Higiene' },
      ]);
    }
  };

  const checkExistingProduct = async () => {
    const produto = await db.getProdutoByBarcode(barcode);
    if (produto) {
      setExistingProduct(produto);
      setProductSaved(true);
      setName(produto.name);
      setSector(produto.sector);
      setAlertDays(produto.alert_days?.toString() || '60');
    } else {
      setExistingProduct(null);
      setProductSaved(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validar APENAS campos do PRODUTO
    if (!barcode || barcode.length < 8) {
      toast.error('Código de barras inválido (mínimo 8 dígitos)');
      return;
    }

    if (!name.trim()) {
      toast.error('Nome do produto é obrigatório');
      return;
    }

    if (!sector.trim()) {
      toast.error('Setor é obrigatório');
      return;
    }

    // Se produto já existe, apenas marcar como salvo
    if (existingProduct) {
      setProductSaved(true);
      toast.info('Produto já cadastrado! Agora você pode adicionar lotes.');
      return;
    }

    setIsLoadingProduct(true);

    try {
      // Criar APENAS o produto (sem lote)
      await createProduto({
        barcode,
        name: name.trim(),
        sector,
        alert_days: parseInt(alertDays) || 60,
        created_by: user?.cloud_user_id ?? user?.local_user_id,
      });

      await refreshCounts();
      setProductSaved(true);
      toast.success('Produto cadastrado com sucesso! Agora você pode adicionar lotes.');
    } catch (error) {
      console.error('Erro ao cadastrar:', error);
      toast.error('Erro ao cadastrar produto');
    } finally {
      setIsLoadingProduct(false);
    }
  };

  const handleSaveLot = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!productSaved && !existingProduct) {
      toast.error('Salve o produto primeiro antes de adicionar lotes');
      return;
    }

    if (!lotExpirationDate) {
      toast.error('Data de validade é obrigatória');
      return;
    }

    if (lotQuantity <= 0) {
      toast.error('Quantidade deve ser maior que zero');
      return;
    }

    // Verificar duplicidade de lote
    const isDuplicate = await db.checkDuplicateLot(barcode, lotExpirationDate);
    if (isDuplicate) {
      toast.error('Já existe um lote com esta validade para este produto');
      return;
    }

    setIsLoadingLot(true);

    try {
      const result = await createLot({
        id: crypto.randomUUID(),
        barcode,
        expiration_date: lotExpirationDate,
        quantity: lotQuantity,
        status: 'active',
        created_by: user?.cloud_user_id ?? user?.local_user_id,
      });

      if (!result.success) {
        toast.error(result.error || 'Erro ao adicionar lote');
        setIsLoadingLot(false);
        return;
      }

      await refreshCounts();
      toast.success('Lote adicionado com sucesso!');
      
      // Limpar campos do lote para adicionar outro
      setLotExpirationDate('');
      setLotQuantity(0);
    } catch (error) {
      console.error('Erro ao adicionar lote:', error);
      toast.error('Erro ao adicionar lote');
    } finally {
      setIsLoadingLot(false);
    }
  };

  const handleGoToDetails = () => {
    navigate(`/produto/${barcode}`);
  };

  return (
    <div className="min-h-screen pb-8 bg-background">
      {/* Header */}
      <header className="header-gradient flex items-center gap-4 mb-6">
        <button 
          onClick={() => navigate('/')}
          className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-primary-foreground" />
        </button>
        <div>
          <h1 className="font-display text-xl font-bold text-primary-foreground">
            Cadastrar Produto
          </h1>
          <p className="text-primary-foreground/80 text-sm">
            {productSaved ? 'Produto salvo! Adicione lotes abaixo.' : 'Preencha os dados do produto'}
          </p>
        </div>
      </header>

      <div className="px-4 space-y-6">
        {/* Código de Barras */}
        <div className="glass-card p-4">
          <Label className="flex items-center gap-2 text-primary mb-3">
            <Barcode className="w-4 h-4" />
            Código de Barras
          </Label>
          <div className="flex gap-2">
            <Input
              type="text"
              inputMode="numeric"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value.replace(/\D/g, ''))}
              placeholder="Digite ou escaneie o código"
              className="input-futuristic text-lg flex-1"
              autoFocus
              disabled={productSaved}
            />
            <button
              type="button"
              onClick={() => setIsScannerOpen(true)}
              className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center hover:bg-primary/30 transition-all active:scale-95"
              aria-label="Escanear código de barras"
              disabled={productSaved}
            >
              <ScanLine className="w-6 h-6 text-primary" />
            </button>
          </div>
          {existingProduct && (
            <p className="text-accent text-sm mt-2 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Produto já cadastrado! Você pode adicionar lotes abaixo.
            </p>
          )}
        </div>

        <BarcodeScanner
          isOpen={isScannerOpen}
          onClose={() => setIsScannerOpen(false)}
          onScan={handleBarcodeScanned}
        />

        {/* ═══ CARD 1: DADOS DO PRODUTO ═══ */}
        <form onSubmit={handleSaveProduct} className="glass-card p-4 space-y-4">
          <h3 className="font-display text-lg font-semibold text-primary flex items-center gap-2">
            <Package className="w-5 h-5" />
            Dados do Produto
          </h3>

          <div>
            <Label className="text-muted-foreground mb-2 block">Nome do Produto *</Label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Arroz Integral 1kg"
              className="input-futuristic"
              disabled={productSaved}
            />
          </div>

          <div className="grid grid-cols-[1fr_auto_80px] gap-2 items-end">
            <div>
              <Label className="text-muted-foreground mb-2 block">Setor *</Label>
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className="input-futuristic w-full"
                disabled={productSaved}
              >
                {sectors.map((s) => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setIsSectorManagerOpen(true)}
              className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center hover:bg-primary/30 transition-all active:scale-95"
              aria-label="Gerenciar setores"
              disabled={productSaved}
            >
              <Settings2 className="w-5 h-5 text-primary" />
            </button>
            <div>
              <Label className="text-muted-foreground mb-2 block text-xs">Dias Alerta</Label>
              <Input
                type="number"
                value={alertDays}
                onChange={(e) => setAlertDays(e.target.value)}
                className="input-futuristic"
                disabled={productSaved}
              />
            </div>
          </div>

          <SectorManager
            isOpen={isSectorManagerOpen}
            onClose={() => setIsSectorManagerOpen(false)}
            onSectorsChange={(newSectors) => {
              setSectors(newSectors);
              // Keep current sector if still exists, else default
              if (!newSectors.some(s => s.name === sector)) {
                setSector(newSectors[0]?.name || 'Geral');
              }
            }}
          />

          {/* Botão Salvar Produto */}
          {!productSaved && (
            <Button
              type="submit"
              disabled={isLoadingProduct}
              className="btn-neon w-full flex items-center justify-center gap-2"
            >
              {isLoadingProduct ? (
                <span className="animate-pulse">Salvando...</span>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Salvar Produto
                </>
              )}
            </Button>
          )}

          {productSaved && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-green/20 border border-green/30">
              <Package className="w-5 h-5 text-green" />
              <span className="text-green font-medium">Produto salvo com sucesso!</span>
            </div>
          )}
        </form>

        {/* ═══ CARD 2: ADICIONAR LOTE ═══ */}
        <form onSubmit={handleSaveLot} className={`glass-card p-4 space-y-4 transition-opacity ${productSaved ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
          <h3 className="font-display text-lg font-semibold text-accent flex items-center gap-2">
            <Layers className="w-5 h-5" />
            Adicionar Lote
          </h3>

          {!productSaved && (
            <p className="text-muted-foreground text-sm">
              Salve o produto acima primeiro para poder adicionar lotes.
            </p>
          )}

          <div>
            <Label className="text-muted-foreground mb-2 block flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Data de Validade *
            </Label>
            <Input
              type="date"
              value={lotExpirationDate}
              onChange={(e) => setLotExpirationDate(e.target.value)}
              className="input-futuristic"
              disabled={!productSaved}
            />
          </div>

          <div>
            <Label className="text-muted-foreground mb-2 block">Quantidade *</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min="0"
                value={lotQuantity}
                onChange={(e) => setLotQuantity(parseInt(e.target.value) || 0)}
                placeholder="0"
                className="input-futuristic flex-1"
                disabled={!productSaved}
              />
              <QuantityCalculator
                value={lotQuantity}
                onChange={setLotQuantity}
              />
            </div>
          </div>

          {/* Botão Salvar Lote */}
          <Button
            type="submit"
            disabled={isLoadingLot || !productSaved}
            className="btn-secondary w-full flex items-center justify-center gap-2"
          >
            {isLoadingLot ? (
              <span className="animate-pulse">Adicionando...</span>
            ) : (
              <>
                <Layers className="w-5 h-5" />
                Salvar Lote
              </>
            )}
          </Button>
        </form>

        {/* Botão ir para detalhes */}
        {productSaved && (
          <Button
            type="button"
            onClick={handleGoToDetails}
            variant="outline"
            className="w-full"
          >
            Ver Todos os Lotes do Produto
          </Button>
        )}
      </div>
    </div>
  );
};

export default CadastrarProduto;
