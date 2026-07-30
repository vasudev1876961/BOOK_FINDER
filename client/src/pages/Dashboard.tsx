import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import ApiClient from "../services/api";
import { 
  Flame, Trophy, Award, RefreshCw, 
  Search, Sparkles, Clock, Star, Compass, ChevronRight, X, Settings2, ArrowRight
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
  
  // Upgraded goals & progress
  reading_speed: number;
  daily_pages_goal: number;
  monthly_books_goal: number;
  yearly_books_goal: number;
  daily_pages_progress: number;
  monthly_books_progress: number;
  yearly_books_progress: number;
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

  // Goal & Progress Logging States
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [dailyGoalInput, setDailyGoalInput] = useState(30);
  const [monthlyGoalInput, setMonthlyGoalInput] = useState(2);
  const [yearlyGoalInput, setYearlyGoalInput] = useState(12);
  const [speedInput, setSpeedInput] = useState(1.5);
  const [logValue, setLogValue] = useState(0);

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

  // Sync inputs when analytics loads
  useEffect(() => {
    if (analytics) {
      setDailyGoalInput(analytics.daily_pages_goal);
      setMonthlyGoalInput(analytics.monthly_books_goal);
      setYearlyGoalInput(analytics.yearly_books_goal);
      setSpeedInput(analytics.reading_speed);
    }
  }, [analytics]);

  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      await ApiClient.post("/recommendations/recalculate", {});
      // Reload details
      await fetchData();
    } catch (err) {
      console.error("Recalculation error:", err);
    } finally {
      setRecalculating(false);
    }
  };

  const handleLogPages = async () => {
    if (logValue <= 0) return;
    try {
      await ApiClient.post("/analytics/log-pages", { pages: logValue });
      setLogValue(0);
      fetchData();
    } catch (err) {
      console.error("Failed to log pages:", err);
    }
  };

  const handleUpdateGoals = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await ApiClient.post("/analytics/goals", {
        daily_pages_goal: dailyGoalInput,
        monthly_books_goal: monthlyGoalInput,
        yearly_books_goal: yearlyGoalInput,
        reading_speed: speedInput
      });
      setShowGoalModal(false);
      fetchData();
    } catch (err) {
      console.error("Failed to update goals:", err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
        <div className="w-10 h-10 border-2 border-primary/20 border-t-emerald-400 rounded-full animate-spin"></div>
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

  // SVGRing Circumference calculations
  const dailyPages = analytics?.daily_pages_progress || 0;
  const dailyGoal = analytics?.daily_pages_goal || 30;
  const readSpeed = analytics?.reading_speed || 1.5;
  const readMinutes = Math.round(dailyPages / readSpeed);
  const goalMinutes = Math.round(dailyGoal / readSpeed);
  const dailyPercent = Math.min(100, Math.round((dailyPages / dailyGoal) * 100));
  const dashOffset = 251.2 - (dailyPercent / 100) * 251.2;

  return (
    <div className="space-y-8 pb-16">
      
      {/* 1. Welcome Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1.5">
            Welcome back, {user?.full_name || "Reader"} 👋
          </h1>
          <p className="text-xs text-zinc-400">Continue your reading journey. Discover your next favorite book.</p>
        </div>
        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className="px-4 py-2 text-xs font-semibold rounded-xl bg-white/3 border border-white/5 hover:bg-white/5 text-zinc-300 hover:text-white transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${recalculating ? "animate-spin" : ""}`} />
          Recalculate AI Recommendations
        </button>
      </div>

      {/* 2. Quick Action Console (AI Search & Ask Redirect inputs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="glass-card rounded-2xl border border-white/5 p-5 relative overflow-hidden group">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-400" />
            Search Catalog
          </h3>
          <div className="relative">
            <input
              type="text"
              placeholder="Search by title, author, or genre..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && navigate(`/search?q=${encodeURIComponent(searchQuery)}`)}
              className="w-full glass-input text-xs pr-10"
            />
            <button 
              onClick={() => navigate(`/search?q=${encodeURIComponent(searchQuery)}`)}
              className="absolute right-3 top-2.5 text-zinc-500 hover:text-white transition cursor-pointer"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="glass-card rounded-2xl border border-white/5 p-5 relative overflow-hidden group">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            Ask Aetheria
          </h3>
          <div className="relative">
            <input
              type="text"
              placeholder="Ask for summaries, key themes, or recommendations..."
              value={aiQuestion}
              onChange={(e) => setAiQuestion(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && navigate(`/chat?question=${encodeURIComponent(aiQuestion)}`)}
              className="w-full glass-input text-xs pr-10"
            />
            <button 
              onClick={() => navigate(`/chat?question=${encodeURIComponent(aiQuestion)}`)}
              className="absolute right-3 top-2.5 text-emerald-400 hover:text-white transition cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Shelf & Carousels (2/3 width) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Currently Reading Shelf */}
          <div className="space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              Continue Reading
            </h3>
            {currentlyReading.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentlyReading.slice(0, 4).map((item) => {
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
              <div className="text-center py-10 text-zinc-650 text-xs border border-dashed border-white/5 rounded-2xl flex flex-col items-center justify-center gap-2 bg-white/1">
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

          {/* Upgraded Goals & Logging Card */}
          <div className="glass-card border border-white/5 rounded-2xl p-5 flex flex-col items-center justify-between text-center gap-4">
            <div className="flex justify-between items-center w-full">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Reading Goals</h3>
              <button
                type="button"
                onClick={() => setShowGoalModal(true)}
                className="text-[10px] text-emerald-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
              >
                <Settings2 className="w-3 h-3" />
                Edit Goals
              </button>
            </div>
            
            <div className="relative w-24 h-24 flex items-center justify-center">
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
                  strokeDashoffset={dashOffset}
                  strokeLinecap="round"
                  className="transition-all duration-500"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center">
                <span className="text-lg font-black text-white">{dailyPages}</span>
                <span className="text-[8px] text-zinc-500 uppercase tracking-wider font-semibold">of {dailyGoal} pages</span>
              </div>
            </div>

            <div className="space-y-1 w-full text-center">
              <p className="text-xs font-bold text-white">Daily Target: {dailyGoal} pages ({goalMinutes} min)</p>
              <p className="text-[10px] text-zinc-400 block font-semibold mt-0.5">
                Completed today: {dailyPages} pages (~{readMinutes} min spent)
              </p>
              <p className="text-[10px] text-zinc-500 mt-1 block">
                {dailyPercent >= 100 
                  ? "🎉 Daily reading goal achieved! Excellent work!" 
                  : `Read ${dailyGoal - dailyPages} more pages to hit target today!`}
              </p>
            </div>

            {/* Monthly / Yearly progress bars */}
            <div className="w-full space-y-3 pt-2 text-left border-t border-white/5">
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-zinc-400 font-semibold">
                  <span>Monthly Books Goal</span>
                  <span className="text-emerald-400">
                    {analytics?.monthly_books_progress || 0} of {analytics?.monthly_books_goal || 2} completed
                  </span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-400 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, ((analytics?.monthly_books_progress || 0) / (analytics?.monthly_books_goal || 2)) * 100)}%` }}
                  ></div>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-zinc-400 font-semibold">
                  <span>Yearly Books Goal</span>
                  <span className="text-emerald-400">
                    {analytics?.yearly_books_progress || 0} of {analytics?.yearly_books_goal || 12} completed
                  </span>
                </div>
                <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-400 rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, ((analytics?.yearly_books_progress || 0) / (analytics?.yearly_books_goal || 12)) * 100)}%` }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Quick Log Form */}
            <div className="w-full pt-3 border-t border-white/5">
              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Pages read"
                  value={logValue === 0 ? "" : logValue}
                  onChange={(e) => setLogValue(parseInt(e.target.value) || 0)}
                  onKeyDown={(e) => e.key === "Enter" && handleLogPages()}
                  className="flex-1 glass-input text-xs py-1.5 text-center"
                />
                <button
                  type="button"
                  onClick={handleLogPages}
                  className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-xs font-semibold cursor-pointer shadow shadow-emerald-500/10"
                >
                  Log Pages
                </button>
              </div>
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
                  <p className="text-xs font-bold text-white truncate">Page Turner</p>
                  <p className="text-[9px] text-zinc-500">Log over 500 total read pages</p>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* 3. Goal configuration overlay modal dialog */}
      {showGoalModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="glass-card w-full max-w-md rounded-2xl border border-white/10 shadow-2xl relative p-6 animate-in zoom-in-95 duration-200 text-left">
            <button
              onClick={() => setShowGoalModal(false)}
              className="absolute right-4 top-4 p-2 text-zinc-400 hover:text-white rounded-lg transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-emerald-400" />
              Configure Reading Parameters
            </h3>

            <form onSubmit={handleUpdateGoals} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Daily Goal (pages)</label>
                <input
                  type="number"
                  required
                  value={dailyGoalInput}
                  onChange={(e) => setDailyGoalInput(parseInt(e.target.value) || 10)}
                  className="w-full glass-input text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Monthly Goal (completed books)</label>
                <input
                  type="number"
                  required
                  value={monthlyGoalInput}
                  onChange={(e) => setMonthlyGoalInput(parseInt(e.target.value) || 1)}
                  className="w-full glass-input text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Yearly Goal (completed books)</label>
                <input
                  type="number"
                  required
                  value={yearlyGoalInput}
                  onChange={(e) => setYearlyGoalInput(parseInt(e.target.value) || 1)}
                  className="w-full glass-input text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Reading Velocity (pages per minute)</label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={speedInput}
                  onChange={(e) => setSpeedInput(parseFloat(e.target.value) || 1.0)}
                  className="w-full glass-input text-xs"
                />
              </div>

              <div className="flex gap-3 justify-end pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowGoalModal(false)}
                  className="px-4 py-2 border border-white/5 hover:bg-white/5 rounded-xl text-zinc-400 hover:text-white text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold cursor-pointer shadow shadow-emerald-500/10"
                >
                  Save Adjustments
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
