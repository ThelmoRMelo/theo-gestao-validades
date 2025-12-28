import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '😡'];

interface ReactionPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  position?: { x: number; y: number };
}

const ReactionPicker = ({ onSelect, onClose, position }: ReactionPickerProps) => {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        className="absolute z-50 bg-card border border-border rounded-full px-2 py-1 shadow-lg flex gap-1"
        style={position ? { left: position.x, top: position.y } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {EMOJI_LIST.map((emoji) => (
          <button
            key={emoji}
            onClick={() => {
              onSelect(emoji);
              onClose();
            }}
            className="text-xl hover:scale-125 transition-transform p-1"
          >
            {emoji}
          </button>
        ))}
      </motion.div>
    </AnimatePresence>
  );
};

export default ReactionPicker;
