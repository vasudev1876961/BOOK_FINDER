import React, { useEffect, useState } from "react";
import ApiClient from "../services/api";
import { useAuth } from "../context/AuthContext";
import { 
  Plus, Edit2, Trash2, Library, AlertTriangle, 
  X, Save, BookOpen, Search, Info, Sparkles, UploadCloud, Camera 
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
        <button
          onClick={handleOpenAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold rounded-xl transition duration-200 cursor-pointer shadow-lg shadow-emerald-500/10"
        >
          <Plus className="w-4 h-4" />
          Ingest New Book
        </button>
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
    </div>
  );
}
