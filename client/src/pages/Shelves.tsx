import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ApiClient from "../services/api";
import { 
  Trash2, BookOpen, Library, Heart, Star, 
  ChevronDown, CheckCircle2, Bookmark, Clock, Sparkles
} from "lucide-react";

interface Book {
  id: number;
  title: string;
  cover_url: string;
  rating: number;
  pages: number;
  author?: { name: string };
  genres?: { name: string }[];
}

interface ShelfItem {
  id: number;
  status: "want_to_read" | "reading" | "completed";
  added_at: string;
  book: Book;
}

export default function Shelves() {
  const [shelves, setShelves] = useState<ShelfItem[]>([]);
  const [favorites, setFavorites] = useState<Book[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"all" | "reading" | "want_to_read" | "completed" | "favorites">("all");
  const [statusMenuOpenId, setStatusMenuOpenId] = useState<number | null>(null);

  const fetchData = async () => {
    try {
      const [shelvesData, favsData] = await Promise.all([
        ApiClient.get("/reading-lists/"),
        ApiClient.get("/reading-lists/favorites")
      ]);
      setShelves(shelvesData || []);
      const favList: Book[] = favsData || [];
      setFavorites(favList);
      setFavoriteIds(new Set(favList.map((b) => b.id)));
    } catch (err) {
      console.error("Failed to load shelves data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleDelete = async (bookId: number) => {
    // Optimistic UI update
    setShelves((prev) => prev.filter((item) => item.book?.id !== bookId));
    try {
      await ApiClient.delete(`/reading-lists/${bookId}`);
    } catch (err) {
      console.error("Failed to delete shelf item:", err);
      fetchData();
    }
  };

  const handleToggleFavorite = async (book: Book) => {
    const isFav = favoriteIds.has(book.id);
    const newFavSet = new Set(favoriteIds);
    if (isFav) {
      newFavSet.delete(book.id);
      setFavorites((prev) => prev.filter((b) => b.id !== book.id));
    } else {
      newFavSet.add(book.id);
      setFavorites((prev) => [...prev, book]);
    }
    setFavoriteIds(newFavSet);

    try {
      await ApiClient.post(`/reading-lists/${book.id}/favorite`, {});
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
      fetchData();
    }
  };

  const handleUpdateShelfStatus = async (bookId: number, newStatus: "want_to_read" | "reading" | "completed") => {
    setStatusMenuOpenId(null);
    // Optimistically update
    setShelves((prev) =>
      prev.map((item) =>
        item.book?.id === bookId ? { ...item, status: newStatus } : item
      )
    );

    try {
      await ApiClient.post("/reading-lists/", {
        book_id: bookId,
        status: newStatus
      });
    } catch (err) {
      console.error("Failed to update status:", err);
      fetchData();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-zinc-400">
        <div className="relative w-12 h-12 mb-4">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20"></div>
          <div className="absolute inset-0 rounded-full border-2 border-t-primary animate-spin"></div>
        </div>
        <p className="text-sm font-medium">Arranging your bookshelves...</p>
      </div>
    );
  }

  const readingCount = shelves.filter((s) => s.status === "reading").length;
  const wantCount = shelves.filter((s) => s.status === "want_to_read").length;
  const completedCount = shelves.filter((s) => s.status === "completed").length;
  const favCount = favorites.length;

  const tabs = [
    { id: "all", label: "All Shelves", count: shelves.length },
    { id: "reading", label: "Currently Reading", count: readingCount },
    { id: "want_to_read", label: "Want to Read", count: wantCount },
    { id: "completed", label: "Completed", count: completedCount },
    { id: "favorites", label: "Favorites", count: favCount, isHeart: true }
  ];

  const getStatusBadge = (status: string) => {
    if (status === "want_to_read") {
      return (
        <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
          <Bookmark className="w-2.5 h-2.5" /> Want to Read
        </span>
      );
    }
    if (status === "reading") {
      return (
        <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
          <Clock className="w-2.5 h-2.5" /> Reading
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
        <CheckCircle2 className="w-2.5 h-2.5" /> Completed
      </span>
    );
  };

  // Render cards based on active tab
  let displayBooks: { book: Book; shelfStatus?: "want_to_read" | "reading" | "completed"; shelfId?: number }[] = [];

  if (activeTab === "favorites") {
    displayBooks = favorites.map((b) => {
      const matchingShelf = shelves.find((s) => s.book?.id === b.id);
      return {
        book: b,
        shelfStatus: matchingShelf?.status,
        shelfId: matchingShelf?.id
      };
    });
  } else {
    displayBooks = shelves
      .filter((item) => activeTab === "all" || item.status === activeTab)
      .map((item) => ({
        book: item.book,
        shelfStatus: item.status,
        shelfId: item.id
      }));
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Library className="w-6 h-6 text-emerald-400" />
            <h1 className="text-3xl font-extrabold tracking-tight text-white">My Bookshelves</h1>
          </div>
          <p className="text-zinc-400 text-sm">
            Curate reading queues, track completed books, and organize favorites
          </p>
        </div>

        <Link
          to="/search"
          className="self-start md:self-auto px-4 py-2.5 rounded-xl bg-primary text-black font-bold text-xs hover:bg-emerald-400 transition shadow-lg shadow-primary/20 flex items-center gap-1.5 cursor-pointer"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Discover More Books</span>
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-white/5 gap-1.5 scrollbar-none pb-px">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 pb-3.5 px-4 text-xs font-bold tracking-wide border-b-2 transition-all outline-none whitespace-nowrap cursor-pointer ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-zinc-400 hover:text-white hover:border-white/20"
              }`}
            >
              {tab.isHeart && (
                <Heart
                  className={`w-3.5 h-3.5 ${
                    isActive ? "text-rose-400 fill-rose-400" : "text-zinc-500"
                  }`}
                />
              )}
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold ${
                  isActive
                    ? "bg-primary/20 text-primary"
                    : "bg-white/5 text-zinc-500"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Books Grid */}
      {displayBooks.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {displayBooks.map(({ book, shelfStatus }) => {
            if (!book) return null;
            const isFav = favoriteIds.has(book.id);
            const isMenuOpen = statusMenuOpenId === book.id;

            return (
              <div
                key={book.id}
                className="group glass-card rounded-2xl p-4 flex flex-col justify-between relative border border-white/8 hover:border-white/18 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5"
              >
                <div>
                  {/* Cover Display */}
                  <div className="aspect-[2/3] w-full overflow-hidden rounded-xl shadow-lg relative mb-4 bg-zinc-900/60">
                    <Link to={`/books/${book.id}`}>
                      <img
                        src={book.cover_url || "https://placehold.co/240x360?text=No+Cover"}
                        alt={book.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-103"
                        loading="lazy"
                      />
                    </Link>

                    {/* Favorite Heart Button */}
                    <button
                      onClick={() => handleToggleFavorite(book)}
                      className={`absolute top-2.5 left-2.5 p-2 rounded-xl backdrop-blur-md transition-all duration-200 shadow-md cursor-pointer ${
                        isFav
                          ? "bg-rose-500/20 border border-rose-500/40 text-rose-400"
                          : "bg-black/50 border border-white/10 text-white/70 hover:text-rose-400 hover:bg-black/70"
                      }`}
                      title={isFav ? "Remove from Favorites" : "Add to Favorites"}
                    >
                      <Heart className={`w-3.5 h-3.5 ${isFav ? "fill-rose-400" : ""}`} />
                    </button>

                    {/* Shelf Status Pill Badge */}
                    {shelfStatus && (
                      <div className="absolute top-2.5 right-2.5 shadow-md">
                        {getStatusBadge(shelfStatus)}
                      </div>
                    )}

                    {/* Rating Pill */}
                    {book.rating > 0 && (
                      <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 flex items-center gap-1 text-[10px] font-bold text-amber-300 shadow-md">
                        <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                        <span>{book.rating.toFixed(1)}</span>
                      </div>
                    )}
                  </div>

                  {/* Metadata */}
                  <Link to={`/books/${book.id}`}>
                    <h3 className="text-sm font-bold text-white truncate hover:text-primary transition-colors mb-1">
                      {book.title}
                    </h3>
                  </Link>
                  <p className="text-xs text-zinc-400 truncate mb-3">
                    by {book.author?.name || "Unknown Author"}
                  </p>
                </div>

                {/* Footer Controls & Quick Shelf Switcher */}
                <div className="border-t border-white/6 pt-3 mt-2 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400">
                    <div className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-zinc-500" />
                      <span>{book.pages ? `${book.pages} p.` : "Pages n/a"}</span>
                    </div>

                    {/* Quick Shelf Move Dropdown */}
                    <div className="relative">
                      <button
                        onClick={() => setStatusMenuOpenId(isMenuOpen ? null : book.id)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/4 hover:bg-white/8 border border-white/8 text-[10px] font-bold text-zinc-300 hover:text-white transition cursor-pointer"
                        title="Change Shelf Status"
                      >
                        <span>Move</span>
                        <ChevronDown className="w-3 h-3" />
                      </button>

                      {isMenuOpen && (
                        <div className="absolute right-0 bottom-full mb-1 w-36 bg-zinc-950/95 backdrop-blur-xl border border-white/12 rounded-xl shadow-2xl py-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                          <button
                            onClick={() => handleUpdateShelfStatus(book.id, "want_to_read")}
                            className={`w-full px-3 py-1.5 text-left text-xs font-semibold hover:bg-white/5 transition flex items-center justify-between cursor-pointer ${
                              shelfStatus === "want_to_read" ? "text-blue-400" : "text-zinc-300"
                            }`}
                          >
                            <span>Want to Read</span>
                            {shelfStatus === "want_to_read" && <CheckCircle2 className="w-3 h-3" />}
                          </button>
                          <button
                            onClick={() => handleUpdateShelfStatus(book.id, "reading")}
                            className={`w-full px-3 py-1.5 text-left text-xs font-semibold hover:bg-white/5 transition flex items-center justify-between cursor-pointer ${
                              shelfStatus === "reading" ? "text-amber-400" : "text-zinc-300"
                            }`}
                          >
                            <span>Reading</span>
                            {shelfStatus === "reading" && <CheckCircle2 className="w-3 h-3" />}
                          </button>
                          <button
                            onClick={() => handleUpdateShelfStatus(book.id, "completed")}
                            className={`w-full px-3 py-1.5 text-left text-xs font-semibold hover:bg-white/5 transition flex items-center justify-between cursor-pointer ${
                              shelfStatus === "completed" ? "text-emerald-400" : "text-zinc-300"
                            }`}
                          >
                            <span>Completed</span>
                            {shelfStatus === "completed" && <CheckCircle2 className="w-3 h-3" />}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Remove from Shelf button */}
                  {shelfStatus && (
                    <button
                      onClick={() => handleDelete(book.id)}
                      className="w-full py-1 rounded-lg text-[10px] font-semibold text-zinc-500 hover:text-rose-400 hover:bg-rose-500/5 transition flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remove from Shelf</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20 border border-dashed border-white/8 rounded-2xl flex flex-col items-center justify-center gap-3 bg-white/1">
          <Library className="w-12 h-12 text-zinc-700 stroke-1" />
          <div className="space-y-1">
            <p className="font-bold text-zinc-300">
              {activeTab === "favorites" ? "No favorite books yet" : "Bookshelf is empty"}
            </p>
            <p className="text-xs text-zinc-500 max-w-sm">
              {activeTab === "favorites"
                ? "Click the heart icon on any book cover across Aetheria to collect your favorites here."
                : "Search or browse our AI catalog to shelf-add books to your reading lists."}
            </p>
          </div>
          <Link
            to="/search"
            className="text-xs font-bold px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-primary hover:bg-white/10 transition mt-2 cursor-pointer"
          >
            Explore Catalog
          </Link>
        </div>
      )}
    </div>
  );
}
