import React, { useState } from "react";
import { Link } from "react-router-dom";
import ApiClient from "../services/api";
import { Search as SearchIcon, Filter, Star, BookOpen, Layers, Info } from "lucide-react";

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

const Search: React.FC = () => {
  const [query, setQuery] = useState<string>("");
  const [searchType, setSearchType] = useState<"keyword" | "semantic" | "hybrid">("hybrid");
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [minRating, setMinRating] = useState<number>(0);
  const [maxPages, setMaxPages] = useState<number>(1000);
  
  const [results, setResults] = useState<SearchHit[]>([]);
  const [spellCorrected, setSpellCorrected] = useState<string | null>(null);
  const [totalHits, setTotalHits] = useState<number>(0);
  const [searching, setSearching] = useState<boolean>(false);
  const [showFilters, setShowFilters] = useState<boolean>(false);

  const availableGenres = ["Self-Help", "Business", "Tech", "Psychology", "Fantasy", "Sci-Fi", "History", "Biography", "Mystery", "Fiction", "Education"];

  const handleSearch = async (searchQuery: string = query) => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSpellCorrected(null);

    try {
      const payload = {
        query: searchQuery,
        search_type: searchType,
        genres: selectedGenres.length > 0 ? selectedGenres : null,
        min_rating: minRating > 0 ? minRating : null,
        max_pages: maxPages < 1000 ? maxPages : null,
        page: 1,
        page_size: 12
      };

      const response = await ApiClient.post("/search/", payload);
      setResults(response.results);
      setTotalHits(response.total);
      setSpellCorrected(response.spell_corrected_query);
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setSearching(false);
    }
  };

  const handleGenreToggle = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const handleSuggestedSearch = (corrected: string) => {
    setQuery(corrected);
    handleSearch(corrected);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Search Header */}
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">Search Engine</h1>
        <p className="text-zinc-500 text-sm">Query the catalog using keyword searches, dense semantic embeddings, or reciprocal rank fusion (RRF)</p>
      </div>

      {/* Main Search Panel */}
      <div className="flex flex-col gap-4">
        {/* Input & Search Type Selector */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3.5 top-3.5 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="e.g. books about building focus and overcoming distractions"
              className="glass-input w-full pl-10 text-sm py-3"
            />
            {searching && (
              <div className="absolute right-3.5 top-3.5 w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            )}
          </div>
          <div className="flex gap-2">
            <select
              value={searchType}
              onChange={(e: any) => setSearchType(e.target.value)}
              className="glass-input text-xs font-semibold bg-zinc-900 border border-white/5 outline-none rounded-lg px-3 py-2 cursor-pointer text-zinc-300"
            >
              <option value="hybrid">Hybrid Search (RRF)</option>
              <option value="semantic">Semantic Search (AI)</option>
              <option value="keyword">Keyword Search (BM25)</option>
            </select>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`glass-card hover:bg-white/5 border border-white/5 px-4 py-2.5 rounded-lg flex items-center gap-2 text-xs font-semibold transition-colors ${
                showFilters ? "border-primary/40 text-primary" : "text-zinc-300"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
            </button>
            <button
              onClick={() => handleSearch()}
              className="bg-primary hover:bg-emerald-600 text-white font-semibold px-6 py-2.5 rounded-lg text-xs shadow-lg shadow-primary/10 transition-colors"
            >
              Search
            </button>
          </div>
        </div>

        {/* Explainers banner */}
        <div className="p-3 bg-zinc-900/40 border border-white/4 rounded-lg flex items-start gap-2.5 text-[10px] text-zinc-500">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span>
            {searchType === "hybrid" && "Hybrid: Blends BM25 keyword matching with sentence-transformer embeddings via Reciprocal Rank Fusion, boosted by book ratings."}
            {searchType === "semantic" && "Semantic: Encodes your query into a dense vector using all-MiniLM-L6-v2 and computes cosine similarity. Doesn't require keyword matches!"}
            {searchType === "keyword" && "Keyword: Standard BM25 term frequency-inverse document frequency scoring across titles, author names, and descriptions."}
          </span>
        </div>

        {/* Typo suggestion */}
        {spellCorrected && spellCorrected.toLowerCase() !== query.trim().toLowerCase() && (
          <div className="text-xs text-zinc-400 flex items-center gap-1">
            <span>Did you mean:</span>
            <button
              onClick={() => handleSuggestedSearch(spellCorrected)}
              className="text-primary font-bold hover:underline italic"
            >
              {spellCorrected}
            </button>
          </div>
        )}
      </div>

      {/* Grid: Layout (Filters sidebar + Results) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Filters Panel (Collapsible on mobile) */}
        {showFilters && (
          <div className="glass-card rounded-xl p-5 border border-white/5 space-y-6 h-fit lg:col-span-1">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Search Filters</h3>

            {/* Genres */}
            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Genres</label>
              <div className="flex flex-wrap lg:flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                {availableGenres.map((genre) => (
                  <label key={genre} className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedGenres.includes(genre)}
                      onChange={() => handleGenreToggle(genre)}
                      className="rounded border-zinc-700 bg-zinc-800 text-primary focus:ring-primary/20 accent-primary"
                    />
                    <span>{genre}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Ratings */}
            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Minimum Rating</label>
              <div className="flex gap-2">
                {[0, 3, 4, 4.5].map((val) => (
                  <button
                    key={val}
                    onClick={() => setMinRating(val)}
                    className={`flex-1 text-[10px] py-1.5 rounded border transition-colors ${
                      minRating === val
                        ? "bg-primary/10 border-primary text-primary font-semibold"
                        : "border-white/5 text-zinc-400 hover:bg-white/5"
                    }`}
                  >
                    {val === 0 ? "All" : `${val}+`}
                  </button>
                ))}
              </div>
            </div>

            {/* Page Count */}
            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex justify-between">
                <span>Max Pages</span>
                <span className="text-primary font-semibold">{maxPages === 1000 ? "Any" : `< ${maxPages}`}</span>
              </label>
              <input
                type="range"
                min="100"
                max="1000"
                step="50"
                value={maxPages}
                onChange={(e) => setMaxPages(parseInt(e.target.value))}
                className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>
          </div>
        )}

        {/* Search Results */}
        <div className={`space-y-4 ${showFilters ? "lg:col-span-3" : "lg:col-span-4"}`}>
          {/* Results Summary bar */}
          {results.length > 0 && (
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Found {totalHits} matching items</span>
            </div>
          )}

          {/* Results Grid */}
          {results.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {results.map((hit) => {
                const book = hit.book;
                return (
                  <Link
                    key={book.id}
                    to={`/books/${book.id}`}
                    className="group glass-card glass-card-hover rounded-xl p-4 flex flex-col justify-between"
                  >
                    <div>
                      {/* Image & Score Badge */}
                      <div className="aspect-[2/3] w-full overflow-hidden rounded-lg shadow-lg relative mb-4">
                        <img
                          src={book.cover_url || "https://placehold.co/150x225?text=No+Cover"}
                          alt={book.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-102"
                        />
                        {/* Match Score Badge */}
                        <div className="absolute top-2.5 right-2.5 px-2 py-1 rounded bg-black/75 backdrop-blur border border-white/5 text-[9px] font-bold text-primary flex items-center gap-1">
                          <Layers className="w-3 h-3 text-primary" />
                          <span>Score: {hit.score.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* Metadata */}
                      <h3 className="text-sm font-bold text-white truncate group-hover:text-primary transition-colors mb-0.5">
                        {book.title}
                      </h3>
                      <p className="text-[11px] text-zinc-400 truncate mb-2">
                        by {book.author?.name || "Unknown Author"}
                      </p>

                      {/* Genres tags */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {book.genres?.slice(0, 3).map((g) => (
                          <span
                            key={g.name}
                            className="px-2 py-0.5 rounded-full bg-white/4 text-[8px] font-semibold text-zinc-400"
                          >
                            {g.name}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Stats footer */}
                    <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-2 text-[10px] text-zinc-500">
                      <div className="flex items-center gap-1">
                        <BookOpen className="w-3.5 h-3.5 text-zinc-650" />
                        <span>{book.pages || "???"} pages</span>
                      </div>
                      <div className="flex items-center gap-1 text-yellow-500 font-semibold">
                        <Star className="w-3 h-3 fill-yellow-500/10" />
                        <span>{book.rating || "New"}</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-20 text-zinc-600 text-sm border border-dashed border-white/5 rounded-xl flex flex-col items-center justify-center gap-3">
              <SearchIcon className="w-10 h-10 text-zinc-700 animate-pulse" />
              <div className="space-y-1">
                <p className="font-semibold text-zinc-400">No search results</p>
                <p className="text-xs text-zinc-600 max-w-sm">Enter a search query above to filter books using hybrid search mechanisms</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Search;
