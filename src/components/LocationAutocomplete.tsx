import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

const LocationAutocomplete = ({ value, onChange, placeholder = "e.g. Central Park, NYC", className }: LocationAutocompleteProps) => {
  const [suggestions, setSuggestions] = useState<{ display_name: string; place_id: string }[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const search = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 3) { setSuggestions([]); setOpen(false); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=0`);
        const data = await res.json();
        setSuggestions(data);
        setOpen(data.length > 0);
      } catch { setSuggestions([]); }
    }, 350);
  };

  return (
    <div ref={containerRef} className="relative">
      <Input
        value={value}
        onChange={(e) => { onChange(e.target.value); search(e.target.value); }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className={className}
      />
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s.place_id}
              type="button"
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent/50 transition-colors truncate"
              onClick={() => { onChange(s.display_name); setOpen(false); }}
            >
              {s.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default LocationAutocomplete;
