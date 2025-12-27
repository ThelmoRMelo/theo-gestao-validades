import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield, User, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Credenciais fixas conforme especificação
    if (username === 'Administrador' && password === 'ADM102030') {
      sessionStorage.setItem('admin_auth', 'true');
      toast.success('Acesso administrativo concedido!');
      navigate('/admin');
    } else {
      toast.error('Credenciais inválidas');
    }

    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="header-gradient flex items-center gap-4">
        <button 
          onClick={() => navigate('/configuracoes')}
          className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-primary-foreground" />
        </button>
        <div>
          <h1 className="font-display text-xl font-bold text-primary-foreground flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Acesso Administrativo
          </h1>
          <p className="text-primary-foreground/80 text-sm">
            Área restrita
          </p>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="glass-card p-6 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Shield className="w-10 h-10 text-primary" />
            </div>
            <h2 className="font-display text-xl font-bold text-foreground">
              Login Administrativo
            </h2>
            <p className="text-muted-foreground text-sm mt-1">
              Insira suas credenciais para continuar
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label className="flex items-center gap-2 text-muted-foreground mb-2">
                <User className="w-4 h-4" />
                Usuário
              </Label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Digite o usuário"
                className="input-futuristic"
                autoComplete="off"
              />
            </div>

            <div>
              <Label className="flex items-center gap-2 text-muted-foreground mb-2">
                <Lock className="w-4 h-4" />
                Senha
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite a senha"
                  className="input-futuristic pr-10"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !username || !password}
              className="btn-neon w-full mt-6"
            >
              {isLoading ? 'Verificando...' : 'Entrar'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
