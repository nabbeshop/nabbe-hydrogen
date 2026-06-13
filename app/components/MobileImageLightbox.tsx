import { useEffect } from 'react';

type ImageItem = {
  url: string;
  alt: string | null;
};

export function MobileImageLightbox({
  open,
  images,
  index,
  onClose,
  onIndexChange,
}: {
  open: boolean;
  images: ImageItem[];
  index: number;
  onClose: () => void;
  onIndexChange: (idx: number) => void;
}) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') onIndexChange((index - 1 + images.length) % images.length);
      if (e.key === 'ArrowRight') onIndexChange((index + 1) % images.length);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, index, images, onClose, onIndexChange]);

  if (!open || !images[index]) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col justify-between p-4 md:p-6 animate-fade-in">
      {/* Top Header */}
      <div className="flex justify-between items-center w-full">
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
          {index + 1} / {images.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-foreground hover:text-primary transition-colors p-2 text-sm uppercase tracking-wider font-mono"
        >
          ✕ Close
        </button>
      </div>

      {/* Main Image View */}
      <div className="flex-1 flex items-center justify-center relative my-4">
        {images.length > 1 && (
          <button
            type="button"
            onClick={() => onIndexChange((index - 1 + images.length) % images.length)}
            aria-label="Previous image"
            className="absolute left-2 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-card/80 border border-border text-foreground hover:text-primary transition-all active:scale-95"
          >
            ←
          </button>
        )}

        <img
          src={images[index].url}
          alt={images[index].alt || `Product detail view ${index + 1}`}
          className="max-h-[75vh] max-w-full object-contain select-none transition-transform duration-300"
          draggable={false}
        />

        {images.length > 1 && (
          <button
            type="button"
            onClick={() => onIndexChange((index + 1) % images.length)}
            aria-label="Next image"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center rounded-full bg-card/80 border border-border text-foreground hover:text-primary transition-all active:scale-95"
          >
            →
          </button>
        )}
      </div>

      {/* Bottom Thumbnails */}
      {images.length > 1 && (
        <div className="flex justify-center gap-2 overflow-x-auto max-w-full pb-4 scrollbar-thin">
          {images.map((img, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onIndexChange(i)}
              className={`w-12 h-12 bg-card border flex-shrink-0 transition-all ${
                index === i ? 'border-primary scale-105' : 'border-border opacity-60 hover:opacity-100'
              }`}
            >
              <img src={img.url} alt={`View ${i + 1}`} className="w-full h-full object-contain" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
