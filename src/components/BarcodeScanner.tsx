import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeScannerState } from 'html5-qrcode';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, Camera, FlashlightOff, Flashlight } from 'lucide-react';

interface BarcodeScannerProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({ isOpen, onClose, onScan }) => {
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      scannerRef.current = null;
    }
    if (mountedRef.current) {
      setIsScanning(false);
      setTorchOn(false);
    }
  }, []);

  const startScanner = useCallback(async () => {
    if (!containerRef.current || scannerRef.current) return;

    try {
      setError(null);
      const scanner = new Html5Qrcode('scanner-container', {
        verbose: false,
        formatsToSupport: undefined, // Suporta todos os formatos
      });
      scannerRef.current = scanner;

// Área de leitura otimizada para códigos de barras EAN/UPC.
// Mantemos uma região ampla para evitar que o usuário precise
// posicionar o código exatamente em um ponto específico.
const calculateScanRegion = (
  viewfinderWidth: number,
  viewfinderHeight: number
) => {
  const scanWidth = Math.floor(viewfinderWidth * 0.90);
  const scanHeight = Math.floor(viewfinderHeight * 0.38);

  return {
    width: scanWidth,
    height: scanHeight,
  };
};
      await scanner.start(
  {
    facingMode: 'environment',
  },
  {
    fps: 15,
    qrbox: calculateScanRegion,
    aspectRatio: 4 / 3,
    disableFlip: false,
  },
        (decodedText) => {
          // Código detectado com sucesso
          onScan(decodedText);
          stopScanner();
          onClose();
        },
        () => {
          // Ignorar erros de scan silenciosamente
        }
      );
      
      if (mountedRef.current) {
        setIsScanning(true);
      }
      // Tenta otimizar automaticamente o foco da câmera para leitura
      // de códigos de barras próximos e distantes.
      try {
        const runningTrack = (scanner as any).getRunningTrackSettings?.();

        if (runningTrack) {
          await (scanner as any).applyVideoConstraints({
            advanced: [
              {
                focusMode: 'continuous',
              },
            ],
          });

          console.log('Foco contínuo solicitado para a câmera.');
        }
      } catch (focusError) {
        // Nem todas as câmeras/browser suportam focusMode.
        // O scanner continua funcionando normalmente com o autofoco nativo.
        console.log(
          'Foco contínuo não disponível neste dispositivo:',
          focusError
        );
      }

      if (mountedRef.current) {
        setIsScanning(true);
      }
    } catch (err: any) {
      console.error('Scanner error:', err);
      if (mountedRef.current) {
        setError(err?.message || 'Erro ao iniciar câmera. Verifique as permissões.');
        setIsScanning(false);
      }
    }
  }, [onScan, onClose, stopScanner]);

  const toggleTorch = async () => {
    if (scannerRef.current) {
      try {
        const track = (scannerRef.current as any).getRunningTrackSettings?.();
        if (track?.torch !== undefined) {
          await (scannerRef.current as any).applyVideoConstraints({
            advanced: [{ torch: !torchOn }]
          });
          setTorchOn(!torchOn);
        }
      } catch (err) {
        console.error('Torch not supported:', err);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    
    if (isOpen) {
      // Delay para garantir que o container esteja montado
      const timer = setTimeout(() => startScanner(), 350);
      return () => clearTimeout(timer);
    } else {
      stopScanner();
    }

    return () => {
      mountedRef.current = false;
      stopScanner();
    };
  }, [isOpen, startScanner, stopScanner]);

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md bg-card border-border/50 p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center justify-between text-foreground">
            <span className="flex items-center gap-2">
              <Camera className="w-5 h-5 text-primary" />
              Scanner de Código de Barras
            </span>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X className="w-5 h-5" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="relative w-full aspect-[4/3] bg-secondary overflow-hidden">
          {/* Container do scanner - a biblioteca html5-qrcode renderiza aqui */}
          <div
            id="scanner-container"
            ref={containerRef}
            className="w-full h-full [&>video]:object-contain [&>video]:bg-black"
            style={{
              // Garantir que o vídeo preencha o container
              position: 'relative',
            }}
          />
          
          {/* Loading state */}
          {!isScanning && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-card/90 z-10">
              <div className="animate-pulse text-muted-foreground">
                Iniciando câmera...
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/90 p-4 text-center z-10">
              <p className="text-destructive mb-4">{error}</p>
              <Button onClick={startScanner} variant="outline">
                Tentar Novamente
              </Button>
            </div>
          )}

          {/* Custom overlay que coincide EXATAMENTE com a área de detecção */}
          {isScanning && (
            <div className="absolute inset-0 pointer-events-none z-20">
              {/* Máscara escura com buraco central */}
              <svg className="absolute inset-0 w-full h-full">
                <defs>
                  <mask id="scan-mask">
                    {/* Fundo branco (visível) */}
                    <rect x="0" y="0" width="100%" height="100%" fill="white" />
                    {/* Área visual correspondente à região real de leitura */}
<rect 
  x="5%" 
  y="31%" 
  width="90%" 
  height="38%" 
  fill="black" 
  rx="8"
/>
                  </mask>
                </defs>
                {/* Overlay escuro com máscara */}
                <rect 
                  x="0" 
                  y="0" 
                  width="100%" 
                  height="100%" 
                  fill="hsl(var(--background) / 0.7)" 
                  mask="url(#scan-mask)" 
                />
              </svg>
              
              {/* Frame de scan - posicionado EXATAMENTE no centro (60% largura, 28% altura) */}
              <div 
                className="absolute"
                style={{ 
                  left: '20%',
                  top: '36%',
                  width: '60%', 
                  height: '28%',
                }}
              >
                {/* Borda principal */}
                <div className="absolute inset-0 border-2 border-primary rounded-lg" />
                
                {/* Cantos decorativos */}
                <div className="absolute -top-0.5 -left-0.5 w-6 h-6 border-t-3 border-l-3 border-primary rounded-tl-lg" style={{ borderWidth: '3px 0 0 3px' }} />
                <div className="absolute -top-0.5 -right-0.5 w-6 h-6 border-t-3 border-r-3 border-primary rounded-tr-lg" style={{ borderWidth: '3px 3px 0 0' }} />
                <div className="absolute -bottom-0.5 -left-0.5 w-6 h-6 border-b-3 border-l-3 border-primary rounded-bl-lg" style={{ borderWidth: '0 0 3px 3px' }} />
                <div className="absolute -bottom-0.5 -right-0.5 w-6 h-6 border-b-3 border-r-3 border-primary rounded-br-lg" style={{ borderWidth: '0 3px 3px 0' }} />
                
                {/* Linha de scan animada - horizontalmente centralizada */}
                <div 
                  className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse"
                  style={{ top: '50%', transform: 'translateY(-50%)' }}
                />
              </div>
              
              {/* Indicador de posição */}
              <div className="absolute bottom-4 left-0 right-0 text-center">
                <span className="bg-background/80 text-foreground text-xs px-3 py-1 rounded-full">
                  Centralize o código na área demarcada
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 space-y-3">
          <p className="text-sm text-muted-foreground text-center">
            Posicione o código de barras no <strong>centro</strong> da área demarcada
          </p>
          
          <div className="flex gap-2">
            <Button
              onClick={toggleTorch}
              variant="outline"
              className="flex-1"
              disabled={!isScanning}
            >
              {torchOn ? (
                <>
                  <FlashlightOff className="w-4 h-4 mr-2" />
                  Desligar Flash
                </>
              ) : (
                <>
                  <Flashlight className="w-4 h-4 mr-2" />
                  Ligar Flash
                </>
              )}
            </Button>
            <Button onClick={handleClose} variant="secondary" className="flex-1">
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BarcodeScanner;
