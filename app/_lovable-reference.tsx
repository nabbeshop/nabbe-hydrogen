// @ts-nocheck
import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Minus, Plus, Loader2, Heart, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useWishlist } from "@/hooks/useWishlist";
import { useProduct } from "@/hooks/useProducts";
import { useCartStore } from "@/stores/cartStore";
import { useAuth } from "@/hooks/useAuth";
import { useAccountStore } from "@/stores/accountStore";
import { buildCheckoutUrl, openCheckout, FREE_SHIPPING_THRESHOLD } from "@/lib/volumeDiscount";
import { FadeIn } from "@/components/animations/FadeIn";
import { SEO } from "@/components/SEO";
import { JsonLd } from "@/components/JsonLd";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { colorNameToHex } from "@/lib/colors";
import { VolumeDiscountTiers } from "@/components/VolumeDiscountTiers";

import { shopifyImageUrl, shopifyImageSrcSet } from "@/lib/shopifyImage";
import DOMPurify from "dompurify";
import { RelatedProducts } from "@/components/product/RelatedProducts";
import { MobileImageLightbox } from "@/components/product/MobileImageLightbox";
import { SizeGuide } from "@/components/product/SizeGuide";

type ProductImage = { node: { url: string; altText: string | null; width?: number; height?: number } };

const getImagePath = (url: string) => {
    if (url.includes("/products/burgundy-tee.png")) return url;
    try {
        return new URL(url).pathname;
    } catch {
        return url.split("?")[0];
    }
};

const normalizeColorName = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

const imageMatchesColor = (url: string, color: string) => getImagePath(url).toLowerCase().includes(`-${normalizeColorName(color)}_`);

const findPairedImageUrls = (sourceUrl: string, allImages: ProductImage[]) => {
    const sourcePath = getImagePath(sourceUrl);
    const candidatePaths = [sourcePath.replace(/\/front-/i, "/back-"), sourcePath.replace(/\/back-/i, "/front-")];
    return allImages
        .filter((img) => candidatePaths.includes(getImagePath(img.node.url)))
        .map((img) => img.node.url);
};

const DELIVERY_ESTIMATE = "🚚 Made to order — ships in 2–3 days";

