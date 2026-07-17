import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Trash2, ExternalLink, Star } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const PAGE_SIZE = 25;

type SourceFilter = "all" | "seed" | "interview" | "import" | "guest" | "user";

const SEED_PREFIX = "guest-";

function sourceOf(r: { guest_session_id: string | null; is_guest: boolean }): {
  key: Exclude<SourceFilter, "all">;
  label: string;
} {
  const s = r.guest_session_id || "";
  if (/^guest-\d+/.test(s)) return { key: "seed", label: "Seed" };
  if (s.startsWith("interview:")) return { key: "interview", label: "Interview" };
  if (s.startsWith("import:")) return { key: "import", label: "Import" };
  if (r.is_guest) return { key: "guest", label: "Guest" };
  return { key: "user", label: "User" };
}

export default function AdminReviews() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [source, setSource] = useState<SourceFilter>("all");
  const [verified, setVerified] = useState<"all" | "yes" | "no">("all");
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const { data: seedCount = 0, refetch: refetchSeedCount } = useQuery({
    queryKey: ["admin-reviews-seed-count"],
    queryFn: async () => {
      const { count } = await supabase
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .like("guest_session_id", `${SEED_PREFIX}%`);
      return count ?? 0;
    },
  });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-reviews", search, page, source, verified],
    queryFn: async () => {
      let q = supabase
        .from("reviews")
        .select(
          `id, content, rating, created_at, verified, is_guest, location, media_urls,
           user_id, model_id, guest_session_id,
           models:model_id ( id, name, brands:brand_id ( id, name ) )`,
          { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

      if (search.trim()) {
        q = q.ilike("content", `%${search.trim()}%`);
      }
      if (source === "seed") q = q.like("guest_session_id", `${SEED_PREFIX}%`);
      else if (source === "interview") q = q.like("guest_session_id", "interview:%");
      else if (source === "import") q = q.like("guest_session_id", "import:%");
      else if (source === "guest") q = q.eq("is_guest", true);
      else if (source === "user") q = q.eq("is_guest", false);
      if (verified === "yes") q = q.eq("verified", true);
      if (verified === "no") q = q.eq("verified", false);

      const { data, error, count } = await q;
      if (error) throw error;

      const userIds = Array.from(
        new Set((data ?? []).map((r: any) => r.user_id).filter(Boolean))
      );
      let profileMap: Record<string, any> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, username, display_name")
          .in("user_id", userIds);
        profileMap = Object.fromEntries((profs ?? []).map((p: any) => [p.user_id, p]));
      }
      const rows = (data ?? []).map((r: any) => ({
        ...r,
        profiles: r.user_id ? profileMap[r.user_id] : null,
      }));
      return { rows, count: count ?? 0 };
    },
  });

  const rows = data?.rows ?? [];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function deleteReview(id: string) {
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Review deleted");
    refetch();
    refetchSeedCount();
  }

  async function toggleVerified(id: string, current: boolean) {
    const { error } = await supabase
      .from("reviews")
      .update({ verified: !current })
      .eq("id", id);
    if (error) return toast.error(error.message);
    refetch();
  }

  async function deleteAllSeeded() {
    setBulkDeleting(true);
    const { error } = await supabase
      .from("reviews")
      .delete()
      .like("guest_session_id", `${SEED_PREFIX}%`);
    setBulkDeleting(false);
    if (error) return toast.error(error.message);
    toast.success(`Deleted ${seedCount} seeded test reviews`);
    refetch();
    refetchSeedCount();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display tracking-wider uppercase text-2xl">Reviews ({total})</h1>
        <p className="text-sm text-muted-foreground">All reviews across the platform.</p>
      </div>

      <Card className="p-4 flex flex-wrap gap-3 items-center">
        <Input
          placeholder="Search review content…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          className="max-w-sm"
        />
        <div className="flex gap-2">
          {(["all", "user", "guest"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={source === s ? "default" : "outline"}
              onClick={() => {
                setSource(s);
                setPage(0);
              }}
            >
              {s === "all" ? "All" : s === "user" ? "Users" : "Guests"}
            </Button>
          ))}
        </div>
        <div className="flex gap-2">
          {(["all", "yes", "no"] as const).map((v) => (
            <Button
              key={v}
              size="sm"
              variant={verified === v ? "default" : "outline"}
              onClick={() => {
                setVerified(v);
                setPage(0);
              }}
            >
              {v === "all" ? "Any" : v === "yes" ? "Verified" : "Unverified"}
            </Button>
          ))}
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Author</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Content</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Loading…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No reviews found.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r: any) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    {r.models ? (
                      <Link
                        to={`/model/${r.models.id}`}
                        className="hover:underline text-sm"
                      >
                        <span className="text-muted-foreground">
                          {r.models.brands?.name}
                        </span>{" "}
                        {r.models.name}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    {r.is_guest ? (
                      <Badge variant="outline">Guest</Badge>
                    ) : (
                      r.profiles?.display_name ||
                      r.profiles?.username ||
                      <span className="text-muted-foreground">Unknown</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.rating ? (
                      <span className="inline-flex items-center gap-1 text-sm">
                        <Star className="h-3 w-3 fill-current" />
                        {r.rating}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="max-w-md">
                    <p className="text-sm line-clamp-2">
                      {r.content || <span className="text-muted-foreground italic">No content</span>}
                    </p>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => toggleVerified(r.id, r.verified)}
                      className="cursor-pointer"
                      title="Toggle verified"
                    >
                      <Badge variant={r.verified ? "default" : "secondary"}>
                        {r.verified ? "Verified" : "Draft"}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        asChild
                        title="Open model"
                      >
                        <Link to={`/model/${r.model_id}`}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" title="Delete review">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete review?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This permanently removes the review. This cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteReview(r.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {page + 1} of {totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
