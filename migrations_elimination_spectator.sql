-- ============================================================================
-- ELIMINATION REVEAL & SPECTATOR MODE MIGRATION
-- ============================================================================
-- This migration adds:
-- 1. eliminated_at timestamp to players table
-- 2. Updated finalize_voting function with game continuation logic
-- 3. start_new_round function to reset game after elimination
-- 4. end_game function to properly end games
-- ============================================================================

-- 1. Add eliminated_at column to players table
ALTER TABLE players ADD COLUMN IF NOT EXISTS eliminated_at TIMESTAMPTZ DEFAULT NULL;

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_players_eliminated_at ON players(eliminated_at) WHERE is_eliminated = true;

-- 2. Drop existing finalize_voting function if exists
DROP FUNCTION IF EXISTS finalize_voting(UUID, INT);

-- 3. Create updated finalize_voting function with continuation support
CREATE OR REPLACE FUNCTION finalize_voting(
    p_room_id UUID,
    p_round INT
) RETURNS TABLE (
    eliminated_id UUID,
    eliminated_was_imposter BOOLEAN,
    should_continue_game BOOLEAN,
    is_final_phase BOOLEAN,
    imposter_wins BOOLEAN,
    tie BOOLEAN,
    already_finalized BOOLEAN
) AS $$
DECLARE
    v_eliminated_id UUID;
    v_eliminated_was_imposter BOOLEAN;
    v_alive_count INT;
    v_imposter_alive BOOLEAN;
    v_tie BOOLEAN := false;
    v_should_continue BOOLEAN := false;
    v_is_final_phase BOOLEAN := false;
    v_imposter_wins BOOLEAN := false;
    v_already_finalized BOOLEAN := false;
    v_max_votes INT;
    v_vote_count INT;
BEGIN
    -- Check if already finalized this round (idempotency)
    SELECT EXISTS(
        SELECT 1 FROM players 
        WHERE room_id = p_room_id 
        AND is_eliminated = true 
        AND eliminated_at > NOW() - INTERVAL '10 seconds'
    ) INTO v_already_finalized;
    
    IF v_already_finalized THEN
        already_finalized := true;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Find player with most votes
    SELECT target_id, COUNT(*) INTO v_eliminated_id, v_max_votes
    FROM votes
    WHERE room_id = p_room_id AND round = p_round
    GROUP BY target_id
    ORDER BY COUNT(*) DESC
    LIMIT 1;

    -- Check for tie
    IF v_eliminated_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_vote_count
        FROM votes
        WHERE room_id = p_room_id AND round = p_round AND target_id = v_eliminated_id;
        
        IF v_max_votes = 1 THEN
            SELECT COUNT(DISTINCT target_id) INTO v_vote_count
            FROM votes
            WHERE room_id = p_room_id AND round = p_round;
            
            IF v_vote_count > 1 THEN
                v_tie := true;
                v_eliminated_id := NULL;
            END IF;
        END IF;
    END IF;

    -- If no elimination (tie or no votes), skip elimination
    IF v_eliminated_id IS NULL THEN
        eliminated_id := NULL;
        eliminated_was_imposter := NULL;
        should_continue_game := true;
        is_final_phase := false;
        imposter_wins := false;
        tie := v_tie;
        already_finalized := false;
        RETURN NEXT;
        RETURN;
    END IF;

    -- Get eliminated player's imposter status
    SELECT is_imposter INTO v_eliminated_was_imposter
    FROM players
    WHERE id = v_eliminated_id;

    -- Mark player as eliminated
    UPDATE players 
    SET is_eliminated = true, 
        eliminated_at = NOW()
    WHERE id = v_eliminated_id;

    -- Count remaining alive players
    SELECT COUNT(*) INTO v_alive_count
    FROM players
    WHERE room_id = p_room_id 
    AND is_eliminated = false 
    AND is_connected = true;

    -- Check if imposter is still alive
    SELECT EXISTS(
        SELECT 1 FROM players 
        WHERE room_id = p_room_id 
        AND is_imposter = true 
        AND is_eliminated = false
        AND is_connected = true
    ) INTO v_imposter_alive;

    -- Determine game continuation
    IF v_eliminated_was_imposter THEN
        v_should_continue := false;
        v_imposter_wins := false;
    ELSIF v_alive_count <= 2 THEN
        v_should_continue := false;
        v_imposter_wins := true;
    ELSIF v_alive_count = 3 THEN
        v_should_continue := true;
        v_is_final_phase := true;
        v_imposter_wins := false;
    ELSE
        v_should_continue := true;
        v_is_final_phase := false;
        v_imposter_wins := false;
    END IF;

    eliminated_id := v_eliminated_id;
    eliminated_was_imposter := v_eliminated_was_imposter;
    should_continue_game := v_should_continue;
    is_final_phase := v_is_final_phase;
    imposter_wins := v_imposter_wins;
    tie := v_tie;
    already_finalized := false;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- 4. Create function to start new round after elimination
