'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useGame } from '@/context/GameContext';
import { supabase } from '@/lib/supabase/client';
import { Skull, Users, ArrowRight, Loader2, CheckCircle, Ban, X, Heart, Star, Award, MessageSquare, Bug, Lightbulb, Send, CircleCheck } from 'lucide-react';

type Mode = 'home' | 'create' | 'join';

export default function HomeScreen() {
  const router = useRouter();
  const { sessionId, setRoom, setMyPlayer } = useGame();
  const [mode, setMode] = useState<Mode>('home');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [avatarColor, setAvatarColor] = useState('#6366f1');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingAction, setPendingAction] = useState<'create' | 'join' | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [takenColors, setTakenColors] = useState<string[]>([]);
  const [showCredits, setShowCredits] = useState(false);
  const [showTesters, setShowTesters] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [fbName, setFbName] = useState('');
  const [fbType, setFbType] = useState<'bug' | 'suggestion' | 'other'>('bug');
  const [fbMessage, setFbMessage] = useState('');
  const [fbSending, setFbSending] = useState(false);
  const [fbSent, setFbSent] = useState(false);
  const [fbError, setFbError] = useState('');

  const handleFeedbackSubmit = async () => {
    if (!fbMessage.trim()) { setFbError('Please write a message'); return; }
    setFbSending(true);
    setFbError('');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: fbName, type: fbType, message: fbMessage }),
      });
      if (!res.ok) throw new Error();
      setFbSent(true);
      setTimeout(() => {
        setShowFeedback(false);
        setFbSent(false);
        setFbName('');
        setFbType('bug');
        setFbMessage('');
      }, 2000);
    } catch {
      setFbError('Failed to send. Try again.');
    } finally {
      setFbSending(false);
    }
  };

  // Fetch taken colors when entering join mode or when code changes
  useEffect(() => {
    if (mode === 'join' && code.trim().length === 6) {
      const fetchTakenColors = async () => {
        const { data: room } = await supabase
          .from('rooms')
          .select('id')
          .eq('code', code.toUpperCase())
          .single();
          
        if (room) {
          const { data: players } = await supabase
            .from('players')
            .select('avatar_color')
            .eq('room_id', room.id)
            .eq('is_eliminated', false);
            
          setTakenColors(players?.map(p => p.avatar_color).filter(Boolean) || []);
        }
      };
      fetchTakenColors();
    } else {
      setTakenColors([]);
    }
  }, [mode, code]);

  useEffect(() => {
    if (mode !== 'join' || !takenColors.includes(avatarColor)) return;

    const nextAvailableColor = AVATAR_COLORS.find((color) => !takenColors.includes(color));
    if (nextAvailableColor) {
      setAvatarColor(nextAvailableColor);
    }
  }, [mode, takenColors, avatarColor]);

  const AVATAR_COLORS = [
    '#6366f1', // Indigo
    '#e11d48', // Rose
    '#f59e0b', // Amber
    '#10b981', // Emerald
    '#06b6d4', // Cyan
    '#8b5cf6', // Violet
    '#f97316', // Orange
    '#ec4899', // Pink
    '#84cc16', // Lime
    '#14b8a6', // Teal
  ];

  const handleCreate = () => {
    if (!name.trim()) { setError('Enter your name'); return; }
    setError('');
    setPendingAction('create');
    setShowHowToPlay(true);
  };

  const handleJoin = () => {
    if (!name.trim()) { setError('Enter your name'); return; }
    if (!code.trim()) { setError('Enter room code'); return; }
    setError('');
    setPendingAction('join');
    setShowHowToPlay(true);
  };

  const handleConfirm = async () => {
    setLoading(true);
    setError('');
    try {
      if (pendingAction === 'create') {
        const res = await fetch('/api/room/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ hostName: name.trim(), sessionId, avatarColor }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error); setShowHowToPlay(false); return; }
        setRoom(data.room);
        setMyPlayer(data.player);
        router.push(`/room/${data.room.code}`);
      } else if (pendingAction === 'join') {
        const res = await fetch('/api/room/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerName: name.trim(), sessionId, code: code.trim(), avatarColor }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error); setShowHowToPlay(false); return; }
        setRoom(data.room);
        setMyPlayer(data.player);
        router.push(`/room/${data.room.code}`);
      }
    } catch {
      setError(pendingAction === 'create' ? 'Failed to create room' : 'Failed to join room');
      setShowHowToPlay(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 items-center justify-center min-h-screen bg-gray-950 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative mb-4">
            <div className="w-20 h-20 rounded-full bg-red-600 flex items-center justify-center shadow-lg shadow-red-900">
              <Skull className="w-10 h-10 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-yellow-400 border-2 border-gray-950" />
          </div>
          <h1 className="text-4xl font-black tracking-tight text-white">Sino-ngaling</h1>
          <p className="text-gray-400 text-sm mt-1 tracking-widest uppercase">Word deceiving game</p>
          <span className="mt-2 px-3 py-1 rounded-full bg-red-500/15 border border-red-500/40 text-red-400 text-xs font-bold tracking-widest uppercase">
            v1.0
          </span>
        </div>

        {/* Card */}
        <div className="bg-gray-900 rounded-2xl p-6 shadow-xl border border-gray-800">
          {mode === 'home' && (
            <div className="flex flex-col gap-4">
              <p className="text-center text-gray-400 text-sm mb-2">
              Find the Sinungaling before it&apos;s too late.
              </p>
              <button
                onClick={() => setMode('create')}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-lg transition-colors"
              >
                <Skull className="w-5 h-5" /> Create Room
              </button>
              <button
                onClick={() => setMode('join')}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-bold text-lg transition-colors border border-gray-700"
              >
                <Users className="w-5 h-5" /> Join Room
              </button>
            </div>
          )}

          {mode === 'create' && (
            <div className="flex flex-col gap-4">
              <button onClick={() => { setMode('home'); setError(''); }} className="text-gray-500 text-sm hover:text-gray-300 text-left">← Back</button>
              <h2 className="text-xl font-bold text-white">Create a Room</h2>
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
              />
              <div>
                <p className="text-gray-400 text-xs mb-2 uppercase tracking-wider">Avatar Color</p>
                <div className="flex gap-2 flex-wrap">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setAvatarColor(c)}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        avatarColor === c ? 'border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                onClick={handleCreate}
                disabled={loading}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold transition-colors"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ArrowRight className="w-5 h-5" /> Create Room</>}
              </button>
            </div>
          )}

          {mode === 'join' && (
            <div className="flex flex-col gap-4">
              <button onClick={() => { setMode('home'); setError(''); }} className="text-gray-500 text-sm hover:text-gray-300 text-left">← Back</button>
              <h2 className="text-xl font-bold text-white">Join a Room</h2>
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-red-500"
              />
              <input
                type="text"
                placeholder="Enter room code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={6}
                className="w-full px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 uppercase tracking-widest font-mono"
              />
              <div>
                <p className="text-gray-400 text-xs mb-2 uppercase tracking-wider flex items-center gap-2">
                  Avatar Color
                  {takenColors.length > 0 && (
                    <span className="text-yellow-500 text-[10px] normal-case">(taken colors marked)</span>
                  )}
                </p>
                <div className="flex gap-2 flex-wrap">
                  {AVATAR_COLORS.map((c) => {
                    const isTaken = takenColors.includes(c);
                    const isSelected = avatarColor === c;
                    return (
                      <button
                        key={c}
                        onClick={() => !isTaken && setAvatarColor(c)}
                        disabled={isTaken}
                        className={`w-8 h-8 rounded-full border-2 transition-all relative ${
                          isSelected ? 'border-white scale-110' : isTaken ? 'border-transparent opacity-40 cursor-not-allowed' : 'border-transparent hover:scale-105'
                        }`}
                        style={{ backgroundColor: c }}
                        title={isTaken ? 'Color already taken' : ''}
                      >
                        {isTaken && (
                          <Ban className="w-4 h-4 text-white/80 absolute inset-0 m-auto" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button
                onClick={handleJoin}
                disabled={loading}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold transition-colors"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><ArrowRight className="w-5 h-5" /> Join Room</>}
              </button>
            </div>
          )}
        </div>

        {/* Credits, Beta Testers & Feedback buttons */}
        <div className="flex items-center justify-center gap-2 mt-6 flex-wrap">
          <button
            onClick={() => setShowCredits(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-400 hover:text-white text-xs font-semibold transition-all"
          >
            <Heart className="w-3.5 h-3.5" /> Credits
          </button>
          <button
            onClick={() => setShowTesters(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-gray-700 text-gray-400 hover:text-white text-xs font-semibold transition-all"
          >
            <Award className="w-3.5 h-3.5" /> Beta Testers
          </button>
          <button
            onClick={() => setShowFeedback(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 border border-orange-700/50 text-orange-400 hover:text-orange-300 text-xs font-semibold transition-all"
          >
            <MessageSquare className="w-3.5 h-3.5" /> Feedback
          </button>
        </div>
      </div>

      {/* How to Play Modal */}
      {showHowToPlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4 animate-fadeIn">
          <div className="w-full max-w-lg bg-gray-950 border border-gray-800 rounded-3xl p-6 flex flex-col gap-5 shadow-2xl animate-popIn">

            {/* Header */}
            <div className="flex flex-col items-center gap-1 pb-1">
              {/* Top label */}
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-600/20 border border-red-500/40 mb-1">
                <span className="text-red-400 text-xl font-bold uppercase tracking-widest">Read first!</span>
              </div>
              {/* Big title */}
              <h2 className="text-3xl font-black text-white tracking-tight">How to Play</h2>
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent -mt-1" />

            {/* Role Introductions */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-red-950/50 border border-red-700/50 rounded-2xl p-4 flex flex-col gap-2">
                <div className="text-3xl">🎭</div>
                <p className="text-red-400 text-xs uppercase tracking-widest font-black">Sinungaling</p>
                <p className="text-gray-300 text-xs leading-relaxed">
                  You receive a <span className="text-red-300 font-semibold">different word </span> from everyone else.
                  You don&apos;t know the real word your job is to <span className="text-red-300 font-semibold">lie, blend in</span>, and
                  avoid being voted out. Sound convincing enough and you win!
                </p>
              </div>
              <div className="bg-indigo-950/50 border border-indigo-700/50 rounded-2xl p-4 flex flex-col gap-2">
                <div className="text-3xl">🕵️</div>
                <p className="text-indigo-400 text-xs uppercase tracking-widest font-black">Normal na Tao</p>
                <p className="text-gray-300 text-xs leading-relaxed">
                  You and most players share the <span className="text-indigo-300 font-semibold">same secret word</span>.
                  Give clues that prove you know it but watch out for the Sinungaling
                  trying to <span className="text-indigo-300 font-semibold">copy your hints</span>!
                </p>
              </div>
            </div>

            {/* Simple Instructions */}
            <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
              <p className="text-gray-300 text-sm leading-relaxed text-center">
                Everyone gets a secret word and takes turns giving clues.
                The <span className="text-red-400 font-semibold">Sinungaling</span> has a different word and must fake their way through.
                After all clues, vote for who you think is lying.
                Catch the Sinungaling to win, or be fooled and they win!
              </p>
            </div>

            {/* Confirm button */}
            <button
              onClick={handleConfirm}
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-black text-lg transition-all active:scale-95 flex items-center justify-center gap-2 shadow-lg shadow-red-900/40"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle className="w-5 h-5" /> Let&apos;s Play!</>}
            </button>

          </div>
        </div>
      )}

      {/* Credits Modal */}
      {showCredits && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-6 animate-fadeIn" onClick={() => setShowCredits(false)}>
          <div className="w-full max-w-xs bg-gray-900 border border-gray-700 rounded-3xl p-8 flex flex-col items-center gap-5 shadow-2xl animate-popIn" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowCredits(false)} className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-900/40">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-gray-500 font-bold mb-1">Developed by</p>
              <h3 className="text-2xl font-black text-white">Benkhair Najir</h3>
            </div>
            <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-700 to-transparent" />
            <p className="text-gray-400 text-xs text-center leading-relaxed">
              Boring kaya ginawa
            </p>
            <button
              onClick={() => setShowCredits(false)}
              className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-semibold text-sm transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Beta Testers Modal */}
      {showTesters && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-6 animate-fadeIn" onClick={() => setShowTesters(false)}>
          <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-3xl p-6 flex flex-col gap-5 shadow-2xl animate-popIn" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award className="w-5 h-5 text-yellow-400" />
                <h3 className="text-lg font-black text-white">Beta Testers</h3>
              </div>
              <button onClick={() => setShowTesters(false)} className="text-gray-500 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Special Thanks */}
            <div className="bg-gradient-to-br from-yellow-950/50 to-orange-950/50 border border-yellow-600/40 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-yellow-900/40">
                <Star className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-green-400 text-[10px] uppercase tracking-widest font-bold">Special Thanks</p>
                <p className="text-white font-bold text-xl">Ahmidserhan Halon</p>
                <p className="text-green-300/60 text-[10px]">Helped a lot throughout development</p>
              </div>
            </div>

            {/* Testers List */}
            <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: '#374151 transparent' }}>
              {[
                'Al-Qudcy Absara',
                'Al-Qadeer Tulawie',
                'Ahron Pasadilla',
                'Zoe Elas',
                'Ivan Guerrero',
                'Rogie Gabotero',
                'Jamie Anne Macasinag',
                'Marc Adriel Esperat',
                'James Bernard Santos',
                'Louie Apolinario',
                'Aldwin Ray Aguilo',
                'Khriz Marr Falcatan',
              ].map((name) => (
                <div key={name} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-800/60 border border-gray-700/50">
                  <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-gray-400 text-[10px] font-bold flex-shrink-0">
                    {name[0]}
                  </div>
                  <span className="text-gray-300 text-xs font-medium">{name}</span>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowTesters(false)}
              className="w-full py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white font-semibold text-sm transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
      {/* Feedback Modal */}
      {showFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-6 animate-fadeIn" onClick={() => { if (!fbSending) setShowFeedback(false); }}>
          <div className="w-full max-w-sm bg-gray-900 border border-gray-700 rounded-3xl p-6 flex flex-col gap-4 shadow-2xl animate-popIn" onClick={(e) => e.stopPropagation()}>

            {fbSent ? (
              <div className="flex flex-col items-center gap-4 py-8">
                <div className="w-16 h-16 rounded-full bg-green-600/20 border border-green-500/40 flex items-center justify-center">
                  <CircleCheck className="w-8 h-8 text-green-400" />
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-black text-white">Thank you!</h3>
                  <p className="text-gray-400 text-xs mt-1">Your feedback has been sent.</p>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-orange-400" />
                    <h3 className="text-lg font-black text-white">Send Feedback</h3>
                  </div>
                  <button onClick={() => setShowFeedback(false)} className="text-gray-500 hover:text-white transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-gray-500 text-xs">Report bugs, suggest features, or share anything.</p>

                {/* Name */}
                <input
                  type="text"
                  placeholder="Your name (optional)"
                  value={fbName}
                  onChange={(e) => setFbName(e.target.value)}
                  maxLength={30}
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 text-sm"
                />

                {/* Type selector */}
                <div className="flex gap-2">
                  {[
                    { value: 'bug' as const, label: 'Bug', icon: Bug, color: 'red' },
                    { value: 'suggestion' as const, label: 'Suggestion', icon: Lightbulb, color: 'yellow' },
                    { value: 'other' as const, label: 'Other', icon: MessageSquare, color: 'blue' },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => setFbType(opt.value)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
                        fbType === opt.value
                          ? opt.color === 'red' ? 'bg-red-950/50 border-red-500/50 text-red-400'
                            : opt.color === 'yellow' ? 'bg-yellow-950/50 border-yellow-500/50 text-yellow-400'
                            : 'bg-blue-950/50 border-blue-500/50 text-blue-400'
                          : 'bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      <opt.icon className="w-3.5 h-3.5" />
                      {opt.label}
                    </button>
                  ))}
                </div>

                {/* Message */}
                <textarea
                  placeholder="Describe the issue or your idea..."
                  value={fbMessage}
                  onChange={(e) => setFbMessage(e.target.value)}
                  maxLength={500}
                  rows={4}
                  className="w-full px-3 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500 text-sm resize-none"
                />
                <div className="flex items-center justify-between">
                  <span className="text-gray-600 text-[10px]">{fbMessage.length}/500</span>
                </div>

                {fbError && <p className="text-red-400 text-xs">{fbError}</p>}

                <button
                  onClick={handleFeedbackSubmit}
                  disabled={fbSending || !fbMessage.trim()}
                  className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
                >
                  {fbSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Send Feedback</>}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
