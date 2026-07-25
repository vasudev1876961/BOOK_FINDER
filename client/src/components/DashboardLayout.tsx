import React, { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { 
  LayoutDashboard, Search, Library, LogOut, Shield, 
  Sparkles, ChevronLeft, ChevronRight, User, Settings2 
} from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

const LogoSVG = () => (
  <svg 
    viewBox="0 0 24 24" 
    className="w-5 h-5 text-emerald-400 group-hover:text-electric-blue transition-colors duration-300" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2.5" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

const DashboardLayout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navItems = [
    { label: "Home", path: "/", icon: LayoutDashboard },
    { label: "AI Search", path: "/search", icon: Search },
    { label: "AI Librarian", path: "/chat", icon: Sparkles },
    { label: "My Library", path: "/shelves", icon: Library }
  ];

  if (user?.role === "admin") {
    navItems.push({ label: "Admin Control", path: "/admin", icon: Shield });
  }

  const isActive = (path: string) => {
    if (path === "/") {
      return location.pathname === "/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-foreground flex flex-col md:flex-row relative overflow-hidden select-none font-sans">
      
      {/* Background ambient spots - premium Spotify-like canvas */}
      <div className="absolute top-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-glow-emerald pointer-events-none opacity-40 blur-[80px]"></div>
      <div className="absolute bottom-[-15%] left-[-15%] w-[55vw] h-[55vw] rounded-full bg-glow-indigo pointer-events-none opacity-30 blur-[90px]"></div>

      {/* Sidebar - Desktop */}
      <aside 
        className={`hidden md:flex flex-col border-r border-white/5 bg-[#09090b]/80 backdrop-blur-xl transition-all duration-350 ease-in-out h-screen sticky top-0 shrink-0 z-20 ${
          isCollapsed ? "w-20 px-3 py-6" : "w-64 p-6"
        }`}
      >
        {/* Brand Header */}
        <div className={`flex items-center gap-3 mb-8 group ${isCollapsed ? "justify-center" : "px-2"}`}>
          <div className="w-9 h-9 rounded-xl bg-white/3 border border-white/10 flex items-center justify-center shadow-lg group-hover:border-emerald-500/20 transition-all duration-300">
            <LogoSVG />
          </div>
          {!isCollapsed && (
            <span className="font-extrabold text-lg tracking-wider bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent heading-font">
              AETHERIA
            </span>
          )}
        </div>

        {/* Collapsible toggle button */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute top-7 -right-3 w-6 h-6 rounded-full bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:border-emerald-500/30 transition cursor-pointer shadow-md"
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>

        {/* Navigation list */}
        <nav className="flex-1 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 group relative ${
                  active
                    ? "bg-white/5 border border-white/10 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-white/2"
                }`}
              >
                {/* Active edge indicator */}
                {active && (
                  <div className="absolute left-1 top-3 bottom-3 w-1 rounded bg-emerald-500"></div>
                )}
                
                <Icon className={`w-4 h-4 transition duration-200 ${
                  active 
                    ? "text-emerald-400" 
                    : "text-zinc-500 group-hover:text-zinc-300 group-hover:scale-102"
                }`} />
                
                {!isCollapsed && <span>{item.label}</span>}
                
                {/* Collapsed tooltip */}
                {isCollapsed && (
                  <div className="absolute left-16 bg-zinc-950 border border-white/10 text-xs px-2.5 py-1.5 rounded-lg opacity-0 pointer-events-none group-hover:opacity-100 transition duration-150 shadow-xl text-white font-semibold z-30">
                    {item.label}
                  </div>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User profile footer section */}
        <div className="border-t border-white/5 pt-5 mt-auto flex flex-col gap-3">
          <div className={`flex items-center gap-3 ${isCollapsed ? "justify-center" : "px-2"}`}>
            <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center font-bold text-zinc-300 text-sm shadow-inner shrink-0">
              {isCollapsed ? <User className="w-4 h-4 text-zinc-400" /> : (user?.full_name || user?.email || "U").substring(0, 1).toUpperCase()}
            </div>
            {!isCollapsed && (
              <div className="truncate">
                <p className="text-xs font-bold text-white truncate">{user?.full_name || "Reader"}</p>
                <p className="text-[10px] text-zinc-500 truncate">{user?.email}</p>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <button
              onClick={() => navigate("/")} // Stub route link for settings
              className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white hover:bg-white/2 transition cursor-pointer"
            >
              <Settings2 className="w-3.5 h-3.5" />
              <span>Workspace Settings</span>
            </button>
          )}

          <button
            onClick={handleLogout}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/5 transition cursor-pointer ${
              isCollapsed ? "justify-center" : ""
            }`}
          >
            <LogOut className="w-3.5 h-3.5" />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Top Header (Sticky) */}
      <header className="md:hidden sticky top-0 z-40 w-full px-6 py-4 flex items-center justify-between border-b border-white/5 bg-[#09090b]/85 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <LogoSVG />
          <span className="font-extrabold text-md tracking-wider bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent heading-font">
            AETHERIA
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="p-2 hover:bg-white/5 text-rose-400 rounded-lg transition"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* Main Workspace Frame */}
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full overflow-y-auto pb-24 md:pb-10 relative z-10">
        {children}
      </main>

      {/* Mobile Bottom Navigation Bar - Premium Tab Layout */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#09090b]/85 backdrop-blur-xl border-t border-white/5 px-6 py-3 flex justify-between items-center shadow-lg">
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center gap-1.5 px-3 py-1 text-[10px] font-bold transition duration-200 ${
                active ? "text-emerald-400 scale-102" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

    </div>
  );
};

export default DashboardLayout;
