import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { SPRING_ENTER, FADE_ENTER, BACKDROP_ENTER, MODAL_OFFSET_Y } from '../utils/motion';

interface DeleteModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({ isOpen, onConfirm, onCancel }) => {
  const reducedMotion = usePrefersReducedMotion();

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
      <motion.div 
        className="absolute inset-0 bg-background/90" 
        onClick={onCancel}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={reducedMotion ? FADE_ENTER : BACKDROP_ENTER}
      />
      <motion.div 
        className="relative bg-card border border-border rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 text-center"
        initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: MODAL_OFFSET_Y }}
        animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
        exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: MODAL_OFFSET_Y }}
        transition={reducedMotion ? FADE_ENTER : SPRING_ENTER}
      >
        <span className="material-symbols-outlined text-4xl text-red-500 mb-2">delete_forever</span>
        <h2 className="font-title-sm text-foreground mb-2">Delete Shortcut?</h2>
        <p className="text-muted-foreground font-body-md mb-4">This action cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2 border border-border rounded-full font-body-sm hover:bg-muted transition-colors text-foreground">Cancel</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2 bg-red-500 text-white rounded-full font-body-sm hover:bg-red-600 transition-colors">Delete</button>
        </div>
      </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
};