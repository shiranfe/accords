import { useEffect, useState } from "react";
import App from "./App.tsx";
import { LibraryPage } from "./pages/LibraryPage.tsx";
import { SongPage } from "./pages/SongPage.tsx";
import { ImportPage } from "./pages/ImportPage.tsx";
import { ChordPreviewPage } from "./pages/ChordPreviewPage.tsx";
import { DrillPage } from "./pages/DrillPage.tsx";
import { navigate } from "./lib/navigate";
import { TopNav } from "./components/TopNav.tsx";

/** Vite base, always with a trailing slash ("/" in dev). */
const BASE = import.meta.env.BASE_URL || "/";

const readPath = () => {
  const { pathname } = window.location;
  const rest = pathname.startsWith(BASE) ? pathname.slice(BASE.length) : pathname.replace(/^\//, "");
  return `/${rest}`.replace(/\/+$/, "") || "/";
};

/** Old bookmarks still carry `#/song/<id>` — fold them back into the pathname. */
function dropLegacyHash() {
  const { hash, search } = window.location;
  if (!hash.startsWith("#/")) return;
  window.history.replaceState(null, "", `${BASE}${hash.slice(2)}${search}`);
}

function useRoutePath() {
  const [path, setPath] = useState(() => {
    dropLegacyHash();
    return readPath();
  });

  useEffect(() => {
    const onPopState = () => setPath(readPath());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  return path;
}

export function Router() {
  const path = useRoutePath();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);

  const songMatch = path.match(/^\/song\/(.+)$/);

  useEffect(() => {
    const known =
      path === "/" ||
      path === "/editor" ||
      path === "/import" ||
      path === "/chords" ||
      path === "/drill";
    if (!known && !songMatch) navigate("/", true);
  }, [path, songMatch]);

  const page = (() => {
    if (path === "/editor") return <App />;
    if (path === "/import") return <ImportPage />;
    if (path === "/chords") return <ChordPreviewPage />;
    if (path === "/drill") return <DrillPage />;
    if (songMatch) return <SongPage songId={decodeURIComponent(songMatch[1])} />;
    return <LibraryPage />;
  })();

  return (
    <>
      <TopNav path={path} />
      {page}
    </>
  );
}
