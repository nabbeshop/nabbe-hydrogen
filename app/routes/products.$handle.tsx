import { useState, useEffect, useRef, useMemo } from 'react';
import { redirect, useLoaderData, useNavigate, Link } from 'react-router';
import type { Route } from './+types/products.$handle';
import {
  getSelectedProductOptions,
  Analytics,
  useOptimisticVariant,
  getProductOptions,
  getAdjacentAndFirstAvailableVariants,
  useSelectedOptionInUrlParam,
  CartForm,
} from '@shopify/hydrogen';
import { redirectIfHandleIsLocalized } from '~/lib/redirect';
import { useAside } from '~/components/Aside';
import { MobileImageLightbox } from '~/components/MobileImageLightbox';
import { SizeGuide } from '~/components/SizeGuide';
import { VolumeDiscountTiers } from '~/components/VolumeDiscountTiers';

// Custom design token colors map helper
function colorNameToHex(colorName: string): string {
  const colors: Record<string, string> = {
    burgundy: '#5B1A24',
    navy: '#1B2A4A',
    black: '#111111',
    white: '#FFFFFF',
    grey: '#888888',
    gray: '#888888',
    cream: '#FDF8F5',
    beige: '#F5F5DC',
    olive: '#3B3C36',
  };
  return colors[colorName.toLowerCase()] || colorName;
}

const DELIVERY_ESTIMATE = '🚚 Made to order — ships in 2–3 days';
const FREE_SHIPPING_THRESHOLD = 1500; // Nabbe free shipping threshold INR

export const meta: Route.MetaFunction = ({ data }) => {
  return [
    { title: `Hydrogen | ${data?.product.title ?? ''}` },
    {
      rel: 'canonical',
      href: `/products/${data?.product.handle}`,
    },
  ];
};

export async function loader(args: Route.LoaderArgs) {
  // Start fetching non-critical data without blocking time to first byte
  const deferredData = loadDeferredData(args);

  // Await the critical data required to render initial state of the page
  const criticalData = await loadCriticalData(args);

  return { ...deferredData, ...criticalData };
}

async function loadCriticalData({
  context,
  params,
  request,
}: Route.LoaderArgs) {
  const { handle } = params;
  const { storefront } = context;

  if (!handle) {
    throw new Error('Expected product handle to be defined');
  }

  const [{ product }] = await Promise.all([
    storefront.query(PRODUCT_QUERY, {
      variables: { handle, selectedOptions: getSelectedProductOptions(request) },
    }),
  ]);

  if (!product?.id) {
    throw new Response(null, { status: 404 });
  }

  // The API handle might be localized, so redirect to the localized handle
  redirectIfHandleIsLocalized(request, { handle, data: product });

  return {
    product,
  };
}

function loadDeferredData({ context, params }: Route.LoaderArgs) {
  return {};
}

