
-- Create a trigger function that calls the send-push-notification edge function
CREATE OR REPLACE FUNCTION public.notify_push_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  payload jsonb;
BEGIN
  payload := jsonb_build_object(
    'record', jsonb_build_object(
      'id', NEW.id,
      'user_id', NEW.user_id,
      'actor_id', NEW.actor_id,
      'type', NEW.type,
      'review_id', NEW.review_id,
      'comment_id', NEW.comment_id
    )
  );

  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url', true) || '/functions/v1/send-push-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := payload
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't fail the insert if push notification fails
  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER on_notification_insert_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_push_on_insert();
