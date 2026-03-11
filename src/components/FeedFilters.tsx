import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Filter, X } from "lucide-react";

interface FeedFiltersProps {
  brand: string;
  category: string;
  sort: string;
  country: string;
  city: string;
  onBrandChange: (v: string) => void;
  onCategoryChange: (v: string) => void;
  onSortChange: (v: string) => void;
  onCountryChange: (v: string) => void;
  onCityChange: (v: string) => void;
}

const CATEGORIES = [
  { value: "road", label: "Road" },
  { value: "trail", label: "Trail" },
  { value: "track", label: "Track" },
  { value: "racing", label: "Racing" },
  { value: "indoor_climbing", label: "Indoor Climbing" },
  { value: "outdoor_climbing", label: "Outdoor Climbing" },
  { value: "mountaineering", label: "Mountaineering" },
  { value: "hiking", label: "Hiking" },
  { value: "recovery", label: "Recovery" },
  { value: "cross_training", label: "Cross Training" },
  { value: "walking", label: "Walking" },
];

const FeedFilters = ({ brand, category, sort, country, city, onBrandChange, onCategoryChange, onSortChange, onCountryChange, onCityChange }: FeedFiltersProps) => {
  const [expanded, setExpanded] = useState(false);

  const { data: brands } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => {
      const { data } = await supabase.from("brands").select("id, name").order("name");
      return data ?? [];
    },
  });

  const activeCount = [brand, category, country, city].filter((v) => v !== "all" && v !== "").length + (sort !== "recent" ? 1 : 0);

  const clearAll = () => {
    onBrandChange("all");
    onCategoryChange("all");
    onSortChange("recent");
    onCountryChange("all");
    onCityChange("");
  };

  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-2">
        <Button
          variant={expanded ? "default" : "outline"}
          size="sm"
          className="gap-1.5 h-8 text-xs"
          onClick={() => setExpanded(!expanded)}
        >
          <Filter className="w-3.5 h-3.5" />
          Filters
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]">
              {activeCount}
            </Badge>
          )}
        </Button>

        {/* Quick sort toggle */}
        <div className="flex gap-1 ml-auto">
          <button
            onClick={() => onSortChange("recent")}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${sort === "recent" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
          >
            Recent
          </button>
          <button
            onClick={() => onSortChange("popular")}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${sort === "popular" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
          >
            Popular
          </button>
          <button
            onClick={() => onSortChange("rating")}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${sort === "rating" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"}`}
          >
            Top Rated
          </button>
        </div>
      </div>

      {expanded && (
        <div className="flex flex-wrap gap-2 p-3 bg-card rounded-lg border border-border animate-fade-in">
          <Select value={brand} onValueChange={onBrandChange}>
            <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Brand" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Brands</SelectItem>
              {brands?.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={category} onValueChange={onCategoryChange}>
            <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={country} onValueChange={onCountryChange}>
            <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Country" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
            </SelectContent>
          </Select>

          <Input
            placeholder="City"
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            className="w-[100px] h-8 text-xs"
          />

          {activeCount > 0 && (
            <Button variant="ghost" size="sm" className="h-8 text-xs gap-1 text-muted-foreground" onClick={clearAll}>
              <X className="w-3 h-3" /> Clear
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default FeedFilters;