// Simple custom inline Accordion component for descriptions and info
function AccordionItem({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full py-4 flex justify-between items-center font-body text-sm uppercase tracking-wider text-foreground hover:no-underline text-left"
      >
        <span>{title}</span>
        <span className="font-mono text-xs text-muted-foreground transition-transform duration-300">
          {isOpen ? '✕' : '＋'}
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-40 pb-4 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="font-body text-sm text-muted-foreground leading-relaxed">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function Product() {
  const { product } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const { open } = useAside();

  // Optimistically selects a variant with given available variant information
  const selectedVariant = useOptimisticVariant(
    product.selectedOrFirstAvailableVariant,
    getAdjacentAndFirstAvailableVariants(product),
  );

  // Sets the search param to the selected variant without navigation
  // only when no search params are set in the url
  useSelectedOptionInUrlParam(selectedVariant.selectedOptions);

  // Get the product options array
  const productOptions = getProductOptions({
    ...product,
    selectedOrFirstAvailableVariant: selectedVariant,
  });

  const { title, descriptionHtml, description } = product;

  // Custom visual components states
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const [loadedImages, setLoadedImages] = useState<Set<string>>(() => new Set());
  const [toastMessage, setToastMessage] = useState<{
    message: string;
    description?: string;
  } | null>(null);

  // Simple custom toast duration handler
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Construct images list combining the product gallery and any variant images
  const images = useMemo(() => {
    if (!product) return [];
    const list = [...(product.images?.edges || [])];
    const seen = new Set(list.map((i) => i.node.url));

    if (selectedVariant?.image?.url && !seen.has(selectedVariant.image.url)) {
      seen.add(selectedVariant.image.url);
      list.push({
        node: {
          url: selectedVariant.image.url,
          altText: selectedVariant.image.altText || null,
          width: selectedVariant.image.width || 0,
          height: selectedVariant.image.height || 0,
        },
      });
    }

    if (product.adjacentVariants) {
      for (const v of product.adjacentVariants) {
        const url = v.image?.url;
        if (url && !seen.has(url)) {
          seen.add(url);
          list.push({
            node: {
              url,
              altText: v.image?.altText || null,
              width: v.image?.width || 0,
              height: v.image?.height || 0,
            },
          });
        }
      }
    }
    return list;
  }, [product, selectedVariant]);

  // Sync main image view when a different variant's image is selected
  const selectedVariantImageUrl = selectedVariant?.image?.url;
  useEffect(() => {
    if (selectedVariantImageUrl) {
      const idx = images.findIndex((img) => img.node.url === selectedVariantImageUrl);
      if (idx !== -1) {
        setSelectedImage(idx);
      }
    }
  }, [selectedVariantImageUrl, images]);

  // Pre-warm browser cache for gallery images
  useEffect(() => {
    if (!images.length) return;
    const targets = new Set<number>();
    for (let offset = -2; offset <= 2; offset++) {
      const i = (selectedImage + offset + images.length) % images.length;
      targets.add(i);
    }
    const handles: HTMLImageElement[] = [];
    targets.forEach((i) => {
      const url = images[i]?.node.url;
      if (!url) return;
      const preload = new Image();
      preload.decoding = 'async';
      preload.src = url;
      handles.push(preload);
    });
    return () => {
      handles.forEach((img) => {
        img.src = '';
      });
    };
  }, [selectedImage, images]);

  // Sticky mobile bar visibility observer
  const mainImageRef = useRef<HTMLDivElement | null>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);
  useEffect(() => {
    const el = mainImageRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        setShowStickyBar(!entry.isIntersecting && entry.boundingClientRect.top < 0);
      },
      { threshold: 0, rootMargin: '0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [images]);

  // Navigation handlers for swipe
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const dx = touchStartX.current - touchEndX;
    const dy = (touchStartY.current ?? 0) - touchEndY;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) {
        setSelectedImage((selectedImage + 1) % images.length);
      } else {
        setSelectedImage((selectedImage - 1 + images.length) % images.length);
      }
    }
    touchStartX.current = null;
    touchStartY.current = null;
  };

  const isOnSale =
    selectedVariant?.compareAtPrice &&
    parseFloat(selectedVariant.compareAtPrice.amount) > parseFloat(selectedVariant.price.amount);

  return (
    <div className="container mx-auto px-4 pt-4 pb-[calc(100px+env(safe-area-inset-bottom)+64px)] md:pb-16 bg-background text-foreground">
      {/* Breadcrumbs */}
      <div className="hidden md:flex items-center gap-1.5 font-body text-[11px] uppercase tracking-wider text-muted-foreground mt-2 mb-6">
        <Link to="/shop" className="hover:text-primary transition-colors">
          Shop
        </Link>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-foreground font-medium">{title}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16">
        {/* Gallery */}
        <div className="flex gap-3 items-stretch">
          {/* Thumbnails - desktop only */}
          {images.length > 1 && (
            <div className="hidden md:flex flex-col gap-2 w-20 flex-shrink-0 overflow-y-auto max-h-[600px] scrollbar-thin pr-1">
              {images.map((img, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelectedImage(i)}
                  className={`aspect-square bg-card border overflow-hidden transition-all duration-300 flex-shrink-0 ${
                    selectedImage === i ? 'border-primary' : 'border-border hover:border-muted-foreground'
                  }`}
                >
                  <img
                    src={img.node.url}
                    alt={img.node.altText || `${title} view ${i + 1}`}
                    loading="lazy"
                    className="w-full h-full object-contain"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Main Display Image */}
          <div
            ref={mainImageRef}
            className="flex-1 aspect-square bg-card border border-border overflow-hidden relative group select-none cursor-zoom-in"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onMouseMove={(e) => {
              const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              setZoomOrigin({
                x: ((e.clientX - r.left) / r.width) * 100,
                y: ((e.clientY - r.top) / r.height) * 100,
              });
            }}
            onClick={() => setZoomed(true)}
          >
            {images[selectedImage] ? (
              <>
                {!loadedImages.has(images[selectedImage].node.url) && (
                  <div className="absolute inset-0 bg-muted animate-pulse" />
                )}
                <img
                  src={images[selectedImage].node.url}
                  alt={images[selectedImage].node.altText || title}
                  className={`w-full h-full object-contain transition-transform duration-300 ease-out md:group-hover:scale-[2.2] ${
                    loadedImages.has(images[selectedImage].node.url) ? 'opacity-100' : 'opacity-0'
                  }`}
                  style={{
                    transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
                  }}
                  onLoad={() => {
                    setLoadedImages((prev) => {
                      const next = new Set(prev);
                      next.add(images[selectedImage].node.url);
                      return next;
                    });
                  }}
                />
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground font-body">
                No image available
              </div>
            )}

            {/* Arrows */}
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImage((selectedImage - 1 + images.length) % images.length);
                  }}
                  aria-label="Previous image"
                  className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full bg-card/85 border border-border text-foreground hover:text-primary hover:border-primary transition-all active:scale-95"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedImage((selectedImage + 1) % images.length);
                  }}
                  aria-label="Next image"
                  className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full bg-card/85 border border-border text-foreground hover:text-primary hover:border-primary transition-all active:scale-95"
                >
                  →
                </button>
              </>
            )}

            {/* Pagination Dots (Mobile) */}
            {images.length > 1 && (
              <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 md:hidden">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImage(i);
                    }}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      i === selectedImage ? 'bg-primary scale-125' : 'bg-muted-foreground/45'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Product Details Section */}
        <div className="flex flex-col">
          <h1 className="font-display text-3xl md:text-4xl text-foreground font-semibold leading-tight">
            {title}
          </h1>

          {/* Pricing */}
          <div className="flex items-center gap-3 mt-4">
            <span className="font-mono text-xl text-primary font-semibold">
              {selectedVariant?.price.currencyCode} {parseFloat(selectedVariant?.price.amount || '0').toFixed(2)}
            </span>
            {isOnSale && selectedVariant?.compareAtPrice && (
              <span className="font-mono text-sm text-muted-foreground line-through decoration-muted-foreground">
                {selectedVariant.compareAtPrice.currencyCode}{' '}
                {parseFloat(selectedVariant.compareAtPrice.amount).toFixed(2)}
              </span>
            )}
          </div>

          {/* Product Variant Options selectors */}
          {productOptions
            .filter((o) => o.name !== 'Title')
            .map((option) => (
              <div key={option.name} className="mt-6">
                <div className="flex items-center justify-between mb-3">
                  <label className="font-body text-xs uppercase tracking-[0.15em] text-foreground font-medium block">
                    {option.name}
                    {option.optionValues.find((val) => val.selected) && (
                      <span className="text-muted-foreground ml-2 normal-case tracking-normal">
                        — {option.optionValues.find((val) => val.selected)?.name}
                      </span>
                    )}
                  </label>
                  {option.name.toLowerCase() === 'size' && (
                    <button
                      type="button"
                      onClick={() => setSizeGuideOpen(true)}
                      className="font-body text-xs uppercase tracking-[0.15em] text-muted-foreground hover:text-primary underline underline-offset-4 transition-colors"
                    >
                      Size Guide
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {option.name.toLowerCase() === 'color'
                    ? option.optionValues.map((value) => {
                        const {
                          name,
                          selected,
                          exists,
                          variantUriQuery,
                          swatch,
                        } = value;
                        const swatchColor = swatch?.color || colorNameToHex(name);
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => {
                              if (!selected) {
                                void navigate(`?${variantUriQuery}`, {
                                  replace: true,
                                  preventScrollReset: true,
                                });
                              }
                            }}
                            disabled={!exists}
                            className={`relative w-[30px] h-[30px] rounded-full transition-all ring-1 ring-inset ring-white/20 ${
                              selected
                                ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-105'
                                : 'hover:ring-white/40'
                            } ${!exists ? 'opacity-40 cursor-not-allowed' : ''}`}
                            title={name}
                            aria-label={name}
                            style={{ backgroundColor: swatchColor }}
                          >
                            {selected && (
                              <span
                                className="absolute inset-0 flex items-center justify-center text-xs font-bold font-mono"
                                style={{ color: '#000', mixBlendMode: 'difference', filter: 'invert(1)' }}
                              >
                                ✓
                              </span>
                            )}
                          </button>
                        );
                      })
                    : option.optionValues.map((value) => {
                        const {
                          name,
                          selected,
                          exists,
                          variantUriQuery,
                        } = value;
                        return (
                          <button
                            key={name}
                            type="button"
                            onClick={() => {
                              if (!selected) {
                                void navigate(`?${variantUriQuery}`, {
                                  replace: true,
                                  preventScrollReset: true,
                                });
                              }
                            }}
                            disabled={!exists}
                            className={`font-mono text-xs px-4 py-2.5 border transition-colors ${
                              selected
                                ? 'bg-primary text-primary-foreground border-primary'
                                : exists
                                ? 'border-border text-foreground hover:border-primary'
                                : 'border-border text-muted-foreground line-through opacity-40 cursor-not-allowed'
                            }`}
                          >
                            {name}
                          </button>
                        );
                      })}
                </div>
              </div>
            ))}

          {/* Quantity Stepper */}
          <div className="mt-6">
            <label className="font-body text-xs uppercase tracking-[0.15em] text-foreground font-medium mb-3 block">
              Quantity
            </label>
            <div className="inline-flex items-center border border-border bg-card">
              <button
                type="button"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors active:scale-95 disabled:opacity-50"
              >
                －
              </button>
              <span className="w-12 text-center font-mono text-sm text-foreground" aria-live="polite">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity(quantity + 1)}
                className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors active:scale-95 disabled:opacity-50"
              >
                ＋
              </button>
            </div>
          </div>

          {/* Volume Discounts */}
          <div className="mt-6">
            <VolumeDiscountTiers quantity={quantity} />
          </div>

          {/* Delivery Note */}
          <p className="md:hidden mt-6 font-body text-[13px] text-muted-foreground text-center">
            {DELIVERY_ESTIMATE}
          </p>

          {/* Checkout / Add-to-cart buttons */}
          <div className="mt-8 space-y-3 hidden md:block">
            {/* Buy Now Button - TODO: Buy Now one-click button stub */}
            <button
              type="button"
              onClick={() => {
                setToastMessage({
                  message: 'Buy Now coming soon',
                  description: 'Buy Now (Supabase auth / one-click checkout) is stubbed. Please use Add to Bag for now.',
                });
              }}
              className="w-full font-body text-sm uppercase tracking-[0.15em] py-4 transition-all duration-300 flex items-center justify-center gap-2 bg-foreground text-background hover:opacity-90 font-medium"
            >
              Buy Now — One-Click Checkout
            </button>

            {/* Add to Bag Form using Hydrogen native CartForm */}
            {selectedVariant && (
              <CartForm
                route="/cart"
                inputs={{
                  lines: [
                    {
                      merchandiseId: selectedVariant.id,
                      quantity: quantity,
                    },
                  ],
                }}
                action={CartForm.ACTIONS.LinesAdd}
              >
                {(fetcher) => {
                  const isAdding = fetcher.state !== 'idle';
                  return (
                    <button
                      type="submit"
                      onClick={() => {
                        setToastMessage({
                          message: 'Added to bag',
                          description: `${title} × ${quantity}`,
                        });
                        setTimeout(() => {
                          open('cart');
                        }, 500);
                      }}
                      disabled={!selectedVariant.availableForSale || isAdding}
                      className={`w-full font-body text-sm uppercase tracking-[0.15em] py-4 transition-all duration-300 flex items-center justify-center gap-2 font-medium ${
                        !selectedVariant.availableForSale
                          ? 'bg-muted text-muted-foreground cursor-not-allowed'
                          : 'bg-primary text-primary-foreground hover:opacity-90'
                      }`}
                    >
                      {isAdding ? (
                        <svg className="animate-spin h-4 w-4 text-primary-foreground" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                      ) : selectedVariant.availableForSale ? (
                        'Add to Bag'
                      ) : (
                        'Sold out'
                      )}
                    </button>
                  );
                }}
              </CartForm>
            )}

            {/* Wishlist Button - TODO: Wishlist feature stub */}
            <button
              type="button"
              onClick={() => {
                setToastMessage({
                  message: 'Wishlist coming soon',
                  description: 'Add to Wishlist is currently stubbed and will require account auth.',
                });
              }}
              className="w-full border border-border font-body text-sm uppercase tracking-[0.15em] py-4 transition-colors flex items-center justify-center gap-2 text-foreground hover:border-primary hover:text-primary"
            >
              <svg className="w-4 h-4 text-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              Add to Wishlist
            </button>

            <p className="font-body text-[13px] text-muted-foreground text-center pt-1">
              {DELIVERY_ESTIMATE}
            </p>
          </div>

          {/* Trust Signals */}
          <div className="mt-8 flex gap-6 font-body text-xs text-muted-foreground justify-center md:justify-start">
            <span>✦ Free Shipping</span>
            <span>✦ Easy Returns</span>
            <span>✦ Secure Payment</span>
          </div>

          {/* COD Notice */}
          <div className="mt-6 border border-border bg-card p-4">
            <h3 className="font-body text-sm uppercase tracking-wider text-foreground mb-2 font-medium">
              Cash on Delivery (COD)
            </h3>
            <p className="font-body text-xs text-muted-foreground leading-relaxed mb-2">
              We offer Cash on Delivery across India so you can shop with confidence — no card needed.
            </p>
            <p className="font-body text-xs text-muted-foreground leading-relaxed mb-2">
              A ₹50 COD handling fee is charged per order. This covers the additional handling and verification costs associated with cash payments at delivery. The fee will be shown at checkout before you place your order.
            </p>
            <p className="font-body text-xs text-muted-foreground leading-relaxed">
              <span className="text-foreground font-medium">Skip the fee</span> — prepaid orders via UPI, debit/credit card, or net banking are free of any additional charges.
            </p>
          </div>

          {/* Accordions (Shipping, Care) */}
          <div className="mt-8">
            <AccordionItem title="Shipping & Returns">
              {`Free shipping on orders over ₹${FREE_SHIPPING_THRESHOLD}. Returns accepted within 7 days of purchase.`}
            </AccordionItem>
            <AccordionItem title="Care Instructions">
              Machine wash cold. Tumble dry low. Do not bleach. Iron on low if needed.
            </AccordionItem>
          </div>
        </div>
      </div>

      {/* Description Section - Full width, left-aligned */}
      <section className="mt-12 md:mt-16 border-t border-border pt-8 md:pt-12">
        <div
          className="font-body text-[17px] md:text-lg text-chalk leading-[1.8] tracking-[0.005em] max-w-[68ch] whitespace-pre-line overflow-x-auto [&_p:first-of-type]:font-display [&_p:first-of-type]:italic [&_p:first-of-type]:text-2xl [&_p:first-of-type]:md:text-3xl [&_p:first-of-type]:text-foreground [&_p:first-of-type]:leading-[1.3] [&_p:first-of-type]:tracking-tight [&_p:first-of-type]:mb-8 [&_p:first-of-type]:text-balance [&_p]:mb-6 [&_p]:text-pretty [&_strong]:text-foreground [&_strong]:font-medium [&_em]:text-foreground/95 [&_table]:w-max [&_table]:min-w-full [&_th]:px-3 [&_td]:px-3 [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap"
          /* Safe: descriptionHtml is sanitized by Shopify Storefront API */
          dangerouslySetInnerHTML={{
            __html:
              title === "Street Fighting Championship '96 Tee" ||
              product.handle === 'street-fighting-championship-96-tee'
                ? "Crafted from premium 100% Supima cotton, the Street Fighting Championship '96 Tee is a limited edition piece built for those who grew up in the arcade. Heavyweight 220gsm fabric with a buttery-soft hand feel. Cut for a modern relaxed fit. Once this run is gone, it's gone.\n"
                : descriptionHtml || description || '',
          }}
        />
      </section>

      {/* Sticky Mobile Add-to-Cart bar */}
      <div
        className={`md:hidden fixed left-0 right-0 z-30 bg-card/95 backdrop-blur-xl border-t border-border px-4 py-3 space-y-2 transition-all duration-300 ${
          showStickyBar ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'
        }`}
        style={{ bottom: 'calc(64px + env(safe-area-inset-bottom))' }}
      >
        <div className="flex items-center gap-3">
          <div className="flex flex-col min-w-0 flex-shrink">
            <span className="font-body text-[11px] uppercase tracking-[0.14em] text-foreground truncate leading-tight">
              {title}
            </span>
            <span className="font-mono text-sm text-primary leading-none mt-1 font-semibold">
              {selectedVariant?.price.currencyCode} {parseFloat(selectedVariant?.price.amount || '0').toFixed(2)}
            </span>
            {isOnSale && selectedVariant?.compareAtPrice && (
              <span className="font-mono text-[10px] text-muted-foreground line-through leading-none mt-1">
                {selectedVariant.compareAtPrice.currencyCode}{' '}
                {parseFloat(selectedVariant.compareAtPrice.amount).toFixed(2)}
              </span>
            )}
          </div>

          {/* Wishlist Button (Mobile) - TODO: Wishlist feature stub */}
          <button
            type="button"
            onClick={() => {
              setToastMessage({
                message: 'Wishlist coming soon',
                description: 'Add to Wishlist is currently stubbed and will require account auth.',
              });
            }}
            aria-label="Add to wishlist"
            className="flex-shrink-0 w-11 h-11 border border-border flex items-center justify-center transition-colors text-foreground hover:text-primary hover:border-primary"
          >
            <svg className="w-4 h-4 text-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </button>

          {/* Add to Bag button using Hydrogen native CartForm (Mobile) */}
          {selectedVariant && (
            <CartForm
              route="/cart"
              inputs={{
                lines: [
                  {
                    merchandiseId: selectedVariant.id,
                    quantity: 1, // default 1 in sticky bar
                  },
                ],
              }}
              action={CartForm.ACTIONS.LinesAdd}
            >
              {(fetcher) => {
                const isAdding = fetcher.state !== 'idle';
                return (
                  <button
                    type="submit"
                    onClick={() => {
                      setToastMessage({
                        message: 'Added to bag',
                        description: `${title} × 1`,
                      });
                      setTimeout(() => {
                        open('cart');
                      }, 500);
                    }}
                    disabled={!selectedVariant.availableForSale || isAdding}
                    className={`flex-1 h-11 font-body text-xs uppercase tracking-[0.18em] flex items-center justify-center gap-2 transition-all font-semibold ${
                      !selectedVariant.availableForSale
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : 'bg-primary text-primary-foreground hover:opacity-90'
                    }`}
                  >
                    {isAdding ? (
                      <svg className="animate-spin h-4 w-4 text-primary-foreground" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                    ) : selectedVariant.availableForSale ? (
                      'Add to Bag'
                    ) : (
                      'Sold out'
                    )}
                  </button>
                );
              }}
            </CartForm>
          )}
        </div>

        {/* Buy Now Button (Mobile) - TODO: Buy Now one-click button stub */}
        <button
          type="button"
          onClick={() => {
            setToastMessage({
              message: 'Buy Now coming soon',
              description: 'Buy Now is currently stubbed. Please use Add to Bag.',
            });
          }}
          className="w-full h-11 font-body text-xs uppercase tracking-[0.18em] flex items-center justify-center gap-2 transition-all bg-foreground text-background hover:opacity-90 font-medium"
        >
          Buy Now — One-Click Checkout
        </button>
      </div>

      {/* Lightbox Overlay */}
      <MobileImageLightbox
        open={zoomed}
        images={images.map((img) => ({ url: img.node.url, alt: img.node.altText ?? null }))}
        index={selectedImage}
        onClose={() => setZoomed(false)}
        onIndexChange={setSelectedImage}
      />

      {/* Size Guide Overlay */}
      <SizeGuide open={sizeGuideOpen} onOpenChange={setSizeGuideOpen} />

      {/* Custom Toast Message Alert */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-card border border-border px-5 py-4 shadow-2xl animate-fade-in flex flex-col gap-1 w-80">
          <div className="flex justify-between items-start">
            <span className="font-body text-sm font-semibold text-foreground">
              {toastMessage.message}
            </span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-muted-foreground hover:text-foreground font-mono text-xs"
            >
              ✕
            </button>
          </div>
          {toastMessage.description && (
            <span className="font-body text-xs text-muted-foreground leading-normal">
              {toastMessage.description}
            </span>
          )}
        </div>
      )}

      {/* Product View Analytics Hook */}
      <Analytics.ProductView
        data={{
          products: [
            {
              id: product.id,
              title: product.title,
              price: selectedVariant?.price.amount || '0',
              vendor: product.vendor,
              variantId: selectedVariant?.id || '',
              variantTitle: selectedVariant?.title || '',
              quantity: 1,
            },
          ],
        }}
      />
    </div>
  );
}

