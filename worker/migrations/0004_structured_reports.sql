-- Store structured assistant report JSON for vehicle inspection messages.
ALTER TABLE chat_messages ADD COLUMN structured_report TEXT;
