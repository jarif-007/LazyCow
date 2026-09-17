import React from 'react';

interface OSCriticalWarningModalProps {
  trigger: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const OSCriticalWarningModal: React.FC<OSCriticalWarningModalProps> = ({ trigger, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onCancel} />
      
      {/* Modal */}
      <div className="relative bg-card border border-red-500/30 rounded-2xl p-8 shadow-2xl max-w-md w-full mx-4">
        <div className="flex flex-col items-center text-center gap-4">
          {/* Red exclamation icon */}
          <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-red-500">error</span>
          </div>

          <h2 className="font-title-sm text-foreground text-lg">System-Critical Shortcut</h2>

          <p className="text-muted-foreground font-body-md leading-relaxed">
            <code className="bg-muted px-2 py-0.5 rounded text-foreground font-code-sm">{trigger}</code> is marked as a system-critical shortcut. 
            Removing it from the blocked list may allow a custom shortcut to override this key combination, 
            potentially interfering with normal system behavior.
          </p>

          <div className="flex gap-3 w-full mt-2">
            <button
              onClick={onCancel}
              className="flex-1 px-6 py-2.5 border border-border rounded-full font-title-sm hover:bg-muted transition-colors text-foreground"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 px-6 py-2.5 bg-red-500 text-white rounded-full font-title-sm hover:bg-red-600 transition-colors shadow-md"
            >
              Delete Anyway
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};