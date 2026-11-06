import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AppProvider } from "@/contexts/AppContext";
import { AnimatePresence } from "framer-motion";
import SplashScreen from "@/components/SplashScreen";
import Index from "./pages/Index";
import Identificacao from "./pages/Identificacao";
import CadastrarProduto from "./pages/CadastrarProduto";
import ConsultarProdutos from "./pages/ConsultarProdutos";
import DetalheProduto from "./pages/DetalheProduto";
import LotesAtivos from "./pages/LotesAtivos";
import ValidadesCriticas from "./pages/ValidadesCriticas";
import ChatGlobal from "./pages/ChatGlobal";
import Configuracoes from "./pages/Configuracoes";
import AdminLogin from "./pages/AdminLogin";
import AdminPanel from "./pages/AdminPanel";
import GestaoMetas from "./pages/GestaoMetas";
import LancarVenda from "./pages/LancarVenda";
import DashboardMetas from "./pages/DashboardMetas";
import NotFound from "./pages/NotFound";
import CentralFerramentas from "./pages/CentralFerramentas";
import SorteiosConfig from "./pages/SorteiosConfig";
import SorteioVendas from "./pages/SorteioVendas";
import SorteioApuracao from "./pages/SorteioApuracao";
import SorteioPublico from "./pages/SorteioPublico";
import EleicoesConfig from "./pages/EleicoesConfig";
import EleicaoMesario from "./pages/EleicaoMesario";
import EleicaoUrna from "./pages/EleicaoUrna";
import EleicaoApuracao from "./pages/EleicaoApuracao";
import EleicaoPublica from "./pages/EleicaoPublica";
import ModuloEmPreparacao from "./pages/ModuloEmPreparacao";

const queryClient = new QueryClient();

const App = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  useEffect(() => {
    const hasSeenSplash = sessionStorage.getItem('hasSeenSplash');
    if (hasSeenSplash) {
      setShowSplash(false);
      setIsFirstLoad(false);
    }
  }, []);

  const handleSplashFinish = () => {
    setShowSplash(false);
    sessionStorage.setItem('hasSeenSplash', 'true');
  };

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TooltipProvider>
          <AppProvider>
            <Toaster />
            <Sonner />
            <AnimatePresence mode="wait">
              {showSplash && isFirstLoad && (
                <SplashScreen onFinish={handleSplashFinish} />
              )}
            </AnimatePresence>
            {!showSplash && (
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/identificacao" element={<Identificacao />} />
                <Route path="/cadastrar" element={<CadastrarProduto />} />
                <Route path="/consultar" element={<ConsultarProdutos />} />
                <Route path="/produto/:barcode" element={<DetalheProduto />} />
                <Route path="/lotes-ativos" element={<LotesAtivos />} />
                <Route path="/validades-criticas" element={<ValidadesCriticas />} />
                <Route path="/chat" element={<ChatGlobal />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
                <Route path="/admin-login" element={<AdminLogin />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/gestao-metas" element={<GestaoMetas />} />
                <Route path="/lancar-venda" element={<LancarVenda />} />
                <Route path="/metas" element={<DashboardMetas />} />
                <Route path="/ferramentas" element={<CentralFerramentas />} />
                <Route path="/ferramentas/urna-cipa" element={<Navigate to="/ferramentas/eleicoes" replace />} />
                <Route path="/ferramentas/eleicoes" element={<EleicoesConfig />} />
                <Route path="/ferramentas/gestao-metas" element={<ModuloEmPreparacao variant="metas" />} />
                <Route path="/ferramentas/eleicoes/:id/mesario" element={<EleicaoMesario />} />
                <Route path="/ferramentas/eleicoes/:id/urna" element={<EleicaoUrna />} />
                <Route path="/ferramentas/eleicoes/:id/apuracao" element={<EleicaoApuracao />} />
                <Route path="/eleicao/:id" element={<EleicaoPublica />} />
                <Route path="/ferramentas/sorteios" element={<SorteiosConfig />} />
                <Route path="/sorteio/:id" element={<SorteioPublico />} />
                <Route path="/ferramentas/sorteios/:id/vendas" element={<SorteioVendas />} />
                <Route path="/ferramentas/sorteios/:id/apuracao" element={<SorteioApuracao />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            )}
          </AppProvider>
        </TooltipProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
