/**
 * ═══════════════════════════════════════════════════════
 * SISTEMA DE BACKUP/RESTAURAÇÃO - Excel (.xlsx)
 * Exportação e Importação offline-first
 * ═══════════════════════════════════════════════════════
 */

import * as XLSX from 'xlsx';
import * as db from '@/lib/db';
import type { Produto, ProductLot } from '@/lib/db';

// ═══ TIPOS DE EXPORTAÇÃO ═══
interface ExportedProduct {
  codigo_barras: string;
  nome_produto: string;
  setor: string;
  dias_alerta: number;
  status_produto: string;
  criado_por: string;
  data_criacao: string;
  data_atualizacao: string;
}

interface ExportedLot {
  codigo_barras_produto: string;
  id_lote: string;
  data_validade: string;
  quantidade: number;
  status_lote: string;
  criado_por: string;
  data_criacao: string;
  data_atualizacao: string;
}

// ═══ RESULTADO DA IMPORTAÇÃO ═══
export interface ImportReport {
  produtosCriados: number;
  produtosAtualizados: number;
  lotesCriados: number;
  lotesAtualizados: number;
  erros: string[];
  avisos: string[];
}

// ═══ FUNÇÕES DE EXPORTAÇÃO ═══

/**
 * Converte produto do banco para formato de exportação
 */
function produtoToExport(produto: Produto): ExportedProduct {
  return {
    codigo_barras: produto.barcode,
    nome_produto: produto.name,
    setor: produto.sector,
    dias_alerta: produto.alert_days,
    status_produto: produto.is_active ? 'ativo' : 'desativado',
    criado_por: produto.created_by || '',
    data_criacao: produto.created_at,
    data_atualizacao: produto.updated_at,
  };
}

/**
 * Converte lote do banco para formato de exportação
 */
function lotToExport(lot: ProductLot): ExportedLot {
  // Determina status: ativo, desativado, ou "vencido" se já passou da validade
  const today = new Date().toISOString().split('T')[0];
  let statusLoteStr = 'ativo';
  
  if (lot.status === 'disabled') {
    statusLoteStr = 'desativado';
  } else if (lot.status === 'active' && lot.expiration_date < today) {
    statusLoteStr = 'vencido';
  }
  
  return {
    codigo_barras_produto: lot.barcode,
    id_lote: lot.id,
    data_validade: lot.expiration_date,
    quantidade: lot.quantity,
    status_lote: statusLoteStr,
    criado_por: lot.created_by || '',
    data_criacao: lot.created_at,
    data_atualizacao: lot.updated_at,
  };
}

/**
 * Exporta todos os dados para Excel com 2 planilhas
 */
export async function exportToBackup(): Promise<void> {
  // Buscar todos os dados
  const [produtos, lots] = await Promise.all([
    db.getAllProdutos(),
    db.getAllLots(),
  ]);
  
  // Converter para formato de exportação
  const produtosExport = produtos.map(produtoToExport);
  const lotsExport = lots.map(lotToExport);
  
  // Criar workbook
  const workbook = XLSX.utils.book_new();
  
  // Planilha 1 - PRODUTOS
  const wsProducts = XLSX.utils.json_to_sheet(produtosExport, {
    header: [
      'codigo_barras',
      'nome_produto',
      'setor',
      'dias_alerta',
      'status_produto',
      'criado_por',
      'data_criacao',
      'data_atualizacao',
    ],
  });
  
  // Ajustar largura das colunas - Produtos
  wsProducts['!cols'] = [
    { wch: 20 }, // codigo_barras
    { wch: 40 }, // nome_produto
    { wch: 20 }, // setor
    { wch: 12 }, // dias_alerta
    { wch: 15 }, // status_produto
    { wch: 40 }, // criado_por
    { wch: 25 }, // data_criacao
    { wch: 25 }, // data_atualizacao
  ];
  
  XLSX.utils.book_append_sheet(workbook, wsProducts, 'PRODUTOS');
  
  // Planilha 2 - LOTES
  const wsLots = XLSX.utils.json_to_sheet(lotsExport, {
    header: [
      'codigo_barras_produto',
      'id_lote',
      'data_validade',
      'quantidade',
      'status_lote',
      'criado_por',
      'data_criacao',
      'data_atualizacao',
    ],
  });
  
  // Ajustar largura das colunas - Lotes
  wsLots['!cols'] = [
    { wch: 20 }, // codigo_barras_produto
    { wch: 40 }, // id_lote
    { wch: 15 }, // data_validade
    { wch: 12 }, // quantidade
    { wch: 15 }, // status_lote
    { wch: 40 }, // criado_por
    { wch: 25 }, // data_criacao
    { wch: 25 }, // data_atualizacao
  ];
  
  XLSX.utils.book_append_sheet(workbook, wsLots, 'LOTES');
  
  // Gerar nome do arquivo com data/hora
  const now = new Date();
  const dateStr = now.toISOString().split('T')[0];
  const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
  const filename = `backup_${dateStr}_${timeStr}.xlsx`;
  
  // Download do arquivo
  XLSX.writeFile(workbook, filename);
}

