/**
 * ═══════════════════════════════════════════════════════
 * GESTÃO DE VALIDADES - BANCO DE DADOS LOCAL (IndexedDB)
 * Sistema Offline-First com Sincronização
 * ═══════════════════════════════════════════════════════
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

// ═══ TIPOS ═══
export interface LocalUser {
  local_user_id: string;
  /**
   * ID do usuário no backend (app_users.id). Usado para FKs (created_by/user_id)
   * e para manter consistência entre dispositivos.
   */
  cloud_user_id?: string;
  device_id: string;
  name: string;
  function: string;
  is_active: boolean;
  can_edit_others_lots: boolean;
  can_delete_lots: boolean;
  can_deactivate_products: boolean;
  can_manage_sectors: boolean;
  created_at: string;
  updated_at: string;
  synced: boolean;
}

export interface Produto {
  id?: string; // UUID do cloud (chave primária no Supabase)
  barcode: string;
  name: string;
  sector: string;
  alert_days: number;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  pending_sync: boolean;
}

export interface ProductLot {
  id: string;
  barcode: string;
  expiration_date: string;
  quantity: number;
  status: 'active' | 'disabled';
  created_by?: string;
  created_at: string;
  updated_at: string;
  pending_sync: boolean;
  deactivation_reason?: string;
  deactivated_at?: string;
  deactivated_by?: string;
}

export interface ChatMessage {
  id: string;
  user_id: string;
  user_name: string;
  message: string;
  created_at: string;
  pending_sync: boolean;
}

export interface Sector {
  id: string;
  name: string;
}

export interface AppSettings {
  key: string;
  value: unknown;
}

export interface AppIdentity {
  id: string;
  icon_url?: string;
  title: string;
  subtitle: string;
  updated_at: string;
}

export interface SyncQueueItem {
  id: string;
  table: string;
  operation: 'insert' | 'update' | 'delete' | 'upsert';
  data: unknown;
  created_at: string;
}

// ═══ SCHEMA DO BANCO ═══
interface GestaoDBSchema extends DBSchema {
  local_user: {
    key: string;
    value: LocalUser;
  };
  produtos: {
    key: string;
    value: Produto;
    indexes: { 'by-sector': string; 'by-pending': number; 'by-active': number };
  };
  product_lots: {
    key: string;
    value: ProductLot;
    indexes: { 
      'by-barcode': string; 
      'by-expiration': string; 
      'by-status': string;
      'by-pending': number;
      'by-barcode-expiration': [string, string];
    };
  };
  chat_messages: {
    key: string;
    value: ChatMessage;
    indexes: { 'by-created': string };
  };
  sectors: {
    key: string;
    value: Sector;
  };
  app_settings: {
    key: string;
    value: AppSettings;
  };
  app_identity: {
    key: string;
    value: AppIdentity;
  };
  sync_queue: {
    key: string;
    value: SyncQueueItem;
    indexes: { 'by-table': string };
  };
}

const DB_NAME = 'gestao-validades-db';
const DB_VERSION = 2;

let dbInstance: IDBPDatabase<GestaoDBSchema> | null = null;

// ═══ INICIALIZAÇÃO DO BANCO ═══
export async function initDB(): Promise<IDBPDatabase<GestaoDBSchema>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<GestaoDBSchema>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion) {
      // Local User
      if (!db.objectStoreNames.contains('local_user')) {
        db.createObjectStore('local_user', { keyPath: 'local_user_id' });
      }

      // Produtos
      if (!db.objectStoreNames.contains('produtos')) {
        const produtosStore = db.createObjectStore('produtos', { keyPath: 'barcode' });
        produtosStore.createIndex('by-sector', 'sector');
        produtosStore.createIndex('by-pending', 'pending_sync');
        produtosStore.createIndex('by-active', 'is_active');
      }

      // Product Lots
      if (!db.objectStoreNames.contains('product_lots')) {
        const lotsStore = db.createObjectStore('product_lots', { keyPath: 'id' });
        lotsStore.createIndex('by-barcode', 'barcode');
        lotsStore.createIndex('by-expiration', 'expiration_date');
        lotsStore.createIndex('by-status', 'status');
        lotsStore.createIndex('by-pending', 'pending_sync');
        lotsStore.createIndex('by-barcode-expiration', ['barcode', 'expiration_date'], { unique: true });
      }

      // Chat Messages
      if (!db.objectStoreNames.contains('chat_messages')) {
        const chatStore = db.createObjectStore('chat_messages', { keyPath: 'id' });
        chatStore.createIndex('by-created', 'created_at');
      }

      // Sectors
      if (!db.objectStoreNames.contains('sectors')) {
        db.createObjectStore('sectors', { keyPath: 'id' });
      }

      // App Settings
      if (!db.objectStoreNames.contains('app_settings')) {
        db.createObjectStore('app_settings', { keyPath: 'key' });
      }

      // App Identity
      if (!db.objectStoreNames.contains('app_identity')) {
        db.createObjectStore('app_identity', { keyPath: 'id' });
      }

      // Sync Queue
      if (!db.objectStoreNames.contains('sync_queue')) {
        const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id' });
        syncStore.createIndex('by-table', 'table');
      }
    },
  });

  return dbInstance;
}

