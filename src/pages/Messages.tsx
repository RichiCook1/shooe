import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/landing/Navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ArrowLeft, MessageCircle, Star } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";

const Messages = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const [activeConvo, setActiveConvo] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const targetUserId = searchParams.get("to");
  const sharedReviewId = searchParams.get("reviewId");

  // Fetch conversations
  const { data: conversations } = useQuery({
    queryKey: ["conversations", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
        .order("updated_at", { ascending: false });
      if (!data || data.length === 0) return [];
      const otherIds = [...new Set(data.map((c: any) => c.user1_id === user.id ? c.user2_id : c.user1_id))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, username, display_name, avatar_url").in("user_id", otherIds);
      const pm = Object.fromEntries((profiles ?? []).map((p: any) => [p.user_id, p]));
      return data.map((c: any) => {
        const otherId = c.user1_id === user.id ? c.user2_id : c.user1_id;
        return { ...c, otherUser: pm[otherId] || null, otherUserId: otherId };
      });
    },
    enabled: !!user,
  });

  // Auto-create conversation if navigating with ?to= param
  useEffect(() => {
    if (!targetUserId || !user || !conversations) return;
    const existing = conversations.find((c: any) => c.otherUserId === targetUserId);
    if (existing) {
      setActiveConvo(existing.id);
      // If sharing a review, send it automatically
      if (sharedReviewId) {
        sendSharedReview(existing.id, sharedReviewId);
      }
    } else {
      // Create new conversation
      const createConvo = async () => {
        const [u1, u2] = [user.id, targetUserId].sort();
        const { data } = await supabase.from("conversations").insert({ user1_id: u1, user2_id: u2 }).select().single();
        if (data) {
          queryClient.invalidateQueries({ queryKey: ["conversations", user.id] });
          setActiveConvo(data.id);
          if (sharedReviewId) {
            sendSharedReview(data.id, sharedReviewId);
          }
        }
      };
      createConvo();
    }
  }, [targetUserId, user, conversations]);

  const sendSharedReview = async (convoId: string, reviewId: string) => {
    if (!user) return;
    await supabase.from("messages").insert({
      conversation_id: convoId,
      sender_id: user.id,
      content: "Shared a review 👟",
      review_id: reviewId,
    });
    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convoId);
    queryClient.invalidateQueries({ queryKey: ["messages", convoId] });
  };

  // Fetch messages for active convo
  const { data: messages } = useQuery({
    queryKey: ["messages", activeConvo],
    queryFn: async () => {
      if (!activeConvo) return [];
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", activeConvo)
        .order("created_at", { ascending: true });
      // Fetch shared reviews
      const reviewIds = [...new Set((data ?? []).filter((m: any) => m.review_id).map((m: any) => m.review_id))];
      let reviewMap: Record<string, any> = {};
      if (reviewIds.length > 0) {
        const { data: reviews } = await supabase.from("reviews").select("id, rating, model:models(name, brand:brands(name))").in("id", reviewIds);
        reviewMap = Object.fromEntries((reviews ?? []).map((r: any) => [r.id, r]));
      }
      return (data ?? []).map((m: any) => ({ ...m, sharedReview: m.review_id ? reviewMap[m.review_id] : null }));
    },
    enabled: !!activeConvo,
    refetchInterval: 5000,
  });

  // Mark messages as read
  useEffect(() => {
    if (!activeConvo || !user || !messages) return;
    const unread = messages.filter((m: any) => m.sender_id !== user.id && !m.read);
    if (unread.length > 0) {
      supabase.from("messages").update({ read: true }).in("id", unread.map((m: any) => m.id)).then(() => {
        queryClient.invalidateQueries({ queryKey: ["unread-messages", user.id] });
      });
    }
  }, [messages, activeConvo, user]);

  // Realtime subscription
  useEffect(() => {
    if (!activeConvo) return;
    const channel = supabase
      .channel(`messages-${activeConvo}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${activeConvo}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["messages", activeConvo] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeConvo]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!user || !activeConvo || !messageText.trim()) return;
      await supabase.from("messages").insert({
        conversation_id: activeConvo,
        sender_id: user.id,
        content: messageText.trim(),
      });
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", activeConvo);
      // Send notification
      const convo = conversations?.find((c: any) => c.id === activeConvo);
      if (convo) {
        await supabase.from("notifications").insert({
          user_id: convo.otherUserId,
          actor_id: user.id,
          type: "message",
        });
      }
      setMessageText("");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages", activeConvo] });
      queryClient.invalidateQueries({ queryKey: ["conversations", user?.id] });
    },
  });

  const activeConvoData = conversations?.find((c: any) => c.id === activeConvo);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <div className="flex-1 flex max-w-2xl mx-auto w-full">
        {/* Conversations list or chat */}
        {!activeConvo ? (
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-border">
              <h1 className="text-lg font-bold font-display">Messages</h1>
            </div>
            {conversations && conversations.length > 0 ? (
              <div className="flex-1 overflow-y-auto">
                {conversations.map((c: any) => (
                  <button
                    key={c.id}
                    onClick={() => setActiveConvo(c.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors border-b border-border/50"
                  >
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      {c.otherUser?.avatar_url ? (
                        <img src={c.otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-sm font-bold text-muted-foreground">
                          {(c.otherUser?.display_name || c.otherUser?.username || "?")[0]?.toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="text-left min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{c.otherUser?.display_name || c.otherUser?.username || "Runner"}</p>
                      <p className="text-xs text-muted-foreground">{new Date(c.updated_at).toLocaleDateString()}</p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No conversations yet</p>
                  <p className="text-xs mt-1">Message someone from their profile!</p>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 flex flex-col">
            {/* Chat header */}
            <div className="flex items-center gap-3 p-4 border-b border-border">
              <button onClick={() => setActiveConvo(null)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-muted transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <Link to={`/profile/${activeConvoData?.otherUserId}`} className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                  {activeConvoData?.otherUser?.avatar_url ? (
                    <img src={activeConvoData.otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-muted-foreground">
                      {(activeConvoData?.otherUser?.display_name || "?")[0]?.toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-sm font-medium">{activeConvoData?.otherUser?.display_name || activeConvoData?.otherUser?.username || "Runner"}</span>
              </Link>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages?.map((m: any) => {
                const isMine = m.sender_id === user?.id;
                return (
                  <div key={m.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isMine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      {m.sharedReview && (
                        <Link to="/feed" className={`block mb-1 p-2 rounded-lg ${isMine ? "bg-primary-foreground/10" : "bg-background"}`}>
                          <div className="flex items-center gap-1.5">
                            <Star className="w-3.5 h-3.5" />
                            <span className="text-xs font-medium">
                              {[m.sharedReview?.model?.brand?.name, m.sharedReview?.model?.name].filter(Boolean).join(" ")}
                            </span>
                            {m.sharedReview?.rating != null && (
                              <span className="text-xs ml-auto font-bold">{m.sharedReview.rating}/10</span>
                            )}
                          </div>
                        </Link>
                      )}
                      <p className="text-sm">{m.content}</p>
                      <p className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={(e) => { e.preventDefault(); sendMutation.mutate(); }} className="p-4 border-t border-border flex gap-2">
              <Input value={messageText} onChange={(e) => setMessageText(e.target.value)} placeholder="Type a message..." className="flex-1" />
              <Button type="submit" size="icon" disabled={!messageText.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

export default Messages;
