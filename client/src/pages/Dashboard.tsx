import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ApiClient from "../services/api";
import { 
  Flame, Trophy, Award, RefreshCw, 
  Search, Sparkles, Clock, Star, Compass, ChevronRight 
} from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip } from "recharts";
import { useAuth } from "../context/AuthContext";

interface Book {
  id: number;
  title: string;
  cover_url: string;
  rating: number;
  pages: number;
  author?: { name: string };
  genres?: { name: string }[];
}

interface Analytics {
  total_books_read: number;
  total_pages_read: number;
  average_rating: number;
  genre_distribution: { genre: string; count: number }[];
  monthly_activity: { month: string; count: number }[];
  reading_streak: { current_streak: number; longest_streak: number; last_activity_date: string };
}

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  interface RecommendationHit {
    book: Book;
    score: number;
    explanation: string;
  }

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendationHit[]>([]);
  const [currentlyReading, setCurrentlyReading] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [recalculating, setRecalculating] = useState<boolean>(false);

  // Quick Action States
  const [searchQuery, setSearchQuery] = useState("");
  const [aiQuestion, setAiQuestion] = useState("");

  const fetchData = async () => {
    try {
      const [analyticsData, recsData, shelfData] = await Promise.all([
        ApiClient.get("/analytics/"),
        ApiClient.get("/recommendations/"),
        ApiClient.get("/reading-lists/?status=reading")
      ]);
      setAnalytics(analyticsData);
      setRecommendations(recsData);
      setCurrentlyReading(shelfData);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      await ApiClient.post("/recommendations/recalculate", {});
      setTimeout(async () => {
        const recsData = await ApiClient.get("/recommendations/");
        setRecommendations(recsData);
        setRecalculating(false);
      }, 1500);
    } catch (err) {
      console.error("Failed to recalculate recommendations:", err);
      setRecalculating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-zinc-400">
        <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
        <p className="text-xs font-semibold tracking-wider text-zinc-500 animate-pulse">Syncing Workspace...</p>
      </div>
    );
  }

  const activityChartData = analytics?.monthly_activity || [];

  // Deterministic mock progress helper for currently reading books
  const getProgressDetails = (bookId: number, totalPages: number) => {
    const percent = Math.min(85, Math.max(15, ((bookId * 19) % 70) + 15));
    const pagesRead = Math.round((percent / 100) * (totalPages || 300));
    return { percent, pagesRead };
  };

  return (
    <div className="space-y-8 pb-16">
      
      {/* 1. Welcome Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1.5">
            Welcome back, {user?.full_name || "Reader"} 👋
          </h1>
          <p className="text-sm text-zinc-400">
            Continue your reading journey. Discover your next favorite book.
          </p>
        </div>
        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className="px-4 py-2.5 rounded-xl border border-white/5 bg-white/2 hover:bg-white/5 text-zinc-300 text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50 cursor-pointer self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${recalculating ? "animate-spin text-emerald-400" : "text-zinc-500"}`} />
          <span>{recalculating ? "Recalculating..." : "Sync AI Recommender"}</span>
        </button>
      </div>

      {/* 2. Quick Action Workspace Console */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Search Input Card */}
        <div className="glass-card border border-white/5 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-electric-blue/10 flex items-center justify-center shrink-0">
            <Search className="w-4 h-4 text-electric-blue" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && navigate(`/search?q=${encodeURIComponent(searchQuery)}`)}
            placeholder="Search Books by Title, Author, or ISBN..."
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
          />
        </div>

        {/* Ask AI Input Card */}
        <div className="glass-card border border-white/5 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
          <input
            type="text"
            value={aiQuestion}
            onChange={(e) => setAiQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && navigate(`/chat?question=${encodeURIComponent(aiQuestion)}`)}
            placeholder="Ask Aetheria anything (e.g. Recommend focus books)..."
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-zinc-500"
          />
        </div>
      </div>

      {/* 3. Main Dashboard Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column (2/3 width) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Continue Reading Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-zinc-400" />
              Continue Reading
            </h3>
            
            {currentlyReading.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentlyReading.map((item) => {
                  const book = item.book;
                  if (!book) return null;
                  const { percent, pagesRead } = getProgressDetails(book.id, book.pages);
                  return (
                    <div 
                      key={item.id} 
                      className="glass-card rounded-2xl border border-white/5 p-4 flex gap-4 hover:border-white/10 transition group"
                    >
                      <img 
                        src={book.cover_url || "https://placehold.co/80x120?text=Book"} 
                        alt={book.title} 
                        className="w-14 h-20 object-cover rounded-lg shadow-md shrink-0"
                      />
                      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                        <div>
                          <h4 className="text-xs font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                            {book.title}
                          </h4>
                          <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                            by {book.author?.name || "Unknown Author"}
                          </p>
                        </div>
                        
                        {/* Progress Bar */}
                        <div className="space-y-1.5 mt-2">
                          <div className="flex justify-between text-[9px] text-zinc-500 font-semibold">
                            <span>{pagesRead} of {book.pages || 300} pages</span>
                            <span className="text-emerald-400">{percent}%</span>
                          </div>
                          <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-emerald-400 rounded-full transition-all duration-300"
                              style={{ width: `${percent}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-10 text-zinc-600 text-xs border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 bg-white/1">
                <Compass className="w-6 h-6 text-zinc-700 animate-pulse" />
                <span>No active books on your reading list.</span>
                <Link to="/search" className="text-[10px] text-emerald-400 font-bold hover:underline mt-1">
                  Discover Books
                </Link>
              </div>
            )}
          </div>

          {/* Trending Carousel */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              Trending Now
            </h3>
            <div className="flex gap-4 overflow-x-auto pb-3 pt-1 scrollbar-thin">
              {recommendations.length > 0 ? (
                recommendations.map((hit) => {
                  const book = hit.book;
                  return (
                    <Link
                      key={book.id}
                      to={`/books/${book.id}`}
                      className="flex-none w-36 glass-card rounded-2xl border border-white/5 p-3 hover:border-white/10 hover:bg-white/2 transition group"
                    >
                      <div className="aspect-[2/3] w-full overflow-hidden rounded-xl shadow mb-3 relative">
                        <img 
                          src={book.cover_url || "https://placehold.co/100x150?text=Cover"} 
                          alt={book.title} 
                          className="w-full h-full object-cover group-hover:scale-102 transition duration-300"
                        />
                        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur border border-white/5 text-[8px] font-bold text-emerald-400">
                          {hit.score > 0 ? `${Math.round(hit.score * 100)}% Match` : "Match"}
                        </div>
                      </div>
                      <h4 className="text-xs font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                        {book.title}
                      </h4>
                      <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                        {book.author?.name || "Unknown"}
                      </p>
                    </Link>
                  );
                })
              ) : (
                <div className="w-full text-center py-10 text-zinc-650 text-xs border border-dashed border-white/5 rounded-2xl">
                  Catalog records loading...
                </div>
              )}
            </div>
          </div>

          {/* AI Recommended Grid */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Star className="w-4 h-4 text-emerald-400" />
              Recommended For You
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {recommendations.slice(0, 3).map((hit) => {
                const book = hit.book;
                return (
                  <Link
                    key={book.id}
                    to={`/books/${book.id}`}
                    className="glass-card rounded-2xl border border-white/5 p-3 hover:border-white/10 hover:bg-white/2 transition group flex flex-col justify-between"
                  >
                    <div>
                      <div className="aspect-[2/3] w-full overflow-hidden rounded-xl shadow mb-3 relative">
                        <img 
                          src={book.cover_url || "https://placehold.co/100x150?text=Cover"} 
                          alt={book.title} 
                          className="w-full h-full object-cover group-hover:scale-102 transition duration-300"
                        />
                      </div>
                      <h4 className="text-xs font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                        {book.title}
                      </h4>
                      <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                        by {book.author?.name || "Unknown"}
                      </p>
                      {hit.explanation && (
                        <p className="text-[9px] text-emerald-400/90 italic font-semibold mt-1.5 truncate">
                          {hit.explanation}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-white/5 text-[9px] text-zinc-500 font-semibold">
                      <span className="flex items-center gap-0.5 text-yellow-500">
                        <Star className="w-3 h-3 fill-yellow-500/10" />
                        {book.rating || "New"}
                      </span>
                      <span className="flex items-center gap-1 hover:text-white transition">
                        Details <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

        </div>

        {/* Right Column: Analytics & Goals (1/3 width) */}
        <div className="space-y-8">
          
          {/* Streak & Pages Read stats */}
          <div className="glass-card border border-white/5 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Reading Analytics</h3>
            <div className="grid grid-cols-2 gap-3">
              {/* Streak */}
              <div className="bg-white/2 border border-white/5 rounded-xl p-3 flex flex-col justify-between">
                <Flame className="w-5 h-5 text-orange-500 mb-2" />
                <div>
                  <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block">Streak</span>
                  <span className="text-lg font-extrabold text-white mt-0.5 block">
                    {analytics?.reading_streak.current_streak || 0} <span className="text-xs font-normal text-zinc-500">days</span>
                  </span>
                </div>
              </div>
              {/* Pages */}
              <div className="bg-white/2 border border-white/5 rounded-xl p-3 flex flex-col justify-between">
                <Trophy className="w-5 h-5 text-emerald-400 mb-2" />
                <div>
                  <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider block">Pages Read</span>
                  <span className="text-lg font-extrabold text-white mt-0.5 block">
                    {analytics?.total_pages_read || 0} <span className="text-xs font-normal text-zinc-500">pgs</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Velocity chart */}
            <div className="h-44 w-full mt-4">
              {activityChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={activityChartData}>
                    <XAxis dataKey="month" stroke="#52525b" fontSize={9} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: "#09090b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px" }}
                      labelStyle={{ color: "#fafafa", fontSize: "10px" }}
                      itemStyle={{ fontSize: "10px" }}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[3, 3, 0, 0]} maxBarSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-zinc-650 text-[10px]">
                  No velocity data populated.
                </div>
              )}
            </div>
          </div>

          {/* Daily Goal Progress (SVG Ring) */}
          <div className="glass-card border border-white/5 rounded-2xl p-5 flex flex-col items-center justify-between text-center gap-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider self-start">Reading Goal</h3>
            
            <div className="relative w-24 h-24 flex items-center justify-center">
              {/* SVG circular track */}
              <svg className="w-full h-full transform -rotate-90">
                <circle cx="48" cy="48" r="40" stroke="rgba(255,255,255,0.04)" strokeWidth="6" fill="transparent" />
                <circle 
                  cx="48" 
                  cy="48" 
                  r="40" 
                  stroke="#10b981" 
                  strokeWidth="6" 
                  fill="transparent" 
                  strokeDasharray="251.2"
                  strokeDashoffset="83.7" // Simulated 66% completed
                  strokeLinecap="round"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-lg font-black text-white">20</span>
                <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">of 30 min</span>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-xs font-bold text-white">Daily Target: 30 minutes</p>
              <p className="text-[10px] text-zinc-500">Read 10 more minutes to hit your streak target today!</p>
            </div>
          </div>

          {/* Achievements badge list */}
          <div className="glass-card border border-white/5 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-4 h-4 text-emerald-400" />
              Achievements
            </h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 flex items-center justify-center shrink-0">
                  <Flame className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">Consummate Reader</p>
                  <p className="text-[9px] text-zinc-500">Complete 3 consecutive streak days</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                  <Trophy className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">Pages Pioneer</p>
                  <p className="text-[9px] text-zinc-500">Exceed 1,000 completed reading pages</p>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