// ═══ FUNÇÕES DE IMPORTAÇÃO ═══

/**
 * Valida a estrutura do arquivo Excel
 */
function validateFileStructure(workbook: XLSX.WorkBook): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Verificar se tem as planilhas necessárias
  if (!workbook.SheetNames.includes('PRODUTOS')) {
    errors.push('Planilha "PRODUTOS" não encontrada');
  }
  if (!workbook.SheetNames.includes('LOTES')) {
    errors.push('Planilha "LOTES" não encontrada');
  }
  
  if (errors.length > 0) {
    return { valid: false, errors };
  }
  
  // Verificar colunas da planilha PRODUTOS
  const wsProdutos = workbook.Sheets['PRODUTOS'];
  const produtosData = XLSX.utils.sheet_to_json(wsProdutos, { header: 1 }) as string[][];
  
  if (produtosData.length > 0) {
    const headers = produtosData[0].map(h => String(h).toLowerCase().trim());
    const requiredProdutos = ['codigo_barras', 'nome_produto', 'setor', 'dias_alerta', 'status_produto'];
    
    for (const col of requiredProdutos) {
      if (!headers.includes(col)) {
        errors.push(`Coluna "${col}" não encontrada na planilha PRODUTOS`);
      }
    }
  }
  
  // Verificar colunas da planilha LOTES
  const wsLotes = workbook.Sheets['LOTES'];
  const lotesData = XLSX.utils.sheet_to_json(wsLotes, { header: 1 }) as string[][];
  
  if (lotesData.length > 0) {
    const headers = lotesData[0].map(h => String(h).toLowerCase().trim());
    const requiredLotes = ['codigo_barras_produto', 'id_lote', 'data_validade', 'quantidade', 'status_lote'];
    
    for (const col of requiredLotes) {
      if (!headers.includes(col)) {
        errors.push(`Coluna "${col}" não encontrada na planilha LOTES`);
      }
    }
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Normaliza string de status para formato do banco
 * Inclui tratamento para status "vencido" que deve ser mapeado para "active"
 * (produto vencido continua ativo no sistema, apenas a data indica vencimento)
 */
function normalizeStatus(status: string): 'active' | 'disabled' {
  const normalized = String(status).toLowerCase().trim();
  // "vencido" é um status de exportação, no banco continua como "active"
  if (normalized === 'ativo' || normalized === 'active' || normalized === 'vencido') {
    return 'active';
  }
  return 'disabled';
}

/**
 * Normaliza boolean de is_active
 */
function normalizeIsActive(status: string): boolean {
  const normalized = String(status).toLowerCase().trim();
  return normalized === 'ativo' || normalized === 'active';
}

/**
 * Normaliza código de barras para string
 * Garante que zeros à esquerda sejam preservados
 */
function normalizeBarcode(barcode: any): string {
  if (barcode === null || barcode === undefined) return '';
  
  // Se for número, converte sem notação científica
  if (typeof barcode === 'number') {
    return barcode.toFixed(0);
  }
  
  return String(barcode).trim();
}

/**
 * Normaliza quantidade para número inteiro válido
 * Garante que valores inválidos retornem 1 (mínimo)
 */
function normalizeQuantity(quantity: any): number {
  if (quantity === null || quantity === undefined) return 1;
  
  const parsed = parseInt(String(quantity), 10);
  
  // Se não for número válido ou for menor que 0, retorna 1
  if (isNaN(parsed) || parsed < 0) return 1;
  
  return parsed;
}

/**
 * Normaliza dias de alerta para número inteiro válido
 */
function normalizeAlertDays(days: any): number {
  if (days === null || days === undefined) return 60;
  
  const parsed = parseInt(String(days), 10);
  
  // Se não for número válido ou for menor que 1, retorna 60
  if (isNaN(parsed) || parsed < 1) return 60;
  
  return parsed;
}

/**
 * Formata data para padrão ISO (YYYY-MM-DD)
 * Suporta múltiplos formatos de entrada
 */
function normalizeDate(dateValue: any): string {
  if (!dateValue) return new Date().toISOString();
  
  // Se for objeto Date (quando cellDates: true no XLSX)
  if (dateValue instanceof Date) {
    // Verificar se é uma data válida
    if (isNaN(dateValue.getTime())) {
      return new Date().toISOString().split('T')[0];
    }
    const year = dateValue.getFullYear();
    const month = String(dateValue.getMonth() + 1).padStart(2, '0');
    const day = String(dateValue.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  
  // Se for número (Excel serial date)
  if (typeof dateValue === 'number') {
    try {
      const date = XLSX.SSF.parse_date_code(dateValue);
      if (date && date.y && date.m && date.d) {
        return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
      }
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  }
  
  // Se já for string ISO (YYYY-MM-DD)
  const str = String(dateValue).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.split('T')[0];
  }
  
  // Tentar parse BR com barra (DD/MM/YYYY)
  const brSlashMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (brSlashMatch) {
    const day = brSlashMatch[1].padStart(2, '0');
    const month = brSlashMatch[2].padStart(2, '0');
    return `${brSlashMatch[3]}-${month}-${day}`;
  }
  
  // Tentar parse BR com hífen (DD-MM-YYYY)
  const brDashMatch = str.match(/^(\d{1,2})-(\d{1,2})-(\d{4})/);
  if (brDashMatch) {
    const day = brDashMatch[1].padStart(2, '0');
    const month = brDashMatch[2].padStart(2, '0');
    return `${brDashMatch[3]}-${month}-${day}`;
  }
  
  // Última tentativa: tentar parse como data qualquer
  try {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
  } catch {
    // Ignora erro
  }
  
  return new Date().toISOString().split('T')[0];
}

/**
 * Importa dados do arquivo Excel para o banco local
 */
export async function importFromBackup(file: File): Promise<ImportReport> {
  const report: ImportReport = {
    produtosCriados: 0,
    produtosAtualizados: 0,
    lotesCriados: 0,
    lotesAtualizados: 0,
    erros: [],
    avisos: [],
  };
  
  try {
    // Ler arquivo
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array', cellDates: true });
    
    // Validar estrutura
    const validation = validateFileStructure(workbook);
    if (!validation.valid) {
      report.erros = validation.errors;
      return report;
    }
    
    // ═══ IMPORTAR PRODUTOS ═══
    const wsProdutos = workbook.Sheets['PRODUTOS'];
    const produtosData = XLSX.utils.sheet_to_json<Record<string, any>>(wsProdutos);
    
    // Map de produtos existentes
    const existingProducts = await db.getAllProdutos();
    const existingProductsMap = new Map(existingProducts.map(p => [p.barcode, p]));
    
    for (let i = 0; i < produtosData.length; i++) {
      const row = produtosData[i];
      const rowNum = i + 2; // +2 porque linha 1 é header
      
      try {
        // Usar normalizeBarcode para preservar zeros à esquerda
        const barcode = normalizeBarcode(row.codigo_barras);
        
        if (!barcode) {
          report.erros.push(`Linha ${rowNum} (PRODUTOS): código de barras vazio`);
          continue;
        }
        
        const nome = String(row.nome_produto || '').trim();
        if (!nome) {
          report.erros.push(`Linha ${rowNum} (PRODUTOS): nome do produto vazio`);
          continue;
        }
        
        const existing = existingProductsMap.get(barcode);
        const now = new Date().toISOString();
        
        const produto: Produto = {
          barcode,
          name: nome,
          sector: String(row.setor || 'Geral').trim(),
          alert_days: normalizeAlertDays(row.dias_alerta),
          is_active: normalizeIsActive(row.status_produto || 'ativo'),
          created_by: existing?.created_by || String(row.criado_por || '').trim() || undefined,
          created_at: existing?.created_at || normalizeDate(row.data_criacao) || now,
          updated_at: now,
          pending_sync: true,
        };
        
        await db.saveProduto(produto);
        
        if (existing) {
          report.produtosAtualizados++;
        } else {
          report.produtosCriados++;
          existingProductsMap.set(barcode, produto);
        }
      } catch (error) {
        report.erros.push(`Linha ${rowNum} (PRODUTOS): ${error instanceof Error ? error.message : 'erro desconhecido'}`);
      }
    }
    
    // ═══ IMPORTAR LOTES ═══
    const wsLotes = workbook.Sheets['LOTES'];
    const lotesData = XLSX.utils.sheet_to_json<Record<string, any>>(wsLotes);
    
    // Map de lotes existentes
    const existingLots = await db.getAllLots();
    const existingLotsMap = new Map(existingLots.map(l => [l.id, l]));
    
    // Atualizar mapa de produtos após importação
    const updatedProducts = await db.getAllProdutos();
    const productsSet = new Set(updatedProducts.map(p => p.barcode));
    
    for (let i = 0; i < lotesData.length; i++) {
      const row = lotesData[i];
      const rowNum = i + 2;
      
      try {
        // Usar normalizeBarcode para preservar zeros à esquerda
        const barcode = normalizeBarcode(row.codigo_barras_produto);
        let lotId = String(row.id_lote || '').trim();
        
        if (!barcode) {
          report.erros.push(`Linha ${rowNum} (LOTES): código de barras vazio`);
          continue;
        }
        
        // Gerar ID automaticamente se estiver vazio
        if (!lotId) {
          lotId = crypto.randomUUID();
          report.avisos.push(`Linha ${rowNum} (LOTES): id_lote gerado automaticamente`);
        }
        
        // Verificar se produto existe
        if (!productsSet.has(barcode)) {
          report.erros.push(`Linha ${rowNum} (LOTES): produto com código "${barcode}" não encontrado`);
          continue;
        }
        
        const expirationDate = normalizeDate(row.data_validade);
        if (!expirationDate || !/^\d{4}-\d{2}-\d{2}/.test(expirationDate)) {
          report.erros.push(`Linha ${rowNum} (LOTES): data de validade inválida`);
          continue;
        }
        
        const existing = existingLotsMap.get(lotId);
        const now = new Date().toISOString();
        
        // Usar normalizeQuantity para tratar quantidade 0 ou inválida
        const quantity = normalizeQuantity(row.quantidade);
        
        // Avisar se quantidade era 0 ou negativa
        const originalQuantity = parseInt(String(row.quantidade), 10);
        if (originalQuantity === 0) {
          report.avisos.push(`Linha ${rowNum} (LOTES): quantidade era 0, mantido como 0`);
        } else if (originalQuantity < 0) {
          report.avisos.push(`Linha ${rowNum} (LOTES): quantidade negativa convertida para 1`);
        }
        
        const lot: ProductLot = {
          id: lotId,
          barcode,
          expiration_date: expirationDate,
          quantity: originalQuantity === 0 ? 0 : quantity, // Permitir 0 se era explicitamente 0
          status: normalizeStatus(row.status_lote || 'ativo'),
          created_by: existing?.created_by || String(row.criado_por || '').trim() || undefined,
          created_at: existing?.created_at || normalizeDate(row.data_criacao) || now,
          updated_at: now,
          pending_sync: true,
        };
        
        await db.saveLot(lot);
        
        if (existing) {
          report.lotesAtualizados++;
        } else {
          report.lotesCriados++;
          existingLotsMap.set(lotId, lot);
        }
      } catch (error) {
        report.erros.push(`Linha ${rowNum} (LOTES): ${error instanceof Error ? error.message : 'erro desconhecido'}`);
      }
    }
    
    // Avisos finais
    if (produtosData.length === 0) {
      report.avisos.push('Nenhum produto encontrado na planilha PRODUTOS');
    }
    if (lotesData.length === 0) {
      report.avisos.push('Nenhum lote encontrado na planilha LOTES');
    }
    
  } catch (error) {
    report.erros.push(`Erro ao processar arquivo: ${error instanceof Error ? error.message : 'erro desconhecido'}`);
  }
  
  return report;
}
