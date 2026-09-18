import React, { useEffect, useState } from "react";
import ApiClient from "../services/api";
import { useAuth } from "../context/AuthContext";
import { 
  Plus, Edit2, Trash2, Library, AlertTriangle, 
  X, Save, BookOpen, Search, Info, Sparkles, UploadCloud, Camera,
  Globe, Check, CheckCircle2, Loader2
} from "lucide-react";

interface Book {
  id: number;
  title: string;
  description: string;
  isbn: string | null;
  pub_date: string | null;
  pages: number | null;
  cover_url: string | null;
  language: string;
  author?: { name: string };
  publisher?: { name: string };
  genres?: { name: string }[];
}

interface GoogleSearchResult {
  id: string;
  title: string;
  authors: string[];
  publisher?: string;
  published_date?: string;
  description?: string;
  isbn?: string;
  pages?: number;
  cover_url?: string;
  language: string;
  categories: string[];
  already_exists: boolean;
}

export default function AdminCatalog() {
  const { user } = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal States
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<"add" | "edit">("add");
  const [selectedBookId, setSelectedBookId] = useState<number | null>(null);

  // Form Fields
  const [title, setTitle] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [publisherName, setPublisherName] = useState("");
  const [description, setDescription] = useState("");
  const [isbn, setIsbn] = useState("");
  const [pubDate, setPubDate] = useState("");
  const [pages, setPages] = useState("");
  const [coverUrl, setCoverUrl] = useState("");
  const [language, setLanguage] = useState("English");
  const [genres, setGenres] = useState("");

  const [saving, setSaving] = useState(false);
  const [scanStatus, setScanStatus] = useState("");

  // Google Books Ingestion Modal States
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleQuery, setGoogleQuery] = useState("");
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleResults, setGoogleResults] = useState<GoogleSearchResult[]>([]);
  const [googleError, setGoogleError] = useState("");
  const [ingestingId, setIngestingId] = useState<string | null>(null);
  const [ingestSuccessMsg, setIngestSuccessMsg] = useState("");

  const handleSearchGoogle = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!googleQuery.trim()) return;
    setGoogleLoading(true);
    setGoogleError("");
    setIngestSuccessMsg("");
    try {
      const data = await ApiClient.get(`/books/external/search?q=${encodeURIComponent(googleQuery)}`);
      setGoogleResults(data || []);
      if (!data || data.length === 0) {
        setGoogleError("No matching books found on Google Books.");
      }
    } catch (err: any) {
      setGoogleError(err.message || "Failed to query Google Books API.");
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleIngestGoogleBook = async (item: GoogleSearchResult) => {
    setIngestingId(item.id);
    setGoogleError("");
    setIngestSuccessMsg("");
    try {
      await ApiClient.post("/books/external/ingest", {
        title: item.title,
        author_name: item.authors[0] || null,
        publisher_name: item.publisher || null,
        description: item.description || null,
        isbn: item.isbn || null,
        pub_date: item.published_date || null,
        pages: item.pages || null,
        cover_url: item.cover_url || null,
        language: item.language === "en" ? "English" : item.language,
        genres: item.categories || []
      });
      setGoogleResults(prev => prev.map(b => b.id === item.id ? { ...b, already_exists: true } : b));
      setIngestSuccessMsg(`"${item.title}" successfully ingested and queued for vector embedding!`);
      fetchCatalog();
    } catch (err: any) {
      setGoogleError(err.message || "Failed to ingest book.");
    } finally {
      setIngestingId(null);
    }
  };

  const handleOcrCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanStatus("Analyzing cover image layout...");
    setError("");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await ApiClient.request("/ocr/parse-cover", {
        method: "POST",
        body: formData
      });
      if (response.title) setTitle(response.title);
      if (response.author_name) setAuthorName(response.author_name);
      setScanStatus("Cover parsed successfully! Title and Author autofilled.");
    } catch (err: any) {
      setError(err.message || "Failed to parse cover image.");
      setScanStatus("");
    }
  };

  const handleBarcodeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanStatus("Decoding barcode and querying Open Library...");
    setError("");
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await ApiClient.request("/ocr/scan-barcode", {
        method: "POST",
        body: formData
      });
      if (response.details) {
        const details = response.details;
        if (details.title) setTitle(details.title);
        if (details.author_name) setAuthorName(details.author_name);
        if (details.publisher_name) setPublisherName(details.publisher_name);
        if (details.description) setDescription(details.description);
        if (details.isbn) setIsbn(details.isbn);
        if (details.pages) setPages(String(details.pages));
        if (details.cover_url) setCoverUrl(details.cover_url);
        if (details.pub_date) setPubDate(details.pub_date);
        setScanStatus("Barcode scanned and Open Library record ingested successfully!");
      } else {
        setScanStatus(response.message || "ISBN decoded, but no catalog match found.");
      }
    } catch (err: any) {
      setError(err.message || "Failed to scan barcode.");
      setScanStatus("");
    }
  };

  // Load books
  const fetchCatalog = async () => {
    setLoading(true);
    try {
      // Query a larger limit to manage catalog
      const data = await ApiClient.get("/books/?limit=100");
      setBooks(data);
    } catch (err: any) {
      setError(err.message || "Failed to load book catalog.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "admin") {
      fetchCatalog();
    }
  }, [user]);

  if (user?.role !== "admin") {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertTriangle className="w-12 h-12 text-red-400 mb-4 animate-bounce" />
        <h2 className="text-xl font-bold text-foreground mb-2">403 — Access Forbidden</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          You do not have administrative privileges to access this control panel.
        </p>
      </div>
    );
  }

  const handleOpenAdd = () => {
    setModalMode("add");
    setSelectedBookId(null);
    setTitle("");
    setAuthorName("");
    setPublisherName("");
    setDescription("");
    setIsbn("");
    setPubDate("");
    setPages("");
    setCoverUrl("");
    setLanguage("English");
    setGenres("");
    setError("");
    setScanStatus("");
    setShowModal(true);
  };

  const handleOpenEdit = (book: Book) => {
    setModalMode("edit");
    setSelectedBookId(book.id);
    setTitle(book.title);
    setAuthorName(book.author?.name || "");
    setPublisherName(book.publisher?.name || "");
    setDescription(book.description || "");
    setIsbn(book.isbn || "");
    setPubDate(book.pub_date || "");
    setPages(book.pages ? String(book.pages) : "");
    setCoverUrl(book.cover_url || "");
    setLanguage(book.language || "English");
    setGenres(book.genres ? book.genres.map(g => g.name).join(", ") : "");
    setError("");
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    const genresList = genres
      .split(",")
      .map(g => g.trim())
      .filter(g => g.length > 0);

    const payload = {
      title,
      description: description || null,
      isbn: isbn || null,
      pub_date: pubDate || null,
      pages: pages ? Number(pages) : null,
      cover_url: coverUrl || null,
      language,
      genres: genresList
    };

    try {
      if (modalMode === "add") {
        await ApiClient.post("/books/", {
          ...payload,
          author_name: authorName || null,
          publisher_name: publisherName || null
        });
      } else {
        // Edit Mode: PUT accepts author_id and publisher_id directly or resolves
        await ApiClient.put(`/books/${selectedBookId}`, payload);
      }
      setShowModal(false);
      fetchCatalog();
    } catch (err: any) {
      setError(err.message || "Failed to save book catalog record.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (bookId: number, title: string) => {
    if (!window.confirm(`Are you sure you want to delete '${title}' from the database catalog?`)) {
      return;
    }

    try {
      await ApiClient.delete(`/books/${bookId}`);
      fetchCatalog();
    } catch (err: any) {
      alert(err.message || "Failed to delete book catalog record.");
    }
  };

  const filteredBooks = books.filter(b => {
    const query = searchQuery.toLowerCase();
    return (
      b.title.toLowerCase().includes(query) ||
      (b.isbn && b.isbn.includes(query)) ||
      (b.author?.name && b.author.name.toLowerCase().includes(query))
    );
  });

  return (
    <div className="p-8 max-w-7xl mx-auto">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Library className="w-8 h-8 text-emerald-400" />
            Catalog Control Panel
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create, update, and manage indexed books in the Aetheria search directory
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setShowGoogleModal(true);
              setGoogleError("");
              setIngestSuccessMsg("");
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600/15 hover:bg-blue-600/25 text-blue-400 border border-blue-500/30 text-sm font-semibold rounded-xl transition duration-200 cursor-pointer shadow-lg shadow-blue-500/10"
          >
            <Globe className="w-4 h-4" />
            Import from Google Books
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition duration-200 cursor-pointer shadow-lg shadow-emerald-500/10"
          >
            <Plus className="w-4 h-4" />
            Manual Ingest
          </button>
        </div>
      </div>

      {/* Search Filter Toolbar */}
      <div className="mb-6 flex gap-3 w-full max-w-md relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter catalog by title, author, or ISBN..."
          className="w-full glass-input pl-10"
        />
        <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
      </div>

      {/* Catalog Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : filteredBooks.length === 0 ? (
        <div className="glass-card p-12 rounded-2xl text-center border border-white/5">
          <Info className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-1">No Books Found</h3>
          <p className="text-sm text-muted-foreground">
            No entries matched your search criteria or the catalog is empty.
          </p>
        </div>
      ) : (
        <div className="glass-card rounded-2xl border border-white/5 overflow-hidden shadow-2xl">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white/3 border-b border-white/5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <th className="px-6 py-4">Title / Info</th>
                <th className="px-6 py-4">Author</th>
                <th className="px-6 py-4">ISBN</th>
                <th className="px-6 py-4">Genres</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm text-foreground">
              {filteredBooks.map((book) => (
                <tr key={book.id} className="hover:bg-white/2 transition duration-150">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {book.cover_url ? (
                        <img
                          src={book.cover_url}
                          alt={book.title}
                          className="w-9 h-12 object-cover rounded-md border border-white/10"
                        />
                      ) : (
                        <div className="w-9 h-12 bg-white/5 rounded-md flex items-center justify-center border border-white/5">
                          <BookOpen className="w-4 h-4 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <div className="font-semibold text-white">{book.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {book.language} • {book.pages || "?"} pages
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {book.author?.name || "Unknown Author"}
                  </td>
                  <td className="px-6 py-4 font-mono text-xs text-muted-foreground">
                    {book.isbn || "N/A"}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {book.genres?.map((g) => (
                        <span
                          key={g.name}
                          className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs"
                        >
                          {g.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleOpenEdit(book)}
                        className="p-2 hover:bg-white/5 text-emerald-400 hover:text-emerald-300 rounded-lg transition cursor-pointer"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(book.id, book.title)}
                        className="p-2 hover:bg-white/5 text-red-400 hover:text-red-300 rounded-lg transition cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit/Add Ingestion Dialog */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-card w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl relative p-8 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 p-2 text-muted-foreground hover:text-white rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-xl font-bold text-white mb-6">
              {modalMode === "add" ? "Ingest New Book Record" : "Update Book Registry"}
            </h3>

            {error && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs mb-6">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              {modalMode === "add" && (
                <div className="p-4 rounded-xl bg-white/5 border border-white/5 space-y-3 mb-6">
                  <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" />
                    AI Ingestion Helpers
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* OCR Cover Scanner */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">Scan Book Cover (OCR)</span>
                      <div className="flex gap-2">
                        <label className="flex-1 flex items-center justify-center py-2 px-3 bg-white/5 border border-white/10 hover:bg-white/20 text-xs text-zinc-300 rounded-lg cursor-pointer transition select-none">
                          <UploadCloud className="w-4 h-4 mr-2 text-indigo-400" />
                          Upload Cover
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleOcrCoverUpload}
                          />
                        </label>
                      </div>
                    </div>

                    {/* Barcode Scanner */}
                    <div className="space-y-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-semibold">Scan Barcode (Open Library)</span>
                      <div className="flex gap-2">
                        <label className="flex-1 flex items-center justify-center py-2 px-3 bg-white/5 border border-white/10 hover:bg-white/20 text-xs text-zinc-300 rounded-lg cursor-pointer transition select-none">
                          <Camera className="w-4 h-4 mr-2 text-emerald-400" />
                          Scan Barcode
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handleBarcodeUpload}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                  {scanStatus && <p className="text-[11px] text-emerald-400 font-medium animate-pulse">{scanStatus}</p>}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Book Title
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Atomic Habits"
                    className="w-full glass-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Author Name
                  </label>
                  <input
                    type="text"
                    required={modalMode === "add"}
                    disabled={modalMode === "edit"} // Author update handled via author_id normally
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    placeholder="James Clear"
                    className="w-full glass-input disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Publisher Name
                  </label>
                  <input
                    type="text"
                    disabled={modalMode === "edit"}
                    value={publisherName}
                    onChange={(e) => setPublisherName(e.target.value)}
                    placeholder="Avery"
                    className="w-full glass-input disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    ISBN-13 Code
                  </label>
                  <input
                    type="text"
                    value={isbn}
                    onChange={(e) => setIsbn(e.target.value)}
                    placeholder="9780735211292"
                    className="w-full glass-input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Tiny changes, remarkable results..."
                  rows={4}
                  className="w-full glass-input resize-none"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Publish Date
                  </label>
                  <input
                    type="text"
                    value={pubDate}
                    onChange={(e) => setPubDate(e.target.value)}
                    placeholder="2018-10-16"
                    className="w-full glass-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Page Count
                  </label>
                  <input
                    type="number"
                    value={pages}
                    onChange={(e) => setPages(e.target.value)}
                    placeholder="320"
                    className="w-full glass-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Language
                  </label>
                  <input
                    type="text"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    placeholder="English"
                    className="w-full glass-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Cover Image URL
                  </label>
                  <input
                    type="text"
                    value={coverUrl}
                    onChange={(e) => setCoverUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full glass-input"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Genres (Comma-separated)
                  </label>
                  <input
                    type="text"
                    value={genres}
                    onChange={(e) => setGenres(e.target.value)}
                    placeholder="Self-Help, Business, Psychology"
                    className="w-full glass-input"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-white/5 pt-6 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 hover:bg-white/5 text-muted-foreground text-sm font-semibold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition duration-200 cursor-pointer shadow-lg shadow-emerald-500/10"
                >
                  <Save className="w-4 h-4" />
                  {saving ? "Saving..." : "Save Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Google Books Ingestion Modal */}
      {showGoogleModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0c0d12] border border-white/12 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-white/8 flex items-center justify-between bg-white/2">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Import from Google Books</h2>
                  <p className="text-xs text-zinc-400">
                    Extract metadata, clean ISBN, and automatically index embeddings into Aetheria
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowGoogleModal(false)}
                className="p-2 text-zinc-500 hover:text-white rounded-xl hover:bg-white/5 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="p-6 border-b border-white/6 bg-white/1">
              <form onSubmit={handleSearchGoogle} className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    value={googleQuery}
                    onChange={(e) => setGoogleQuery(e.target.value)}
                    placeholder="Search by book title, author, or ISBN (e.g., 'Atomic Habits', 'Cal Newport')..."
                    className="w-full glass-input pl-10 pr-4 py-3 text-sm text-white placeholder:text-zinc-600 rounded-xl"
                  />
                </div>
                <button
                  type="submit"
                  disabled={googleLoading || !googleQuery.trim()}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition flex items-center gap-2 cursor-pointer shrink-0 shadow-lg shadow-blue-600/20"
                >
                  {googleLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Searching...</span>
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      <span>Search Catalog</span>
                    </>
                  )}
                </button>
              </form>

              {/* Quick Suggestion Pills */}
              <div className="flex items-center gap-2 mt-3 text-[11px] text-zinc-500">
                <span>Quick search:</span>
                {["Klara and the Sun", "Clean Architecture", "Atomic Habits", "Project Hail Mary"].map((pill) => (
                  <button
                    key={pill}
                    onClick={() => {
                      setGoogleQuery(pill);
                      setTimeout(() => {
                        setGoogleLoading(true);
                        setGoogleError("");
                        ApiClient.get(`/books/external/search?q=${encodeURIComponent(pill)}`)
                          .then((data) => setGoogleResults(data || []))
                          .catch((err) => setGoogleError(err.message))
                          .finally(() => setGoogleLoading(false));
                      }, 50);
                    }}
                    className="px-2 py-0.5 rounded-lg bg-white/4 hover:bg-white/8 text-zinc-400 hover:text-white transition cursor-pointer"
                  >
                    {pill}
                  </button>
                ))}
              </div>

              {/* Alerts */}
              {googleError && (
                <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{googleError}</span>
                </div>
              )}
              {ingestSuccessMsg && (
                <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{ingestSuccessMsg}</span>
                </div>
              )}
            </div>

            {/* Results Grid */}
            <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
              {googleResults.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {googleResults.map((item) => {
                    const isIngesting = ingestingId === item.id;
                    return (
                      <div
                        key={item.id}
                        className="glass-card p-4 rounded-xl border border-white/8 flex gap-4 hover:border-white/16 transition-all"
                      >
                        {/* Thumbnail */}
                        <div className="w-20 h-28 rounded-lg overflow-hidden shrink-0 bg-zinc-900 border border-white/10 relative">
                          {item.cover_url ? (
                            <img
                              src={item.cover_url}
                              alt={item.title}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">
                              No Cover
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <h4 className="text-sm font-bold text-white truncate mb-0.5" title={item.title}>
                              {item.title}
                            </h4>
                            <p className="text-xs text-zinc-400 truncate mb-1">
                              by {item.authors.length > 0 ? item.authors.join(", ") : "Unknown Author"}
                            </p>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {item.isbn && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/8 font-mono">
                                  ISBN {item.isbn}
                                </span>
                              )}
                              {item.pages && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/8">
                                  {item.pages} p.
                                </span>
                              )}
                              {item.published_date && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 border border-white/8">
                                  {item.published_date}
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed">
                                {item.description}
                              </p>
                            )}
                          </div>

                          {/* Action Button */}
                          <div className="pt-2 mt-2 border-t border-white/5 flex items-center justify-between">
                            {item.already_exists ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                                <Check className="w-3 h-3" /> Already In Catalog
                              </span>
                            ) : (
                              <button
                                onClick={() => handleIngestGoogleBook(item)}
                                disabled={isIngesting}
                                className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-500/10"
                              >
                                {isIngesting ? (
                                  <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Ingesting...</span>
                                  </>
                                ) : (
                                  <>
                                    <UploadCloud className="w-3.5 h-3.5" />
                                    <span>1-Click Ingest</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-16 text-center text-zinc-600 flex flex-col items-center justify-center gap-2">
                  <Globe className="w-12 h-12 stroke-1 text-zinc-700" />
                  <p className="text-sm font-medium text-zinc-400">Search for Books on Google</p>
                  <p className="text-xs text-zinc-600 max-w-sm">
                    Enter a title, author name, or ISBN above to discover books and ingest them with complete metadata and vector indexing.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