// ═══ FUNÇÕES PARA LOCAL USER ═══
export async function getLocalUser(): Promise<LocalUser | undefined> {
  const db = await initDB();
  const users = await db.getAll('local_user');
  return users[0];
}

export async function saveLocalUser(user: LocalUser): Promise<void> {
  const db = await initDB();
  await db.put('local_user', user);
}

// ═══ FUNÇÕES PARA PRODUTOS ═══
export async function getAllProdutos(): Promise<Produto[]> {
  const db = await initDB();
  return db.getAll('produtos');
}

export async function getActiveProdutos(): Promise<Produto[]> {
  const db = await initDB();
  const all = await db.getAll('produtos');
  return all.filter(p => p.is_active !== false);
}

export async function getProdutoByBarcode(barcode: string): Promise<Produto | undefined> {
  const db = await initDB();
  return db.get('produtos', barcode);
}

export async function saveProduto(produto: Produto): Promise<void> {
  const db = await initDB();
  await db.put('produtos', produto);
}

export async function getPendingProdutos(): Promise<Produto[]> {
  const db = await initDB();
  const all = await db.getAll('produtos');
  return all.filter(p => p.pending_sync);
}

export async function deleteProduto(barcode: string): Promise<void> {
  const db = await initDB();
  await db.delete('produtos', barcode);
}

// ═══ FUNÇÕES PARA LOTES ═══
export async function getAllLots(): Promise<ProductLot[]> {
  const db = await initDB();
  return db.getAll('product_lots');
}

export async function getLotsByBarcode(barcode: string): Promise<ProductLot[]> {
  const db = await initDB();
  return db.getAllFromIndex('product_lots', 'by-barcode', barcode);
}

export async function getLotById(id: string): Promise<ProductLot | undefined> {
  const db = await initDB();
  return db.get('product_lots', id);
}

export async function saveLot(lot: ProductLot): Promise<void> {
  const db = await initDB();
  await db.put('product_lots', lot);
}

export async function deleteLot(id: string): Promise<void> {
  const db = await initDB();
  await db.delete('product_lots', id);
}

export async function updateLot(id: string, updates: Partial<ProductLot>): Promise<void> {
  const db = await initDB();
  const lot = await db.get('product_lots', id);
  if (lot) {
    const updatedLot = {
      ...lot,
      ...updates,
      updated_at: new Date().toISOString(),
      pending_sync: true,
    };
    await db.put('product_lots', updatedLot);
  }
}

export async function checkDuplicateLot(barcode: string, expirationDate: string, excludeId?: string): Promise<boolean> {
  const db = await initDB();
  const lots = await db.getAllFromIndex('product_lots', 'by-barcode', barcode);
  return lots.some(lot => 
    lot.expiration_date === expirationDate && 
    lot.id !== excludeId
  );
}

export async function getPendingLots(): Promise<ProductLot[]> {
  const db = await initDB();
  const all = await db.getAll('product_lots');
  return all.filter(l => l.pending_sync);
}

// ═══ FUNÇÕES PARA CONTADORES (conta produtos DISTINTOS com lotes qualificados) ═══

/**
 * "Produtos Ativos" - Conta produtos DISTINTOS que possuem:
 * - Produto ativo (is_active = true)
 * - Pelo menos 1 lote ativo
 * - Validade do lote NÃO vencida (>= hoje)
 * - Validade do lote ≤ 60 dias
 */
export async function getActiveProductsCount(): Promise<number> {
  const db = await initDB();
  const lots = await db.getAll('product_lots');
  const produtos = await db.getAll('produtos');
  
  const activeProductBarcodes = new Set(
    produtos.filter(p => p.is_active !== false).map(p => p.barcode)
  );
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + 60);
  const futureDateStr = futureDate.toISOString().split('T')[0];
  
  // Coletar barcodes DISTINTOS de produtos com lotes qualificados
  const qualifiedBarcodes = new Set<string>();
  
  for (const lot of lots) {
    if (
      lot.status === 'active' &&
      activeProductBarcodes.has(lot.barcode) &&
      lot.expiration_date >= todayStr &&    // Não vencido
      lot.expiration_date <= futureDateStr  // Dentro de 60 dias
    ) {
      qualifiedBarcodes.add(lot.barcode);
    }
  }
  
  return qualifiedBarcodes.size;
}

/**
 * "Validades Críticas" - Conta produtos DISTINTOS que possuem:
 * - Produto ativo (is_active = true)
 * - Pelo menos 1 lote ativo
 * - Validade do lote NÃO vencida (>= hoje)
 * - Validade do lote ≤ 20 dias (crítico)
 */
