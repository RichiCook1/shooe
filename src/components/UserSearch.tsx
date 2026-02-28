import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";

interface UserSearchProps {
  onSelect?: () => void;
}

const UserSearch = ({ onSelect }: UserSearchProps) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const search = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 2) { setResults([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, username, display_name, avatar_url")
        .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(6);
      setResults(data ?? []);
      setOpen((data ?? []).length > 0);
    }, 300);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder="Search runners..."
          className="pl-8 h-9"
          autoFocus
        />
      </div>
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {results.map((p) => (
            <button
              key={p.user_id}
              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent/50 transition-colors"
              onClick={() => {
                navigate(`/profile/${p.user_id}`);
                setOpen(false);
                setQuery("");
                onSelect?.();
              }}
            >
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                {p.avatar_url ? (
                  <img src={p.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </div>
              <div className="text-left min-w-0">
                <p className="text-sm font-medium truncate">{p.display_name || p.username || "Runner"}</p>
                {p.username && <p className="text-xs text-muted-foreground truncate">@{p.username}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserSearch;
