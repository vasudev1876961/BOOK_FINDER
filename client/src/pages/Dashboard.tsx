import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import ApiClient from "../services/api";
import { BookOpen, Flame, Trophy, Award, RefreshCw, Compass, Clock, Star } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell } from "recharts";

interface Book {
  id: number;
  title: string;
  cover_url: string;
  rating: number;
  author?: { name: string };
  genres?: { name: string }[];
}

interface Analytics {
  total_books_read: number;
  total_pages_read: number;
  average_rating: number;
  genre_distribution: { genre: string; count: number }[];
  monthly_activity: { month: string; count: number }[];
  reading_streak: { current_streak: int; longest_streak: int; last_activity_date: string };
}

// Bypassing TS parameter type conflicts
type int = number;

const COLORS = ["#10b981", "#3b82f6", "#6366f1", "#a855f7", "#ec4899", "#f59e0b"];

const Dashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [recommendations, setRecommendations] = useState<Book[]>([]);
  const [currentlyReading, setCurrentlyReading] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [recalculating, setRecalculating] = useState<boolean>(false);

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
      // Fetch updated list after trigger delay
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
        <div className="relative w-12 h-12 mb-4">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20"></div>
          <div className="absolute inset-0 rounded-full border-2 border-t-primary animate-spin"></div>
        </div>
        <p className="text-sm font-medium tracking-wide">Synthesizing Analytics...</p>
      </div>
    );
  }

  // Fallback structures if analytics array is blank
  const genreChartData = analytics?.genre_distribution.slice(0, 5).map((item) => ({
    name: item.genre,
    value: item.count
  })) || [];

  const activityChartData = analytics?.monthly_activity || [];

  return (
    <div className="space-y-8 pb-10">
      {/* Welcome Block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">My Dashboard</h1>
          <p className="text-zinc-500 text-sm">Review your achievements, reading analytics, and AI recommendations</p>
        </div>
        <button
          onClick={handleRecalculate}
          disabled={recalculating}
          className="glass-card hover:bg-white/5 border border-white/5 text-zinc-300 font-semibold px-4 py-2.5 rounded-lg flex items-center gap-2.5 transition-colors disabled:opacity-50 text-xs self-start"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${recalculating ? "animate-spin text-primary" : "text-zinc-400"}`} />
          <span>{recalculating ? "Syncing..." : "Sync AI Recommender"}</span>
        </button>
      </div>

      {/* Grid: Totals Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Streak */}
        <div className="glass-card rounded-xl p-5 flex items-center gap-4 relative overflow-hidden">
          <div className="w-12 h-12 rounded-lg bg-orange-500/10 flex items-center justify-center">
            <Flame className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Reading Streak</p>
            <p className="text-xl font-bold text-white mt-0.5">
              {analytics?.reading_streak.current_streak || 0} <span className="text-xs font-normal text-zinc-400">days</span>
            </p>
            <p className="text-[10px] text-zinc-600 mt-0.5">Longest: {analytics?.reading_streak.longest_streak || 0} days</p>
          </div>
        </div>

        {/* Books Read */}
        <div className="glass-card rounded-xl p-5 flex items-center gap-4 relative overflow-hidden">
          <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Completed Books</p>
            <p className="text-xl font-bold text-white mt-0.5">
              {analytics?.total_books_read || 0} <span className="text-xs font-normal text-zinc-400">books</span>
            </p>
            <p className="text-[10px] text-zinc-650 mt-0.5">Keep reading to set new records!</p>
          </div>
        </div>

        {/* Pages Read */}
        <div className="glass-card rounded-xl p-5 flex items-center gap-4 relative overflow-hidden">
          <div className="w-12 h-12 rounded-lg bg-blue-500/10 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-blue-500" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Pages Finished</p>
            <p className="text-xl font-bold text-white mt-0.5">
              {analytics?.total_pages_read || 0} <span className="text-xs font-normal text-zinc-400">pages</span>
            </p>
            <p className="text-[10px] text-zinc-600 mt-0.5">Outstanding milestone achieved</p>
          </div>
        </div>

        {/* Average Rating */}
        <div className="glass-card rounded-xl p-5 flex items-center gap-4 relative overflow-hidden">
          <div className="w-12 h-12 rounded-lg bg-yellow-500/10 flex items-center justify-center">
            <Award className="w-6 h-6 text-yellow-500" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">My Avg Rating</p>
            <p className="text-xl font-bold text-white mt-0.5">
              {analytics?.average_rating || 0.0} <span className="text-xs font-normal text-zinc-400">/ 5.0</span>
            </p>
            <p className="text-[10px] text-zinc-600 mt-0.5">Across all reviewed books</p>
          </div>
        </div>
      </div>

      {/* Grid: Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart: Activity */}
        <div className="glass-card rounded-xl p-6 lg:col-span-2 flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-white tracking-wide uppercase">Reading Velocity</h3>
            <p className="text-xs text-zinc-500">Number of books completed month over month</p>
          </div>
          <div className="h-64 w-full">
            {activityChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={activityChartData}>
                  <XAxis dataKey="month" stroke="#52525b" fontSize={11} tickLine={false} />
                  <YAxis stroke="#52525b" fontSize={11} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px" }}
                    labelStyle={{ color: "#fafafa" }}
                  />
                  <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-600 text-xs">
                No monthly data found. Complete books to view velocity.
              </div>
            )}
          </div>
        </div>

        {/* Chart: Genres */}
        <div className="glass-card rounded-xl p-6 flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-white tracking-wide uppercase">Genre Distribution</h3>
            <p className="text-xs text-zinc-500">Categories of books completed</p>
          </div>
          <div className="h-64 w-full flex items-center justify-center">
            {genreChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genreChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {genreChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "6px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-zinc-600 text-xs text-center">
                Add books to your Completed shelf to map genre breakdowns.
              </div>
            )}
          </div>
          {genreChartData.length > 0 && (
            <div className="grid grid-cols-2 gap-2 mt-2">
              {genreChartData.map((item, idx) => (
                <div key={item.name} className="flex items-center gap-1.5 text-[10px] text-zinc-400">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                  <span className="truncate">{item.name} ({item.value})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Grid: Currently Reading & Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Currently Reading (Shelf) */}
        <div className="glass-card rounded-xl p-6 flex flex-col justify-between h-fit lg:col-span-1">
          <div className="mb-4">
            <h3 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
              <Clock className="w-4 h-4 text-zinc-400" />
              <span>Currently Reading</span>
            </h3>
            <p className="text-xs text-zinc-500">Keep up the pace on your current shelves</p>
          </div>

          <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
            {currentlyReading.length > 0 ? (
              currentlyReading.map((item) => (
                <Link
                  key={item.id}
                  to={`/books/${item.book?.id}`}
                  className="flex gap-3 p-2.5 rounded-lg bg-white/3 border border-white/3 hover:border-primary/20 transition-all group"
                >
                  <img
                    src={item.book?.cover_url || "https://placehold.co/80x120?text=Book"}
                    alt={item.book?.title}
                    className="w-12 h-18 object-cover rounded shadow"
                  />
                  <div className="flex-1 min-w-0 flex flex-col justify-center">
                    <h4 className="text-xs font-bold text-white group-hover:text-primary transition-colors truncate">
                      {item.book?.title}
                    </h4>
                    <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                      by {item.book?.author?.name || "Unknown Author"}
                    </p>
                    <p className="text-[9px] text-zinc-500 mt-2 italic capitalize">
                      Added: {new Date(item.added_at).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-8 text-zinc-600 text-xs border border-dashed border-white/5 rounded-lg flex flex-col items-center justify-center gap-2">
                <Compass className="w-6 h-6 text-zinc-700" />
                <span>No books shelf-active. Find a book to start!</span>
                <Link to="/search" className="text-[10px] text-primary font-semibold mt-2 hover:underline">
                  Browse Catalog
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* AI Recommendations */}
        <div className="glass-card rounded-xl p-6 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide uppercase flex items-center gap-2">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500/25" />
                <span>AI Recommended For You</span>
              </h3>
              <p className="text-xs text-zinc-500">Personalized matching based on habits and history</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {recommendations.length > 0 ? (
              recommendations.slice(0, 3).map((book) => (
                <Link
                  key={book.id}
                  to={`/books/${book.id}`}
                  className="group flex flex-col p-2.5 rounded-xl bg-white/2 border border-white/2 hover:border-primary/20 transition-all hover:bg-white/4"
                >
                  <div className="aspect-[2/3] w-full overflow-hidden rounded shadow-lg relative mb-3">
                    <img
                      src={book.cover_url || "https://placehold.co/120x180?text=Cover"}
                      alt={book.title}
                      className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                    />
                  </div>
                  <h4 className="text-xs font-bold text-white truncate group-hover:text-primary transition-colors">
                    {book.title}
                  </h4>
                  <p className="text-[10px] text-zinc-500 truncate mt-0.5">
                    {book.author?.name || "Unknown"}
                  </p>
                  <div className="flex items-center gap-1 mt-2 text-[9px] text-yellow-500 font-semibold">
                    <Star className="w-3 h-3 fill-yellow-500/10" />
                    <span>{book.rating || "New"}</span>
                  </div>
                </Link>
              ))
            ) : (
              <div className="col-span-3 text-center py-10 text-zinc-600 text-xs border border-dashed border-white/5 rounded-lg flex flex-col items-center justify-center gap-2">
                <span>Recommendations will appear as you build shelves and review books.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
