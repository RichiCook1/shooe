import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function subscribeToPush(userId: string) {
  try {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const registration = await navigator.serviceWorker.ready;

    // Check if already subscribed
    const existingSub = await registration.pushManager.getSubscription();
    if (existingSub) {
      // Already subscribed, ensure it's in the DB
      const endpoint = existingSub.endpoint;
      const { data: existing } = await supabase
        .from("push_subscriptions")
        .select("id")
        .eq("user_id", userId)
        .eq("endpoint", endpoint)
        .maybeSingle();

      if (!existing) {
        const p256dh = arrayBufferToBase64Url(existingSub.getKey("p256dh")!);
        const auth = arrayBufferToBase64Url(existingSub.getKey("auth")!);
        await supabase.from("push_subscriptions").insert({
          user_id: userId,
          endpoint,
          p256dh,
          auth,
        });
      }
      return;
    }

    // Get VAPID public key from edge function
    const { data: vapidData, error: vapidError } = await supabase.functions.invoke("get-vapid-public-key");
    if (vapidError || !vapidData?.publicKey) {
      console.warn("Could not get VAPID public key:", vapidError);
      return;
    }

    const applicationServerKey = urlBase64ToUint8Array(vapidData.publicKey);

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
    });

    const p256dh = arrayBufferToBase64Url(subscription.getKey("p256dh")!);
    const auth = arrayBufferToBase64Url(subscription.getKey("auth")!);

    await supabase.from("push_subscriptions").insert({
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh,
      auth,
    });

    console.log("Push notification subscription saved");
  } catch (err) {
    console.warn("Push subscription failed:", err);
  }
}

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);

      // Subscribe to push notifications once user is logged in
      if (session?.user) {
        // Delay to not block initial UX
        setTimeout(() => {
          subscribeToPush(session.user.id);
        }, 3000);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
