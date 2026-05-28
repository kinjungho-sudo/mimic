-- agreements JSONB에 email_notification 기본값 세팅
-- marketing이 없는 레코드도 함께 보완
UPDATE mm_users
SET agreements = agreements
  || jsonb_build_object(
       'email_notification', COALESCE((agreements->>'email_notification')::boolean, true),
       'marketing',          COALESCE((agreements->>'marketing')::boolean, false)
     )
WHERE agreements->>'email_notification' IS NULL
   OR agreements->>'marketing' IS NULL;
