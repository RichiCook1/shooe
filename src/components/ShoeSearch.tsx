import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const ShoeSearch = () => {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (q.trim().length < 2) { setResults([]); return; }
      const { data } = await supabase
        .from("models")
        .select("id, name, brand:brands(name)")
        .ilike("name", `%${q.trim()}%`)
        .limit(8);
      setResults(data ?? []);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", click);
    return () => document.removeEventListener("mousedown", click);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search a shoe model..."
          className="pl-9"
        />
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-64 overflow-auto">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => { navigate(`/model/${r.id}`); setOpen(false); setQ(""); }}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent flex flex-col"
            >
              <span className="font-medium">{r.name}</span>
              {r.brand?.name && <span className="text-xs text-muted-foreground">{r.brand.name}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ShoeSearch;
