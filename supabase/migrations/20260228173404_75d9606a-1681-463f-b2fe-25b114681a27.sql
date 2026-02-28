
-- Saved reviews table
CREATE TABLE public.saved_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  review_id UUID NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, review_id)
);
ALTER TABLE public.saved_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own saved reviews" ON public.saved_reviews FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can save reviews" ON public.saved_reviews FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unsave reviews" ON public.saved_reviews FOR DELETE USING (auth.uid() = user_id);

-- Conversations table
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID NOT NULL,
  user2_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user1_id, user2_id)
);
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own conversations" ON public.conversations FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Users can create conversations" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Users can update own conversations" ON public.conversations FOR UPDATE USING (auth.uid() = user1_id OR auth.uid() = user2_id);

-- Messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT,
  review_id UUID REFERENCES public.reviews(id) ON DELETE SET NULL,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view messages in own conversations" ON public.messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid()))
);
CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK (
  auth.uid() = sender_id AND EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid()))
);
CREATE POLICY "Users can update own messages" ON public.messages FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid()))
);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;

-- Seed feedback tags (at least 3+)
INSERT INTO public.tags (label, type, sort_order, active) VALUES
  ('Great cushioning', 'positive', 1, true),
  ('Lightweight', 'positive', 2, true),
  ('Good grip', 'positive', 3, true),
  ('Breathable', 'positive', 4, true),
  ('True to size', 'positive', 5, true),
  ('Durable', 'positive', 6, true),
  ('Too narrow', 'negative', 10, true),
  ('Heavy', 'negative', 11, true),
  ('Poor durability', 'negative', 12, true),
  ('Runs small', 'negative', 13, true),
  ('Stiff', 'negative', 14, true),
  ('Slippery', 'negative', 15, true)
ON CONFLICT DO NOTHING;
