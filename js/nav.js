document.addEventListener('DOMContentLoaded', () => {
  const links = document.querySelectorAll('nav a:not(.nav-give)');

  // Each "stroke" is a slightly different wavy path at a different vertical offset
  // Strokes go: left→right, right→left, left→right — like a real pen
  const strokes = [
    { d: 'M2,6 Q25,3 50,6 Q75,9 98,6',   delay: 0,    duration: 320 },
    { d: 'M98,4 Q75,7 50,4 Q25,1 2,4',   delay: 280,  duration: 300 },
    { d: 'M2,7 Q30,4 52,7 Q72,10 98,7',  delay: 540,  duration: 280 },
  ];

  links.forEach(link => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('nav-underline-svg');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('viewBox', '0 0 100 12');
    svg.setAttribute('aria-hidden', 'true');

    strokes.forEach((stroke, i) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', stroke.d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#f9b625');
      path.setAttribute('stroke-width', i === 1 ? '2' : '2.5');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-opacity', i === 1 ? '0.7' : '0.9');
      svg.appendChild(path);
    });

    link.appendChild(svg);

    // Pre-measure path lengths after render
    requestAnimationFrame(() => {
      svg.querySelectorAll('path').forEach(path => {
        const len = path.getTotalLength();
        path.style.strokeDasharray = len;
        path.style.strokeDashoffset = len;
        path.style.transition = 'none';
      });
    });
  });

  const nav = document.querySelector('nav');
  let hoverTimeouts = [];

  function clearTimeouts() {
    hoverTimeouts.forEach(t => clearTimeout(t));
    hoverTimeouts = [];
  }

  function animateIn(link) {
    const paths = link.querySelectorAll('.nav-underline-svg path');
    clearTimeouts();

    paths.forEach((path, i) => {
      const stroke = strokes[i];
      const len = path.getTotalLength();

      // Reset instantly
      path.style.transition = 'none';
      path.style.strokeDashoffset = len;

      const t = setTimeout(() => {
        path.style.transition = `stroke-dashoffset ${stroke.duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
        path.style.strokeDashoffset = '0';
      }, stroke.delay + 10);

      hoverTimeouts.push(t);
    });
  }

  function animateOut(link) {
    const paths = link.querySelectorAll('.nav-underline-svg path');
    clearTimeouts();

    paths.forEach(path => {
      const len = path.getTotalLength();
      path.style.transition = 'stroke-dashoffset 0.15s ease';
      path.style.strokeDashoffset = len;
    });
  }

  nav.addEventListener('mouseover', (e) => {
    const link = e.target.closest('nav a:not(.nav-give)');
    if (!link) return;

    // Hide hover animations on other links
    links.forEach(l => {
      if (l !== link) {
        animateOut(l);
        l.classList.remove('nav-link-hovered');
      }
    });

    nav.classList.add('nav-hovered');
    link.classList.add('nav-link-hovered');
    animateIn(link);
  });

  nav.addEventListener('mouseleave', () => {
    links.forEach(l => {
      animateOut(l);
      l.classList.remove('nav-link-hovered');
    });
    nav.classList.remove('nav-hovered');
  });
  // Static underline for .text-underline elements
  const staticTargets = document.querySelectorAll('.text-underline');

  staticTargets.forEach(el => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('nav-underline-svg');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('viewBox', '0 0 100 12');
    svg.setAttribute('aria-hidden', 'true');

    strokes.forEach((stroke, i) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', stroke.d);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', '#f9b625');
      path.setAttribute('stroke-width', i === 1 ? '2' : '2.5');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-opacity', i === 1 ? '0.7' : '0.9');
      svg.appendChild(path);
    });

    el.style.position = 'relative';
    el.appendChild(svg);

    requestAnimationFrame(() => {
      svg.querySelectorAll('path').forEach(path => {
        const len = path.getTotalLength();
        path.style.strokeDasharray = len;
        path.style.strokeDashoffset = len;
        path.style.transition = 'none';
      });

      // Запускаем анимацию с задержкой 700ms
      svg.querySelectorAll('path').forEach((path, i) => {
        const stroke = strokes[i];
        const len = path.getTotalLength();
        const baseDelay = 700;

        setTimeout(() => {
          path.style.transition = `stroke-dashoffset ${stroke.duration}ms cubic-bezier(0.4, 0, 0.2, 1)`;
          path.style.strokeDashoffset = '0';
        }, baseDelay + stroke.delay + 10);
      });
    });
  });
});
