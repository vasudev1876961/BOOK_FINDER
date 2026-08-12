import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ApiClient from "../services/api";
import { useAuth } from "../context/AuthContext";
import { 
  Star, Heart, BookOpen, Calendar, Hash, Globe, 
  Send, Sparkles, AlertCircle, RefreshCw, Layers, Check, X 
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
  rating: number;
  rating_count: number;
  author?: { name: string; bio: string | null };
  publisher?: { name: string };
  genres?: { name: string }[];
}

interface Review {
  id: number;
  rating: number;
  review_text: string | null;
  created_at: string;
  user_name: string;
}

export default function BookDetails() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  
  const [book, setBook] = useState<Book | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [similarBooks, setSimilarBooks] = useState<Book[]>([]);
  const [shelfStatus, setShelfStatus] = useState<string>("none");
  const [isFavorited, setIsFavorited] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Tabs
  const [activeTab, setActiveTab] = useState<"overview" | "summary" | "librarian" | "reviews" | "sentiment">("overview");

  // AI states
  const [aiSummary, setAiSummary] = useState<string>("");
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false);
  const [aiSentiment, setAiSentiment] = useState<string>("");
  const [loadingSentiment, setLoadingSentiment] = useState<boolean>(false);

  // Chat/Librarian state
  const [chatInput, setChatInput] = useState<string>("");
  const [chatLog, setChatLog] = useState<{ q: string; a: string }[]>([]);
  const [chatting, setChatting] = useState<boolean>(false);

  // Review Form state
  const [formRating, setFormRating] = useState<number>(5);
  const [formText, setFormText] = useState<string>("");
  const [reviewError, setReviewError] = useState<string>("");
  const [submittingReview, setSubmittingReview] = useState<boolean>(false);

  const fetchBookDetails = async () => {
    try {
      const bookData = await ApiClient.get(`/books/${id}`);
      setBook(bookData);

      // Fetch reviews
      const reviewsData = await ApiClient.get(`/reviews/book/${id}`);
      setReviews(reviewsData);

      // Fetch similar recommendations
      const recs = await ApiClient.get("/recommendations/");
      setSimilarBooks(recs.filter((b: Book) => b.id !== bookData.id).slice(0, 4));

      // Fetch user relations
      if (user) {
        const listData = await ApiClient.get("/reading-lists/");
        const activeItem = listData.find((item: any) => item.book_id === bookData.id);
        if (activeItem) {
          setShelfStatus(activeItem.status);
        }

        const favsData = await ApiClient.get("/reading-lists/favorites");
        setIsFavorited(favsData.some((f: any) => f.id === bookData.id));
      }
    } catch (err) {
      console.error("Failed to fetch book details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookDetails();
    // Reset tab and states on ID change
    setActiveTab("overview");
    setAiSummary("");
    setAiSentiment("");
    setChatLog([]);
  }, [id, user]);

  const loadAiSummary = async () => {
    if (aiSummary || loadingSummary) return;
    setLoadingSummary(true);
    try {
      const data = await ApiClient.get(`/books/${id}/ai-summary`);
      setAiSummary(data.summary);
    } catch (err) {
      console.error("Summary failed:", err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const loadAiSentiment = async () => {
    if (aiSentiment || loadingSentiment) return;
    setLoadingSentiment(true);
    try {
      const data = await ApiClient.get(`/reviews/book/${id}/sentiment`);
      setAiSentiment(data.sentiment_report);
    } catch (err) {
      console.error("Sentiment consensus failed:", err);
    } finally {
      setLoadingSentiment(false);
    }
  };

  // Trigger lazy loading on tab switches
  useEffect(() => {
    if (activeTab === "summary") {
      loadAiSummary();
    } else if (activeTab === "sentiment") {
      loadAiSentiment();
    }
  }, [activeTab]);

  const handleShelfChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const nextStatus = e.target.value;
    setShelfStatus(nextStatus);
    try {
      await ApiClient.post(`/reading-lists/${id}?status=${nextStatus}`, {});
    } catch (err) {
      console.error("Failed to update reading status:", err);
    }
  };

  const handleToggleFavorite = async () => {
    const nextVal = !isFavorited;
    setIsFavorited(nextVal);
    try {
      await ApiClient.post(`/reading-lists/${id}/favorite`, {});
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
      setIsFavorited(!nextVal);
    }
  };

  const handleChatSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || chatting) return;

    const queryText = chatInput;
    setChatInput("");
    setChatLog((prev) => [...prev, { q: queryText, a: "Thinking..." }]);
    setChatting(true);

    try {
      const data = await ApiClient.post(`/books/${id}/chat?question=${encodeURIComponent(queryText)}`, {});
      setChatLog((prev) => {
        const updated = [...prev];
        updated[updated.length - 1].a = data.answer;
        return updated;
      });
    } catch (err) {
      console.error("Chat error:", err);
      setChatLog((prev) => {
        const updated = [...prev];
        updated[updated.length - 1].a = "Failed to communicate with librarian. Please try again.";
        return updated;
      });
    } finally {
      setChatting(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewError("");
    setSubmittingReview(true);

    try {
      await ApiClient.post("/reviews/", {
        book_id: Number(id),
        rating: formRating,
        review_text: formText
      });

      const reviewsData = await ApiClient.get(`/reviews/book/${id}`);
      setReviews(reviewsData);

      const bookData = await ApiClient.get(`/books/${id}`);
      setBook(bookData);

      setFormText("");
      setAiSentiment(""); // Reset so they can reload fresh consensus
    } catch (err: any) {
      setReviewError(err.message || "Failed to submit review.");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-zinc-400">
        <div className="w-10 h-10 border-2 border-primary/20 border-t-primary rounded-full animate-spin mb-4"></div>
        <p className="text-xs font-semibold tracking-wider text-zinc-500 animate-pulse">Drafting book dossier...</p>
      </div>
    );
  }

  if (!book) {
    return (
      <div className="text-center py-20 text-zinc-400">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="font-bold">Book Not Found</p>
        <Link to="/search" className="text-primary hover:underline text-sm mt-4 inline-block">
          Return to search
        </Link>
      </div>
    );
  }

  // Calculate difficulty & reading time dynamically
  const pages = book.pages || 300;
  const difficulty = pages > 500 ? "Advanced" : pages > 250 ? "Intermediate" : "Beginner";
  const readingTimeHours = Math.max(1, Math.round((pages * 1.5) / 60));

  // Basic prose pros & cons parser
  const getProsConsList = (text: string) => {
    const pros: string[] = [];
    const cons: string[] = [];
    if (!text) return { pros, cons };

    const lines = text.split("\n");
    lines.forEach(line => {
      const cleanLine = line.replace(/^[-+*]\s*/, "").trim();
      if (!cleanLine) return;
      if (cleanLine.toLowerCase().includes("pro:") || cleanLine.toLowerCase().startsWith("praise:") || cleanLine.toLowerCase().includes("strength")) {
        pros.push(cleanLine.replace(/^(pro:|praise:)\s*/i, ""));
      } else if (cleanLine.toLowerCase().includes("con:") || cleanLine.toLowerCase().startsWith("critic:") || cleanLine.toLowerCase().includes("weakness")) {
        cons.push(cleanLine.replace(/^(con:|critic:)\s*/i, ""));
      } else {
        // Fallback distribution
        if (pros.length <= cons.length) {
          pros.push(cleanLine);
        } else {
          cons.push(cleanLine);
        }
      }
    });

    return { pros: pros.slice(0, 4), cons: cons.slice(0, 4) };
  };

  const parsedConsensus = getProsConsList(aiSentiment);

  return (
    <div className="space-y-8 pb-16">
      
      {/* Breadcrumb row */}
      <div className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wider flex items-center gap-2">
        <Link to="/" className="hover:text-white transition">Dashboard</Link>
        <span>/</span>
        <Link to="/search" className="hover:text-white transition">Search</Link>
        <span>/</span>
        <span className="text-zinc-300 truncate max-w-xs">{book.title}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Left Column: Cover art, metrics, and shelves */}
        <div className="space-y-6">
          <div className="aspect-[2/3] w-full max-w-[260px] mx-auto overflow-hidden rounded-2xl border border-white/5 shadow-2xl relative">
            <img
              src={book.cover_url || "https://placehold.co/300x450?text=No+Cover"}
              alt={book.title}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="glass-card rounded-2xl p-5 border border-white/5 space-y-5">
            {/* Title block */}
            <div className="text-center pb-4 border-b border-white/5">
              <h2 className="text-md font-bold text-white leading-tight">{book.title}</h2>
              <p className="text-xs text-emerald-400 font-semibold mt-1">
                by {book.author?.name || "Unknown Author"}
              </p>
              
              {/* Star Rating */}
              <div className="flex justify-center items-center gap-1.5 mt-3">
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((starVal) => (
                    <Star 
                      key={starVal} 
                      className={`w-3.5 h-3.5 ${
                        Math.round(book.rating) >= starVal 
                          ? "text-yellow-500 fill-yellow-500/10" 
                          : "text-zinc-700"
                      }`} 
                    />
                  ))}
                </div>
                <span className="text-[10px] text-zinc-500 font-semibold">({book.rating_count} reviews)</span>
              </div>
            </div>

            {/* Shelf Selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider block">Shelving Status</label>
              <select
                value={shelfStatus}
                onChange={handleShelfChange}
                className="glass-input w-full bg-zinc-900 border border-white/5 outline-none text-xs py-2.5 cursor-pointer text-zinc-300 font-semibold"
              >
                <option value="none">Not Shelved</option>
                <option value="want_to_read">Want to Read</option>
                <option value="reading">Currently Reading</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {/* Favorite heart button */}
            <button
              onClick={handleToggleFavorite}
              className={`w-full py-2.5 rounded-xl border font-bold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                isFavorited
                  ? "bg-red-500/10 border-red-500/20 text-red-400"
                  : "border-white/5 text-zinc-400 hover:bg-white/5"
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavorited ? "fill-red-500 text-red-400" : ""}`} />
              <span>{isFavorited ? "In Favorites" : "Add to Favorites"}</span>
            </button>
          </div>
        </div>

        {/* Right Column: AI details tabs */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Tabs header bar */}
          <div className="flex border-b border-white/5 overflow-x-auto gap-2">
            {[
              { id: "overview", label: "Overview" },
              { id: "summary", label: "AI Summary", premium: true },
              { id: "librarian", label: "Chat with Book", premium: true },
              { id: "sentiment", label: "Consensus Feedback", premium: true },
              { id: "reviews", label: "User Reviews" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-3 px-3 text-xs font-semibold border-b-2 transition whitespace-nowrap outline-none flex items-center gap-1.5 cursor-pointer ${
                  activeTab === tab.id
                    ? "border-emerald-500 text-emerald-400"
                    : "border-transparent text-zinc-400 hover:text-white"
                }`}
              >
                {tab.premium && <Sparkles className="w-3 h-3 text-emerald-400" />}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab contents grid */}
          <div className="min-h-[320px]">
            
            {/* Overview tab */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">Description</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed whitespace-pre-line">
                    {book.description || "No description loaded."}
                  </p>
                </div>

                <div className="border-t border-white/5 pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="flex items-center gap-3">
                    <Hash className="w-4 h-4 text-zinc-650" />
                    <div>
                      <span className="text-[9px] text-zinc-550 uppercase tracking-wider block font-semibold">ISBN</span>
                      <span className="text-xs text-white block mt-0.5 font-mono">{book.isbn || "N/A"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-zinc-650" />
                    <div>
                      <span className="text-[9px] text-zinc-550 uppercase tracking-wider block font-semibold">Published</span>
                      <span className="text-xs text-white block mt-0.5">{book.pub_date || "N/A"}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-4 h-4 text-zinc-650" />
                    <div>
                      <span className="text-[9px] text-zinc-550 uppercase tracking-wider block font-semibold">Pages</span>
                      <span className="text-xs text-white block mt-0.5">{book.pages || "N/A"} pgs</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-zinc-650" />
                    <div>
                      <span className="text-[9px] text-zinc-550 uppercase tracking-wider block font-semibold">Language</span>
                      <span className="text-xs text-white block mt-0.5">{book.language}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Summary tab */}
            {activeTab === "summary" && (
              <div className="space-y-6">
                {loadingSummary ? (
                  <div className="flex flex-col items-center justify-center py-16 text-zinc-500 text-xs gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                    <span>Engaging AI Synthesizer...</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Dashboard Metrics grid */}
                    <div className="grid grid-cols-3 gap-4">
                      <div className="bg-white/2 border border-white/5 rounded-xl p-3 text-center">
                        <span className="text-[9px] text-zinc-550 uppercase font-bold tracking-wider block">Estimated Read</span>
                        <span className="text-sm font-extrabold text-white mt-1 block">{readingTimeHours} hours</span>
                      </div>
                      <div className="bg-white/2 border border-white/5 rounded-xl p-3 text-center">
                        <span className="text-[9px] text-zinc-550 uppercase font-bold tracking-wider block">Target Difficulty</span>
                        <span className="text-sm font-extrabold text-white mt-1 block">{difficulty}</span>
                      </div>
                      <div className="bg-white/2 border border-white/5 rounded-xl p-3 text-center">
                        <span className="text-[9px] text-zinc-550 uppercase font-bold tracking-wider block">Target Audience</span>
                        <span className="text-xs font-bold text-emerald-400 mt-1 block truncate">Readers / Devs</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider">Elevator Pitch & Key Takeaways</h4>
                      <div className="prose prose-invert text-zinc-400 text-sm leading-relaxed whitespace-pre-line bg-white/2 border border-white/5 rounded-xl p-4">
                        {aiSummary || "No summary compiled."}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* AI Librarian Chat drawer */}
            {activeTab === "librarian" && (
              <div className="flex flex-col h-[350px] border border-white/5 rounded-2xl bg-zinc-950/40 overflow-hidden">
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                  {chatLog.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-zinc-650 text-xs gap-2">
                      <Sparkles className="w-5 h-5 text-zinc-700" />
                      <p className="font-semibold text-zinc-400">Ask this Book a Question</p>
                      <p className="max-w-xs text-zinc-550">Inquire about details, summaries, or core lessons contained inside the chapters.</p>
                    </div>
                  ) : (
                    chatLog.map((log, idx) => (
                      <div key={idx} className="space-y-2 text-xs">
                        <div className="flex justify-end">
                          <div className="bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 rounded-xl px-3 py-2 max-w-[80%]">
                            {log.q}
                          </div>
                        </div>
                        <div className="flex justify-start">
                          <div className="bg-white/3 border border-white/5 text-zinc-300 rounded-xl px-3 py-2 max-w-[85%] leading-relaxed">
                            {log.a === "Thinking..." ? (
                              <div className="flex items-center gap-2 text-zinc-500">
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                <span>Reading pages...</span>
                              </div>
                            ) : (
                              log.a
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleChatSend} className="p-3 border-t border-white/5 bg-white/2 flex gap-2">
                  <input
                    type="text"
                    required
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="e.g. What are the key rules for forming habits?"
                    className="glass-input flex-1 text-xs py-2 bg-transparent focus:ring-0 focus:border-white/10"
                  />
                  <button
                    type="submit"
                    disabled={chatting}
                    className="bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl p-2.5 flex items-center justify-center transition disabled:opacity-50 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {/* AI Review Consensus pros/cons tab */}
            {activeTab === "sentiment" && (
              <div className="space-y-4">
                {loadingSentiment ? (
                  <div className="flex flex-col items-center justify-center py-16 text-zinc-500 text-xs gap-2">
                    <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                    <span>Aggregating critiques...</span>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Pros Column */}
                      <div className="bg-emerald-500/2 border border-emerald-500/10 rounded-2xl p-4 space-y-3">
                        <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Check className="w-4 h-4" />
                          What Readers Love
                        </h4>
                        {parsedConsensus.pros.length > 0 ? (
                          <ul className="space-y-2 text-xs text-zinc-300">
                            {parsedConsensus.pros.map((p, idx) => (
                              <li key={idx} className="flex gap-2 items-start leading-relaxed">
                                <span className="text-emerald-500 font-bold shrink-0 mt-0.5">•</span>
                                <span>{p}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-[10px] text-zinc-500 italic">No praise compiled yet.</p>
                        )}
                      </div>

                      {/* Cons Column */}
                      <div className="bg-rose-500/2 border border-rose-500/10 rounded-2xl p-4 space-y-3">
                        <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                          <X className="w-4 h-4" />
                          Where It Falls Short
                        </h4>
                        {parsedConsensus.cons.length > 0 ? (
                          <ul className="space-y-2 text-xs text-zinc-300">
                            {parsedConsensus.cons.map((c, idx) => (
                              <li key={idx} className="flex gap-2 items-start leading-relaxed">
                                <span className="text-rose-500 font-bold shrink-0 mt-0.5">•</span>
                                <span>{c}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-[10px] text-zinc-500 italic">No criticisms compiled yet.</p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* User reviews tab */}
            {activeTab === "reviews" && (
              <div className="space-y-6">
                {user ? (
                  <form onSubmit={handleReviewSubmit} className="glass-card rounded-2xl p-4 border border-white/5 space-y-3">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Write Review</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400">Rating:</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setFormRating(val)}
                            className="text-zinc-500 hover:text-yellow-500 focus:outline-none transition"
                          >
                            <Star className={`w-4 h-4 ${formRating >= val ? "text-yellow-500 fill-yellow-500/10" : ""}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      required
                      rows={2}
                      placeholder="Share your experience reading this book..."
                      value={formText}
                      onChange={(e) => setFormText(e.target.value)}
                      className="glass-input w-full text-xs"
                    />
                    {reviewError && <p className="text-xs text-red-400 font-semibold">{reviewError}</p>}
                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      {submittingReview ? "Submitting..." : "Post Review"}
                    </button>
                  </form>
                ) : (
                  <p className="text-xs text-zinc-500 text-center italic py-2">Sign in to publish a review.</p>
                )}

                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">User Reviews</h4>
                  {reviews.length > 0 ? (
                    reviews.map((rev) => (
                      <div key={rev.id} className="p-3 bg-white/2 border border-white/4 rounded-xl space-y-1.5">
                        <div className="flex justify-between items-center text-[10px] text-zinc-500">
                          <span className="font-bold text-zinc-300">{rev.user_name}</span>
                          <span>{new Date(rev.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((val) => (
                            <Star key={val} className={`w-3 h-3 ${rev.rating >= val ? "text-yellow-500 fill-yellow-500/10" : "text-zinc-700"}`} />
                          ))}
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed">{rev.review_text}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-zinc-550 text-center py-4">No reviews yet. Be the first to review!</p>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* Similar Books carousel */}
          {similarBooks.length > 0 && (
            <div className="space-y-4 pt-6 border-t border-white/5">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" />
                Similar Books You May Enjoy
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {similarBooks.map((sb) => (
                  <Link
                    key={sb.id}
                    to={`/books/${sb.id}`}
                    className="glass-card rounded-2xl border border-white/5 p-3 hover:border-white/10 hover:bg-white/2 transition group flex flex-col justify-between"
                  >
                    <div>
                      <div className="aspect-[2/3] w-full overflow-hidden rounded-xl mb-2.5">
                        <img 
                          src={sb.cover_url || "https://placehold.co/100x150?text=Cover"} 
                          alt={sb.title}
                          className="w-full h-full object-cover group-hover:scale-102 transition duration-300"
                        />
                      </div>
                      <h4 className="text-[11px] font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                        {sb.title}
                      </h4>
                      <p className="text-[9px] text-zinc-500 truncate mt-0.5">
                        {sb.author?.name || "Unknown"}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
