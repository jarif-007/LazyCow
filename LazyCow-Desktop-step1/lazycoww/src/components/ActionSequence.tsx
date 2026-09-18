import React, { useState } from 'react';
import { ActionItem, getFieldLabel } from '../types/actions';

interface ActionSequenceProps {
  sequence: ActionItem[];
  onDelete: (id: string) => void;
  onUpdateValue: (id: string, value: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onDropFromSidebar: (index: number, catalogType: string) => void;
  onDropAtEnd: (catalogType: string) => void;
}

export const ActionSequence: React.FC<ActionSequenceProps> = ({
  sequence,
  onDelete,
  onUpdateValue,
  onMoveUp,
  onMoveDown,
  onReorder,
  onDropFromSidebar,
  onDropAtEnd,
}) => {
  // ── Drag state for internal reorder ──
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // ── Drag state for sidebar drops ──
  const [sidebarDragOverIndex, setSidebarDragOverIndex] = useState<number | null>(null);
  const [dragOverDropZone, setDragOverDropZone] = useState(false);

  // ───────────────────────────────────
  // INTERNAL REORDER (card to card)
  // ───────────────────────────────────

  const handleDragStart = (e: React.DragEvent, index: number) => {
    // Mark this as an internal reorder drag
    e.dataTransfer.setData('application/drag-type', 'reorder');
    e.dataTransfer.effectAllowed = 'move';
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const dragType = e.dataTransfer.types.includes('application/drag-type')
      ? e.dataTransfer.getData('application/drag-type')
      : '';

    if (dragType === 'reorder') {
      // Internal reorder
      e.dataTransfer.dropEffect = 'move';
      setDragOverIndex(index);
      setSidebarDragOverIndex(null);
    }
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const dragType = e.dataTransfer.getData('application/drag-type');

    if (dragType === 'reorder' && dragIndex !== null && dragIndex !== index) {
      onReorder(dragIndex, index);
    }

    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  // ───────────────────────────────────
  // SIDEBAR → SEQUENCE DROP
  // ───────────────────────────────────

  const handleSidebarDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    // Only respond if this is NOT a reorder drag
    if (!e.dataTransfer.types.includes('application/drag-type')) {
      e.dataTransfer.dropEffect = 'copy';
      setSidebarDragOverIndex(index);
      setDragOverDropZone(false);
    }
  };

  const handleSidebarDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const catalogType = e.dataTransfer.getData('application/catalog-type');
    if (catalogType) {
      onDropFromSidebar(index, catalogType);
    }
    setSidebarDragOverIndex(null);
  };

  // ───────────────────────────────────
  // DROP ZONE (end of sequence)
  // ───────────────────────────────────

