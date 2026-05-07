-- Fix: Update room status to 'ended' when game ends in finalize_voting
-- This ensures play-again works immediately after game ends

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
        -- Game ends: update room status immediately
        UPDATE rooms
        SET status = 'ended',
            ended_at = NOW()
        WHERE id = p_room_id;
    ELSIF v_alive_count <= 2 THEN
        v_should_continue := false;
        v_imposter_wins := true;
        -- Game ends: update room status immediately
        UPDATE rooms
        SET status = 'ended',
            ended_at = NOW()
        WHERE id = p_room_id;
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
