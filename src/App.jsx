import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import TopNav from "./components/TopNav";
import SyncBanner from "./components/SyncBanner";
import Content from "./pages/Content";
import ContentDetail from "./pages/ContentDetail";
import Catalogue from "./pages/Catalogue";
import CatalogueItemDetail from "./pages/CatalogueItemDetail";
import ContentTypes from "./pages/ContentTypes";
import ContentTypeDetail from "./pages/ContentTypeDetail";
import Taxonomies from "./pages/Taxonomies";
import TaxonomyDetail from "./pages/TaxonomyDetail";
import Media from "./pages/Media";
import MediaDetail from "./pages/MediaDetail";
import Settings from "./pages/Settings";
import Preview from "./pages/Preview";
import { useAccess } from "./lib/access";

export default function App() {
  const location = useLocation();
  const { canModel } = useAccess();
  // Content types and taxonomies are for people who model content; an editor is sent to Content.
  const modeling = (page) => (canModel ? page : <Navigate to="/content" replace />);

  // Preview renders a standalone mock site/app, not the CMS chrome.
  if (location.pathname.startsWith("/preview")) {
    return (
      <Routes>
        <Route path="/preview/:channelId/:entryId" element={<Preview />} />
      </Routes>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      <TopNav />
      <SyncBanner />
      <main className="flex min-h-0 flex-1 flex-col">
        <Routes>
          <Route path="/" element={<Navigate to="/content" replace />} />
          <Route path="/content" element={<Content />} />
          <Route path="/content/:id" element={<ContentDetail />} />
          <Route path="/catalogue" element={<Catalogue />} />
          <Route path="/catalogue/item/:id" element={<CatalogueItemDetail />} />
          <Route path="/content-types" element={modeling(<ContentTypes />)} />
          <Route path="/content-types/:id" element={modeling(<ContentTypeDetail />)} />
          <Route path="/taxonomies" element={modeling(<Taxonomies />)} />
          <Route path="/taxonomies/:id" element={modeling(<TaxonomyDetail />)} />
          <Route path="/media" element={<Media />} />
          <Route path="/media/:id" element={<MediaDetail />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </div>
  );
}
