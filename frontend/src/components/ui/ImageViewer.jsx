import { useRef, useState, useCallback, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCw, RotateCcw, Sun, Contrast, Maximize2, RefreshCw, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { isDicomUrl, loadDicomAsImage } from '../../utils/dicomViewer.js';

/**
 * Image viewer for radiology reports.
 * Handles two cases automatically:
 * - Standard images (JPEG/PNG exports from the modality console)
 * - Real DICOM (.dcm) files — parsed and rendered client-side with proper
 *   window/level grayscale mapping. Single-frame, uncompressed transfer
 *   syntaxes only (the common case for exported slices); multi-frame cine
 *   and compressed syntaxes like JPEG2000 are out of scope for a
 *   browser-only viewer and would need a server-side transcode step.
 */
export default function ImageViewer({ images = [], initialIndex = 0, onClose }) {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [resolvedSrc, setResolvedSrc] = useState(null);
  const [dicomError, setDicomError] = useState(null);
  const [decoding, setDecoding] = useState(false);
  const dragState = useRef(null);
  const containerRef = useRef(null);

  const current = images[index];

  useEffect(() => {
    if (!current) return;
    setDicomError(null);
    if (isDicomUrl(current.url)) {
      setDecoding(true);
      setResolvedSrc(null);
      loadDicomAsImage(current.url)
        .then(setResolvedSrc)
        .catch((e) => setDicomError(e.message || 'Could not decode DICOM file'))
        .finally(() => setDecoding(false));
    } else {
      setResolvedSrc(current.url);
    }
  }, [current?.url]);

  const reset = useCallback(() => {
    setZoom(1); setRotation(0); setBrightness(100); setContrast(100); setPan({ x: 0, y: 0 });
  }, []);

  const goTo = (i) => { setIndex(((i % images.length) + images.length) % images.length); reset(); };

  const onWheel = (e) => {
    e.preventDefault();
    setZoom((z) => Math.min(6, Math.max(0.5, z + (e.deltaY < 0 ? 0.15 : -0.15))));
  };

  const onMouseDown = (e) => {
    dragState.current = { startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y };
  };
  const onMouseMove = (e) => {
    if (!dragState.current) return;
    const dx = e.clientX - dragState.current.startX;
    const dy = e.clientY - dragState.current.startY;
    setPan({ x: dragState.current.panX + dx, y: dragState.current.panY + dy });
  };
  const onMouseUp = () => { dragState.current = null; };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) containerRef.current?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col" ref={containerRef}>
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900 text-slate-100 text-sm">
        <div className="flex items-center gap-3">
          <span className="font-medium">{current.label || `Image ${index + 1}`}</span>
          <span className="text-slate-400">{index + 1} / {images.length}</span>
        </div>
        <button onClick={onClose} className="text-slate-300 hover:text-white text-lg leading-none">✕</button>
      </div>

      <div
        className="flex-1 overflow-hidden flex items-center justify-center relative cursor-move select-none"
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {images.length > 1 && (
          <button onClick={() => goTo(index - 1)} className="absolute left-3 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70">
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        {decoding && (
          <div className="flex flex-col items-center gap-2 text-slate-300">
            <Loader2 className="w-8 h-8 animate-spin" />
            <span className="text-sm">Decoding DICOM file…</span>
          </div>
        )}
        {dicomError && !decoding && (
          <div className="text-center text-slate-300 max-w-md px-4">
            <p className="text-red-400 font-medium mb-1">Could not display this file</p>
            <p className="text-sm">{dicomError}</p>
          </div>
        )}
        {resolvedSrc && !decoding && !dicomError && (
          <img
            src={resolvedSrc}
            alt={current.label || 'Radiology image'}
            draggable={false}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotate(${rotation}deg)`,
              filter: `brightness(${brightness}%) contrast(${contrast}%)`,
              transition: dragState.current ? 'none' : 'transform 0.05s ease-out',
              maxHeight: '85vh',
              maxWidth: '90vw',
            }}
          />
        )}
        {images.length > 1 && (
          <button onClick={() => goTo(index + 1)} className="absolute right-3 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70">
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      <div className="bg-slate-900 text-slate-200 px-4 py-3 flex flex-wrap items-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="p-1.5 hover:bg-slate-700 rounded"><ZoomOut className="w-4 h-4" /></button>
          <span className="w-10 text-center">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(6, z + 0.25))} className="p-1.5 hover:bg-slate-700 rounded"><ZoomIn className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setRotation(r => r - 90)} className="p-1.5 hover:bg-slate-700 rounded"><RotateCcw className="w-4 h-4" /></button>
          <button onClick={() => setRotation(r => r + 90)} className="p-1.5 hover:bg-slate-700 rounded"><RotateCw className="w-4 h-4" /></button>
        </div>
        <div className="flex items-center gap-1.5">
          <Sun className="w-4 h-4" />
          <input type="range" min="50" max="150" value={brightness} onChange={e => setBrightness(Number(e.target.value))} className="w-20" />
        </div>
        <div className="flex items-center gap-1.5">
          <Contrast className="w-4 h-4" />
          <input type="range" min="50" max="150" value={contrast} onChange={e => setContrast(Number(e.target.value))} className="w-20" />
        </div>
        <button onClick={reset} className="p-1.5 hover:bg-slate-700 rounded flex items-center gap-1"><RefreshCw className="w-4 h-4" /> Reset</button>
        <button onClick={toggleFullscreen} className="p-1.5 hover:bg-slate-700 rounded flex items-center gap-1"><Maximize2 className="w-4 h-4" /> Fullscreen</button>
        <span className="text-slate-500 ml-auto">Scroll to zoom · Drag to pan</span>
      </div>
    </div>
  );
}
