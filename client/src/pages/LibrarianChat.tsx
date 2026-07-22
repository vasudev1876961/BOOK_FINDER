import { useState, useRef, useEffect } from "react";
import ApiClient from "../services/api";
import { 
  Sparkles, Send, Loader2, BookOpen, 
  User, HelpCircle 
} from "lucide-react";

interface Message {
  sender: "user" | "bot";
  text: string;
}

export default function LibrarianChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      sender: "bot",
      text: "Hello! I am your Aetheria AI Librarian. Ask me anything about our book catalog, request custom recommendations, or ask for deep concepts explained!"
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const samplePrompts = [
    "Recommend a book for building long-term systems of success.",
    "Which books discuss deep focus and overcoming digital distractions?",
    "Explain the four laws of behavior change in Atomic Habits.",
    "Show me books focused on software craftsmanship."
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim()) return;

    setMessages((prev) => [...prev, { sender: "user", text: textToSend }]);
    setInput("");
    setLoading(true);

    try {
      // Send question to global library RAG chat endpoint
      const response = await ApiClient.post(`/books/chat?question=${encodeURIComponent(textToSend)}`, {});
      setMessages((prev) => [...prev, { sender: "bot", text: response.answer }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev, 
        { 
          sender: "bot", 
          text: `Error: ${err.message || "Could not reach the AI Librarian. Make sure the backend is active."}` 
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto flex flex-col h-[calc(100vh-140px)]">
      {/* Title Header */}
      <div className="mb-6 flex justify-between items-center shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-emerald-400 animate-pulse" />
            AI Librarian
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Perform catalog-wide Q&A and request contextual insights powered by RAG
          </p>
        </div>
      </div>

      {/* Main Chat Workspace */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Chat Feed */}
        <div className="lg:col-span-3 flex flex-col glass-card border border-white/5 rounded-2xl overflow-hidden shadow-2xl h-full">
          {/* Scroll feed */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-thin">
            {messages.map((msg, idx) => (
              <div 
                key={idx} 
                className={`flex gap-3 max-w-[85%] ${
                  msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                }`}
              >
                {/* Avatar Icon */}
                <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center border ${
                  msg.sender === "user" 
                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" 
                    : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                }`}>
                  {msg.sender === "user" ? <User className="w-4 h-4" /> : <BookOpen className="w-4 h-4" />}
                </div>

                {/* Text Bubble */}
                <div className={`p-4 rounded-2xl text-sm ${
                  msg.sender === "user"
                    ? "bg-emerald-500 text-white rounded-tr-none"
                    : "bg-white/5 text-zinc-200 border border-white/5 rounded-tl-none whitespace-pre-line"
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3 max-w-[80%] mr-auto">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
                <div className="p-4 bg-white/5 border border-white/5 rounded-2xl text-sm rounded-tl-none text-zinc-500 flex items-center gap-2">
                  <span>Librarian is analyzing text chunks...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Form input bar */}
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(input); }} 
            className="p-4 border-t border-white/5 bg-[#141419]/90 flex gap-2 shrink-0"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask the AI Librarian a question..."
              disabled={loading}
              className="flex-1 glass-input py-2.5 px-4 text-sm"
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
            <p className="text-xs text-muted-foreground mb-4">
              Click any prompt below to ask the AI Librarian instantly:
            </p>
            <div className="space-y-2">
              {samplePrompts.map((prompt, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(prompt)}
                  disabled={loading}
                  className="w-full p-3 text-left bg-white/3 hover:bg-white/5 rounded-xl border border-white/5 text-xs text-zinc-300 hover:text-white transition duration-150 cursor-pointer active:scale-[0.98]"
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