export async function getCriticalProductsCount(): Promise<number> {
  const db = await initDB();
  const lots = await db.getAll('product_lots');
  const produtos = await db.getAll('produtos');
  
  const activeProductBarcodes = new Set(
    produtos.filter(p => p.is_active !== false).map(p => p.barcode)
  );
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = today.toISOString().split('T')[0];
  
  const criticalDate = new Date(today);
  criticalDate.setDate(today.getDate() + 20);
  const criticalDateStr = criticalDate.toISOString().split('T')[0];
  
  // Coletar barcodes DISTINTOS de produtos com lotes críticos
  const criticalBarcodes = new Set<string>();
  
  for (const lot of lots) {
    if (
      lot.status === 'active' &&
      activeProductBarcodes.has(lot.barcode) &&
      lot.expiration_date >= todayStr &&     // Não vencido
      lot.expiration_date <= criticalDateStr // Dentro de 20 dias
    ) {
      criticalBarcodes.add(lot.barcode);
    }
  }
  
  return criticalBarcodes.size;
}

// Mantém as funções antigas para compatibilidade (deprecated)
export async function getActiveLotsCount(): Promise<number> {
  return getActiveProductsCount();
}

export async function getCriticalLotsCount(alertDays: number = 60): Promise<number> {
  return getCriticalProductsCount();
}

// ═══ FUNÇÕES PARA CHAT ═══
export async function getChatMessages(limit: number = 100): Promise<ChatMessage[]> {
  const db = await initDB();
  const messages = await db.getAll('chat_messages');
  return messages
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)
    .reverse();
}

export async function saveChatMessage(message: ChatMessage): Promise<void> {
  const db = await initDB();
  await db.put('chat_messages', message);
}

// ═══ FUNÇÕES PARA SETORES ═══
export async function getAllSectors(): Promise<Sector[]> {
  const db = await initDB();
  return db.getAll('sectors');
}

export async function getSectorById(id: string): Promise<Sector | undefined> {
  const db = await initDB();
  return db.get('sectors', id);
}

export async function saveSector(sector: Sector): Promise<void> {
  const db = await initDB();
  await db.put('sectors', sector);
}

export async function deleteSector(id: string): Promise<void> {
  const db = await initDB();
  await db.delete('sectors', id);
}

export async function saveSectors(sectors: Sector[]): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('sectors', 'readwrite');
  await Promise.all(sectors.map(s => tx.store.put(s)));
  await tx.done;
}

// ═══ FUNÇÕES PARA APP IDENTITY ═══
export async function getAppIdentity(): Promise<AppIdentity | undefined> {
  const db = await initDB();
  const identities = await db.getAll('app_identity');
  return identities[0];
}

export async function saveAppIdentity(identity: AppIdentity): Promise<void> {
  const db = await initDB();
  await db.put('app_identity', identity);
}

// ═══ FUNÇÕES PARA SETTINGS ═══
export async function getSetting<T>(key: string): Promise<T | undefined> {
  const db = await initDB();
  const setting = await db.get('app_settings', key);
  return setting?.value as T | undefined;
}

export async function saveSetting(key: string, value: unknown): Promise<void> {
  const db = await initDB();
  await db.put('app_settings', { key, value });
}

// ═══ FUNÇÕES PARA SYNC QUEUE ═══
export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'created_at'>): Promise<void> {
  const db = await initDB();
  await db.put('sync_queue', {
    ...item,
    id: crypto.randomUUID(),
    created_at: new Date().toISOString(),
  });
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  const db = await initDB();
  return db.getAll('sync_queue');
}

export async function clearSyncQueue(): Promise<void> {
  const db = await initDB();
  await db.clear('sync_queue');
}

export async function removeSyncQueueItem(id: string): Promise<void> {
  const db = await initDB();
  await db.delete('sync_queue', id);
}

// ═══ FUNÇÕES UTILITÁRIAS ═══
export function generateUUID(): string {
  return crypto.randomUUID();
}

export function generateDeviceId(): string {
  const stored = localStorage.getItem('device_id');
  if (stored) return stored;
  
  const deviceId = `device_${crypto.randomUUID()}`;
  localStorage.setItem('device_id', deviceId);
  return deviceId;
}

// ═══ LIMPAR BANCO (ADMIN) ═══
export async function clearAllData(): Promise<void> {
  const db = await initDB();
  await db.clear('produtos');
  await db.clear('product_lots');
  await db.clear('chat_messages');
  await db.clear('sync_queue');
}

// ═══ BULK OPERATIONS ═══
export async function bulkSaveProdutos(produtos: Produto[]): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('produtos', 'readwrite');
  await Promise.all(produtos.map(p => tx.store.put(p)));
  await tx.done;
}

export async function bulkSaveLots(lots: ProductLot[]): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('product_lots', 'readwrite');
  await Promise.all(lots.map(l => tx.store.put(l)));
  await tx.done;
}

export async function bulkSaveMessages(messages: ChatMessage[]): Promise<void> {
  const db = await initDB();
  const tx = db.transaction('chat_messages', 'readwrite');
  await Promise.all(messages.map(m => tx.store.put(m)));
  await tx.done;
}
