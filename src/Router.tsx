import { useEffect, useState } from "react";
import App from "./App.tsx";
import { LibraryPage } from "./pages/LibraryPage.tsx";
import { SongPage } from "./pages/SongPage.tsx";
import { ImportPage } from "./pages/ImportPage.tsx";
import { ChordPreviewPage } from "./pages/ChordPreviewPage.tsx";

function useHashPath() {
  const [path, setPath] = useState(() => window.location.hash.replace(/^#/, "") || "/");

  useEffect(() => {
    const onHashChange = () => setPath(window.location.hash.replace(/^#/, "") || "/");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return path;
}

export function Router() {
  const path = useHashPath();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [path]);

  if (path === "/editor") return <App />;
  if (path === "/import") return <ImportPage />;
  if (path === "/chords") return <ChordPreviewPage />;

  const songMatch = path.match(/^\/song\/(.+)$/);
  if (songMatch) return <SongPage songId={songMatch[1]} />;

  return <LibraryPage />;
}
