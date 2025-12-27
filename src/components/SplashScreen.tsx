import { useEffect } from 'react';
import { motion } from 'framer-motion';

interface SplashScreenProps {
  onFinish: () => void;
}

const SplashScreen = ({ onFinish }: SplashScreenProps) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 2500);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background"
    >
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ 
          duration: 0.8, 
          ease: "easeOut",
          delay: 0.2
        }}
        className="relative"
      >
        {/* Círculo de fundo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="absolute inset-0 rounded-full bg-primary/20"
          style={{
            width: '300px',
            height: '300px',
            transform: 'translate(-50%, -50%)',
            left: '50%',
            top: '50%',
            filter: 'blur(40px)',
          }}
        />
        
        {/* Container do ícone */}
        <motion.div
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          transition={{ 
            duration: 0.6, 
            delay: 0.4,
            ease: "easeOut"
          }}
          className="relative z-10 flex items-center justify-center"
        >
          <div
            className="flex items-center justify-center rounded-2xl shadow-2xl bg-card border border-border"
            style={{
              width: '140px',
              height: '140px',
              boxShadow: 'var(--shadow-card)',
            }}
          >
            <span
              className="font-bold text-primary font-display"
              style={{
                fontSize: '56px',
              }}
            >
              TG
            </span>
          </div>
        </motion.div>
        
        {/* Animação de loading */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          className="absolute -bottom-16 left-1/2 transform -translate-x-1/2"
        >
          <div className="flex space-x-2">
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 1,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
                className="w-2 h-2 rounded-full bg-primary/60"
              />
            ))}
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

export default SplashScreen;
