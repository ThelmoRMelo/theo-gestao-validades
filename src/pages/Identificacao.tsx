import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '@/contexts/AppContext';
import { generateUUID, generateDeviceId } from '@/lib/db';
import { User, Briefcase } from 'lucide-react';

const Identificacao = () => {
  const navigate = useNavigate();
  const { user, setUser } = useApp();
  const [nome, setNome] = useState('');
  const [funcao, setFuncao] = useState('');
  const [error, setError] = useState('');

  // Se já tem usuário, redireciona
  if (user) {
    navigate('/');
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!nome.trim() || !funcao.trim()) {
      setError('Preencha todos os campos');
      return;
    }

    const newUser = {
      local_user_id: generateUUID(),
      device_id: generateDeviceId(),
      name: nome.trim(),
      function: funcao.trim(),
      is_active: true,
      can_edit_others_lots: false,
      can_delete_lots: false,
      can_deactivate_products: false,
      can_manage_sectors: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      synced: false,
    };

    await setUser(newUser);
    navigate('/');
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl font-bold text-primary mb-2">
            Me Fala Quem Você É
          </h1>
          <p className="text-muted-foreground">
            Identificação única para este dispositivo
          </p>
        </div>

        <form onSubmit={handleSubmit} className="glass-card p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">
              <User className="inline w-4 h-4 mr-2" />
              Seu Nome
            </label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Digite seu nome"
              className="input-futuristic"
              maxLength={50}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">
              <Briefcase className="inline w-4 h-4 mr-2" />
              Sua Função
            </label>
            <input
              type="text"
              value={funcao}
              onChange={(e) => setFuncao(e.target.value)}
              placeholder="Ex: Repositor, Gerente, etc."
              className="input-futuristic"
              maxLength={50}
            />
          </div>

          {error && (
            <p className="text-coral text-sm text-center">{error}</p>
          )}

          <button type="submit" className="btn-neon w-full">
            Continuar
          </button>
        </form>
      </div>
    </div>
  );
};

export default Identificacao;
