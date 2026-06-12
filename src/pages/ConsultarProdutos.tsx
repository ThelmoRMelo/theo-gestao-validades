import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Package, ChevronRight, Layers, ScanLine, Power, PowerOff, Eye, EyeOff, List } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useApp } from '@/contexts/AppContext';
import * as db from '@/lib/db';
import { syncProdutoToCloud } from '@/lib/sync';
import type { Produto, ProductLot, Sector } from '@/lib/db';
import BarcodeScanner from '@/components/BarcodeScanner';
import ExportDropdown from '@/components/ExportDropdown';
import { ExportSortOption } from '@/components/ExportOptionsModal';
import { exportToExcel, exportToPDF, exportToExcelBySector, exportToPDFBySector } from '@/lib/exportUtils';
import { toast } from 'sonner';

interface ProdutoComLotes extends Produto {
  lots: ProductLot[];
  activeLots: number;
  expiredLots: number;
  nearestExpiration?: string;
  hasExpiredLots: boolean;
}

const ConsultarProdutos = () => {
  const navigate = useNavigate();
  const { user, refreshCounts } = useApp();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSector, setSelectedSector] = useState('Todos');
  const [showInactive, setShowInactive] = useState(false);
  const [showExpired, setShowExpired] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [produtos, setProdutos] = useState<ProdutoComLotes[]>([]);
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    
    const [allProdutos, allLots, allSectors] = await Promise.all([
      db.getAllProdutos(),
      db.getAllLots(),
      db.getAllSectors(),
    ]);

    // Mapear lotes para produtos
    const today = new Date().toISOString().split('T')[0];
    
    const produtosComLotes: ProdutoComLotes[] = allProdutos.map(produto => {
      const productLots = allLots.filter(l => l.barcode === produto.barcode);
      const activeLots = productLots.filter(l => l.status === 'active').length;
      const expiredLots = productLots.filter(l => l.status === 'active' && l.expiration_date < today).length;
      const hasExpiredLots = expiredLots > 0;
      
      const nearestLot = productLots
        .filter(l => l.status === 'active' && l.expiration_date >= today)
        .sort((a, b) => a.expiration_date.localeCompare(b.expiration_date))[0];
      
      return {
        ...produto,
        lots: productLots,
        activeLots,
        expiredLots,
        hasExpiredLots,
        nearestExpiration: nearestLot?.expiration_date,
      };
    });

    setProdutos(produtosComLotes);
    
    // Se a tabela sectors estiver vazia, extrair setores únicos dos produtos
    if (allSectors.length > 0) {
      setSectors([{ id: '0', name: 'Todos' }, ...allSectors]);
    } else {
      const uniqueSectorsFromProducts = [...new Set(allProdutos.map(p => p.sector).filter(Boolean))];
      const sectorsFromProducts = uniqueSectorsFromProducts.map((name, index) => ({
        id: `extracted-${index}`,
        name: name,
      }));
      setSectors([{ id: '0', name: 'Todos' }, ...sectorsFromProducts]);
    }
    
    setIsLoading(false);
  };

  const handleBarcodeScan = async (barcode: string) => {
    setShowScanner(false);
    
    // Check if product exists
    const existingProduct = await db.getProdutoByBarcode(barcode);
    if (existingProduct) {
      // Product found - navigate to details
      navigate(`/produto/${barcode}`);
    } else {
      // Product not found - navigate to registration with barcode
      toast.info('Produto não encontrado. Redirecionando para cadastro...');
      navigate(`/cadastrar?barcode=${barcode}`);
    }
  };

  const handleToggleProductActive = async (produto: ProdutoComLotes, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!user?.can_deactivate_products) {
      toast.error('Você não tem permissão para desativar produtos');
      return;
    }
    
    const newStatus = !produto.is_active;
    const updatedProduto = {
      ...produto,
      is_active: newStatus,
      updated_at: new Date().toISOString(),
      pending_sync: true,
    };
    
    await db.saveProduto(updatedProduto);
    await syncProdutoToCloud(updatedProduto);
    await refreshCounts();
    
    toast.success(newStatus ? 'Produto ativado!' : 'Produto desativado!');
    loadData();
  };

  const filteredProdutos = produtos.filter((produto) => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const matchesSearch =
      normalizedSearch.length === 0 ||
      produto.name.toLowerCase().includes(normalizedSearch) ||
      produto.barcode.includes(searchTerm.trim());
    const matchesSector = selectedSector === 'Todos' || produto.sector === selectedSector;

    if (!matchesSearch || !matchesSector) return false;

    const isProductInactive = produto.is_active === false;
    const hasInactiveLot = produto.lots.some((lot) => lot.status === 'disabled');
    const matchesInactiveFilter = isProductInactive || hasInactiveLot;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const hasExpiredLot = produto.lots.some((lot) => {
      if (lot.status !== 'active') return false;
      const expiration = new Date(`${lot.expiration_date}T00:00:00`);
      return expiration < today;
    });

    if (showAll) return true;
    if (showInactive && !showExpired) return matchesInactiveFilter;
    if (showExpired && !showInactive) return hasExpiredLot;
    if (showInactive && showExpired) return matchesInactiveFilter || hasExpiredLot;

    return !isProductInactive && !hasExpiredLot;
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('pt-BR');
  };

  const getDaysUntil = (dateStr: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(dateStr + 'T00:00:00');
    const diff = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  const getExpirationColor = (dateStr?: string) => {
    if (!dateStr) return 'text-muted-foreground';
    const days = getDaysUntil(dateStr);
    if (days < 0) return 'text-destructive';
    if (days <= 7) return 'text-coral';
    if (days <= 30) return 'text-orange';
    if (days <= 60) return 'text-yellow';
    return 'text-green';
  };

  const formatDateForExport = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  const buildExportRows = () => {
    // Uma linha por lote ativo do produto filtrado; se não houver lotes, gera linha do produto.
    type Row = { produto: ProdutoComLotes; lot?: ProductLot };
    const rows: Row[] = [];
    filteredProdutos.forEach((p) => {
      if (p.lots.length === 0) {
        rows.push({ produto: p });
      } else {
        p.lots.forEach((lot) => rows.push({ produto: p, lot }));
      }
    });
    return rows;
  };

  const handleExport = async (format: 'excel' | 'pdf', sortOption: ExportSortOption) => {
    try {
      const filename = `consulta-produtos-${new Date().toISOString().split('T')[0]}`;
      const headers = ['Produto', 'Código', 'Setor', 'Quantidade', 'Lote', 'Validade', 'Status'];
      const rowsData = buildExportRows();

      const toCells = (r: { produto: ProdutoComLotes; lot?: ProductLot }) => [
        r.produto.name,
        r.produto.barcode,
        r.produto.sector || 'Geral',
        r.lot ? r.lot.quantity.toString() : '0',
        r.lot ? r.lot.id.substring(0, 8) : '—',
        r.lot ? formatDateForExport(r.lot.expiration_date) : '—',
        r.produto.is_active === false ? 'Inativo' : r.lot?.status === 'disabled' ? 'Lote desativado' : 'Ativo',
      ];

      const sortFn = (a: typeof rowsData[number], b: typeof rowsData[number]) => {
        if (sortOption === 'date-asc') return (a.lot?.expiration_date || '9999').localeCompare(b.lot?.expiration_date || '9999');
        if (sortOption === 'date-desc') return (b.lot?.expiration_date || '0').localeCompare(a.lot?.expiration_date || '0');
        const s = (a.produto.sector || 'Geral').localeCompare(b.produto.sector || 'Geral', 'pt-BR');
        if (s !== 0) return s;
        return a.produto.name.localeCompare(b.produto.name, 'pt-BR');
      };
      const sorted = [...rowsData].sort(sortFn);

      if (sortOption === 'sector-az') {
        const sectorMap = new Map<string, string[][]>();
        sorted.forEach((r) => {
          const sector = r.produto.sector || 'Geral';
          if (!sectorMap.has(sector)) sectorMap.set(sector, []);
          sectorMap.get(sector)!.push(toCells(r));
        });
        const sectors = Array.from(sectorMap.entries())
          .map(([sector, rows]) => ({ sector, rows }))
          .sort((a, b) => a.sector.localeCompare(b.sector, 'pt-BR'));

        const data = {
          headers,
          sectors,
          title: 'Consulta de Produtos',
          totalLotes: sorted.length,
        };
        if (format === 'excel') exportToExcelBySector(data, filename);
        else exportToPDFBySector(data, filename);
      } else {
        const data = {
          headers,
          rows: sorted.map(toCells),
          title: 'Consulta de Produtos',
        };
        if (format === 'excel') exportToExcel(data, filename);
        else exportToPDF(data, filename);
      }

      toast.success(`Exportado para ${format.toUpperCase()} com sucesso!`);
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error('Erro ao exportar dados');
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header - Área Fixa */}
      <header className="header-gradient flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate('/')}
            className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center"
          >
            <ArrowLeft className="w-5 h-5 text-primary-foreground" />
          </button>
          <div>
            <h1 className="font-display text-xl font-bold text-primary-foreground">
              Consultar Produtos
            </h1>
            <p className="text-primary-foreground/80 text-sm">
              {filteredProdutos.length} produtos encontrados
            </p>
          </div>
        </div>
        <ExportDropdown onExport={handleExport} />
      </header>

      {/* Área Fixa: Busca + Filtros */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2 bg-background space-y-4">
        {/* Busca */}
        <div className="glass-card p-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por nome ou código..."
                className="input-futuristic pl-10"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setShowScanner(true)}
              className="border-primary text-primary hover:bg-primary/10"
            >
              <ScanLine className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Scanner Modal */}
        <BarcodeScanner
          isOpen={showScanner}
          onScan={handleBarcodeScan}
          onClose={() => setShowScanner(false)}
        />

        {/* Filtro de Setor */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {sectors.length > 0 ? sectors.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSector(s.name)}
              className={`px-4 py-2 rounded-full whitespace-nowrap text-sm transition-all ${
                selectedSector === s.name
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {s.name}
            </button>
          )) : (
            <>
              {['Todos', 'Geral', 'Mercearia', 'Bebidas', 'Frios'].map((s) => (
                <button
                  key={s}
                  onClick={() => setSelectedSector(s)}
                  className={`px-4 py-2 rounded-full whitespace-nowrap text-sm transition-all ${
                    selectedSector === s
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                  }`}
                >
                  {s}
                </button>
              ))}
            </>
          )}
        </div>

        {/* Toggles */}
        <div className="space-y-2">
          {user?.can_deactivate_products && (
            <div className="flex items-center gap-2">
              <Switch
                id="show-inactive"
                checked={showInactive}
                onCheckedChange={(checked) => {
                  setShowInactive(checked);
                  if (checked) setShowAll(false);
                }}
                disabled={showAll}
              />
              <Label htmlFor="show-inactive" className={`text-sm flex items-center gap-1 ${showAll ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                {showInactive ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                Somente produtos inativos
              </Label>
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <Switch
              id="show-expired"
              checked={showExpired}
              onCheckedChange={(checked) => {
                setShowExpired(checked);
                if (checked) setShowAll(false);
              }}
              disabled={showAll}
            />
            <Label htmlFor="show-expired" className={`text-sm flex items-center gap-1 ${showAll ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
              {showExpired ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              Somente produtos vencidos
            </Label>
          </div>

          <div className="flex items-center gap-2 pt-1 border-t border-border">
            <Switch
              id="show-all"
              checked={showAll}
              onCheckedChange={(checked) => {
                setShowAll(checked);
                if (checked) {
                  setShowInactive(false);
                  setShowExpired(false);
                }
              }}
            />
            <Label htmlFor="show-all" className="text-sm text-muted-foreground flex items-center gap-1">
              <List className="w-4 h-4" />
              Listar todos os produtos
            </Label>
          </div>
        </div>
      </div>

      {/* Área Scrollável: Lista de Produtos */}
      <div className="flex-1 overflow-y-auto px-4 pb-8">
        <div className="space-y-3">
          {isLoading ? (
            <div className="glass-card p-8 text-center">
              <div className="animate-pulse text-muted-foreground">Carregando...</div>
            </div>
          ) : filteredProdutos.length === 0 ? (
            <div className="glass-card p-8 text-center">
              <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhum produto encontrado</p>
            </div>
          ) : (
            filteredProdutos.map((produto) => (
              <div
                key={produto.barcode}
                onClick={() => navigate(`/produto/${produto.barcode}`)}
                className={`glass-card p-4 cursor-pointer hover:bg-card/80 transition-all ${
                  produto.is_active === false ? 'opacity-60 border-l-4 border-muted-foreground' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="w-4 h-4 text-cyan" />
                      <span className="font-semibold text-foreground">{produto.name}</span>
                      {produto.is_active === false && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                          Inativo
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{produto.barcode}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <span className="text-xs px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                        {produto.sector}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Layers className="w-3 h-3" />
                        {produto.activeLots} lotes ativos
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {user?.can_deactivate_products && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-8 w-8 ${produto.is_active !== false ? 'text-green hover:text-green' : 'text-muted-foreground hover:text-muted-foreground'}`}
                        onClick={(e) => handleToggleProductActive(produto, e)}
                        title={produto.is_active !== false ? 'Desativar produto' : 'Ativar produto'}
                      >
                        {produto.is_active !== false ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                      </Button>
                    )}
                    <div className="text-right">
                      {produto.nearestExpiration && (
                        <p className={`text-sm font-medium ${getExpirationColor(produto.nearestExpiration)}`}>
                          {formatDate(produto.nearestExpiration)}
                        </p>
                      )}
                      <ChevronRight className="w-5 h-5 text-muted-foreground mt-2" />
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ConsultarProdutos;