  const handleZoneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer.types.includes('application/drag-type')) {
      e.dataTransfer.dropEffect = 'copy';
      setDragOverDropZone(true);
      setSidebarDragOverIndex(null);
    }
  };

  const handleZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const catalogType = e.dataTransfer.getData('application/catalog-type');
    if (catalogType) {
      onDropAtEnd(catalogType);
    }
    setDragOverDropZone(false);
  };

  const handleZoneDragLeave = () => setDragOverDropZone(false);

  // Determine which highlight to show for each card
  const getHighlightClass = (index: number) => {
    if (dragOverIndex === index) return 'border-primary border-2 bg-primary/5 shadow-lg shadow-primary/10';
    if (sidebarDragOverIndex === index) return 'border-primary border-2 bg-primary/5 shadow-lg shadow-primary/10';
    return 'border-border/80';
  };

  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    const validateActions = async () => {
      const errors: Record<string, string> = {};
      for (const card of sequence) {
        if (card.type === 'open_url') {
          if (card.value && !/^https?:\/\//i.test(card.value)) {
            errors[card.id] = 'URL must start with http:// or https://';
          }
        } else if (card.type === 'launch_app' || card.type === 'open_folder' || card.type === 'open_file' || card.type === 'open_vscode') {
          if (card.value) {
            if (window.electronAPI?.checkPathExists) {
              const exists = await window.electronAPI.checkPathExists(card.value);
              if (!exists) errors[card.id] = 'Path does not exist';
            }
          } else {
            errors[card.id] = 'Path is required';
          }
        } else if (card.type === 'set_volume' || card.type === 'set_brightness') {
          const val = Number(card.value);
          if (isNaN(val) || val < 0 || val > 100 || !Number.isInteger(val)) {
            errors[card.id] = `${card.type === 'set_volume' ? 'Volume' : 'Brightness'} must be an integer between 0 and 100`;
          }
        } else if (card.type === 'delay') {
          const ms = Number(card.value);
          if (isNaN(ms) || ms < 50 || ms > 60000 || !Number.isInteger(ms)) {
            errors[card.id] = 'Delay must be an integer between 50 and 60000 ms';
          }
        } else if (card.type === 'run_script') {
          if (!card.value.trim()) errors[card.id] = 'Script command cannot be empty';
        }
      }
      setValidationErrors(errors);
    };
    
    const timeout = setTimeout(validateActions, 500); // Debounce
    return () => clearTimeout(timeout);
  }, [sequence]);

  // ───────────────────────────────────
  // RENDER
  // ───────────────────────────────────

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="font-label-caps text-label-caps uppercase opacity-70 text-muted-foreground">
          Action Sequence
        </h2>
        <span className="text-body-sm opacity-50 text-muted-foreground">
          {sequence.length} action{sequence.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Flow Preview */}
      <div className="bg-card-light border border-border rounded-xl p-4 flex items-center gap-4 shadow-sm overflow-x-auto">
        <span className="font-label-caps text-label-caps text-muted-foreground uppercase opacity-80 shrink-0">
          Flow Preview:
        </span>
        <div className="flex items-center gap-2">
          {sequence.length === 0 ? (
            <span className="text-body-sm text-muted-foreground italic">No actions added yet</span>
          ) : (
            sequence.map((act, i) => (
              <React.Fragment key={act.id}>
                <div
                  className={`w-8 h-8 ${act.colorClass} border border-current/20 rounded-lg flex items-center justify-center shrink-0 relative`}
                  title={act.title}
                >
                  <span className="material-symbols-outlined text-[18px]">{act.icon}</span>
                  {validationErrors[act.id] && (
                    <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border border-background"></div>
                  )}
                </div>
                {i < sequence.length - 1 && (
                  <span className="material-symbols-outlined text-muted-foreground/50 text-[16px] shrink-0">
                    arrow_forward
                  </span>
                )}
              </React.Fragment>
            ))
          )}
        </div>
      </div>

      {/* Sequence Cards */}
      <div className="flex flex-col gap-4">
        {sequence.map((card, index) => (
          <div
            key={card.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => {
              handleDragOver(e, index);
              handleSidebarDragOver(e, index);
            }}
            onDrop={(e) => {
              handleDrop(e, index);
              handleSidebarDrop(e, index);
            }}
            onDragEnd={handleDragEnd}
            className={`card-themeable bg-gradient-to-br from-card-medium to-card-dark border rounded-xl p-4 shadow-sm flex flex-col gap-4 transition-all ${getHighlightClass(index)} ${
              dragIndex === index ? 'opacity-40 scale-95' : ''
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {/* Drag Handle */}
                <span
                  className="material-symbols-outlined text-muted-foreground cursor-grab p-1 hover:text-primary active:cursor-grabbing select-none"
                  title="Drag to reorder"
                >
                  drag_indicator
                </span>
                {/* Icon */}
                <div className={`${card.colorClass} p-1.5 rounded-md flex`}>
                  <span className="material-symbols-outlined text-[20px]">{card.icon}</span>
                </div>
                {/* Title */}
                <span className="font-title-sm text-foreground">{card.title}</span>
                {(card.type === 'run_script' || card.type === 'launch_app') && (
                  <span className="bg-red-500/10 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded border border-red-500/20 uppercase tracking-wider ml-2">Dangerous</span>
                )}
              </div>
              {/* Controls */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onMoveUp(index)}
                  disabled={index === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-1"
                  title="Move up"
                >
                  <span className="material-symbols-outlined text-[20px]">keyboard_arrow_up</span>
                </button>
                <button
                  onClick={() => onMoveDown(index)}
                  disabled={index === sequence.length - 1}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-1"
                  title="Move down"
                >
                  <span className="material-symbols-outlined text-[20px]">keyboard_arrow_down</span>
                </button>
                <button
                  onClick={() => onDelete(card.id)}
                  className="text-red-400 hover:text-red-500 p-1"
                  title="Remove"
                >
                  <span className="material-symbols-outlined text-[20px]">delete</span>
                </button>
              </div>
            </div>

            {/* Action-specific input */}
            <div className="pl-12 pr-4 flex flex-col gap-2">
              <label className="font-label-caps text-label-caps uppercase opacity-70 block text-muted-foreground flex justify-between">
                <span>{getFieldLabel(card.type)}</span>
                {validationErrors[card.id] && (
                  <span className="text-red-500 font-medium normal-case flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">warning</span>
                    {validationErrors[card.id]}
                  </span>
                )}
              </label>

              {card.type === 'delay' ? (
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="250"
                    max="10000"
                    step="250"
                    value={card.value}
                    onChange={(e) => onUpdateValue(card.id, e.target.value)}
                    className="flex-1 accent-primary"
                  />
                  <span className="font-body-sm font-semibold w-16 text-right text-foreground font-code-sm">
                    {(Number(card.value) / 1000).toFixed(1)}s
                  </span>
                </div>
              ) : card.type === 'set_volume' || card.type === 'set_brightness' ? (
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={card.value}
                    onChange={(e) => onUpdateValue(card.id, e.target.value)}
                    className="flex-1 accent-primary"
                  />
                  <span className="font-body-sm font-semibold w-8 text-right text-foreground">
                    {card.value}%
                  </span>
                </div>
              ) : card.type === 'arrange_windows' ? (
                (() => {
                  let arrangeData = { layout: 'snap_left', orientation: 'vertical', apps: { tl: '', tr: '', bl: '', br: '' } };
                  try {
                    if (card.value.startsWith('{')) {
                      const parsed = JSON.parse(card.value);
                      arrangeData = { ...arrangeData, ...parsed, apps: { ...arrangeData.apps, ...(parsed.apps || {}) } };
                    } else arrangeData.layout = card.value;
                  } catch { /* ignore */ }
                  
                  const updateArrange = (updates: Partial<typeof arrangeData>) => {
                    onUpdateValue(card.id, JSON.stringify({ ...arrangeData, ...updates }));
                  };
                  
                  return (
                    <div className="flex flex-col gap-3">
                      <select
                        value={arrangeData.layout}
                        onChange={(e) => updateArrange({ layout: e.target.value, orientation: e.target.value === 'tri' ? 'main_left' : 'vertical' })}
                        className="w-full bg-background/50 border border-border/50 text-foreground rounded-md px-3 py-2 font-body-sm focus:ring-primary focus:outline-none"
                      >
                        <option value="snap_left">Snap Active Window to Left Half</option>
                        <option value="snap_right">Snap Active Window to Right Half</option>
                        <option value="maximize">Maximize Active Window</option>
                        <option value="split_specific">Split Screen (2 Specific Apps)</option>
                        <option value="tri">Tri-Grid (3 Specific Apps)</option>
                        <option value="quad">Quad Grid (4 Specific Apps)</option>
                      </select>

                      {['snap_left', 'snap_right', 'maximize'].includes(arrangeData.layout) && (
                        <input
                          type="text"
                          placeholder="Target App or Window Title (leave blank for active window)"
                          value={arrangeData.apps.tl || ''}
                          onChange={e => updateArrange({ apps: { ...arrangeData.apps, tl: e.target.value } })}
                          className="w-full bg-background/50 border border-border/50 text-foreground rounded-md px-3 py-1.5 font-body-sm focus:ring-primary focus:outline-none placeholder:opacity-50"
                        />
                      )}

                      {arrangeData.layout === 'split_specific' && (
                        <>
                          <select
                            value={arrangeData.orientation}
                            onChange={(e) => updateArrange({ orientation: e.target.value })}
                            className="w-full bg-background/30 border border-border/30 text-foreground rounded-md px-3 py-1.5 font-body-sm focus:ring-primary focus:outline-none"
                          >
                            <option value="vertical">Vertical Split (Left / Right)</option>
                            <option value="horizontal">Horizontal Split (Top / Bottom)</option>
                          </select>
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            <input type="text" placeholder={arrangeData.orientation === 'horizontal' ? "Top App / Title (e.g. chrome)" : "Left App / Title (e.g. chrome)"} value={arrangeData.apps.tl} onChange={e => updateArrange({apps: {...arrangeData.apps, tl: e.target.value}})} className="bg-background/50 border border-border/50 text-foreground rounded-md px-3 py-1.5 font-body-sm focus:ring-primary focus:outline-none placeholder:opacity-50" />
                            <input type="text" placeholder={arrangeData.orientation === 'horizontal' ? "Bottom App / Title (e.g. facebook)" : "Right App / Title (e.g. facebook)"} value={arrangeData.apps.tr} onChange={e => updateArrange({apps: {...arrangeData.apps, tr: e.target.value}})} className="bg-background/50 border border-border/50 text-foreground rounded-md px-3 py-1.5 font-body-sm focus:ring-primary focus:outline-none placeholder:opacity-50" />
                          </div>
                        </>
                      )}

                      {arrangeData.layout === 'tri' && (
                        <>
                          <select
                            value={arrangeData.orientation}
                            onChange={(e) => updateArrange({ orientation: e.target.value })}
                            className="w-full bg-background/30 border border-border/30 text-foreground rounded-md px-3 py-1.5 font-body-sm focus:ring-primary focus:outline-none"
                          >
                            <option value="main_left">Main App on Left</option>
                            <option value="main_right">Main App on Right</option>
                            <option value="main_top">Main App on Top</option>
                            <option value="main_bottom">Main App on Bottom</option>
                          </select>
                          <div className="grid grid-cols-2 gap-2 mt-1">
                            {arrangeData.orientation === 'main_left' && (
                              <>
                                <input type="text" placeholder="Main Left App" value={arrangeData.apps.tl} onChange={e => updateArrange({apps: {...arrangeData.apps, tl: e.target.value}})} className="row-span-2 bg-background/50 border border-border/50 text-foreground rounded-md px-3 py-1.5 font-body-sm focus:ring-primary focus:outline-none placeholder:opacity-50" />
                                <input type="text" placeholder="Top Right App" value={arrangeData.apps.tr} onChange={e => updateArrange({apps: {...arrangeData.apps, tr: e.target.value}})} className="bg-background/50 border border-border/50 text-foreground rounded-md px-3 py-1.5 font-body-sm focus:ring-primary focus:outline-none placeholder:opacity-50" />
                                <input type="text" placeholder="Bottom Right App" value={arrangeData.apps.br} onChange={e => updateArrange({apps: {...arrangeData.apps, br: e.target.value}})} className="bg-background/50 border border-border/50 text-foreground rounded-md px-3 py-1.5 font-body-sm focus:ring-primary focus:outline-none placeholder:opacity-50" />
                              </>
                            )}
                            {arrangeData.orientation === 'main_right' && (
                              <>
                                <input type="text" placeholder="Top Left App" value={arrangeData.apps.tl} onChange={e => updateArrange({apps: {...arrangeData.apps, tl: e.target.value}})} className="bg-background/50 border border-border/50 text-foreground rounded-md px-3 py-1.5 font-body-sm focus:ring-primary focus:outline-none placeholder:opacity-50" />
                                <input type="text" placeholder="Main Right App" value={arrangeData.apps.tr} onChange={e => updateArrange({apps: {...arrangeData.apps, tr: e.target.value}})} className="row-span-2 bg-background/50 border border-border/50 text-foreground rounded-md px-3 py-1.5 font-body-sm focus:ring-primary focus:outline-none placeholder:opacity-50" />
                                <input type="text" placeholder="Bottom Left App" value={arrangeData.apps.bl} onChange={e => updateArrange({apps: {...arrangeData.apps, bl: e.target.value}})} className="bg-background/50 border border-border/50 text-foreground rounded-md px-3 py-1.5 font-body-sm focus:ring-primary focus:outline-none placeholder:opacity-50" />
                              </>
                            )}
                            {arrangeData.orientation === 'main_top' && (
                              <>
                                <input type="text" placeholder="Main Top App" value={arrangeData.apps.tl} onChange={e => updateArrange({apps: {...arrangeData.apps, tl: e.target.value}})} className="col-span-2 bg-background/50 border border-border/50 text-foreground rounded-md px-3 py-1.5 font-body-sm focus:ring-primary focus:outline-none placeholder:opacity-50" />
                                <input type="text" placeholder="Bottom Left App" value={arrangeData.apps.bl} onChange={e => updateArrange({apps: {...arrangeData.apps, bl: e.target.value}})} className="bg-background/50 border border-border/50 text-foreground rounded-md px-3 py-1.5 font-body-sm focus:ring-primary focus:outline-none placeholder:opacity-50" />
                                <input type="text" placeholder="Bottom Right App" value={arrangeData.apps.br} onChange={e => updateArrange({apps: {...arrangeData.apps, br: e.target.value}})} className="bg-background/50 border border-border/50 text-foreground rounded-md px-3 py-1.5 font-body-sm focus:ring-primary focus:outline-none placeholder:opacity-50" />
                              </>
                            )}
                            {arrangeData.orientation === 'main_bottom' && (
                              <>
                                <input type="text" placeholder="Top Left App" value={arrangeData.apps.tl} onChange={e => updateArrange({apps: {...arrangeData.apps, tl: e.target.value}})} className="bg-background/50 border border-border/50 text-foreground rounded-md px-3 py-1.5 font-body-sm focus:ring-primary focus:outline-none placeholder:opacity-50" />
                                <input type="text" placeholder="Top Right App" value={arrangeData.apps.tr} onChange={e => updateArrange({apps: {...arrangeData.apps, tr: e.target.value}})} className="bg-background/50 border border-border/50 text-foreground rounded-md px-3 py-1.5 font-body-sm focus:ring-primary focus:outline-none placeholder:opacity-50" />
                                <input type="text" placeholder="Main Bottom App" value={arrangeData.apps.bl} onChange={e => updateArrange({apps: {...arrangeData.apps, bl: e.target.value}})} className="col-span-2 bg-background/50 border border-border/50 text-foreground rounded-md px-3 py-1.5 font-body-sm focus:ring-primary focus:outline-none placeholder:opacity-50" />
                              </>
                            )}
                          </div>
                        </>
                      )}
                      
                      {arrangeData.layout === 'quad' && (
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <input type="text" placeholder="Top Left App" value={arrangeData.apps.tl} onChange={e => updateArrange({apps: {...arrangeData.apps, tl: e.target.value}})} className="bg-background/50 border border-border/50 text-foreground rounded-md px-3 py-1.5 font-body-sm focus:ring-primary focus:outline-none placeholder:opacity-50" />
                          <input type="text" placeholder="Top Right App" value={arrangeData.apps.tr} onChange={e => updateArrange({apps: {...arrangeData.apps, tr: e.target.value}})} className="bg-background/50 border border-border/50 text-foreground rounded-md px-3 py-1.5 font-body-sm focus:ring-primary focus:outline-none placeholder:opacity-50" />
                          <input type="text" placeholder="Bottom Left App" value={arrangeData.apps.bl} onChange={e => updateArrange({apps: {...arrangeData.apps, bl: e.target.value}})} className="bg-background/50 border border-border/50 text-foreground rounded-md px-3 py-1.5 font-body-sm focus:ring-primary focus:outline-none placeholder:opacity-50" />
                          <input type="text" placeholder="Bottom Right App" value={arrangeData.apps.br} onChange={e => updateArrange({apps: {...arrangeData.apps, br: e.target.value}})} className="bg-background/50 border border-border/50 text-foreground rounded-md px-3 py-1.5 font-body-sm focus:ring-primary focus:outline-none placeholder:opacity-50" />
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : card.type === 'toggle_dnd' || card.type === 'toggle_nightlight' ? (
                <select
                  value={card.value}
                  onChange={(e) => onUpdateValue(card.id, e.target.value)}
                  className="w-full bg-background/50 border border-border/50 text-foreground rounded-md px-3 py-2 font-body-sm focus:ring-primary focus:outline-none"
                >
                  <option value="toggle">Toggle State</option>
                  <option value="enable">Always Turn On</option>
                  <option value="disable">Always Turn Off</option>
                </select>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={card.value}
                    onChange={(e) => onUpdateValue(card.id, e.target.value)}
                    className={`flex-1 bg-background/50 border text-foreground rounded-md px-3 py-2 font-body-sm focus:outline-none shadow-inner ${validationErrors[card.id] ? 'border-red-500/50 focus:ring-red-500' : 'border-border/50 focus:ring-primary'}`}
                  />
                  {['launch_app', 'open_folder', 'open_file', 'open_vscode'].includes(card.type) && (
                    <button
                      type="button"
                      onClick={async () => {
                        const pickerType = card.type === 'launch_app' ? 'app' : (card.type === 'open_file' ? 'file' : 'folder');
                        const selected = await window.electronAPI?.selectPath(pickerType);
                        if (selected) {
                          onUpdateValue(card.id, selected);
                        }
                      }}
                      className="px-3 py-2 bg-card hover:bg-card-light border border-border text-foreground rounded-md font-body-sm flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer shadow-sm hover:border-primary/50"
                      title="Browse..."
                    >
                      <span className="material-symbols-outlined text-[18px]">folder_open</span>
                      <span>Browse</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Drop Zone */}
      <div
        onDragOver={handleZoneDragOver}
        onDragLeave={handleZoneDragLeave}
        onDrop={handleZoneDrop}
        className={`w-full border-2 border-dashed rounded-xl py-8 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer mt-2 ${
          dragOverDropZone
            ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10'
            : 'border-border/40 bg-card/20 hover:bg-card/40'
        }`}
      >
        <span className={`material-symbols-outlined text-3xl ${dragOverDropZone ? 'text-primary' : ''}`}>
          {dragOverDropZone ? 'input_circle' : 'add_circle'}
        </span>
        <span className="font-body-md text-foreground">
          {dragOverDropZone ? 'Drop action here' : 'Drag actions here or click from sidebar'}
        </span>
      </div>
    </section>
  );
};