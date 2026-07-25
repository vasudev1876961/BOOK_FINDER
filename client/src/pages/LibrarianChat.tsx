import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import ApiClient from "../services/api";
import { 
  Sparkles, Send, Loader2, BookOpen, 
  User, HelpCircle, ArrowRight 
} from "lucide-react";

interface Message {
  sender: "user" | "bot";
  text: string;
  isStreaming?: boolean;
}

interface Book {
  id: number;
  title: string;
  cover_url: string;
  rating: number;
  author?: { name: string };
}

export default function LibrarianChat() {
  const location = useLocation();
  const navigate = useNavigate();

  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "Hello! I am your Aetheria AI Librarian. Ask me anything about our book catalog, request custom recommendations, or ask for deep concepts explained!"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [allBooks, setAllBooks] = useState<Book[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const searchParams = new URLSearchParams(location.search);
  const initialQuestion = searchParams.get("question");

  const samplePrompts = [
    "Recommend a book for building long-term systems of success.",
    "Which books discuss deep focus and overcoming digital distractions?",
    "Explain the four laws of behavior change in Atomic Habits.",
    "Show me books focused on software craftsmanship."
  ];

  // Fetch book database to support inline recommendation cards matching
  useEffect(() => {
    const fetchCatalog = async () => {
      try {
        const books = await ApiClient.get("/recommendations/"); // fetches recommendation/top list as catalog preview
        setAllBooks(books);
      } catch (e) {
        // ignore
      }
    };
    fetchCatalog();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  // Handle URL redirect questions from the dashboard action console
  useEffect(() => {
    if (initialQuestion) {
      // Clear URL parameter so it doesn't refire on refresh
      navigate("/chat", { replace: true });
      handleSend(initialQuestion);
    }
  }, [initialQuestion]);

  // Simulated AI token-streaming typewriter effect
  const streamBotResponse = (fullResponseText: string) => {
    let index = 0;
    const intervalTime = 12; // speed in milliseconds
    const charsPerStep = 4; // characters printed per tick

    // Create placeholder bot message
    setMessages((prev) => [...prev, { sender: "bot", text: "", isStreaming: true }]);

    const timer = setInterval(() => {
      index += charsPerStep;
      if (index >= fullResponseText.length) {
        clearInterval(timer);
        setMessages((prev) => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg) {
            lastMsg.text = fullResponseText;
            lastMsg.isStreaming = false;
          }
          return updated;
        });
      } else {
        setMessages((prev) => {
          const updated = [...prev];
          const lastMsg = updated[updated.length - 1];
          if (lastMsg) {
            lastMsg.text = fullResponseText.substring(0, index);
          }
          return updated;
        });
      }
    }, intervalTime);
  };

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    setMessages((prev) => [...prev, { sender: "user", text: textToSend }]);
    setInput("");
    setLoading(true);

    try {
      const response = await ApiClient.post(`/books/chat?question=${encodeURIComponent(textToSend)}`, {});
      setLoading(false);
      streamBotResponse(response.answer);
    } catch (err: any) {
      setLoading(false);
      setMessages((prev) => [
        ...prev, 
        { 
          sender: "bot", 
          text: `Error: ${err.message || "Could not reach the AI Librarian. Make sure the backend is active."}` 
        }
      ]);
    }
  };

  // Simple custom Markdown parser wrapper
  const renderMessageContent = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, idx) => {
      // Bullet lists
      if (line.startsWith("- ") || line.startsWith("* ")) {
        return (
          <li key={idx} className="ml-4 list-disc pl-1 mb-1 text-zinc-300">
            {parseInlineStyles(line.substring(2))}
          </li>
        );
      }
      // Headers
      if (line.startsWith("### ")) {
        return (
          <h4 key={idx} className="text-xs font-bold text-white uppercase tracking-wider mt-4 mb-2">
            {line.substring(4)}
          </h4>
        );
      }
      if (line.startsWith("## ")) {
        return (
          <h3 key={idx} className="text-sm font-bold text-white tracking-wide mt-5 mb-2.5">
            {line.substring(3)}
          </h3>
        );
      }
      return (
        <p key={idx} className="mb-2 leading-relaxed text-zinc-300">
          {parseInlineStyles(line)}
        </p>
      );
    });
  };

  const parseInlineStyles = (lineStr: string) => {
    // Bold parser **text**
    const parts = lineStr.split(/\*\*([^*]+)\*\*/g);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} className="text-emerald-400 font-bold">{part}</strong>;
      }
      return part;
    });
  };

  // Scrape book catalog elements mentioned in bot responses to render widgets
  const getMentionedBooks = (messageText: string) => {
    if (!messageText) return [];
    return allBooks.filter(book => 
      messageText.toLowerCase().includes(book.title.toLowerCase())
    );
  };

  return (
    <div className="max-w-5xl mx-auto flex flex-col h-[calc(100vh-160px)]">
      
      {/* Title Header */}
      <div className="mb-6 flex justify-between items-center shrink-0 border-b border-white/5 pb-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-emerald-400 animate-pulse" />
            AI Librarian
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Perform catalog-wide Q&A and request contextual insights powered by RAG
          </p>
        </div>
      </div>

      {/* Main Chat Workspace */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Chat Feed */}
        <div className="lg:col-span-3 flex flex-col glass-card border border-white/5 rounded-2xl overflow-hidden shadow-2xl h-full">
          {/* Scroll feed */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
            {messages.map((msg, idx) => {
              const mentionedBooks = msg.sender === "bot" ? getMentionedBooks(msg.text) : [];
              return (
                <div 
                  key={idx} 
                  className={`flex gap-3 max-w-[85%] ${
                    msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                  } animate-in fade-in duration-200`}
                >
                  {/* Avatar Icon */}
                  <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center border ${
                    msg.sender === "user" 
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                      : "bg-[#3b82f6]/10 border-[#3b82f6]/20 text-electric-blue"
                  }`}>
                    {msg.sender === "user" ? <User className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                  </div>

                  {/* Bubble content */}
                  <div className="space-y-3">
                    <div className={`p-4 rounded-2xl text-xs leading-relaxed ${
                      msg.sender === "user"
                        ? "bg-emerald-500 text-white rounded-tr-none"
                        : "bg-white/3 text-zinc-300 border border-white/5 rounded-tl-none"
                    }`}>
                      {msg.sender === "user" ? msg.text : renderMessageContent(msg.text)}
                      {msg.isStreaming && (
                        <span className="inline-block w-1.5 h-3 bg-emerald-400 ml-0.5 animate-pulse">▋</span>
                      )}
                    </div>

                    {/* Mentioned Book Cards inside chat bubbles */}
                    {mentionedBooks.length > 0 && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        {mentionedBooks.map(book => (
                          <Link 
                            key={book.id}
                            to={`/books/${book.id}`}
                            className="glass-card rounded-xl p-3 border border-white/5 flex gap-3 hover:border-emerald-500/30 hover:bg-white/4 transition group"
                          >
                            <img 
                              src={book.cover_url || "https://placehold.co/50x75?text=Cover"}
                              alt={book.title}
                              className="w-9 h-14 object-cover rounded shadow shrink-0"
                            />
                            <div className="min-w-0 flex flex-col justify-center">
                              <h5 className="text-[11px] font-bold text-white truncate group-hover:text-emerald-400 transition-colors">
                                {book.title}
                              </h5>
                              <p className="text-[9px] text-zinc-500 truncate mt-0.5">
                                by {book.author?.name || "Unknown"}
                              </p>
                              <span className="text-[8px] text-emerald-400 font-semibold flex items-center gap-0.5 mt-2">
                                View Book <ArrowRight className="w-2.5 h-2.5" />
                              </span>
                            </div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex gap-3 max-w-[80%] mr-auto">
                <div className="w-8 h-8 rounded-lg bg-[#3b82f6]/10 border border-[#3b82f6]/20 text-electric-blue flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
                <div className="p-4 bg-white/3 border border-white/5 rounded-2xl text-xs rounded-tl-none text-zinc-500">
                  Librarian is retrieving context...
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Form input bar */}
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(input); }} 
            className="p-4 border-t border-white/5 bg-white/2 flex gap-2 shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the AI Librarian a question..."
              disabled={loading}
              className="flex-1 glass-input py-2.5 px-4 text-xs"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl transition duration-200 cursor-pointer shadow-lg shadow-emerald-500/10"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Suggestion Prompts sidebar (Desktop) */}
        <div className="hidden lg:block lg:col-span-1 space-y-4">
          <div className="glass-card border border-white/5 rounded-2xl p-5 h-full">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <HelpCircle className="w-4 h-4 text-emerald-400" />
              Suggested Queries
            </h3>
            <p className="text-[10px] text-zinc-500 mb-4">
              Click any prompt below to ask the AI Librarian instantly:
            </p>
            <div className="space-y-2">
              {samplePrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(prompt)}
                  disabled={loading}
                  className="w-full p-3 text-left bg-white/3 hover:bg-white/5 rounded-xl border border-white/5 text-[11px] text-zinc-300 hover:text-white transition duration-150 cursor-pointer active:scale-[0.98] leading-relaxed"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
