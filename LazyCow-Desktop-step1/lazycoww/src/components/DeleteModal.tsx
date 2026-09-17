import React from 'react';

interface DeleteModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({ onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-card border border-border rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 text-center">
        <span className="material-symbols-outlined text-4xl text-red-500 mb-2">delete_forever</span>
        <h2 className="font-title-sm text-foreground mb-2">Delete Shortcut?</h2>
        <p className="text-muted-foreground font-body-md mb-4">This action cannot be undone.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 px-4 py-2 border border-border rounded-full font-body-sm hover:bg-muted transition-colors text-foreground">Cancel</button>
          <button onClick={onConfirm} className="flex-1 px-4 py-2 bg-red-500 text-white rounded-full font-body-sm hover:bg-red-600 transition-colors">Delete</button>
        </div>
      </div>
    </div>
  );
};