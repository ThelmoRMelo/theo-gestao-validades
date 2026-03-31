/**
 * ═══════════════════════════════════════════════════════
 * GESTÃO DE VALIDADES - SERVIÇO DE SINCRONIZAÇÃO
 * Sync entre IndexedDB e Lovable Cloud
 * ═══════════════════════════════════════════════════════
 */

import { supabase } from '@/integrations/supabase/client';
import * as db from './db';
import type { Produto, ProductLot, LocalUser, ChatMessage, Sector, AppIdentity } from './db';

// ═══ ESTADO DE CONEXÃO ═══
let isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
let syncInProgress = false;
let syncListeners: Array<(syncing: boolean) => void> = [];

export function getIsOnline(): boolean {
  return isOnline;
}

export function getSyncInProgress(): boolean {
  return syncInProgress;
}

export function addSyncListener(listener: (syncing: boolean) => void): () => void {
  syncListeners.push(listener);
  return () => {
    syncListeners = syncListeners.filter(l => l !== listener);
  };
}

function notifySyncListeners(syncing: boolean): void {
  syncListeners.forEach(listener => listener(syncing));
}

// ═══ INICIALIZAÇÃO ═══
export function initSyncListeners(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('online', () => {
    console.log('🌐 Conexão restabelecida');
    isOnline = true;
    syncAll();
  });

  window.addEventListener('offline', () => {
    console.log('📴 Sem conexão');
    isOnline = false;
  });
}

// ═══ SINCRONIZAÇÃO PRINCIPAL ═══
export async function syncAll(): Promise<void> {
  if (!isOnline || syncInProgress) return;

  console.log('🔄 Iniciando sincronização...');
  syncInProgress = true;
  notifySyncListeners(true);

  try {
    // 1. Sincronizar usuário local para cloud
    await syncLocalUser();

    // 2. Sincronizar produtos (local → cloud)
    await syncProdutosToCloud();

    // 3. Sincronizar lotes (local → cloud)
    await syncLotsToCloud();

    // 4. Baixar dados do cloud
    await downloadFromCloud();

    // 5. Limpar fila de sync
    await db.clearSyncQueue();

    console.log('✅ Sincronização concluída');
  } catch (error) {
    console.error('❌ Erro na sincronização:', error);
  } finally {
    syncInProgress = false;
    notifySyncListeners(false);
  }
}

// ═══ SYNC USUÁRIO LOCAL ═══
async function syncLocalUser(): Promise<void> {
  const localUser = await db.getLocalUser();
  if (!localUser || localUser.synced) return;

  try {
    const { error } = await supabase
      .from('app_users')
      .upsert({
        local_user_id: localUser.local_user_id,
        device_id: localUser.device_id,
        name: localUser.name,
        function: localUser.function,
        is_active: localUser.is_active,
        can_edit_others_lots: localUser.can_edit_others_lots,
        can_delete_lots: localUser.can_delete_lots,
      }, { 
        onConflict: 'local_user_id' 
      });

    if (!error) {
      await db.saveLocalUser({ ...localUser, synced: true });
    }
  } catch (error) {
    console.error('Erro ao sincronizar usuário:', error);
  }
}

// ═══ SYNC PRODUTOS PARA CLOUD ═══
async function syncProdutosToCloud(): Promise<void> {
  const pendingProdutos = await db.getPendingProdutos();
  
  for (const produto of pendingProdutos) {
    try {
      const { data, error } = await supabase
        .from('produtos')
        .upsert({
          id: produto.id, // Incluir id se existir
          barcode: produto.barcode,
          name: produto.name,
          sector: produto.sector,
          alert_days: produto.alert_days,
          is_active: produto.is_active,
          created_by: produto.created_by,
          pending_sync: false,
        }, {
          onConflict: 'barcode'
        })
        .select('id')
        .single();

      if (!error) {
        await db.saveProduto({ 
          ...produto, 
          id: data?.id || produto.id,
          pending_sync: false 
        });
      }
    } catch (error) {
      console.error(`Erro ao sincronizar produto ${produto.barcode}:`, error);
    }
  }
}

