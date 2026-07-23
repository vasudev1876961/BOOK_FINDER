import { useState, useEffect } from "react";
import ApiClient from "../services/api";
import { 
  Search as SearchIcon, Star, BookOpen, Layers, 
  Sparkles, History, RotateCcw, X, CheckSquare, 
  HelpCircle, ArrowRightLeft, BookMarked
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

interface SearchHit {
  book: Book;
  score: number;
}

export default function Search() {
  // Search Form State
  const [titleQuery, setTitleQuery] = useState("");
  const [authorQuery, setAuthorQuery] = useState("");
  const [isbnQuery, setIsbnQuery] = useState("");
  const [language, setLanguage] = useState("Any");
  const [searchType, setSearchType] = useState<"hybrid" | "semantic" | "keyword">("hybrid");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [minRating, setMinRating] = useState<number>(0);
  const [maxPages, setMaxPages] = useState<number>(1000);

  const [results, setResults] = useState<SearchHit[]>([]);
  const [spellCorrected, setSpellCorrected] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");

  // History & Comparison
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedForComparison, setSelectedForComparison] = useState<number[]>([]);
  const [comparisonDossier, setComparisonDossier] = useState<string | null>(null);
  const [loadingComparison, setLoadingComparison] = useState(false);

  const availableGenres = ["Self-Help", "Business", "Tech", "Psychology", "Fantasy", "Sci-Fi", "History", "Biography", "Mystery", "Fiction", "Education"];

  // Load recent searches
  useEffect(() => {
    const saved = localStorage.getItem("aetheria_recent_searches");
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const saveRecentSearch = (queryStr: string) => {
    if (!queryStr.trim()) return;
    setRecentSearches((prev) => {
      const updated = [queryStr, ...prev.filter((q) => q !== queryStr)].slice(0, 5);
      localStorage.setItem("aetheria_recent_searches", JSON.stringify(updated));
      return updated;
    });
  };

  const handleSearch = async (overrideQuery?: string) => {
    setSearching(true);
    setSpellCorrected(null);
    setError("");
    setSelectedForComparison([]);

    // Compile a composite query string
    const parts = [];
    if (titleQuery) parts.push(titleQuery);
    if (authorQuery) parts.push(`by ${authorQuery}`);
    if (isbnQuery) parts.push(`ISBN ${isbnQuery}`);
    const compositeQuery = overrideQuery || parts.join(" ") || "Books";

    saveRecentSearch(compositeQuery);

    try {
      const payload = {
        query: compositeQuery,
        search_type: searchType,
        genres: selectedGenres.length > 0 ? selectedGenres : null,
        min_rating: minRating > 0 ? minRating : null,
        max_pages: maxPages < 1000 ? maxPages : null,
        page: 1,
        page_size: 24
      };

      const response = await ApiClient.post("/search/", payload);
      setResults(response.results);
      setSpellCorrected(response.spell_corrected_query);
    } catch (err: any) {
      setError(err.message || "Search failed.");
    } finally {
      setSearching(false);
    }
  };

  const handleReset = () => {
    setTitleQuery("");
    setAuthorQuery("");
    setIsbnQuery("");
    setLanguage("Any");
    setSearchType("hybrid");
    setSelectedGenres([]);
    setMinRating(0);
    setMaxPages(1000);
    setResults([]);
    setSpellCorrected(null);
    setSelectedForComparison([]);
  };

  const handleSelectRecent = (queryStr: string) => {
    setTitleQuery(queryStr);
    handleSearch(queryStr);
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleCheckboxCompare = (bookId: number) => {
    setSelectedForComparison((prev) => {
      if (prev.includes(bookId)) {
        return prev.filter((id) => id !== bookId);
      }
      if (prev.length >= 2) {
        return [prev[1], bookId]; // Keep max 2
      }
      return [...prev, bookId];
    });
  };

  const executeComparison = async () => {
    if (selectedForComparison.length < 2) return;
    setLoadingComparison(true);
    setComparisonDossier(null);
    try {
      const response = await ApiClient.post(
        `/books/compare?book_id_a=${selectedForComparison[0]}&book_id_b=${selectedForComparison[1]}`,
        {}
      );
      setComparisonDossier(response.comparison);
    } catch (err: any) {
      setError(err.message || "Failed to generate comparison dossier.");
    } finally {
      setLoadingComparison(false);
    }
  };

  return (
    <div className="space-y-8 pb-16">
      
      {/* Top Banner Navigation Row */}
      <div className="border-b border-white/5 pb-4 flex justify-between items-center flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <BookMarked className="w-8 h-8 text-emerald-400" />
          <span className="text-xl font-black tracking-wider text-white">
            BOOKFINDER<span className="text-emerald-400">.AI</span>
          </span>
        </div>
        <div className="flex gap-4 text-xs font-semibold text-zinc-400">
          <span className="text-emerald-400 border-b border-emerald-400 pb-1">Search Engine</span>
          <span className="hover:text-white cursor-pointer transition">Buyback Program</span>
          <span className="hover:text-white cursor-pointer transition">User Preferences</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Form (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card border border-white/5 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            
            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2 border-b border-white/5 pb-3">
              <Sparkles className="w-5 h-5 text-emerald-400" />
              Compare & Discover Books
            </h2>

            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Title */}
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Book Title</label>
                  <input 
                    type="text" 
                    value={titleQuery}
                    onChange={(e) => setTitleQuery(e.target.value)}
                    placeholder="e.g. Atomic Habits" 
                    className="w-full glass-input text-sm"
                  />
                </div>
                {/* Author */}
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Author Name</label>
                  <input 
                    type="text" 
                    value={authorQuery}
                    onChange={(e) => setAuthorQuery(e.target.value)}
                    placeholder="e.g. James Clear" 
                    className="w-full glass-input text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* ISBN */}
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">ISBN Code</label>
                  <input 
                    type="text" 
                    value={isbnQuery}
                    onChange={(e) => setIsbnQuery(e.target.value)}
                    placeholder="e.g. 9780062316097" 
                    className="w-full glass-input text-sm font-mono"
                  />
                </div>
                {/* Language */}
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Language</label>
                  <select 
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full glass-input text-sm text-zinc-300 outline-none cursor-pointer"
                  >
                    <option value="Any">Any Language</option>
                    <option value="English">English</option>
                    <option value="Spanish">Spanish</option>
                    <option value="German">German</option>
                  </select>
                </div>
              </div>

              {/* Search Type Radios */}
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">AI Search Mode</label>
                <div className="flex gap-4">
                  {[
                    { id: "hybrid", name: "Hybrid Search (RRF)" },
                    { id: "semantic", name: "Semantic Search (AI)" },
                    { id: "keyword", name: "Keyword Search (BM25)" }
                  ].map((mode) => (
                    <label key={mode.id} className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
                      <input 
                        type="radio" 
                        name="search_type" 
                        value={mode.id}
                        checked={searchType === mode.id}
                        onChange={() => setSearchType(mode.id as any)}
                        className="accent-emerald-400"
                      />
                      <span>{mode.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Genres Multiselect */}
              <div>
                <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Genres</label>
                <div className="flex flex-wrap gap-2 max-h-[85px] overflow-y-auto p-1 border border-white/5 rounded-xl bg-white/2">
                  {availableGenres.map((genre) => (
                    <button
                      key={genre}
                      type="button"
                      onClick={() => toggleGenre(genre)}
                      className={`px-3 py-1 text-xs rounded-lg border transition ${
                        selectedGenres.includes(genre)
                          ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 font-semibold"
                          : "border-white/5 bg-white/3 text-zinc-400 hover:bg-white/5"
                      }`}
                    >
                      {genre}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sliders */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex justify-between">
                    <span>Min Rating</span>
                    <span className="text-emerald-400 font-bold">{minRating === 0 ? "All" : `${minRating}+`}</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="5"
                    step="0.5"
                    value={minRating}
                    onChange={(e) => setMinRating(parseFloat(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex justify-between">
                    <span>Max Pages</span>
                    <span className="text-emerald-400 font-bold">{maxPages === 1000 ? "Any" : `< ${maxPages}`}</span>
                  </label>
                  <input
                    type="range"
                    min="100"
                    max="1000"
                    step="50"
                    value={maxPages}
                    onChange={(e) => setMaxPages(parseInt(e.target.value))}
                    className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 justify-end pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-5 py-2.5 rounded-xl border border-white/5 text-zinc-400 hover:text-white hover:bg-white/5 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset Fields
                </button>
                <button
                  type="button"
                  onClick={() => handleSearch()}
                  disabled={searching}
                  className="px-6 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-semibold shadow-lg shadow-emerald-500/10 flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                >
                  {searching ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  ) : (
                    <SearchIcon className="w-3.5 h-3.5" />
                  )}
                  Find Book Comparison
                </button>
              </div>

            </div>

          </div>
        </div>

        {/* Right Column: History (1/3 width) */}
        <div className="space-y-6">
          {/* Recent Searches */}
          <div className="glass-card border border-white/5 rounded-2xl p-5 shadow-xl">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <History className="w-4 h-4 text-emerald-400" />
              Your Recent Searches
            </h3>
            {recentSearches.length > 0 ? (
              <div className="space-y-2">
                {recentSearches.map((qs, i) => (
                  <button
                    key={i}
                    onClick={() => handleSelectRecent(qs)}
                    className="w-full p-3 text-left bg-white/3 hover:bg-white/5 rounded-xl border border-white/5 text-xs text-zinc-300 hover:text-white transition flex items-center justify-between group cursor-pointer"
                  >
                    <span className="truncate pr-2">{qs}</span>
                    <span className="text-[10px] text-zinc-500 group-hover:text-emerald-400 flex items-center gap-0.5 shrink-0">
                      Query
                      <CheckSquare className="w-3 h-3 ml-1" />
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-650 text-xs border border-dashed border-white/5 rounded-xl">
                No recent searches. Try submitting queries!
              </div>
            )}
          </div>

          {/* Quick Help */}
          <div className="glass-card border border-white/5 rounded-2xl p-5 shadow-xl">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-emerald-400" />
              Find Books With Just One Search
            </h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Our hybrid comparison search engine leverages both BM25 keywords and Vector Semantic space. 
              Search results rank matching items side-by-side, helping you compare structures, target difficulty, and read community consensuses.
            </p>
          </div>
        </div>

      </div>

      {/* Spell Checker Suggestion */}
      {spellCorrected && (
        <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 text-xs text-zinc-300 flex items-center gap-2 max-w-xl">
          <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>Did you mean:</span>
          <button
            onClick={() => handleSelectRecent(spellCorrected)}
            className="text-indigo-400 hover:underline font-bold italic"
          >
            {spellCorrected}
          </button>
        </div>
      )}

      {/* Comparative Drawer floating activator */}
      {selectedForComparison.length === 2 && (
        <div className="fixed bottom-6 right-6 z-40 bg-zinc-900/90 border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center gap-4 animate-in fade-in slide-in-from-bottom-5">
          <div className="text-xs text-zinc-300">
            Compare <span className="text-emerald-400 font-bold">2 Selected Books</span> side-by-side
          </div>
          <button
            onClick={executeComparison}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition shadow-lg shadow-emerald-500/20 cursor-pointer flex items-center gap-1.5"
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            Compare Now
          </button>
        </div>
      )}

      {/* Comparison Modal Overlay */}
      {(loadingComparison || comparisonDossier) && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="glass-card w-full max-w-3xl rounded-2xl border border-white/10 shadow-2xl relative p-8 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => { setComparisonDossier(null); setLoadingComparison(false); }}
              className="absolute right-4 top-4 p-2 text-zinc-400 hover:text-white rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-emerald-400 animate-pulse" />
              AI Comparative Dossier
            </h3>

            {loadingComparison ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3 text-zinc-400">
                <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                <span className="text-xs font-medium">Drafting comparative analysis details...</span>
              </div>
            ) : (
              <div className="prose prose-invert text-zinc-300 text-sm max-w-none whitespace-pre-line leading-relaxed scrollbar-thin">
                {comparisonDossier}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Results Area */}
      <div className="space-y-4">
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">
            {error}
          </div>
        )}
        {results.length > 0 && (
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Search Results ({results.length})</h3>
            <p className="text-xs text-zinc-500">Check exactly 2 books to activate side-by-side comparison dossier</p>
          </div>
        )}

        {results.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {results.map((hit) => {
              const book = hit.book;
              const isChecked = selectedForComparison.includes(book.id);
              return (
                <div 
                  key={book.id} 
                  className={`group glass-card rounded-2xl p-4 flex flex-col justify-between border transition duration-300 ${
                    isChecked ? "border-emerald-500 bg-emerald-500/2" : "border-white/5 hover:border-white/10"
                  }`}
                >
                  <div>
                    {/* Cover Frame */}
                    <div className="aspect-[2/3] w-full overflow-hidden rounded-xl shadow-lg relative mb-4">
                      <img
                        src={book.cover_url || "https://placehold.co/150x225?text=No+Cover"}
                        alt={book.title}
                        className="w-full h-full object-cover transition duration-500 group-hover:scale-103"
                      />
                      
                      {/* Checkbox Overlay for Comparison */}
                      <button
                        onClick={() => handleCheckboxCompare(book.id)}
                        className={`absolute top-3 left-3 p-1.5 rounded-lg border transition ${
                          isChecked 
                            ? "bg-emerald-500 border-emerald-400 text-white" 
                            : "bg-black/60 border-white/10 text-zinc-400 hover:text-white"
                        }`}
                      >
                        <ArrowRightLeft className="w-3.5 h-3.5" />
                      </button>

                      {/* Rank Score Badge */}
                      <div className="absolute top-3 right-3 px-2 py-1 rounded-lg bg-black/60 backdrop-blur border border-white/5 text-[9px] font-bold text-emerald-400 flex items-center gap-1">
                        <Layers className="w-3 h-3 text-emerald-400" />
                        <span>RRF: {hit.score.toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Meta Info */}
                    <h3 className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition-colors mb-0.5">
                      {book.title}
                    </h3>
                    <p className="text-[11px] text-zinc-400 truncate mb-3">
                      by {book.author?.name || "Unknown Author"}
                    </p>

                    {/* Genres */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {book.genres?.slice(0, 3).map((g) => (
                        <span
                          key={g.name}
                          className="px-2 py-0.5 rounded bg-white/4 text-[8px] font-semibold text-zinc-400 uppercase tracking-wider"
                        >
                          {g.name}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Footer link & metrics */}
                  <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-2 text-[10px] text-zinc-500">
                    <div className="flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-zinc-650" />
                      <span>{book.pages || "???"} pgs</span>
                    </div>
                    <div className="flex items-center gap-1 text-yellow-500 font-semibold">
                      <Star className="w-3 h-3 fill-yellow-500/10" />
                      <span>{book.rating || "New"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 text-zinc-600 text-sm border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center gap-3">
            <SearchIcon className="w-10 h-10 text-zinc-700 animate-pulse" />
            <div className="space-y-1">
              <p className="font-semibold text-zinc-400">Search Catalogue</p>
              <p className="text-xs text-zinc-600 max-w-sm">Enter search parameters above to discover books and compile dossiers</p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
