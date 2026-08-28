/** Path-based routes: http://host/song/<id> — no hash. */
export const navigate = (path: string, replace = false) => {
  const base = import.meta.env.BASE_URL || "/";
  const target = `${base}${path.replace(/^\//, "")}`;
  if (window.location.pathname === target) return;

  if (replace) window.history.replaceState(null, "", target);
  else window.history.pushState(null, "", target);

  // pushState/replaceState don't fire popstate — tell the router ourselves.
  window.dispatchEvent(new PopStateEvent("popstate"));
};