// ═══ SYNC LOTES PARA CLOUD ═══
async function syncLotsToCloud(): Promise<void> {
  const pendingLots = await db.getPendingLots();
  
  for (const lot of pendingLots) {
    try {
      // Primeiro, verificar se o produto existe no cloud
      const { data: existingProduct } = await supabase
        .from('produtos')
        .select('barcode')
        .eq('barcode', lot.barcode)
        .single();

      if (!existingProduct) {
        console.warn(`Produto ${lot.barcode} não existe no cloud, pulando lote`);
        continue;
      }

      const { error } = await supabase
        .from('product_lots')
        .upsert({
          id: lot.id,
          barcode: lot.barcode,
          expiration_date: lot.expiration_date,
          quantity: lot.quantity,
          status: lot.status,
          created_by: lot.created_by,
          created_at: lot.created_at,
          pending_sync: false,
          deactivation_reason: lot.deactivation_reason ?? null,
          deactivated_at: lot.deactivated_at ?? null,
          deactivated_by: lot.deactivated_by ?? null,
        }, {
          onConflict: 'id'
        });

      if (!error) {
        await db.saveLot({ ...lot, pending_sync: false });
      }
    } catch (error) {
      console.error(`Erro ao sincronizar lote ${lot.id}:`, error);
    }
  }
}

