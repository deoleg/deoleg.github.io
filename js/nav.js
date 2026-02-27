// Nav underline animation
// Adds animated SVG wave underline on hover, hides active underline while hovering

document.addEventListener('DOMContentLoaded', () => {
  const links = document.querySelectorAll('nav a:not(.nav-give)');

  // Inject SVG underline into each nav link
  links.forEach(link => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('nav-underline-svg');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('viewBox', '0 0 100 8');
    svg.setAttribute('aria-hidden', 'true');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M0,5 Q25,1 50,5 Q75,9 100,5');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#f9b625');
    path.setAttribute('stroke-width', '2.5');
    path.setAttribute('stroke-linecap', 'round');

    svg.appendChild(path);
    link.appendChild(svg);
  });

  const nav = document.querySelector('nav');

  // On mouse enter any nav link — hide active underline, show hover animation
  nav.addEventListener('mouseenter', (e) => {
    const link = e.target.closest('nav a:not(.nav-give)');
    if (!link) return;

    // Hide active ::after underline on all links
    nav.classList.add('nav-hovered');

    // Trigger SVG animation on hovered link
    link.classList.add('nav-link-hovered');
  }, true);

  // On mouse leave a nav link — restore active underline, stop animation
  nav.addEventListener('mouseleave', (e) => {
    const link = e.target.closest('nav a:not(.nav-give)');
    if (!link) return;

    nav.classList.remove('nav-hovered');
    link.classList.remove('nav-link-hovered');
  }, true);
});
