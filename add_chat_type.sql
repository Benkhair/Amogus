-- Add type column to chat_messages table
DO $$
BEGIN
    -- Add type column if not exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'chat_messages' AND column_name = 'type'
    ) THEN
        ALTER TABLE chat_messages ADD COLUMN type VARCHAR(20) DEFAULT 'chat';
    END IF;
END $$;

-- Update existing messages to have type='chat'
UPDATE chat_messages SET type = 'chat' WHERE type IS NULL;

-- Verify
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'chat_messages';
