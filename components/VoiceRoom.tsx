'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useTracks,
  useParticipants,
} from '@livekit/components-react';
import { Track } from 'livekit-client';
import '@livekit/components-styles';
import { Mic, MicOff } from 'lucide-react';
import { Player } from '@/lib/types';

interface VoiceRoomProps {
  roomName: string;
  participantName: string;
  canSpeak: boolean;
  players: Player[];
  currentSpeakerId: string | null;
}

function AudioTracksRenderer() {
  useTracks([Track.Source.Microphone], { onlySubscribed: true });
  return <RoomAudioRenderer />;
}

function ParticipantMicStatus({ players, currentSpeakerId }: { players: Player[]; currentSpeakerId: string | null }) {
  const participants = useParticipants();
  const currentSpeaker = players.find((p) => p.id === currentSpeakerId);

  return (
    <div className="flex flex-wrap gap-2 justify-center mt-2">
      {participants.map((p) => {
        const player = players.find((pl) => pl.name === p.identity);
        const isSpeaker = player?.id === currentSpeakerId;
        return (
          <div
            key={p.identity}
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all ${
              isSpeaker
                ? 'bg-green-500/20 border border-green-500 text-green-300'
                : 'bg-gray-800 border border-gray-700 text-gray-400'
            }`}
          >
            {p.isMicrophoneEnabled ? (
              <Mic className="w-3 h-3" />
            ) : (
              <MicOff className="w-3 h-3 text-gray-600" />
            )}
            {p.identity}
            {isSpeaker && <span className="ml-1">🎙️</span>}
          </div>
        );
      })}
      {currentSpeaker && participants.length === 0 && (
        <p className="text-xs text-gray-500">Connecting to voice...</p>
      )}
    </div>
  );
}

export default function VoiceRoom({ roomName, participantName, canSpeak, players, currentSpeakerId }: VoiceRoomProps) {
  const [token, setToken] = useState<string | null>(null);
  const [livekitUrl] = useState(process.env.NEXT_PUBLIC_LIVEKIT_URL || '');
  const [error, setError] = useState('');

  const fetchToken = useCallback(async () => {
    try {
      const res = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, participantName }),
      });
      const data = await res.json();
      if (res.ok) setToken(data.token);
      else setError(data.error || 'Failed to get voice token');
    } catch {
      setError('Voice chat unavailable');
    }
  }, [roomName, participantName]);

  useEffect(() => {
    if (livekitUrl) fetchToken();
  }, [fetchToken, livekitUrl]);

  if (!livekitUrl) {
    return (
      <div className="text-xs text-yellow-500 text-center py-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
        🎤 Voice chat not configured (LiveKit URL missing)
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-xs text-red-400 text-center py-2 bg-red-500/10 rounded-lg border border-red-500/20">
        {error}
      </div>
    );
  }

  if (!token) {
    return (
      <div className="text-xs text-gray-400 text-center py-2 animate-pulse">
        Connecting to voice room...
      </div>
    );
  }

  return (
    <LiveKitRoom
      serverUrl={livekitUrl}
      token={token}
      connect={true}
      audio={canSpeak}
      video={false}
      className="hidden"
    >
      <AudioTracksRenderer />
      <ParticipantMicStatus players={players} currentSpeakerId={currentSpeakerId} />
    </LiveKitRoom>
  );
}