CREATE OR REPLACE FUNCTION start_new_round(
    p_room_id UUID
) RETURNS TABLE (
    success BOOLEAN,
    new_round INT,
    new_word TEXT,
    new_category TEXT
) AS $$
DECLARE
    v_new_round INT;
    v_new_word TEXT;
    v_new_category TEXT;
    v_imposter_word TEXT;
    v_alive_players UUID[];
    v_imposter_id UUID;
BEGIN
    -- Get current round and increment
    SELECT COALESCE(MAX(round), 0) + 1 INTO v_new_round
    FROM game_state
    WHERE room_id = p_room_id;

    -- Select new random word pair (simplified - in production use word_pairs table)
    SELECT 
        CASE WHEN RANDOM() < 0.5 THEN 'Apple' ELSE 'Banana' END,
        CASE WHEN RANDOM() < 0.5 THEN 'Fruit' ELSE 'Food' END
    INTO v_new_word, v_new_category;

    -- Get the imposter's ID
    SELECT id INTO v_imposter_id
    FROM players
    WHERE room_id = p_room_id AND is_imposter = true AND is_eliminated = false;

    -- Get all alive non-imposter players
    SELECT ARRAY_AGG(id) INTO v_alive_players
    FROM players
    WHERE room_id = p_room_id 
    AND is_eliminated = false 
    AND is_connected = true
    AND is_imposter = false;

    -- Assign words to normal players
    IF v_alive_players IS NOT NULL THEN
        UPDATE players 
        SET word = v_new_word,
            category = v_new_category
        WHERE id = ANY(v_alive_players);
    END IF;

    -- Assign different word to imposter
    IF v_imposter_id IS NOT NULL THEN
        v_imposter_word := CASE 
            WHEN v_new_word = 'Apple' THEN 'Orange'
            WHEN v_new_word = 'Banana' THEN 'Mango'
            ELSE 'Grape'
        END;
        
        UPDATE players 
        SET word = v_imposter_word,
            category = v_new_category
        WHERE id = v_imposter_id;
    END IF;

    -- Update game state for new round
    UPDATE game_state
    SET round = v_new_round,
        current_phase = 'speaking',
        current_turn_index = 0,
        timer_end = NULL,
        updated_at = NOW()
    WHERE room_id = p_room_id;

    -- Update room status
    UPDATE rooms
    SET status = 'playing',
        last_activity_at = NOW()
    WHERE id = p_room_id;

    -- Clear votes from previous round
    DELETE FROM votes
    WHERE room_id = p_room_id AND round < v_new_round;

    success := true;
    new_round := v_new_round;
    new_word := v_new_word;
    new_category := v_new_category;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- 5. Create function to end game and set winner
CREATE OR REPLACE FUNCTION end_game(
    p_room_id UUID,
    p_imposter_wins BOOLEAN
) RETURNS VOID AS $$
BEGIN
    UPDATE rooms
    SET status = 'ended',
        ended_at = NOW()
    WHERE id = p_room_id;

    UPDATE game_state
    SET current_phase = 'results',
        updated_at = NOW()
    WHERE room_id = p_room_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'players' 
AND column_name IN ('is_eliminated', 'eliminated_at')
ORDER BY column_name;

-- Verify functions
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN ('finalize_voting', 'start_new_round', 'end_game')
ORDER BY routine_name;
