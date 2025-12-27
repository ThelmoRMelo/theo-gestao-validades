import { useState } from 'react';
import { Calculator, X, Delete } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface QuantityCalculatorProps {
  value: number;
  onChange: (value: number) => void;
}

const QuantityCalculator = ({ value, onChange }: QuantityCalculatorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [display, setDisplay] = useState(value.toString());
  const [previousValue, setPreviousValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForNewValue, setWaitingForNewValue] = useState(false);

  const handleDigit = (digit: string) => {
    if (waitingForNewValue) {
      setDisplay(digit);
      setWaitingForNewValue(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  };

  const handleOperator = (op: string) => {
    const current = parseFloat(display);
    
    if (previousValue !== null && operator && !waitingForNewValue) {
      const result = calculate(previousValue, current, operator);
      setDisplay(result.toString());
      setPreviousValue(result);
    } else {
      setPreviousValue(current);
    }
    
    setOperator(op);
    setWaitingForNewValue(true);
  };

  const calculate = (a: number, b: number, op: string): number => {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷': return b !== 0 ? a / b : 0;
      default: return b;
    }
  };

  const handleEquals = () => {
    if (previousValue !== null && operator) {
      const current = parseFloat(display);
      const result = calculate(previousValue, current, operator);
      setDisplay(result.toString());
      setPreviousValue(null);
      setOperator(null);
      setWaitingForNewValue(true);
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperator(null);
    setWaitingForNewValue(false);
  };

  const handleBackspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const handleConfirm = () => {
    const finalValue = Math.max(0, Math.round(parseFloat(display) || 0));
    onChange(finalValue);
    setIsOpen(false);
    handleClear();
  };

  const openCalculator = () => {
    setDisplay(value.toString());
    setIsOpen(true);
  };

  const buttons = [
    ['7', '8', '9', '÷'],
    ['4', '5', '6', '×'],
    ['1', '2', '3', '-'],
    ['0', '.', '=', '+'],
  ];

  return (
    <>
      <button
        type="button"
        onClick={openCalculator}
        className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center hover:bg-primary/30 transition-all active:scale-95"
        aria-label="Abrir calculadora"
      >
        <Calculator className="w-5 h-5 text-primary" />
      </button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-xs bg-card border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-foreground">
              <span className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-primary" />
                Calculadora
              </span>
              <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
                <X className="w-5 h-5" />
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Display */}
            <div className="bg-secondary rounded-xl p-4">
              <div className="text-right">
                {previousValue !== null && operator && (
                  <div className="text-sm text-muted-foreground">
                    {previousValue} {operator}
                  </div>
                )}
                <div className="text-3xl font-bold text-foreground font-mono truncate">
                  {display}
                </div>
              </div>
            </div>

            {/* Botões de controle */}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClear}
                className="flex-1"
              >
                C
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleBackspace}
                className="flex-1"
              >
                <Delete className="w-4 h-4" />
              </Button>
            </div>

            {/* Teclado numérico */}
            <div className="grid grid-cols-4 gap-2">
              {buttons.map((row, rowIndex) =>
                row.map((btn, colIndex) => (
                  <Button
                    key={`${rowIndex}-${colIndex}`}
                    type="button"
                    variant={['+', '-', '×', '÷'].includes(btn) ? 'secondary' : btn === '=' ? 'default' : 'outline'}
                    className={`h-12 text-lg font-semibold ${btn === '=' ? 'bg-primary text-primary-foreground' : ''}`}
                    onClick={() => {
                      if (['+', '-', '×', '÷'].includes(btn)) {
                        handleOperator(btn);
                      } else if (btn === '=') {
                        handleEquals();
                      } else {
                        handleDigit(btn);
                      }
                    }}
                  >
                    {btn}
                  </Button>
                ))
              )}
            </div>

            {/* Botão confirmar */}
            <Button
              type="button"
              onClick={handleConfirm}
              className="w-full btn-neon"
            >
              Usar valor: {Math.round(parseFloat(display) || 0)}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default QuantityCalculator;
