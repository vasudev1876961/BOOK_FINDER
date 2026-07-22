import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ApiClient from "../services/api";
import { Trash2, BookOpen, Library } from "lucide-react";

interface ShelfItem {
  id: number;
  status: "want_to_read" | "reading" | "completed";
  added_at: string;
  book?: {
    id: number;
    title: string;
    cover_url: string;
    rating: number;
    pages: number;
    author?: { name: string };
  };
}

const Shelves: React.FC = () => {
  const [shelves, setShelves] = useState<ShelfItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeFilter, setActiveFilter] = useState<"all" | "want_to_read" | "reading" | "completed">("all");

  const fetchShelves = async () => {
    try {
      const data = await ApiClient.get("/reading-lists/");
      setShelves(data);
    } catch (err) {
      console.error("Failed to load reading lists:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchShelves();
  }, []);

  const handleDelete = async (bookId: number) => {
    // Optimistic UI update
    setShelves((prev) => prev.filter((item) => item.book?.id !== bookId));
    try {
      await ApiClient.delete(`/reading-lists/${bookId}`);
    } catch (err) {
      console.error("Failed to delete shelf item:", err);
      // Reload on failure
      fetchShelves();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-zinc-400">
        <div className="relative w-12 h-12 mb-4">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20"></div>
          <div className="absolute inset-0 rounded-full border-2 border-t-primary animate-spin"></div>
        </div>
        <p className="text-sm font-medium">Restoring bookshelves...</p>
      </div>
    );
  }

  const filteredShelves = shelves.filter((item) => {
    if (activeFilter === "all") return true;
    return item.status === activeFilter;
  });

  const getStatusLabel = (status: string) => {
    if (status === "want_to_read") return "Want to Read";
    if (status === "reading") return "Reading";
    return "Completed";
  };

  const getStatusColor = (status: string) => {
    if (status === "want_to_read") return "bg-blue-500/10 text-blue-400 border border-blue-500/20";
    if (status === "reading") return "bg-orange-500/10 text-orange-400 border border-orange-500/20";
    return "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20";
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">My Bookshelves</h1>
          <p className="text-zinc-500 text-sm">Organize and manage your custom reading lists</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-white/5 gap-2">
        {[
          { id: "all", label: "All Shelves" },
          { id: "reading", label: "Currently Reading" },
          { id: "want_to_read", label: "Want to Read" },
          { id: "completed", label: "Completed" }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveFilter(tab.id as any)}
            className={`pb-3 px-3 text-xs font-semibold tracking-wide border-b-2 transition-all outline-none ${
              activeFilter === tab.id
                ? "border-primary text-primary"
                : "border-transparent text-zinc-400 hover:text-white"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Shelves List */}
      {filteredShelves.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredShelves.map((item) => {
            const book = item.book;
            if (!book) return null;
            return (
              <div
                key={item.id}
                className="group glass-card rounded-xl p-4 flex flex-col justify-between"
              >
                <div>
                  {/* Cover Display */}
                  <div className="aspect-[2/3] w-full overflow-hidden rounded-lg shadow-lg relative mb-4">
                    <Link to={`/books/${book.id}`}>
                      <img
                        src={book.cover_url || "https://placehold.co/150x225?text=No+Cover"}
                        alt={book.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
                      />
                    </Link>
                    {/* Status Badge */}
                    <div className={`absolute top-2.5 right-2.5 px-2 py-0.5 rounded text-[8px] font-bold ${getStatusColor(item.status)}`}>
                      {getStatusLabel(item.status)}
                    </div>
                  </div>

                  <Link to={`/books/${book.id}`}>
                    <h3 className="text-sm font-bold text-white truncate hover:text-primary transition-colors mb-0.5">
                      {book.title}
                    </h3>
                  </Link>
                  <p className="text-[11px] text-zinc-400 truncate mb-3">
                    by {book.author?.name || "Unknown Author"}
                  </p>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-2 text-[10px] text-zinc-500">
                  <div className="flex items-center gap-1">
                    <BookOpen className="w-3.5 h-3.5 text-zinc-650" />
                    <span>{book.pages || "???"} pages</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDelete(book.id)}
                      className="p-1.5 rounded hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
                      title="Remove from Shelf"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 text-zinc-650 text-sm border border-dashed border-white/5 rounded-xl flex flex-col items-center justify-center gap-3">
          <Library className="w-10 h-10 text-zinc-750" />
          <div className="space-y-1">
            <p className="font-semibold text-zinc-400">Bookshelf empty</p>
            <p className="text-xs text-zinc-600 max-w-sm">No books on this shelf yet. Browse the catalog to shelf-add books.</p>
          </div>
          <Link to="/search" className="text-xs text-primary font-bold mt-2 hover:underline">
            Search Books
          </Link>
        </div>
      )}
    </div>
  );
};

export default Shelves;