export default function ProductDetail() {
    const { handle } = useParams<{ handle: string }>();
    const { data: product, isLoading, error } = useProduct(handle || "");
    const addItem = useCartStore((s) => s.addItem);
    const updateQuantity = useCartStore((s) => s.updateQuantity);
    const cartItems = useCartStore((s) => s.items);
    const cartLoading = useCartStore((s) => s.isLoading);
    const setCartOpen = useCartStore((s) => s.setOpen);
    const { user, loading: authLoading } = useAuth();
    const setAccountDrawerOpen = useAccountStore((s) => s.setDrawerOpen);
    const setAccountView = useAccountStore((s) => s.setCurrentView);
    const [buyNowLoading, setBuyNowLoading] = useState(false);

    const [selectedImage, setSelectedImage] = useState(0);
    const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
    const [quantity, setQuantity] = useState(1);
    const [sizeGuideOpen, setSizeGuideOpen] = useState(false);
    const [addedSuccess, setAddedSuccess] = useState(false);
    const [zoomed, setZoomed] = useState(false);
    const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
    const [loadedImages, setLoadedImages] = useState<Set<string>>(() => new Set());
    const { isWishlisted, toggle: toggleWishlist } = useWishlist();
    const wishlisted = handle ? isWishlisted(handle) : false;

    // Touch swipe state
    const touchStartX = useRef<number | null>(null);
    const touchEndX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);

    // Sticky mobile bar visibility — show only after scrolling past the main image
    const mainImageRef = useRef<HTMLDivElement | null>(null);
    const [showStickyBar, setShowStickyBar] = useState(false);
    useEffect(() => {
        const el = mainImageRef.current;
        if (!el) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                // Show bar when the image bottom is above the viewport (scrolled past)
                setShowStickyBar(!entry.isIntersecting && entry.boundingClientRect.top < 0);
            },
            { threshold: 0, rootMargin: "0px" },
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [product]);

    const node = product?.node;

    // All images: merge product gallery with any extra variant images so each color is represented.
    const allImages = (() => {
        if (!node) return [] as ProductImage[];
        const list = [...node.images.edges];
        const seen = new Set(list.map((i) => i.node.url));
        for (const v of node.variants.edges) {
            const url = v.node.image?.url;
            if (url && !seen.has(url)) {
                seen.add(url);
                list.push({ node: { url, altText: v.node.image?.altText ?? null, width: 0, height: 0 } });
            }
        }
        return list;
    })();

    // Auto-select the first available value for every non-Title option on load.
    useEffect(() => {
        if (!node) return;
        const defaults: Record<string, string> = {};
        for (const option of node.options) {
            if (option.name === "Title") continue;
            if (option.values.length > 0) {
                defaults[option.name] = option.values[0];
            }
        }
        setSelectedOptions((prev) => ({ ...defaults, ...prev }));
    }, [node]);

    const selectedVariant = node
        ? node.variants.edges.find((v) =>
            v.node.selectedOptions.every((opt) => selectedOptions[opt.name] === opt.value),
        )?.node || node.variants.edges[0]?.node
        : undefined;

    const selectedColor = selectedOptions["Color"] || selectedOptions["color"];

    // Always show every thumbnail, regardless of selected color, so users can
    // browse the full gallery. When a color is picked we just jump the main
    // image to the first thumbnail that belongs to that color.
    const images = allImages;

    // Jump to the first image for the newly selected color (if we can find one),
    // but keep the full gallery visible.
    useEffect(() => {
        if (!node || !selectedColor) return;
        const colorImageUrls = new Set<string>();
        for (const v of node.variants.edges) {
            const matchesColor = v.node.selectedOptions.some(
                (o) => o.name.toLowerCase() === "color" && o.value === selectedColor,
            );
            if (matchesColor && v.node.image?.url) colorImageUrls.add(v.node.image.url);
        }
        for (const img of allImages) {
            if (imageMatchesColor(img.node.url, selectedColor)) colorImageUrls.add(img.node.url);
        }
        const idx = allImages.findIndex((i) => colorImageUrls.has(i.node.url));
        setSelectedImage(idx >= 0 ? idx : 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedColor]);

    // Warm the browser cache for neighboring product images so swipes / dot-taps
    // feel instant. Without this, each image is a fresh Shopify CDN request that
    // can take seconds on slow mobile networks while the user stares at a black
    // square.
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
            preload.decoding = "async";
            preload.src = shopifyImageUrl(url, 900);
            handles.push(preload);
        });
        return () => {
            handles.forEach((img) => {
                img.src = "";
            });
        };
    }, [selectedImage, images]);

    // Body scroll lock + Escape handling are owned by MobileImageLightbox to
    // avoid duplicate locks that can leave body overflow stuck on "hidden".

    // Build a product clone whose first image matches the chosen variant,
    // so the cart drawer thumbnail reflects the selected color. All original
    // images are preserved — we only rotate the matching edge to the front.
    const productForCart = useMemo(() => {
        if (!product || !node) return product;
        const variantUrl = selectedVariant?.image?.url || images[selectedImage]?.node.url;
        const edges = node.images.edges;
        if (!variantUrl || edges.length === 0) return product;
        const matchIdx = edges.findIndex((e) => e.node.url === variantUrl);
        if (matchIdx <= 0) return product;
        const reordered = [edges[matchIdx], ...edges.slice(0, matchIdx), ...edges.slice(matchIdx + 1)];
        return { ...product, node: { ...node, images: { ...node.images, edges: reordered } } };
    }, [product, node, selectedVariant, images, selectedImage]);

    if (isLoading) {
        return (
            <div className="container py-24">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="aspect-[3/4] shimmer" />
                    <div className="space-y-6">
                        <div className="h-8 w-2/3 shimmer" />
                        <div className="h-6 w-1/4 shimmer" />
                        <div className="h-20 shimmer" />
                    </div>
                </div>
            </div>
        );
    }

    if (error || !product || !node) {
        return (
            <div className="container py-32 text-center">
                <h1 className="font-display text-4xl text-foreground mb-4">Product not found</h1>
                <Link to="/shop" className="font-body text-primary hover:underline">
                    Back to Shop
                </Link>
            </div>
        );
    }


    const isOnSale =
        selectedVariant?.compareAtPrice &&
        parseFloat(selectedVariant.compareAtPrice.amount) > parseFloat(selectedVariant.price.amount);


    const handleAddToCart = async () => {
        if (!selectedVariant) return;
        await addItem({
            product: productForCart,
            variantId: selectedVariant.id,
            variantTitle: selectedVariant.title,
            price: selectedVariant.price,
            quantity,
            selectedOptions: selectedVariant.selectedOptions,
        });
        setAddedSuccess(true);
        toast.success("Added to bag", { description: `${node.title} × ${quantity}`, position: "bottom-center" });
        setCartOpen(true);
        setTimeout(() => setAddedSuccess(false), 2000);
    };

    // One-click checkout: add to cart, then jump straight to Shopify checkout
    const handleBuyNow = async () => {
        if (!selectedVariant || buyNowLoading) return;
        // Wait for auth to resolve before deciding — avoids bouncing a signed-in
        // user to the auth screen on a fast click immediately after page load.
        if (authLoading) {
            toast("Just a moment…", { position: "bottom-center" });
            return;
        }
        if (!user) {
            toast.error("Please sign in to place your order", {
                description: "Signing in lets us track your order and send updates.",
                position: "bottom-center",
            });
            setAccountView('auth');
            setAccountDrawerOpen(true);
            return;
        }
        setBuyNowLoading(true);
        try {
            await addItem({
                product: productForCart,
                variantId: selectedVariant.id,
                variantTitle: selectedVariant.title,
                price: selectedVariant.price,
                quantity,
                selectedOptions: selectedVariant.selectedOptions,
            });
            // Verify the item actually made it into the Shopify cart — addItem
            // swallows errors internally, so we need to confirm here.
            const state = useCartStore.getState();
            const checkoutUrl = state.getCheckoutUrl();
            const inCart = state.items.some((i) => i.variantId === selectedVariant.id);
            if (!checkoutUrl || !inCart) {
                toast.error("Couldn't start checkout. Please try again.", { position: "bottom-center" });
                return;
            }
            const totalQty = state.items.reduce((s, i) => s + i.quantity, 0);
            const finalUrl = buildCheckoutUrl(checkoutUrl, { qty: totalQty, email: user.email });
            const openedInNewTab = openCheckout(finalUrl);
            if (!openedInNewTab) {
                // Same-tab fallback already navigated away; nothing else to do.
                return;
            }
            // Surface feedback in case the new tab is hidden behind the current one.
            toast.success("Checkout opened in a new tab", { position: "bottom-center" });
            setCartOpen(true);
        } finally {
            setBuyNowLoading(false);
        }
    };

    const handleToggleWishlist = async () => {
        if (!handle) return;
        if (!user) {
            toast.error("Please sign in to save to your wishlist", {
                description: "Signing in lets us sync your saved pieces across devices.",
                position: "bottom-center",
            });
            setAccountView('auth');
            setAccountDrawerOpen(true);
            return;
        }
        const added = await toggleWishlist(handle);
        toast(added ? "Added to wishlist" : "Removed from wishlist", { position: "bottom-center" });
    };

    const needsSelection = node.options.some((o) => o.name !== "Title" && !selectedOptions[o.name]);

    const goToPrev = () => setSelectedImage((i) => (i === 0 ? images.length - 1 : i - 1));
    const goToNext = () => setSelectedImage((i) => (i === images.length - 1 ? 0 : i + 1));

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length !== 1) return;
        touchStartX.current = e.touches[0].clientX;
        touchStartY.current = e.touches[0].clientY;
    };

    const handleTouchMove = (_e: React.TouchEvent) => {
        // No long-press magnify; native scroll + tap-to-open lightbox handle the rest.
    };

    const handleTouchEnd = (e: React.TouchEvent) => {
        if (touchStartX.current === null) return;
        touchEndX.current = e.changedTouches[0].clientX;
        const dx = touchStartX.current - touchEndX.current;
        const dy = (touchStartY.current ?? 0) - e.changedTouches[0].clientY;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
            if (dx > 0) goToNext();
            else goToPrev();
        }
        touchStartX.current = null;
        touchEndX.current = null;
        touchStartY.current = null;
    };

    return (
        <div className="container pt-0 md:pt-0 lg:pt-0 pb-[calc(80px+env(safe-area-inset-bottom)+64px)] md:pb-16">
            <SEO
                title={node.title}
                description={(() => {
                    // Keep under 160 chars — Google truncates anything longer.
                    const SUFFIX = " — limited edition retro tee by Nabbe India.";
                    const MAX = 158;
                    if (node.description) {
                        const room = MAX - SUFFIX.length;
                        const trimmed = node.description.replace(/\s+/g, " ").trim();
                        const head = trimmed.length > room ? trimmed.slice(0, room - 1).trimEnd() + "…" : trimmed;
                        return `${head}${SUFFIX}`;
                    }
                    const fallback = `Shop ${node.title} — limited edition retro streetwear t-shirt, designed in India by Nabbe.`;
                    return fallback.length > MAX ? fallback.slice(0, MAX - 1).trimEnd() + "…" : fallback;
                })()}
                canonical={`/products/${node.handle}`}
                ogImage={images[0]?.node.url}
                ogImageAlt={images[0]?.node.altText || `${node.title} — Nabbe`}
                ogImageWidth={images[0]?.node.width || 1500}
                ogImageHeight={images[0]?.node.height || 1500}
                ogType="product"
            >
                <meta property="product:brand" content="Nabbe" />
                <meta property="product:availability" content={node.availableForSale ? "in stock" : "out of stock"} />
                <meta property="product:condition" content="new" />
                <meta property="product:price:amount" content={selectedVariant?.price.amount || node.priceRange.minVariantPrice.amount} />
                <meta property="product:price:currency" content={selectedVariant?.price.currencyCode || node.priceRange.minVariantPrice.currencyCode} />
                <meta property="product:retailer_item_id" content={node.handle} />
            </SEO>
            <JsonLd
                data={{
                    "@context": "https://schema.org",
                    "@type": "Product",
                    name: node.title,
                    image: allImages.map((i) => i.node.url).slice(0, 8),
                    description: node.description,
                    sku: selectedVariant?.id?.split("/").pop(),
                    mpn: selectedVariant?.id?.split("/").pop(),
                    brand: { "@type": "Brand", name: "Nabbe", url: "https://nabbe.shop" },
                    category: "Apparel > T-Shirts",
                    offers: {
                        "@type": "Offer",
                        url: `https://nabbe.shop/products/${node.handle}`,
                        priceCurrency: selectedVariant?.price.currencyCode || "INR",
                        price: selectedVariant?.price.amount || "0",
                        priceValidUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
                        availability: node.availableForSale ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
                        itemCondition: "https://schema.org/NewCondition",
                        seller: { "@type": "Organization", name: "Nabbe" },
                        hasMerchantReturnPolicy: {
                            "@type": "MerchantReturnPolicy",
                            applicableCountry: "IN",
                            returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
                            merchantReturnDays: 7,
                            returnMethod: "https://schema.org/ReturnByMail",
                            returnFees: "https://schema.org/FreeReturn",
                        },
                        shippingDetails: {
                            "@type": "OfferShippingDetails",
                            shippingDestination: { "@type": "DefinedRegion", addressCountry: "IN" },
                            shippingRate: { "@type": "MonetaryAmount", value: "0", currency: "INR" },
                            deliveryTime: {
                                "@type": "ShippingDeliveryTime",
                                handlingTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 2, unitCode: "DAY" },
                                transitTime: { "@type": "QuantitativeValue", minValue: 3, maxValue: 7, unitCode: "DAY" },
                            },
                        },
                    },
                }}
            />
            <JsonLd
                data={{
                    "@context": "https://schema.org",
                    "@type": "BreadcrumbList",
                    itemListElement: [
                        { "@type": "ListItem", position: 1, name: "Home", item: "https://nabbe.shop/" },
                        { "@type": "ListItem", position: 2, name: "Shop", item: "https://nabbe.shop/shop" },
                        { "@type": "ListItem", position: 3, name: node.title, item: `https://nabbe.shop/products/${node.handle}` },
                    ],
                }}
            />
            <Breadcrumbs
                className="hidden md:flex items-center gap-1 font-body text-xs text-muted-foreground mt-1 mb-2 flex-wrap"
                items={[
                    { label: 'Shop', to: '/shop' },
                    { label: node.title },
                ]}
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16">
                {/* Gallery */}
                <div className="flex gap-3 items-stretch">
                    {/* Thumbnails — desktop only */}
                    {images.length > 1 && (() => {
                        const colorOption = node.options.find((o) => o.name.toLowerCase() === "color");
                        const colorForImage = (url: string): string | undefined => {
                            // 1) Variant whose image URL matches this thumbnail
                            for (const v of node.variants.edges) {
                                if (v.node.image?.url === url) {
                                    const colorOpt = v.node.selectedOptions.find(
                                        (o) => o.name.toLowerCase() === "color",
                                    );
                                    if (colorOpt) return colorOpt.value;
                                }
                            }
                            // 2) Filename heuristic — look for `-<color>_` in the URL path
                            if (colorOption) {
                                for (const value of colorOption.values) {
                                    if (imageMatchesColor(url, value)) return value;
                                }
                            }
                            return undefined;
                        };

                        return (
                            <div className="hidden md:flex flex-col gap-2 w-20 flex-shrink-0 overflow-y-auto min-h-0 max-h-full scrollbar-thin pr-1">
                                {images.map((img, i) => {
                                    const color = colorForImage(img.node.url);
                                    return (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                setSelectedImage(i);
                                                if (color && colorOption) {
                                                    setSelectedOptions((prev) =>
                                                        prev[colorOption.name] === color
                                                            ? prev
                                                            : { ...prev, [colorOption.name]: color },
                                                    );
                                                }
                                            }}
                                            className={`aspect-square bg-card border overflow-hidden transition-colors flex-shrink-0 ${selectedImage === i ? "border-primary" : "border-border hover:border-muted-foreground"
                                                }`}
                                        >
                                            <img src={shopifyImageUrl(img.node.url, 160)} alt={img.node.altText || `${node.title} — view ${i + 1}`} loading="lazy" decoding="async" className="w-full h-full object-contain" />
                                        </button>
                                    );
                                })}
                            </div>
                        );
                    })()}


                    {/* Main image with swipe on mobile + hover magnify on desktop */}
                    <div
                        ref={mainImageRef}
                        className="flex-1 aspect-square bg-card border border-border overflow-hidden relative group select-none"
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        onTouchCancel={handleTouchEnd}
                        style={{ touchAction: "pan-y" }}
                        onMouseMove={(e) => {
                            const r = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                            setZoomOrigin({
                                x: ((e.clientX - r.left) / r.width) * 100,
                                y: ((e.clientY - r.top) / r.height) * 100,
                            });
                        }}
                    >
                        {images[selectedImage] ? (
                            (() => {
                                const currentUrl = images[selectedImage].node.url;
                                const isLoaded = loadedImages.has(currentUrl);
                                return (
                                    <>
                                        {!isLoaded && (
                                            <div className="absolute inset-0 shimmer pointer-events-none" aria-hidden />
                                        )}
                                        <img
                                            key={selectedImage}
                                            src={shopifyImageUrl(currentUrl, 900)}
                                            srcSet={currentUrl.startsWith('http') ? shopifyImageSrcSet(currentUrl, [480, 900, 1400]) : undefined}
                                            sizes="(min-width: 768px) 50vw, 100vw"
                                            alt={images[selectedImage].node.altText || node.title}
                                            {...({ fetchpriority: "high" } as Record<string, string>)}
                                            decoding="async"
                                            onLoad={() => {
                                                setLoadedImages((prev) => {
                                                    if (prev.has(currentUrl)) return prev;
                                                    const next = new Set(prev);
                                                    next.add(currentUrl);
                                                    return next;
                                                });
                                            }}
                                            onClick={(e) => {
                                                const r = (e.currentTarget as HTMLImageElement).getBoundingClientRect();
                                                setZoomOrigin({
                                                    x: ((e.clientX - r.left) / r.width) * 100,
                                                    y: ((e.clientY - r.top) / r.height) * 100,
                                                });
                                                setZoomed(true);
                                            }}
                                            draggable={false}
                                            onContextMenu={(e) => e.preventDefault()}
                                            className={`relative w-full h-full object-contain cursor-zoom-in transition-[opacity,transform] duration-300 ease-out md:group-hover:scale-[2.2] ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
                                            style={{
                                                transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
                                                WebkitTouchCallout: "none",
                                                WebkitUserSelect: "none",
                                                userSelect: "none",
                                            }}
                                        />
                                    </>
                                );
                            })()
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted-foreground font-body">
                                No image available
                            </div>
                        )}

                        {/* Prev / Next arrows — desktop */}
                        {images.length > 1 && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => setSelectedImage((selectedImage - 1 + images.length) % images.length)}
                                    aria-label="Previous image"
                                    className="hidden md:flex absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm border border-border hover:bg-background transition-colors z-10"
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSelectedImage((selectedImage + 1) % images.length)}
                                    aria-label="Next image"
                                    className="hidden md:flex absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 items-center justify-center rounded-full bg-background/80 backdrop-blur-sm border border-border hover:bg-background transition-colors z-10"
                                >
                                    <ChevronRight className="w-5 h-5" />
                                </button>
                            </>
                        )}

                        {/* Dot indicators — mobile only */}
                        {images.length > 1 && (
                            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 md:hidden">
                                {images.map((_, i) => (
                                    <button
                                        key={i}
                                        onClick={() => setSelectedImage(i)}
                                        style={{
                                            width: 6,
                                            height: 6,
                                            borderRadius: "50%",
                                            background: i === selectedImage ? "#000" : "#ccc",
                                            border: "none",
                                            padding: 0,
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Product Info */}
                <div>
                    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
                        <h1 className="font-display text-3xl md:text-4xl text-foreground">{node.title}</h1>

                        {/* Price */}
                        <div className="flex items-center gap-3 mt-4">
                            <span className="font-mono text-xl text-primary">
                                {selectedVariant?.price.currencyCode} {parseFloat(selectedVariant?.price.amount || "0").toFixed(2)}
                            </span>
                            {isOnSale && selectedVariant?.compareAtPrice && (
                                <span className="font-mono text-sm text-muted-foreground line-through">
                                    {selectedVariant.compareAtPrice.currencyCode}{" "}
                                    {parseFloat(selectedVariant.compareAtPrice.amount).toFixed(2)}
                                </span>
                            )}
                        </div>

                        {/* Options */}
                        {node.options
                            .filter((o) => o.name !== "Title")
                            .map((option) => (
                                <div key={option.name} className="mt-6">
                                    <div className="flex items-center justify-between mb-3">
                                        <label className="font-body text-xs uppercase tracking-[0.15em] text-foreground block">
                                            {option.name}
                                            {selectedOptions[option.name] && (
                                                <span className="text-muted-foreground ml-2 normal-case tracking-normal">
                                                    — {selectedOptions[option.name]}
                                                </span>
                                            )}
                                        </label>
                                        {option.name.toLowerCase() === "size" && (
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
                                        {option.name.toLowerCase() === "color"
                                            ? option.values.map((value) => {
                                                const isSelected = selectedOptions[option.name] === value;
                                                const variant = node.variants.edges.find((v) =>
                                                    v.node.selectedOptions.some((o) => o.name === option.name && o.value === value),
                                                );
                                                const isAvailable = variant?.node.availableForSale !== false;
                                                return (
                                                    <button
                                                        key={value}
                                                        onClick={() => setSelectedOptions((prev) => ({ ...prev, [option.name]: value }))}
                                                        disabled={!isAvailable}
                                                        className={`relative w-[30px] h-[30px] rounded-full transition-all ring-1 ring-inset ring-white/20 ${isSelected
                                                                ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-105"
                                                                : "hover:ring-white/40"
                                                            } ${!isAvailable ? "opacity-40 cursor-not-allowed" : ""}`}
                                                        title={value}
                                                        aria-label={value}
                                                        style={{ backgroundColor: colorNameToHex(value) }}
                                                    >
                                                        {isSelected && (
                                                            <span
                                                                className="absolute inset-0 flex items-center justify-center text-base font-bold"
                                                                style={{ color: "#000", mixBlendMode: "difference", filter: "invert(1)" }}
                                                            >
                                                                ✓
                                                            </span>
                                                        )}
                                                    </button>
                                                );
                                            })
                                            : option.values.map((value) => {
                                                const variant = node.variants.edges.find((v) =>
                                                    v.node.selectedOptions.some((o) => o.name === option.name && o.value === value),
                                                );
                                                const isAvailable = variant?.node.availableForSale !== false;

                                                return (
                                                    <button
                                                        key={value}
                                                        onClick={() =>
                                                            isAvailable && setSelectedOptions((prev) => ({ ...prev, [option.name]: value }))
                                                        }
                                                        disabled={!isAvailable}
                                                        className={`font-mono text-xs px-4 py-2.5 border transition-colors ${selectedOptions[option.name] === value
                                                                ? "bg-primary text-primary-foreground border-primary"
                                                                : isAvailable
                                                                    ? "border-border text-foreground hover:border-primary"
                                                                    : "border-border text-muted-foreground line-through opacity-40 cursor-not-allowed"
                                                            }`}
                                                    >
                                                        {value}
                                                    </button>
                                                );
                                            })}
                                    </div>
                                </div>
                            ))}

                        {/* Quantity */}
                        <div className="mt-6">
                            <label className="font-body text-xs uppercase tracking-[0.15em] text-foreground mb-3 block">
                                Quantity
                            </label>
                            {(() => {
                                const cartLine = selectedVariant
                                    ? cartItems.find((i) => i.variantId === selectedVariant.id)
                                    : undefined;
                                const displayQty = cartLine ? cartLine.quantity : quantity;
                                const dec = () => {
                                    if (cartLine && selectedVariant) {
                                        updateQuantity(selectedVariant.id, cartLine.quantity - 1);
                                    } else {
                                        setQuantity(Math.max(1, quantity - 1));
                                    }
                                };
                                const inc = () => {
                                    if (cartLine && selectedVariant) {
                                        updateQuantity(selectedVariant.id, cartLine.quantity + 1);
                                    } else {
                                        setQuantity(quantity + 1);
                                    }
                                };
                                return (
                                    <div className="inline-flex items-center border border-border">
                                        <button
                                            onClick={dec}
                                            disabled={cartLoading}
                                            aria-label="Decrease quantity"
                                            className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors active:scale-95 disabled:opacity-50"
                                        >
                                            <Minus className="w-4 h-4" />
                                        </button>
                                        <span className="w-12 text-center font-mono text-sm" aria-live="polite">{displayQty}</span>
                                        <button
                                            onClick={inc}
                                            disabled={cartLoading}
                                            aria-label="Increase quantity"
                                            className="w-10 h-10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors active:scale-95 disabled:opacity-50"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                );
                            })()}
                        </div>

                        <div className="mt-6">
                            <VolumeDiscountTiers
                                quantity={
                                    (selectedVariant && cartItems.find((i) => i.variantId === selectedVariant.id)?.quantity) || quantity
                                }
                            />
                        </div>

                        {/* Delivery estimate — mobile, shown inline (not in sticky bar) */}
                        <p className="md:hidden mt-4 font-body text-[13px] text-muted-foreground text-center">
                            {DELIVERY_ESTIMATE}
                        </p>

                        {/* Add to Cart (desktop) */}
                        <div className="mt-8 space-y-3 hidden md:block">
                            <button
                                onClick={handleBuyNow}
                                disabled={cartLoading || buyNowLoading || needsSelection}
                                className={`w-full font-body text-sm uppercase tracking-[0.15em] py-4 transition-all duration-300 flex items-center justify-center gap-2 ${needsSelection
                                        ? "bg-muted text-muted-foreground"
                                        : "bg-foreground text-background hover:opacity-90"
                                    }`}
                            >
                                {buyNowLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : needsSelection ? (
                                    "Select Options"
                                ) : (
                                    "Buy Now — One-Click Checkout"
                                )}
                            </button>

                            <button
                                onClick={handleAddToCart}
                                disabled={cartLoading || needsSelection}
                                className={`w-full font-body text-sm uppercase tracking-[0.15em] py-4 transition-all duration-300 flex items-center justify-center gap-2 ${addedSuccess
                                        ? "bg-success text-primary-foreground"
                                        : needsSelection
                                            ? "bg-muted text-muted-foreground"
                                            : "bg-primary text-primary-foreground hover:opacity-90"
                                    }`}
                            >
                                {cartLoading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : addedSuccess ? (
                                    "✓ Added"
                                ) : needsSelection ? (
                                    "Select Options"
                                ) : (
                                    "Add to Bag"
                                )}
                            </button>

                            <button
                                onClick={handleToggleWishlist}
                                className={`w-full border font-body text-sm uppercase tracking-[0.15em] py-4 transition-colors flex items-center justify-center gap-2 ${wishlisted
                                        ? "border-primary text-primary"
                                        : "border-border text-foreground hover:border-primary hover:text-primary"
                                    }`}
                            >
                                <Heart className={`w-4 h-4 ${wishlisted ? "fill-primary" : ""}`} />
                                {wishlisted ? "Wishlisted" : "Add to Wishlist"}
                            </button>
                            <p className="font-body text-[13px] text-muted-foreground text-center pt-1">
                                {DELIVERY_ESTIMATE}
                            </p>
                        </div>

                        {/* Trust Signals */}
                        <div className="mt-8 flex gap-6 font-body text-xs text-muted-foreground">
                            <span>✦ Free Shipping</span>
                            <span>✦ Easy Returns</span>
                            <span>✦ Secure Payment</span>
                        </div>

                        {/* COD Notice */}
                        <div className="mt-6 border border-border bg-card p-4">
                            <h3 className="font-body text-sm uppercase tracking-wider text-foreground mb-2">
                                Cash on Delivery (COD)
                            </h3>
                            <p className="font-body text-xs text-muted-foreground leading-relaxed mb-2">
                                We offer Cash on Delivery across India so you can shop with confidence — no card needed.
                            </p>
                            <p className="font-body text-xs text-muted-foreground leading-relaxed mb-2">
                                A ₹50 COD handling fee is charged per order. This covers the additional handling and verification costs associated with cash payments at delivery. The fee will be shown at checkout before you place your order.
                            </p>
                            <p className="font-body text-xs text-muted-foreground leading-relaxed">
                                <span className="text-foreground">Skip the fee</span> — prepaid orders via UPI, debit/credit card, or net banking are free of any additional charges.
                            </p>
                        </div>

                        {/* Accordion Details (shipping & care only — description moved below) */}
                        <Accordion type="single" collapsible className="mt-8">
                            <AccordionItem value="shipping" className="border-border">
                                <AccordionTrigger className="font-body text-sm uppercase tracking-wider text-foreground hover:no-underline">
                                    Shipping & Returns
                                </AccordionTrigger>
                                <AccordionContent className="font-body text-sm text-muted-foreground leading-relaxed">
                                    {`Free shipping on orders over ₹${FREE_SHIPPING_THRESHOLD}. Returns accepted within 7 days of purchase.`}
                                </AccordionContent>
                            </AccordionItem>
                            <AccordionItem value="care" className="border-border">
                                <AccordionTrigger className="font-body text-sm uppercase tracking-wider text-foreground hover:no-underline">
                                    Care Instructions
                                </AccordionTrigger>
                                <AccordionContent className="font-body text-sm text-muted-foreground leading-relaxed">
                                    Machine wash cold. Tumble dry low. Do not bleach. Iron on low if needed.
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </motion.div>
                </div>
            </div>

            {/* Description — full-width, left-aligned */}
            <section className="mt-12 md:mt-16 border-t border-border pt-8 md:pt-12">
                <div
                    className="font-body text-[17px] md:text-lg text-chalk leading-[1.8] tracking-[0.005em] max-w-[68ch] whitespace-pre-line overflow-x-auto [&_p:first-of-type]:font-display [&_p:first-of-type]:italic [&_p:first-of-type]:text-2xl [&_p:first-of-type]:md:text-3xl [&_p:first-of-type]:text-foreground [&_p:first-of-type]:leading-[1.3] [&_p:first-of-type]:tracking-tight [&_p:first-of-type]:mb-8 [&_p:first-of-type]:text-balance [&_p]:mb-6 [&_p]:text-pretty [&_strong]:text-foreground [&_strong]:font-medium [&_em]:text-foreground/95 [&_table]:w-max [&_table]:min-w-full [&_th]:px-3 [&_td]:px-3 [&_th]:whitespace-nowrap [&_td]:whitespace-nowrap"
                    dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(
                            node.title === "Street Fighting Championship '96 Tee" ||
                                node.handle === "street-fighting-championship-96-tee"
                                ? "Crafted from premium 100% Supima cotton, the Street Fighting Championship '96 Tee is a limited edition piece built for those who grew up in the arcade. Heavyweight 220gsm fabric with a buttery-soft hand feel. Cut for a modern relaxed fit. Once this run is gone, it's gone.\n"
                                : node.descriptionHtml || node.description || "",
                        ),
                    }}
                />
            </section>


            {/* You may also like */}
            <RelatedProducts currentHandle={handle || ""} />




            {/* Sticky mobile Add-to-Cart bar — sits above bottom nav, appears after scrolling past hero image */}
            <div
                className={`md:hidden fixed left-0 right-0 z-30 bg-[hsl(var(--color-void)/0.96)] backdrop-blur-xl border-t border-border px-4 py-3 space-y-2 transition-all duration-300 ${showStickyBar ? "translate-y-0 opacity-100 pointer-events-auto" : "translate-y-full opacity-0 pointer-events-none"
                    }`}
                style={{ bottom: 'calc(64px + env(safe-area-inset-bottom))' }}
            >
                <div className="flex items-center gap-3">
                    <div className="flex flex-col min-w-0 flex-shrink">
                        <span className="font-body text-[11px] uppercase tracking-[0.14em] text-foreground truncate leading-tight">
                            {node.title}
                        </span>
                        <span className="font-mono text-sm text-primary leading-none mt-1">
                            {selectedVariant?.price.currencyCode} {parseFloat(selectedVariant?.price.amount || "0").toFixed(2)}
                        </span>
                        {isOnSale && selectedVariant?.compareAtPrice && (
                            <span className="font-mono text-[10px] text-muted-foreground line-through leading-none mt-1">
                                {selectedVariant.compareAtPrice.currencyCode}{" "}
                                {parseFloat(selectedVariant.compareAtPrice.amount).toFixed(2)}
                            </span>
                        )}
                    </div>
                    <button
                        onClick={handleToggleWishlist}
                        aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
                        className={`flex-shrink-0 w-11 h-11 border flex items-center justify-center transition-colors ${wishlisted ? "border-primary text-primary" : "border-border text-foreground"
                            }`}
                    >
                        <Heart className={`w-4 h-4 ${wishlisted ? "fill-primary" : ""}`} />
                    </button>
                    <button
                        onClick={handleAddToCart}
                        disabled={cartLoading || needsSelection}
                        className={`flex-1 h-11 font-body text-xs uppercase tracking-[0.18em] flex items-center justify-center gap-2 transition-all ${addedSuccess
                                ? "bg-success text-primary-foreground"
                                : needsSelection
                                    ? "bg-muted text-muted-foreground"
                                    : "bg-primary text-primary-foreground hover:opacity-90"
                            }`}
                    >
                        {cartLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : addedSuccess ? (
                            "✓ Added"
                        ) : needsSelection ? (
                            "Select Options"
                        ) : (
                            "Add to Bag"
                        )}
                    </button>
                </div>
                <button
                    onClick={handleBuyNow}
                    disabled={cartLoading || buyNowLoading || needsSelection}
                    className={`w-full h-11 font-body text-xs uppercase tracking-[0.18em] flex items-center justify-center gap-2 transition-all ${needsSelection
                            ? "bg-muted text-muted-foreground"
                            : "bg-foreground text-background hover:opacity-90"
                        }`}
                >
                    {buyNowLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : needsSelection ? (
                        "Select Options"
                    ) : (
                        "Buy Now — One-Click Checkout"
                    )}
                </button>
            </div>

            {/* Fullscreen image lightbox with pinch-to-zoom + swipe (mobile) and click-to-zoom (desktop) */}
            <MobileImageLightbox
                open={zoomed}
                images={images.map((img) => ({ url: img.node.url, alt: img.node.altText }))}
                index={selectedImage}
                onClose={() => setZoomed(false)}
                onIndexChange={setSelectedImage}
            />
            <SizeGuide open={sizeGuideOpen} onOpenChange={setSizeGuideOpen} />
        </div>
    );
}