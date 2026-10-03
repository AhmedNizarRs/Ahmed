/**
 * The only JavaScript on the page. Progressive: everything works without it.
 *  - scroll reveals (Motion `inView` + the WAAPI-only `motion/mini` animate), skipped for reduced motion
 *  - sticky mobile buy bar
 *  - clips play only while on screen
 */
import { inView, stagger } from 'motion';
import { animate } from 'motion/mini';

const root = document.documentElement;
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
root.classList.add('js-ready');

// Header hairline once the page scrolls.
const onScroll = () => root.classList.toggle('scrolled', window.scrollY > 8);
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

// Reveal on scroll.
if (!reduce) {
  inView(
    '[data-reveal]',
    (el) => {
      const kids = el.querySelectorAll<HTMLElement>('[data-reveal-child]');
      animate(el, { opacity: [0, 1], transform: ['translateY(18px)', 'translateY(0)'] }, { duration: 0.7, ease: [0.22, 1, 0.36, 1] });
      if (kids.length) {
        animate(
          kids,
          { opacity: [0, 1], transform: ['translateY(14px)', 'translateY(0)'] },
          { duration: 0.6, delay: stagger(0.07, { startDelay: 0.12 }), ease: [0.22, 1, 0.36, 1] },
        );
      }
    },
    { amount: 0.15 },
  );
} else {
  document.querySelectorAll<HTMLElement>('[data-reveal]').forEach((el) => (el.style.opacity = '1'));
}

// Value bars grow when they come into view.
inView('.bars', (el) => {
  el.classList.add('in');
});

// Close the mobile menu after picking a section.
document.querySelectorAll<HTMLElement>('[data-close-menu]').forEach((a) =>
  a.addEventListener('click', () => (document.getElementById('site-menu') as HTMLElement & { hidePopover?: () => void })?.hidePopover?.()),
);

// Sticky buy bar: visible once the hero offer has scrolled away, hidden at the final CTA.
const bar = document.querySelector<HTMLElement>('[data-sticky-buy]');
const heroOffer = document.querySelector('[data-buy="hero"]');
const finalCta = document.querySelector('[data-final]');
if (bar && heroOffer) {
  let pastHero = false;
  let atEnd = false;
  const sync = () => {
    const show = pastHero && !atEnd;
    bar.dataset.show = String(show);
    bar.toggleAttribute('inert', !show);
  };
  new IntersectionObserver(([e]) => {
    pastHero = !e.isIntersecting && e.boundingClientRect.top < 0;
    sync();
  }).observe(heroOffer);
  if (finalCta)
    new IntersectionObserver(([e]) => {
      atEnd = e.isIntersecting;
      sync();
    }).observe(finalCta);
}

// Clips: load and play only while visible; never with reduced motion (they keep their controls).
const clips = document.querySelectorAll<HTMLVideoElement>('video[data-clip]');
if (clips.length) {
  const io = new IntersectionObserver(
    (entries) => {
      for (const { target, isIntersecting } of entries) {
        const v = target as HTMLVideoElement;
        if (isIntersecting) {
          if (v.preload === 'none') v.preload = 'auto';
          if (!reduce) v.play().catch(() => {});
        } else {
          v.pause();
        }
      }
    },
    { threshold: 0.35 },
  );
  clips.forEach((v) => {
    v.muted = true;
    if (reduce) v.controls = true;
    io.observe(v);
  });
}