// ═══ DOWNLOAD DO CLOUD ═══
async function downloadFromCloud(): Promise<void> {
  try {
    console.log('⬇️ Baixando dados do cloud...');
    
    // Download setores
    const { data: sectors } = await supabase
      .from('sectors')
      .select('*');
    
    if (sectors) {
      await db.saveSectors(sectors.map(s => ({
        id: s.id,
        name: s.name,
      })));
      console.log(`  → ${sectors.length} setores baixados`);
    }

    // Download app identity
    const { data: identities } = await supabase
      .from('app_identity')
      .select('*')
      .limit(1);
    
    if (identities && identities.length > 0) {
      const identity = identities[0];
      await db.saveAppIdentity({
        id: identity.id,
        icon_url: identity.icon_url ?? undefined,
        title: identity.title ?? 'Sistema de controle de validades',
        subtitle: identity.subtitle ?? 'Estoque Seguro',
        updated_at: identity.updated_at ?? new Date().toISOString(),
      });
      console.log('  → Identidade do app baixada');
    }

    // Download produtos
    const { data: produtos } = await supabase
      .from('produtos')
      .select('*');
    
    if (produtos && produtos.length > 0) {
      console.log(`  → ${produtos.length} produtos no cloud`);
      const localProdutos = await db.getAllProdutos();
      const localMap = new Map(localProdutos.map(p => [p.barcode, p]));
      
      for (const cloudProduto of produtos) {
        const local = localMap.get(cloudProduto.barcode);
        
        // Só atualizar se cloud for mais recente ou se não existir localmente
        if (!local || new Date(cloudProduto.updated_at) > new Date(local.updated_at)) {
          await db.saveProduto({
            id: cloudProduto.id, // Salvar o ID do cloud
            barcode: cloudProduto.barcode,
            name: cloudProduto.name,
            sector: cloudProduto.sector,
            alert_days: cloudProduto.alert_days ?? 60,
            is_active: cloudProduto.is_active ?? true,
            created_by: cloudProduto.created_by ?? undefined,
            created_at: cloudProduto.created_at,
            updated_at: cloudProduto.updated_at,
            pending_sync: false,
          });
        }
      }
    }

    // Download lotes
    const { data: lots } = await supabase
      .from('product_lots')
      .select('*');
    
    if (lots && lots.length > 0) {
      console.log(`  → ${lots.length} lotes no cloud`);
      const localLots = await db.getAllLots();
      const localMap = new Map(localLots.map(l => [l.id, l]));
      
      for (const cloudLot of lots) {
        const local = localMap.get(cloudLot.id);
        
        if (!local || new Date(cloudLot.updated_at) > new Date(local.updated_at)) {
          await db.saveLot({
            id: cloudLot.id,
            barcode: cloudLot.barcode,
            expiration_date: cloudLot.expiration_date,
            quantity: cloudLot.quantity,
            status: cloudLot.status as 'active' | 'disabled',
            created_by: cloudLot.created_by ?? undefined,
            created_at: cloudLot.created_at,
            updated_at: cloudLot.updated_at,
            pending_sync: false,
            deactivation_reason: (cloudLot as any).deactivation_reason ?? undefined,
            deactivated_at: (cloudLot as any).deactivated_at ?? undefined,
            deactivated_by: (cloudLot as any).deactivated_by ?? undefined,
          });
        }
      }

      // Remover lotes que foram deletados no cloud
      const cloudIds = new Set(lots.map(l => l.id));
      for (const localLot of localLots) {
        if (!cloudIds.has(localLot.id) && !localLot.pending_sync) {
          await db.deleteLot(localLot.id);
        }
      }
    }

    // Download mensagens recentes do chat
    const { data: messages } = await supabase
      .from('chat_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    
    if (messages) {
      await db.bulkSaveMessages(messages.map(m => ({
        id: m.id,
        user_id: m.user_id ?? '',
        user_name: m.user_name,
        message: m.message,
        created_at: m.created_at,
        pending_sync: false,
      })));
    }

    // Download permissões do usuário atual
    await syncUserPermissions();

  } catch (error) {
    console.error('Erro ao baixar dados do cloud:', error);
  }
}

// ═══ SYNC USER PERMISSIONS FROM CLOUD ═══
async function syncUserPermissions(): Promise<void> {
  const localUser = await db.getLocalUser();
  if (!localUser) return;

  try {
    const { data: cloudUser } = await supabase
      .from('app_users')
      .select('*')
      .eq('local_user_id', localUser.local_user_id)
      .single();

    if (cloudUser) {
      await db.saveLocalUser({
        ...localUser,
        is_active: cloudUser.is_active ?? true,
        can_edit_others_lots: cloudUser.can_edit_others_lots ?? false,
        can_delete_lots: cloudUser.can_delete_lots ?? false,
        can_deactivate_products: cloudUser.can_deactivate_products ?? false,
        can_manage_sectors: cloudUser.can_manage_sectors ?? false,
        synced: true,
      });
    }
  } catch (error) {
    console.error('Erro ao sincronizar permissões do usuário:', error);
  }
}

// ═══ OPERAÇÕES COM SYNC ═══
export async function createProduto(produto: Omit<Produto, 'created_at' | 'updated_at' | 'pending_sync' | 'is_active' | 'id'>): Promise<void> {
  const now = new Date().toISOString();
  const newProduto: Produto = {
    ...produto,
    is_active: true,
    created_at: now,
    updated_at: now,
    pending_sync: !isOnline,
  };

  await db.saveProduto(newProduto);

  if (isOnline) {
    try {
      const { data } = await supabase
        .from('produtos')
        .upsert({
          barcode: newProduto.barcode,
          name: newProduto.name,
          sector: newProduto.sector,
          alert_days: newProduto.alert_days,
          is_active: newProduto.is_active,
          created_by: newProduto.created_by,
        }, { onConflict: 'barcode' })
        .select('id')
        .single();
      
      // Salvar o ID retornado do cloud
      await db.saveProduto({ 
        ...newProduto, 
        id: data?.id,
        pending_sync: false 
      });
    } catch (error) {
      console.error('Erro ao salvar produto no cloud:', error);
    }
  }
}

export async function updateProduto(barcode: string, updates: Partial<Produto>): Promise<void> {
  const produto = await db.getProdutoByBarcode(barcode);
  if (!produto) return;

  const updatedProduto: Produto = {
    ...produto,
    ...updates,
    updated_at: new Date().toISOString(),
    pending_sync: !isOnline,
  };

  await db.saveProduto(updatedProduto);

  if (isOnline) {
    try {
      // Usar id se disponível, senão usar barcode
      const query = supabase
        .from('produtos')
        .update({
          name: updatedProduto.name,
          sector: updatedProduto.sector,
          alert_days: updatedProduto.alert_days,
          is_active: updatedProduto.is_active,
        });
      
      if (produto.id) {
        await query.eq('id', produto.id);
      } else {
        await query.eq('barcode', barcode);
      }
      
      await db.saveProduto({ ...updatedProduto, pending_sync: false });
    } catch (error) {
      console.error('Erro ao atualizar produto no cloud:', error);
    }
  }
}

// ═══ SYNC SINGLE PRODUTO TO CLOUD ═══
export async function syncProdutoToCloud(produto: Produto): Promise<void> {
  if (!isOnline) return;

  try {
    const query = supabase
      .from('produtos')
      .update({
        name: produto.name,
        sector: produto.sector,
        alert_days: produto.alert_days,
        is_active: produto.is_active,
      });
    
    // Usar id se disponível, senão usar barcode
    if (produto.id) {
      await query.eq('id', produto.id);
    } else {
      await query.eq('barcode', produto.barcode);
    }
    
    await db.saveProduto({ ...produto, pending_sync: false });
  } catch (error) {
    console.error('Erro ao sincronizar produto no cloud:', error);
  }
}

export async function createLot(lot: Omit<ProductLot, 'created_at' | 'updated_at' | 'pending_sync'>): Promise<{ success: boolean; error?: string }> {
  // Verificar duplicidade
  const isDuplicate = await db.checkDuplicateLot(lot.barcode, lot.expiration_date);
  if (isDuplicate) {
    return { success: false, error: 'Já existe um lote com esta validade para este produto' };
  }

  const now = new Date().toISOString();
  const newLot: ProductLot = {
    ...lot,
    created_at: now,
    updated_at: now,
    pending_sync: true, // Sempre marca como pendente inicialmente
  };

  // 1. Salvar localmente PRIMEIRO (offline-first)
  await db.saveLot(newLot);
  console.log('📦 Lote salvo localmente:', newLot.id);

  // 2. Se online, sincronizar imediatamente
  if (isOnline) {
    try {
      const localUser = await db.getLocalUser();
      const createdByCloud = localUser?.cloud_user_id;

      // Primeiro, garantir que o produto existe no cloud
      const localProduto = await db.getProdutoByBarcode(lot.barcode);
      if (localProduto) {
        const { error: prodError } = await supabase
          .from('produtos')
          .upsert(
            {
              barcode: localProduto.barcode,
              name: localProduto.name,
              sector: localProduto.sector,
              alert_days: localProduto.alert_days,
              is_active: localProduto.is_active,
              created_by: createdByCloud ?? null,
            },
            { onConflict: 'barcode' }
          );

        if (prodError) {
          console.error('Erro ao garantir produto no cloud:', prodError);
        }
      }

      // Agora salvar o lote
      const { error } = await supabase
        .from('product_lots')
        .upsert(
          {
            id: newLot.id,
            barcode: newLot.barcode,
            expiration_date: newLot.expiration_date,
            quantity: newLot.quantity,
            status: newLot.status,
            created_by: createdByCloud ?? null,
            deactivation_reason: newLot.deactivation_reason ?? null,
            deactivated_at: newLot.deactivated_at ?? null,
            deactivated_by: newLot.deactivated_by ?? null,
          },
          { onConflict: 'id' }
        );

      if (error) {
        console.error('Erro ao salvar lote no cloud:', error);
      } else {
        // Marcar como sincronizado
        await db.saveLot({
          ...newLot,
          created_by: createdByCloud ?? newLot.created_by,
          pending_sync: false,
        });
        console.log('☁️ Lote sincronizado com cloud:', newLot.id);
      }
    } catch (error) {
      console.error('Erro ao salvar lote no cloud:', error);
    }
  }

  return { success: true };
}

export async function updateLot(lot: ProductLot): Promise<{ success: boolean; error?: string }> {
  // Verificar duplicidade (excluindo o próprio lote)
  const isDuplicate = await db.checkDuplicateLot(lot.barcode, lot.expiration_date, lot.id);
  if (isDuplicate) {
    return { success: false, error: 'Já existe um lote com esta validade para este produto' };
  }

  const updatedLot: ProductLot = {
    ...lot,
    updated_at: new Date().toISOString(),
    pending_sync: !isOnline,
  };

  await db.saveLot(updatedLot);

  if (isOnline) {
    try {
      const { error } = await supabase
        .from('product_lots')
        .update({
          expiration_date: updatedLot.expiration_date,
          quantity: updatedLot.quantity,
          status: updatedLot.status,
          deactivation_reason: updatedLot.deactivation_reason ?? null,
          deactivated_at: updatedLot.deactivated_at ?? null,
          deactivated_by: updatedLot.deactivated_by ?? null,
        })
        .eq('id', updatedLot.id);
      
      if (error) throw error;
      await db.saveLot({ ...updatedLot, pending_sync: false });
    } catch (error) {
      console.error('Erro ao atualizar lote no cloud:', error);
    }
  }

  return { success: true };
}

export async function deleteLotWithSync(id: string): Promise<void> {
  await db.deleteLot(id);

  if (isOnline) {
    try {
      await supabase
        .from('product_lots')
        .delete()
        .eq('id', id);
    } catch (error) {
      console.error('Erro ao deletar lote no cloud:', error);
    }
  } else {
    await db.addToSyncQueue({
      table: 'product_lots',
      operation: 'delete',
      data: { id },
    });
  }
}

// ═══ DELETE PRODUTO ═══
export async function deleteProdutoWithSync(barcode: string): Promise<void> {
  // Primeiro buscar o produto para obter o ID do cloud
  const produto = await db.getProdutoByBarcode(barcode);
  
  // Deletar localmente
  await db.deleteProduto(barcode);

  if (isOnline && produto?.id) {
    try {
      await supabase
        .from('produtos')
        .delete()
        .eq('id', produto.id);
    } catch (error) {
      console.error('Erro ao deletar produto no cloud:', error);
    }
  } else if (!isOnline) {
    await db.addToSyncQueue({
      table: 'produtos',
      operation: 'delete',
      data: { barcode, id: produto?.id },
    });
  }
}

export async function sendChatMessage(userId: string, userName: string, message: string): Promise<void> {
  const chatMessage: ChatMessage = {
    id: db.generateUUID(),
    user_id: userId,
    user_name: userName,
    message,
    created_at: new Date().toISOString(),
    pending_sync: !isOnline,
  };

  await db.saveChatMessage(chatMessage);

  if (isOnline) {
    try {
      await supabase
        .from('chat_messages')
        .insert({
          id: chatMessage.id,
          user_id: chatMessage.user_id,
          user_name: chatMessage.user_name,
          message: chatMessage.message,
        });
      
      await db.saveChatMessage({ ...chatMessage, pending_sync: false });
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    }
  }
}

// ═══ SECTOR OPERATIONS ═══
export async function createSector(name: string): Promise<Sector> {
  const sector: Sector = {
    id: db.generateUUID(),
    name,
  };

  await db.saveSector(sector);

  if (isOnline) {
    try {
      await supabase
        .from('sectors')
        .insert({
          id: sector.id,
          name: sector.name,
        });
    } catch (error) {
      console.error('Erro ao criar setor no cloud:', error);
    }
  }

  return sector;
}

export async function updateSector(id: string, name: string): Promise<void> {
  const sector = await db.getSectorById(id);
  if (!sector) return;

  const updatedSector: Sector = {
    ...sector,
    name,
  };

  await db.saveSector(updatedSector);

  if (isOnline) {
    try {
      await supabase
        .from('sectors')
        .update({ name })
        .eq('id', id);
    } catch (error) {
      console.error('Erro ao atualizar setor no cloud:', error);
    }
  }
}

export async function deleteSectorWithSync(id: string): Promise<void> {
  await db.deleteSector(id);

  if (isOnline) {
    try {
      await supabase
        .from('sectors')
        .delete()
        .eq('id', id);
    } catch (error) {
      console.error('Erro ao deletar setor no cloud:', error);
    }
  }
}

// ═══ APP IDENTITY OPERATIONS ═══
export async function updateAppIdentity(identity: Partial<AppIdentity>): Promise<void> {
  const current = await db.getAppIdentity();
  const updated: AppIdentity = {
    id: current?.id || db.generateUUID(),
    icon_url: identity.icon_url ?? current?.icon_url,
    title: identity.title ?? current?.title ?? 'Sistema de controle de validades',
    subtitle: identity.subtitle ?? current?.subtitle ?? 'Estoque Seguro',
    updated_at: new Date().toISOString(),
  };

  await db.saveAppIdentity(updated);

  if (isOnline) {
    try {
      await supabase
        .from('app_identity')
        .upsert({
          id: updated.id,
          icon_url: updated.icon_url,
          title: updated.title,
          subtitle: updated.subtitle,
          updated_at: updated.updated_at,
        }, { onConflict: 'id' });
    } catch (error) {
      console.error('Erro ao atualizar identidade do app no cloud:', error);
    }
  }
}

// ═══ REALTIME ═══
export function subscribeToRealtime(onUpdate: () => void): () => void {
  const channel = supabase
    .channel('db-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'produtos' },
      async (payload) => {
        console.log('📦 Produto atualizado:', payload);
        if (payload.new && typeof payload.new === 'object' && 'barcode' in payload.new) {
          const p = payload.new as {
            barcode: string;
            name: string;
            sector: string;
            alert_days: number | null;
            is_active: boolean | null;
            created_by: string | null;
            created_at: string;
            updated_at: string;
          };
          await db.saveProduto({
            barcode: p.barcode,
            name: p.name,
            sector: p.sector,
            alert_days: p.alert_days ?? 60,
            is_active: p.is_active ?? true,
            created_by: p.created_by ?? undefined,
            created_at: p.created_at,
            updated_at: p.updated_at,
            pending_sync: false,
          });
        }
        onUpdate();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'product_lots' },
      async (payload) => {
        console.log('📋 Lote atualizado:', payload);
        if (payload.eventType === 'DELETE' && payload.old && typeof payload.old === 'object' && 'id' in payload.old) {
          await db.deleteLot((payload.old as { id: string }).id);
        } else if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
          const l = payload.new as {
            id: string;
            barcode: string;
            expiration_date: string;
            quantity: number;
            status: string;
            created_by: string | null;
            created_at: string;
            updated_at: string;
          };
          await db.saveLot({
            id: l.id,
            barcode: l.barcode,
            expiration_date: l.expiration_date,
            quantity: l.quantity,
            status: l.status as 'active' | 'disabled',
            created_by: l.created_by ?? undefined,
            created_at: l.created_at,
            updated_at: l.updated_at,
            pending_sync: false,
          });
        }
        onUpdate();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'chat_messages' },
      async (payload) => {
        console.log('💬 Mensagem recebida:', payload);
        if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
          const m = payload.new as {
            id: string;
            user_id: string | null;
            user_name: string;
            message: string;
            created_at: string;
          };
          await db.saveChatMessage({
            id: m.id,
            user_id: m.user_id ?? '',
            user_name: m.user_name,
            message: m.message,
            created_at: m.created_at,
            pending_sync: false,
          });
        }
        onUpdate();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sectors' },
      async (payload) => {
        console.log('🏷️ Setor atualizado:', payload);
        if (payload.eventType === 'DELETE' && payload.old && typeof payload.old === 'object' && 'id' in payload.old) {
          await db.deleteSector((payload.old as { id: string }).id);
        } else if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
          const s = payload.new as {
            id: string;
            name: string;
          };
          await db.saveSector({
            id: s.id,
            name: s.name,
          });
        }
        onUpdate();
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'app_users' },
      async (payload) => {
        console.log('👤 Usuário atualizado:', payload);
        // Sync user permissions when they change
        const localUser = await db.getLocalUser();
        if (localUser && payload.new && typeof payload.new === 'object' && 'local_user_id' in payload.new) {
          const u = payload.new as {
            local_user_id: string;
            is_active: boolean | null;
            can_edit_others_lots: boolean | null;
            can_delete_lots: boolean | null;
            can_deactivate_products: boolean | null;
            can_manage_sectors: boolean | null;
          };
          if (u.local_user_id === localUser.local_user_id) {
            await db.saveLocalUser({
              ...localUser,
              is_active: u.is_active ?? true,
              can_edit_others_lots: u.can_edit_others_lots ?? false,
              can_delete_lots: u.can_delete_lots ?? false,
              can_deactivate_products: u.can_deactivate_products ?? false,
              can_manage_sectors: u.can_manage_sectors ?? false,
            });
            onUpdate();
          }
        }
      }
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'app_identity' },
      async (payload) => {
        console.log('🎨 Identidade atualizada:', payload);
        if (payload.new && typeof payload.new === 'object' && 'id' in payload.new) {
          const i = payload.new as {
            id: string;
            icon_url: string | null;
            title: string | null;
            subtitle: string | null;
            updated_at: string | null;
          };
          await db.saveAppIdentity({
            id: i.id,
            icon_url: i.icon_url ?? undefined,
            title: i.title ?? 'Sistema de controle de validades',
            subtitle: i.subtitle ?? 'Estoque Seguro',
            updated_at: i.updated_at ?? new Date().toISOString(),
          });
        }
        onUpdate();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
