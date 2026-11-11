// Hash routing for the two tabs. Pure routeFromHash, DOM work in startRouter.
export function routeFromHash(hash) {
  return hash === '#/news' ? 'news' : 'roadmap';
}

export function startRouter({ onNews, onRoadmap } = {}) {
  const views = document.querySelectorAll('[data-view]');
  const tabs = document.querySelectorAll('[data-tab]');
  // Section links and "+ Milestone" only make sense on the roadmap tab.
  const roadmapOnly = [document.querySelector('.site-nav'), document.querySelector('#header-add')];

  function apply() {
    const route = routeFromHash(window.location.hash);
    for (const view of views) view.hidden = view.dataset.view !== route;
    for (const tab of tabs) {
      if (tab.dataset.tab === route) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    }
    for (const el of roadmapOnly) if (el) el.hidden = route === 'news';
    if (route === 'news' && typeof onNews === 'function') onNews();
    if (route === 'roadmap' && typeof onRoadmap === 'function') onRoadmap();
  }

  window.addEventListener('hashchange', apply);
  apply();
}
