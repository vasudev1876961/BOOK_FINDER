import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ApiClient from "../services/api";
import { useAuth } from "../context/AuthContext";
import { Star, Heart, BookOpen, Calendar, Hash, Globe, Send, Sparkles, AlertCircle, RefreshCw } from "lucide-react";

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

const BookDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  
  const [book, setBook] = useState<Book | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [shelfStatus, setShelfStatus] = useState<string>("none");
  const [isFavorited, setIsFavorited] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // Tabs
  const [activeTab, setActiveTab] = useState<"overview" | "summary" | "librarian" | "reviews" | "sentiment">("overview");

  // AI Summary state
  const [aiSummary, setAiSummary] = useState<string>("");
  const [loadingSummary, setLoadingSummary] = useState<boolean>(false);

  // AI Sentiment state
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

      // Fetch user specific relations if logged in
      if (user) {
        // Shelf status
        const listData = await ApiClient.get("/reading-lists/");
        const activeItem = listData.find((item: any) => item.book_id === bookData.id);
        if (activeItem) {
          setShelfStatus(activeItem.status);
        }

        // Favorite status
        const favsData = await ApiClient.get("/reading-lists/favorites");
        const isFav = favsData.some((f: any) => f.id === bookData.id);
        setIsFavorited(isFav);
      }
    } catch (err) {
      console.error("Failed to fetch book details:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookDetails();
  }, [id, user]);

  // Lazy load AI Summaries
  const loadAiSummary = async () => {
    if (aiSummary || loadingSummary) return;
    setLoadingSummary(true);
    try {
      const data = await ApiClient.get(`/books/${id}/ai-summary`);
      setAiSummary(data.summary);
    } catch (err) {
      console.error("Failed to load AI Summary:", err);
      setAiSummary("Failed to generate AI summary dossier.");
    } finally {
      setLoadingSummary(false);
    }
  };

  // Lazy load AI Sentiment
  const loadAiSentiment = async () => {
    if (aiSentiment || loadingSentiment) return;
    setLoadingSentiment(true);
    try {
      const data = await ApiClient.get(`/reviews/book/${id}/sentiment`);
      setAiSentiment(data.sentiment_report);
    } catch (err) {
      console.error("Failed to load AI Sentiment:", err);
      setAiSentiment("Failed to compile community reviews consensus.");
    } finally {
      setLoadingSentiment(false);
    }
  };

  useEffect(() => {
    if (activeTab === "summary") {
      loadAiSummary();
    } else if (activeTab === "sentiment") {
      loadAiSentiment();
    }
  }, [activeTab]);

  const handleShelfChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const statusVal = e.target.value;
    setShelfStatus(statusVal);

    try {
      if (statusVal === "none") {
        await ApiClient.delete(`/reading-lists/${id}`);
      } else {
        await ApiClient.post("/reading-lists/", { book_id: Number(id), status: statusVal });
      }
    } catch (err) {
      console.error("Failed to update shelf status:", err);
    }
  };

  const handleToggleFavorite = async () => {
    setIsFavorited(!isFavorited);
    try {
      await ApiClient.post(`/reading-lists/${id}/favorite`, {});
    } catch (err) {
      console.error("Failed to toggle favorite:", err);
      // Revert if API failed
      setIsFavorited(isFavorited);
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

      // Reload reviews and book stats
      const reviewsData = await ApiClient.get(`/reviews/book/${id}`);
      setReviews(reviewsData);

      const bookData = await ApiClient.get(`/books/${id}`);
      setBook(bookData);

      // Reset review form inputs
      setFormText("");
      // Reset lazy-loaded review sentiment report so it pulls fresh data
      setAiSentiment("");
    } catch (err: any) {
      setReviewError(err.message || "Failed to submit review.");
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-zinc-400">
        <div className="relative w-12 h-12 mb-4">
          <div className="absolute inset-0 rounded-full border-2 border-primary/20"></div>
          <div className="absolute inset-0 rounded-full border-2 border-t-primary animate-spin"></div>
        </div>
        <p className="text-sm font-medium">Assembling Book Dossier...</p>
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

  return (
    <div className="space-y-8 pb-16">
      {/* Top Breadcrumb */}
      <div className="text-xs text-zinc-500">
        <Link to="/" className="hover:text-white transition-colors">Dashboard</Link>
        <span className="mx-2">&gt;</span>
        <Link to="/search" className="hover:text-white transition-colors">Search</Link>
        <span className="mx-2">&gt;</span>
        <span className="text-zinc-300">{book.title}</span>
      </div>

      {/* Grid: Details Split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Side: Cover & Shelving controls */}
        <div className="lg:col-span-1 space-y-6">
          <div className="aspect-[2/3] w-full max-w-[280px] mx-auto overflow-hidden rounded-2xl border border-white/5 shadow-2xl relative">
            <img
              src={book.cover_url || "https://placehold.co/300x450?text=No+Cover"}
              alt={book.title}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Quick controls */}
          <div className="glass-card rounded-xl p-5 border border-white/5 space-y-4">
            {/* Title & Author */}
            <div className="text-center pb-3 border-b border-white/5">
              <h2 className="text-lg font-bold text-white leading-tight">{book.title}</h2>
              <p className="text-xs text-primary font-semibold mt-1">
                by {book.author?.name || "Unknown Author"}
              </p>
            </div>

            {/* Shelf Select */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Shelving status</label>
              <select
                value={shelfStatus}
                onChange={handleShelfChange}
                className="glass-input w-full bg-zinc-900 border border-white/5 outline-none rounded-lg text-xs py-2.5 cursor-pointer text-zinc-300 font-semibold"
              >
                <option value="none">Not Shelved</option>
                <option value="want_to_read">Want to Read</option>
                <option value="reading">Currently Reading</option>
                <option value="completed">Completed</option>
              </select>
            </div>

            {/* Favorite toggle */}
            <button
              onClick={handleToggleFavorite}
              className={`w-full py-2.5 rounded-lg border font-semibold text-xs flex items-center justify-center gap-2 transition-colors ${
                isFavorited
                  ? "bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/15"
                  : "border-white/5 text-zinc-400 hover:bg-white/5"
              }`}
            >
              <Heart className={`w-4 h-4 ${isFavorited ? "fill-red-400" : "text-zinc-400"}`} />
              <span>{isFavorited ? "In Favorites" : "Add to Favorites"}</span>
            </button>
          </div>
        </div>

        {/* Right Side: Navigation Tabs and details panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tabs */}
          <div className="flex border-b border-white/5 overflow-x-auto gap-2">
            {[
              { id: "overview", label: "Overview" },
              { id: "summary", label: "AI Summary", premium: true },
              { id: "librarian", label: "AI Librarian", premium: true },
              { id: "sentiment", label: "Review Consensus", premium: true },
              { id: "reviews", label: "Community Reviews" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-3 px-3 text-xs font-semibold tracking-wide border-b-2 transition-all whitespace-nowrap outline-none flex items-center gap-1.5 ${
                  activeTab === tab.id
                    ? "border-primary text-primary"
                    : "border-transparent text-zinc-400 hover:text-white"
                }`}
              >
                {tab.premium && <Sparkles className="w-3 h-3 text-emerald-400 fill-emerald-400/10" />}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tab Contents */}
          <div className="min-h-[300px]">
            {/* Overview */}
            {activeTab === "overview" && (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Book Description</h3>
                  <p className="text-zinc-400 text-sm leading-relaxed whitespace-pre-line">
                    {book.description || "No description available for this book."}
                  </p>
                </div>

                <div className="border-t border-white/5 pt-6 grid grid-cols-2 gap-4">
                  <div className="flex items-center gap-3">
                    <Hash className="w-4 h-4 text-zinc-650" />
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">ISBN Number</p>
                      <p className="text-xs text-white mt-0.5">{book.isbn || "Unavailable"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-zinc-650" />
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Publication Date</p>
                      <p className="text-xs text-white mt-0.5">{book.pub_date || "Unavailable"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <BookOpen className="w-4 h-4 text-zinc-650" />
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Page Count</p>
                      <p className="text-xs text-white mt-0.5">{book.pages || "Unavailable"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Globe className="w-4 h-4 text-zinc-650" />
                    <div>
                      <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Language</p>
                      <p className="text-xs text-white mt-0.5">{book.language}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Summary */}
            {activeTab === "summary" && (
              <div className="space-y-4">
                {loadingSummary ? (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-550 text-xs">
                    <RefreshCw className="w-6 h-6 animate-spin mb-3 text-primary" />
                    <span>Engaging AI Synthesizer...</span>
                  </div>
                ) : (
                  <div className="prose prose-invert max-w-none text-zinc-400 text-sm leading-relaxed space-y-4">
                    {aiSummary.split("\n\n").map((para, i) => (
                      <p key={i} className="whitespace-pre-line">
                        {para}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* AI Librarian Chat (RAG) */}
            {activeTab === "librarian" && (
              <div className="flex flex-col h-[400px] border border-white/5 rounded-xl bg-zinc-900/20 overflow-hidden">
                {/* Chat Log logs */}
                <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
                  {chatLog.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center text-zinc-600 text-xs gap-2">
                      <Sparkles className="w-6 h-6 text-zinc-700" />
                      <p className="font-semibold text-zinc-400">Chat with Aetheria Librarian</p>
                      <p className="max-w-xs text-zinc-550">Ask specific questions about the chapter layouts, key definitions, or concepts in {book.title}.</p>
                    </div>
                  ) : (
                    chatLog.map((log, idx) => (
                      <div key={idx} className="space-y-2 text-xs">
                        <div className="flex justify-end">
                          <div className="bg-primary/10 border border-primary/20 text-primary rounded-lg px-3.5 py-2 max-w-[80%] font-medium">
                            {log.q}
                          </div>
                        </div>
                        <div className="flex justify-start">
                          <div className="bg-white/4 border border-white/5 text-zinc-300 rounded-lg px-3.5 py-2.5 max-w-[90%] leading-relaxed whitespace-pre-line">
                            {log.a === "Thinking..." ? (
                              <div className="flex items-center gap-1.5 text-zinc-500">
                                <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-500" />
                                <span>Librarian is retrieving context...</span>
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

                {/* Form Input */}
                <form onSubmit={handleChatSend} className="p-3 border-t border-white/5 bg-zinc-900/40 flex gap-2">
                  <input
                    type="text"
                    required
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={`Ask the librarian about '${book.title}'...`}
                    className="glass-input flex-1 text-xs py-2 bg-transparent"
                  />
                  <button
                    type="submit"
                    disabled={chatting}
                    className="bg-primary hover:bg-emerald-600 text-white rounded-lg p-2 flex items-center justify-center transition-colors disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {/* AI Sentiment analysis */}
            {activeTab === "sentiment" && (
              <div className="space-y-4">
                {loadingSentiment ? (
                  <div className="flex flex-col items-center justify-center py-12 text-zinc-550 text-xs">
                    <RefreshCw className="w-6 h-6 animate-spin mb-3 text-primary" />
                    <span>Aggregating review parameters...</span>
                  </div>
                ) : (
                  <div className="prose prose-invert max-w-none text-zinc-400 text-sm leading-relaxed space-y-4">
                    {aiSentiment.split("\n\n").map((para, i) => (
                      <p key={i} className="whitespace-pre-line">
                        {para}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Community Reviews & Review Input form */}
            {activeTab === "reviews" && (
              <div className="space-y-8">
                {/* Submit review */}
                {user ? (
                  <form onSubmit={handleReviewSubmit} className="glass-card rounded-xl p-5 border border-white/5 space-y-4">
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Leave a Review</h4>
                    
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold text-zinc-500">Rating:</span>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((val) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setFormRating(val)}
                            className="text-zinc-500 hover:text-yellow-500 focus:outline-none transition-colors"
                          >
                            <Star className={`w-5 h-5 ${formRating >= val ? "text-yellow-500 fill-yellow-500/10" : ""}`} />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <textarea
                        required
                        rows={3}
                        placeholder="Write your review here. What did you like? What did you criticize?"
                        value={formText}
                        onChange={(e) => setFormText(e.target.value)}
                        className="glass-input w-full text-xs"
                      />
                    </div>

                    {reviewError && <p className="text-xs text-red-400 font-semibold">{reviewError}</p>}

                    <button
                      type="submit"
                      disabled={submittingReview}
                      className="bg-primary hover:bg-emerald-600 disabled:opacity-50 text-white font-semibold px-5 py-2.5 rounded-lg text-xs shadow-lg shadow-primary/10 transition-colors"
                    >
                      {submittingReview ? "Submitting..." : "Submit Review"}
                    </button>
                  </form>
                ) : (
                  <p className="text-xs text-zinc-650 text-center italic border border-dashed border-white/5 py-4 rounded-lg">
                    Please log in to write a review.
                  </p>
                )}

                {/* Reviews List */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">Community Feedback</h4>
                  {reviews.length > 0 ? (
                    reviews.map((rev) => (
                      <div key={rev.id} className="p-4 rounded-lg bg-white/2 border border-white/4 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-white">{rev.user_name}</span>
                          <span className="text-[10px] text-zinc-600">{new Date(rev.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((val) => (
                            <Star
                              key={val}
                              className={`w-3.5 h-3.5 ${
                                rev.rating >= val ? "text-yellow-500 fill-yellow-500/10" : "text-zinc-700"
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-zinc-400 leading-relaxed whitespace-pre-line mt-1">
                          {rev.review_text}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-zinc-650 text-center py-6">No reviews written for this book yet.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookDetails;
