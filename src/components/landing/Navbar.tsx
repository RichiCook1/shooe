import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { PenSquare, LogOut, User, Rss, Search, Bell, MessageCircle, Bookmark, Mountain } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import UserSearch from "@/components/UserSearch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const Navbar = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const [searchOpen, setSearchOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const { data: unreadCount } = useQuery({
    queryKey: ["unread-notifications", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("read", false);
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const { data: unreadMsgCount } = useQuery({
    queryKey: ["unread-messages", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data: convos } = await supabase
        .from("conversations")
        .select("id")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
      if (!convos || convos.length === 0) return 0;
      const convoIds = convos.map((c: any) => c.id);
      const { count } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", convoIds)
        .neq("sender_id", user.id)
        .eq("read", false);
      return count ?? 0;
    },
    enabled: !!user,
    refetchInterval: 15000,
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["unread-notifications", user?.id] }),
  });

  const { data: notifications } = useQuery({
    queryKey: ["notifications-list", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (!data || data.length === 0) return [];
      const actorIds = [...new Set(data.map((n: any) => n.actor_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("user_id", actorIds);
      const pm = Object.fromEntries((profiles ?? []).map((p: any) => [p.user_id, p]));
      return data.map((n: any) => ({ ...n, actor: pm[n.actor_id] || null }));
    },
    enabled: !!user,
  });

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur-sm border-b border-border">
      <div className="container mx-auto px-4 h-12 flex items-center justify-between gap-2">
        <Link to={user ? "/feed" : "/"} className="flex items-center shrink-0">
          <span className="text-lg font-display tracking-wider uppercase">Sherpa</span>
        </Link>

        <nav className="flex items-center gap-0.5 mx-auto">
          <Link to="/feed">
            <button className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${isActive("/feed") ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>
              <Rss className="w-4 h-4" />
            </button>
          </Link>
          {user && (
            <button
              className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${searchOpen ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => setSearchOpen(true)}
            >
              <Search className="w-4 h-4" />
            </button>
          )}
        </nav>

        <div className="flex items-center gap-1 shrink-0">
          <Link to="/review">
            <button className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground hover:opacity-80 transition-opacity">
              <PenSquare className="w-4 h-4" />
            </button>
          </Link>

          {user ? (
            <>
              <Link to="/messages">
                <button className="relative w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                  <MessageCircle className="w-4 h-4" />
                  {(unreadMsgCount ?? 0) > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-foreground text-background text-[9px] flex items-center justify-center font-bold">
                      {unreadMsgCount! > 9 ? "9+" : unreadMsgCount}
                    </span>
                  )}
                </button>
              </Link>

              <DropdownMenu onOpenChange={(open) => { if (open && (unreadCount ?? 0) > 0) markAllRead.mutate(); }}>
                <DropdownMenuTrigger asChild>
                  <button className="relative w-8 h-8 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                    <Bell className="w-4 h-4" />
                    {(unreadCount ?? 0) > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-foreground text-background text-[9px] flex items-center justify-center font-bold">
                        {unreadCount! > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-72 max-h-80 overflow-y-auto">
                  {notifications && notifications.length > 0 ? (
                    notifications.map((n: any) => {
                      const actorName = n.actor?.display_name || n.actor?.username || "Someone";
                      const msg = n.type === "like" ? "liked your review" : n.type === "comment" ? "commented on your review" : n.type === "message" ? "sent you a message" : "started following you";
                      return (
                        <DropdownMenuItem key={n.id} className={`flex-col items-start gap-0.5 cursor-pointer ${!n.read ? "bg-accent/30" : ""}`}
                          onClick={() => {
                            if (n.type === "follow") navigate(`/profile/${n.actor_id}`);
                            else if (n.type === "message") navigate("/messages");
                            else if (n.review_id) navigate(`/feed?reviewId=${n.review_id}`);
                          }}>
                          <span className="text-sm"><span className="font-medium">{actorName}</span> {msg}</span>
                          <span className="text-[10px] text-muted-foreground">{new Date(n.created_at).toLocaleDateString()}</span>
                        </DropdownMenuItem>
                      );
                    })
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">No notifications yet</div>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="w-8 h-8 rounded-md bg-muted flex items-center justify-center hover:bg-muted/70 transition-colors overflow-hidden">
                    <User className="w-4 h-4 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  <DropdownMenuItem onClick={() => navigate("/profile")} className="gap-2 cursor-pointer">
                    <User className="w-4 h-4" /> Profile
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/saved")} className="gap-2 cursor-pointer">
                    <Bookmark className="w-4 h-4" /> Saved Reviews
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="gap-2 cursor-pointer text-destructive">
                    <LogOut className="w-4 h-4" /> Log Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <Link to="/login">
              <Button variant="ghost" size="sm" className="h-8 text-xs uppercase tracking-wider font-medium">Log In</Button>
            </Link>
          )}
        </div>
      </div>

      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="max-w-md mx-4">
          <div className="pt-2 space-y-3">
            <h3 className="text-2xl font-display uppercase tracking-wider">Find Runners</h3>
            <UserSearch onSelect={() => setSearchOpen(false)} />
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
};

export default Navbar;