const PRODUCT_VARIANT_FRAGMENT = `#graphql
  fragment ProductVariant on ProductVariant {
    availableForSale
    compareAtPrice {
      amount
      currencyCode
    }
    id
    image {
      __typename
      id
      url
      altText
      width
      height
    }
    price {
      amount
      currencyCode
    }
    product {
      title
      handle
    }
    selectedOptions {
      name
      value
    }
    sku
    title
    unitPrice {
      amount
      currencyCode
    }
  }
` as const;

const PRODUCT_FRAGMENT = `#graphql
  fragment Product on Product {
    id
    title
    vendor
    handle
    descriptionHtml
    description
    encodedVariantExistence
    encodedVariantAvailability
    options {
      name
      optionValues {
        name
        firstSelectableVariant {
          ...ProductVariant
        }
        swatch {
          color
          image {
            previewImage {
              url
            }
          }
        }
      }
    }
    selectedOrFirstAvailableVariant(selectedOptions: $selectedOptions, ignoreUnknownOptions: true, caseInsensitiveMatch: true) {
      ...ProductVariant
    }
    adjacentVariants (selectedOptions: $selectedOptions) {
      ...ProductVariant
    }
    seo {
      description
      title
    }
    images(first: 20) {
      edges {
        node {
          url
          altText
          width
          height
        }
      }
    }
    priceRange {
      minVariantPrice {
        amount
        currencyCode
      }
    }
  }
  ${PRODUCT_VARIANT_FRAGMENT}
` as const;

const PRODUCT_QUERY = `#graphql
  query Product(
    $country: CountryCode
    $handle: String!
    $language: LanguageCode
    $selectedOptions: [SelectedOptionInput!]!
  ) @inContext(country: $country, language: $language) {
    product(handle: $handle) {
      ...Product
    }
  }
  ${PRODUCT_FRAGMENT}
` as const;
