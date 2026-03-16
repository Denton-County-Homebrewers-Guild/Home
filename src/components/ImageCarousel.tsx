import { useState, useEffect, useCallback } from "react";
import images from "../config/carousel-images.json";

const AUTOPLAY_INTERVAL = 4000;

export default function ImageCarousel() {
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  const prev = useCallback(() => {
    setCurrent((c) => (c - 1 + images.length) % images.length);
  }, []);

  const next = useCallback(() => {
    setCurrent((c) => (c + 1) % images.length);
  }, []);

  useEffect(() => {
    if (paused) return;
    const timer = setInterval(next, AUTOPLAY_INTERVAL);
    return () => clearInterval(timer);
  }, [paused, next]);

  const slide = images[current];

  return (
    <div
      className="carousel-wrapper"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {/* Slide area */}
      <div className="carousel-track">
        {images.map((img, i) => (
          <div
            key={img.src}
            className={`carousel-slide${i === current ? " active" : ""}`}
            aria-hidden={i !== current}
          >
            <img src={img.src} alt={img.alt} className="carousel-img" />
          </div>
        ))}

        {/* Prev / Next arrows */}
        <button
          className="carousel-arrow carousel-arrow-left"
          onClick={prev}
          aria-label="Previous image"
        >
          &#8249;
        </button>
        <button
          className="carousel-arrow carousel-arrow-right"
          onClick={next}
          aria-label="Next image"
        >
          &#8250;
        </button>

        {/* Slide counter */}
        <div className="carousel-counter">
          {current + 1} / {images.length}
        </div>
      </div>

      {/* Title & Caption */}
      <div className="carousel-meta">
        <p className="carousel-title">{slide.title}</p>
        <p className="carousel-caption">{slide.caption}</p>
      </div>

      {/* Dot indicators */}
      <div className="carousel-dots" role="tablist">
        {images.map((_, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === current}
            aria-label={`Go to image ${i + 1}`}
            className={`carousel-dot${i === current ? " active" : ""}`}
            onClick={() => setCurrent(i)}
          />
        ))}
      </div>

      <style>{`
        .carousel-wrapper {
          width: 100%;
          max-width: 800px;
          margin: 2rem auto 0;
        }

        .carousel-track {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 10;
          background: #111;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 8px 24px rgba(0,0,0,0.5);
        }

        .carousel-slide {
          position: absolute;
          inset: 0;
          opacity: 0;
          transition: opacity 0.6s ease;
          pointer-events: none;
        }

        .carousel-slide.active {
          opacity: 1;
          pointer-events: auto;
        }

        .carousel-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .carousel-arrow {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(0, 0, 0, 0.55);
          color: #fff;
          border: none;
          border-radius: 50%;
          width: 44px;
          height: 44px;
          font-size: 2rem;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
          transition: background 0.2s;
        }

        .carousel-arrow:hover {
          background: rgba(255, 204, 0, 0.85);
          color: #111;
        }

        .carousel-arrow-left  { left: 12px; }
        .carousel-arrow-right { right: 12px; }

        .carousel-counter {
          position: absolute;
          bottom: 10px;
          right: 14px;
          background: rgba(0,0,0,0.5);
          color: #fff;
          font-size: 0.75rem;
          padding: 2px 8px;
          border-radius: 12px;
          z-index: 10;
        }

        .carousel-meta {
          background: rgba(0, 0, 0, 0.6);
          border-radius: 0 0 10px 10px;
          padding: 0.75rem 1rem;
          margin-top: -2px;
          min-height: 70px;
        }

        .carousel-title {
          color: #ffcc00;
          font-size: 1rem;
          font-weight: 600;
          margin: 0 0 0.25rem;
          line-height: 1.3;
        }

        .carousel-caption {
          color: rgba(255,255,255,0.85);
          font-size: 0.875rem;
          margin: 0;
          line-height: 1.5;
        }

        .carousel-dots {
          display: flex;
          justify-content: center;
          gap: 8px;
          margin-top: 14px;
          flex-wrap: wrap;
        }

        .carousel-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          border: none;
          background: rgba(255,255,255,0.35);
          cursor: pointer;
          padding: 0;
          transition: background 0.2s, transform 0.2s;
        }

        .carousel-dot.active {
          background: #ffcc00;
          transform: scale(1.3);
        }

        .carousel-dot:hover:not(.active) {
          background: rgba(255,255,255,0.65);
        }
      `}</style>
    </div>
  );
}
