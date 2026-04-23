-- Persist /api/image/... URLs for user turns so thumbnails survive reloads.
ALTER TABLE chat_messages ADD COLUMN image_urls TEXT;
