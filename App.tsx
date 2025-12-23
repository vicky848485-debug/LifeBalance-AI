
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Screen, UserData, DailyLog, ChatMessage, WorkShift, BreakSession } from './types';
import { COLORS, Icons } from './constants';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';
import { getGeminiResponse } from './services/gemini';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';

// --- Utilities for Audio ---
function encode(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const ProgressBar: React.FC<{ step: number; total: number }> = ({ step, total }) => (
  <div className="flex justify-center space-x-2 my-6">
    {Array.from({ length: total }).map((_, i) => (
      <div
        key={i}
        className={`h-2.5 w-2.5 rounded-full ${
          i < step ? 'bg-indigo-600' : 'bg-gray-300'
        }`}
      />
    ))}
  </div>
);

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('SPLASH');
  const [userData, setUserData] = useState<UserData>({
    ageRange: '26-35',
    workHours: 8,
    workAfterHours: false,
    baseStress: 'Neutral',
    baseLoneliness: 'Sometimes',
    hasOnboarded: false,
  });

  const [workShift, setWorkShift] = useState<WorkShift>({
    breaks: [
      { id: 1, label: 'Break 1', status: 'idle' },
      { id: 2, label: 'Break 2', status: 'idle' },
      { id: 3, label: 'Break 3', status: 'idle' },
      { id: 4, label: 'Break 4', status: 'idle' },
      { id: 5, label: 'Break 5', status: 'idle' },
    ]
  });

  const [logs, setLogs] = useState<DailyLog[]>([
    { date: 'Mon', mood: 'Good', stressLevel: 2, socialized: true, sleepHours: 7 },
    { date: 'Tue', mood: 'Okay', stressLevel: 3, socialized: false, sleepHours: 6 },
    { date: 'Wed', mood: 'Great', stressLevel: 1, socialized: true, sleepHours: 8 },
  ]);

  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  const wellnessScore = useMemo(() => {
    const logWeight = logs.length > 0 ? (logs.reduce((acc, curr) => acc + (5 - curr.stressLevel), 0) / logs.length) * 20 : 70;
    return Math.min(100, Math.floor(logWeight));
  }, [logs]);

  // --- Screens ---

  const SplashScreen = () => (
    <div className="flex flex-col items-center justify-between min-h-screen p-8 bg-white overflow-hidden">
      <div className="flex-1 flex flex-col items-center justify-center animate-in fade-in duration-700">
        <Icons.Logo />
        <h1 className="text-3xl font-bold mt-6 mb-2 tracking-tight">LifeBalance AI</h1>
        <p className="text-gray-500 text-center max-w-xs">
          Your AI companion for balance & well-being
        </p>
      </div>
      <button
        onClick={() => setCurrentScreen('CONSENT')}
        className="w-full py-4 bg-indigo-600 text-white rounded-xl text-lg font-medium shadow-lg hover:bg-indigo-700 active:scale-95 transition-all"
      >
        Get Started
      </button>
    </div>
  );

  const ConsentScreen = () => (
    <div className="flex flex-col min-h-screen p-8 bg-white overflow-hidden">
      <h2 className="text-2xl font-bold mt-12 mb-4">Welcome to LifeBalance AI</h2>
      <p className="text-gray-600 mb-8 leading-relaxed">
        We help you understand stress, loneliness, and work-life balance using AI.
      </p>
      <div className="flex items-start mb-12">
        <input type="checkbox" id="consent" className="mt-1.5 mr-3 w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" defaultChecked />
        <label htmlFor="consent" className="text-gray-700 text-sm">
          I agree to the Privacy Policy & Terms of Service.
        </label>
      </div>
      <button
        onClick={() => setCurrentScreen('ONBOARDING_AGE')}
        className="w-full py-4 bg-indigo-600 text-white rounded-xl font-medium shadow-md hover:bg-indigo-700 transition-colors"
      >
        Continue
      </button>
      <p className="text-center text-gray-400 text-xs mt-6 uppercase tracking-widest font-semibold">
        This app does not provide medical advice.
      </p>
    </div>
  );

  const AgeOnboarding = () => (
    <div className="flex flex-col min-h-screen p-8 max-w-md mx-auto">
      <ProgressBar step={1} total={3} />
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-4">
        <h3 className="text-xl font-bold mb-6">Your Age</h3>
        <select 
          className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
          value={userData.ageRange}
          onChange={(e) => setUserData({ ...userData, ageRange: e.target.value })}
        >
          <option>18–25</option>
          <option>26–35</option>
          <option>36–45</option>
          <option>45+</option>
        </select>
      </div>
      <div className="mt-auto pb-8">
        <button onClick={() => setCurrentScreen('ONBOARDING_WORK')} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-medium">Next</button>
      </div>
    </div>
  );

  const WorkOnboarding = () => (
    <div className="flex flex-col min-h-screen p-8 max-w-md mx-auto">
      <ProgressBar step={2} total={3} />
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-4 space-y-8">
        <div>
          <h3 className="text-lg font-semibold mb-2">How many hours do you work per day?</h3>
          <input type="range" min="0" max="14" value={userData.workHours}
            onChange={(e) => setUserData({...userData, workHours: parseInt(e.target.value)})}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
          <p className="text-right text-indigo-600 font-bold mt-2">{userData.workHours} hours</p>
        </div>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Do you work after office hours?</h3>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={userData.workAfterHours}
              onChange={(e) => setUserData({...userData, workAfterHours: e.target.checked})} />
            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-checked:bg-indigo-600 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full"></div>
          </label>
        </div>
      </div>
      <div className="mt-auto pb-8">
        <button onClick={() => setCurrentScreen('ONBOARDING_WELLBEING')} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-medium">Next</button>
      </div>
    </div>
  );

  const WellBeingOnboarding = () => (
    <div className="flex flex-col min-h-screen p-8 max-w-md mx-auto">
      <ProgressBar step={3} total={3} />
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mt-4 space-y-8">
        <div>
          <h3 className="text-lg font-semibold mb-4">How stressed do you feel most days?</h3>
          <div className="flex justify-between text-3xl">
            {['😌', '🙂', '😐', '😟', '😣'].map((emoji, i) => (
              <button key={i} className={`transition-transform ${userData.baseStress === emoji ? 'scale-125 border-b-2 border-indigo-500' : 'opacity-50'}`}
                onClick={() => setUserData({...userData, baseStress: emoji})}>
                {emoji}
              </button>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-4">How often do you feel lonely?</h3>
          <div className="space-y-2">
            {['Never', 'Sometimes', 'Often', 'Very Often'].map((option) => (
              <label key={option} className="flex items-center p-4 bg-gray-50 rounded-xl cursor-pointer">
                <input type="radio" name="lonely" className="w-4 h-4 text-indigo-600" checked={userData.baseLoneliness === option}
                  onChange={() => setUserData({...userData, baseLoneliness: option})} />
                <span className="ml-3 text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-auto pb-8">
        <button onClick={() => { setUserData({ ...userData, hasOnboarded: true }); setCurrentScreen('DASHBOARD'); }}
          className="w-full py-4 bg-indigo-600 text-white rounded-xl font-medium">Finish Setup</button>
      </div>
    </div>
  );

  const Dashboard = () => (
    <div className="p-6 pb-28 space-y-6 max-w-md mx-auto">
      <header className="flex justify-between items-center">
        <div>
          <h2 className="text-gray-500 text-sm">Good Evening, 👋</h2>
          <h1 className="text-2xl font-bold">LifeBalance AI</h1>
        </div>
        <div className="w-10 h-10 bg-gray-200 rounded-full overflow-hidden border-2 border-white shadow-sm cursor-pointer" onClick={() => setCurrentScreen('PROFILE')}>
          <img src="https://picsum.photos/100/100?random=1" alt="profile" />
        </div>
      </header>

      {/* Primary Action Row */}
      <div className="flex gap-4">
        <button onClick={() => setCurrentScreen('WORK_TRACKER')} className="flex-1 bg-white p-4 rounded-3xl card-shadow flex flex-col items-center justify-center space-y-2 border border-indigo-50 hover:bg-indigo-50 transition-colors">
          <div className="bg-indigo-100 p-2 rounded-xl"><Icons.Clock className="text-indigo-600" /></div>
          <span className="text-xs font-bold text-gray-700">Work Shift</span>
        </button>
        <button onClick={() => setCurrentScreen('CALL_SELECT')} className="flex-1 bg-white p-4 rounded-3xl card-shadow flex flex-col items-center justify-center space-y-2 border border-green-50 hover:bg-green-50 transition-colors">
          <div className="bg-green-100 p-2 rounded-xl"><Icons.Call className="text-green-600" /></div>
          <span className="text-xs font-bold text-gray-700">Voice Call</span>
        </button>
      </div>

      {/* Wellness Score Card */}
      <div className="bg-indigo-600 p-6 rounded-3xl shadow-xl text-white relative overflow-hidden">
        <div className="absolute -right-4 -top-4 opacity-10"><Icons.Logo /></div>
        <div className="flex justify-between items-center mb-4">
          <span className="font-medium opacity-90">Wellness Score</span>
          <span className="bg-white/20 text-white text-[10px] font-bold px-2 py-1 rounded-lg uppercase tracking-wider">Updating Live</span>
        </div>
        <div className="flex items-baseline space-x-2">
          <span className="text-5xl font-black">{wellnessScore}</span>
          <span className="text-indigo-200">/ 100</span>
        </div>
        <div className="w-full bg-indigo-900/30 h-2 rounded-full mt-6">
          <div className="h-full rounded-full bg-white transition-all duration-1000" style={{ width: `${wellnessScore}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-3xl card-shadow border border-gray-50">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-orange-500">🔥</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Burnout Risk</span>
          </div>
          <p className="text-xl font-bold text-amber-500">Medium</p>
        </div>
        <div className="bg-white p-4 rounded-3xl card-shadow border border-gray-50">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-indigo-500">😊</span>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">Daily Mood</span>
          </div>
          <p className="text-xl font-bold text-green-500">Stable</p>
        </div>
      </div>

      <div className="space-y-3">
        <button onClick={() => setCurrentScreen('CHECK_IN')} className="w-full flex items-center justify-between p-5 bg-white border border-gray-100 rounded-3xl text-gray-700 font-bold shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-4">
            <div className="bg-indigo-100 p-2 rounded-xl">📝</div>
            <span>Daily Check-in</span>
          </div>
          <span className="text-gray-300 font-light">›</span>
        </button>
        <button onClick={() => setCurrentScreen('INSIGHTS')} className="w-full flex items-center justify-between p-5 bg-white border border-gray-100 rounded-3xl text-gray-700 font-bold shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-4">
            <div className="bg-amber-100 p-2 rounded-xl">💡</div>
            <span>AI Insights</span>
          </div>
          <span className="text-gray-300 font-light">›</span>
        </button>
      </div>
    </div>
  );

  const WorkTracker = () => {
    const toggleShift = () => {
      setWorkShift(prev => ({
        ...prev,
        shiftStart: prev.shiftStart ? prev.shiftStart : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        shiftEnd: prev.shiftStart ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined
      }));
    };

    const toggleBreak = (id: number) => {
      setWorkShift(prev => ({
        ...prev,
        breaks: prev.breaks.map(b => {
          if (b.id === id) {
            if (b.status === 'idle') return { ...b, status: 'active', start: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
            if (b.status === 'active') return { ...b, status: 'done', end: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
          }
          return b;
        })
      }));
    };

    return (
      <div className="p-6 pb-28 space-y-6 max-w-md mx-auto min-h-screen bg-gray-50">
        <header className="flex items-center space-x-4">
          <button onClick={() => setCurrentScreen('DASHBOARD')} className="p-2 bg-white rounded-full shadow-sm">←</button>
          <h1 className="text-xl font-bold">Shift Tracker</h1>
        </header>

        <div className="bg-white p-6 rounded-3xl card-shadow space-y-6">
          <div className="flex justify-between items-center border-b pb-4">
            <div>
              <h2 className="font-bold text-lg">Daily Shift</h2>
              <p className="text-xs text-gray-400">{workShift.shiftStart ? `Started at ${workShift.shiftStart}` : 'Not started'}</p>
            </div>
            <button 
              onClick={toggleShift}
              className={`px-6 py-2 rounded-2xl font-bold text-sm shadow-sm transition-all ${workShift.shiftEnd ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : workShift.shiftStart ? 'bg-red-500 text-white' : 'bg-indigo-600 text-white'}`}
              disabled={!!workShift.shiftEnd}
            >
              {workShift.shiftEnd ? 'Completed' : workShift.shiftStart ? 'End Shift' : 'Start Shift'}
            </button>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Breaks (1–5)</h3>
            {workShift.breaks.map(b => (
              <div key={b.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                <div>
                  <h4 className="font-bold text-gray-700">{b.label}</h4>
                  <p className="text-[10px] text-gray-400">
                    {b.start ? `${b.start} ${b.end ? `- ${b.end}` : '(Ongoing)'}` : 'Available'}
                  </p>
                </div>
                <button 
                  onClick={() => toggleBreak(b.id)}
                  disabled={b.status === 'done'}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${b.status === 'idle' ? 'bg-white text-indigo-600' : b.status === 'active' ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-400'}`}
                >
                  {b.status === 'idle' ? 'In' : b.status === 'active' ? 'Out' : 'Done'}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const CallSelect = () => (
    <div className="p-6 space-y-8 max-w-md mx-auto bg-white min-h-screen">
      <header className="flex items-center space-x-4">
        <button onClick={() => setCurrentScreen('DASHBOARD')} className="p-2 bg-gray-50 rounded-full">←</button>
        <h1 className="text-xl font-bold">Wellness Call</h1>
      </header>

      <div className="space-y-4 pt-10">
        <div onClick={() => setCurrentScreen('AI_CALL')} className="group bg-indigo-50 p-8 rounded-[40px] text-center space-y-4 cursor-pointer hover:bg-indigo-100 transition-all border border-indigo-100">
          <div className="text-5xl mx-auto w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">🤖</div>
          <div>
            <h2 className="text-xl font-bold text-indigo-900">AI Wellness Agent</h2>
            <p className="text-sm text-indigo-700/60 mt-1">Talk privately with our empathetic AI about your stress and emotions.</p>
          </div>
        </div>

        <div onClick={() => setCurrentScreen('PEER_CALL')} className="group bg-green-50 p-8 rounded-[40px] text-center space-y-4 cursor-pointer hover:bg-green-100 transition-all border border-green-100">
          <div className="text-5xl mx-auto w-20 h-20 bg-white rounded-3xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">🤝</div>
          <div>
            <h2 className="text-xl font-bold text-green-900">Connect with Peer</h2>
            <p className="text-sm text-green-700/60 mt-1">Speak with a verified community member for mutual support and relief.</p>
          </div>
        </div>
      </div>
    </div>
  );

  const AICallScreen = () => {
    const [status, setStatus] = useState('Connecting...');
    const [isMuted, setIsMuted] = useState(false);
    const sessionRef = useRef<any>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const nextStartTimeRef = useRef<number>(0);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

    useEffect(() => {
      let isMounted = true;
      const startCall = async () => {
        try {
          const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          
          const sessionPromise = ai.live.connect({
            model: 'gemini-2.5-flash-native-audio-preview-09-2025',
            callbacks: {
              onopen: () => {
                if (isMounted) setStatus('Listening...');
                const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
                const source = inputCtx.createMediaStreamSource(stream);
                const processor = inputCtx.createScriptProcessor(4096, 1, 1);
                processor.onaudioprocess = (e) => {
                  if (isMuted) return;
                  const inputData = e.inputBuffer.getChannelData(0);
                  const int16 = new Int16Array(inputData.length);
                  for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
                  const pcmBlob = {
                    data: encode(new Uint8Array(int16.buffer)),
                    mimeType: 'audio/pcm;rate=16000',
                  };
                  sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
                };
                source.connect(processor);
                processor.connect(inputCtx.destination);
              },
              onmessage: async (msg: LiveServerMessage) => {
                const base64Audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                if (base64Audio && audioContextRef.current) {
                  setStatus('AI Speaking...');
                  const ctx = audioContextRef.current;
                  nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
                  const buffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
                  const source = ctx.createBufferSource();
                  source.buffer = buffer;
                  source.connect(ctx.destination);
                  source.start(nextStartTimeRef.current);
                  nextStartTimeRef.current += buffer.duration;
                  sourcesRef.current.add(source);
                  source.onended = () => {
                    sourcesRef.current.delete(source);
                    if (sourcesRef.current.size === 0) setStatus('Listening...');
                  };
                }
              },
              onclose: () => { if (isMounted) setCurrentScreen('CALL_SELECT'); },
              onerror: (e) => console.error(e),
            },
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
              systemInstruction: "You are an empathetic, calm, and supportive wellness AI. The user is calling you to vent or seek comfort. Listen more than you speak. Keep responses very short and human-like.",
            }
          });
          sessionRef.current = await sessionPromise;
        } catch (err) {
          console.error(err);
          if (isMounted) setStatus('Error connecting');
        }
      };

      startCall();
      return () => {
        isMounted = false;
        sessionRef.current?.close();
        audioContextRef.current?.close();
      };
    }, []);

    return (
      <div className="flex flex-col h-screen bg-indigo-900 text-white items-center justify-between p-12">
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-bold tracking-tight">AI Wellness Session</h2>
          <p className="text-indigo-300 font-medium">{status}</p>
        </div>

        <div className="relative">
          <div className="w-48 h-48 rounded-full bg-white/10 flex items-center justify-center animate-pulse">
            <div className="w-32 h-32 rounded-full bg-indigo-500/30 flex items-center justify-center">
              <div className="w-20 h-20 rounded-full bg-indigo-400 flex items-center justify-center shadow-2xl">
                <Icons.Call className="w-10 h-10 text-white" />
              </div>
            </div>
          </div>
          {status === 'AI Speaking...' && (
            <div className="absolute inset-0 flex items-center justify-center">
               <div className="w-64 h-64 border-2 border-indigo-400/20 rounded-full animate-ping"></div>
            </div>
          )}
        </div>

        <div className="flex space-x-8">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-red-500 shadow-red-500/50' : 'bg-white/10 hover:bg-white/20'}`}
          >
            {isMuted ? '🔇' : '🎙️'}
          </button>
          <button 
            onClick={() => setCurrentScreen('CALL_SELECT')}
            className="w-16 h-16 rounded-full bg-red-600 flex items-center justify-center shadow-lg shadow-red-900/40 active:scale-90 transition-transform"
          >
             <Icons.Call className="w-8 h-8 rotate-[135deg]" />
          </button>
        </div>
      </div>
    );
  };

  const AIChat = () => {
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }
    }, [chatHistory, isTyping]);

    const handleSend = async () => {
      if (!input.trim()) return;
      const userMsg: ChatMessage = { role: 'user', text: input };
      setChatHistory(prev => [...prev, userMsg]);
      setInput('');
      setIsTyping(true);
      const aiText = await getGeminiResponse(chatHistory, input);
      setChatHistory(prev => [...prev, { role: 'model', text: aiText }]);
      setIsTyping(false);
    };

    return (
      <div className="flex flex-col h-screen bg-white">
        <header className="bg-white px-6 py-4 flex items-center border-b border-gray-100 sticky top-0 z-20">
          <button onClick={() => setCurrentScreen('DASHBOARD')} className="mr-4 text-gray-400 bg-gray-50 p-2 rounded-full">←</button>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-sm">L</div>
            <div>
              <h2 className="font-bold text-gray-800">Empathetic Chat</h2>
              <div className="flex items-center space-x-1">
                <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">AI Support</span>
              </div>
            </div>
          </div>
        </header>

        {/* This container must have a defined height or grow to fill space */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 bg-gray-50/50">
          {chatHistory.length === 0 && (
            <div className="bg-white p-8 rounded-3xl text-center text-gray-500 text-sm shadow-sm border border-gray-100 max-w-xs mx-auto mt-10">
              <p className="leading-relaxed font-medium">Hello! I'm here to listen. Whether you're feeling overwhelmed, lonely, or just need to vent, I'm all ears.</p>
            </div>
          )}
          {chatHistory.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
              <div className={`max-w-[85%] p-4 px-5 rounded-2xl shadow-sm text-sm leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-gray-700 border border-gray-100 rounded-tl-none'}`}>
                {msg.text}
              </div>
            </div>
          ))}
          {isTyping && (
            <div className="flex justify-start">
              <div className="bg-white p-4 px-6 rounded-3xl rounded-tl-none shadow-sm text-indigo-600 flex space-x-1 items-center font-bold">
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce"></div>
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce delay-75"></div>
                <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce delay-150"></div>
              </div>
            </div>
          )}
        </div>

        {/* Sticky Input Area */}
        <div className="p-4 bg-white border-t border-gray-100 safe-area-bottom">
          <div className="flex space-x-2 max-w-lg mx-auto bg-gray-50 p-2 rounded-2xl shadow-inner border border-gray-100">
            <input 
              type="text" 
              placeholder="How are you really feeling?" 
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              className="flex-1 bg-transparent border-none px-4 py-2 text-sm focus:ring-0 focus:outline-none placeholder-gray-400"
            />
            <button 
              onClick={handleSend}
              className="bg-indigo-600 text-white p-3 rounded-xl shadow-lg active:scale-95 transition-all flex items-center justify-center"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          </div>
          <div className="flex justify-center mt-3">
             <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest">LifeBalance Confidential AI</span>
          </div>
        </div>
      </div>
    );
  };

  const DailyCheckIn = () => {
    const [mood, setMood] = useState('😐');
    const [stress, setStress] = useState(3);
    const [social, setSocial] = useState(true);
    const [sleep, setSleep] = useState(7);

    const handleSubmit = () => {
      const newLog = {
        date: new Date().toLocaleDateString('en-US', { weekday: 'short' }),
        mood, stressLevel: stress, socialized: social, sleepHours: sleep
      };
      setLogs([...logs, newLog]);
      setCurrentScreen('DASHBOARD');
    };

    return (
      <div className="p-6 pb-24 space-y-8 min-h-screen bg-white max-w-md mx-auto">
        <div className="flex items-center space-x-4">
          <button onClick={() => setCurrentScreen('DASHBOARD')} className="p-2 bg-gray-100 rounded-full">←</button>
          <h1 className="text-xl font-bold">Daily Check-in</h1>
        </div>
        <div className="space-y-8">
          <div>
            <h3 className="text-lg font-semibold mb-4 text-center">How was your day?</h3>
            <div className="flex justify-between text-4xl bg-gray-50 p-6 rounded-3xl">
              {['😣', '😟', '😐', '🙂', '😊'].map(e => (
                <button key={e} className={`transition-all ${mood === e ? 'scale-150 drop-shadow-lg' : 'opacity-40 grayscale'}`} onClick={() => setMood(e)}>{e}</button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-semibold">Stress Level</h3><span className="text-indigo-600 font-bold">{stress}/5</span></div>
            <input type="range" min="1" max="5" value={stress} onChange={e => setStress(parseInt(e.target.value))} className="w-full h-3 bg-gray-200 rounded-full appearance-none cursor-pointer accent-indigo-600" />
          </div>
          <button onClick={handleSubmit} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg mt-4">Submit Check-in</button>
        </div>
      </div>
    );
  };

  const AIInsights = () => (
    <div className="p-6 pb-24 space-y-6 max-w-md mx-auto">
      <header className="flex items-center space-x-4">
        <button onClick={() => setCurrentScreen('DASHBOARD')} className="p-2 bg-white rounded-full shadow-sm">←</button>
        <h1 className="text-xl font-bold">AI Insights</h1>
      </header>
      <div className="grid gap-4">
        <div className="bg-white p-5 rounded-3xl card-shadow border-l-4 border-indigo-500">
          <h3 className="font-bold text-gray-700 flex items-center mb-2">🕒 Work Pattern</h3>
          <p className="text-gray-600 text-sm">"You've logged 3 breaks today. Great progress on pacing yourself."</p>
        </div>
        <div className="bg-white p-5 rounded-3xl card-shadow border-l-4 border-red-500">
          <h3 className="font-bold text-gray-700 flex items-center mb-2">📉 Stress Trend</h3>
          <p className="text-gray-600 text-sm">"Stress levels often spike before your 2nd break. Try deep breathing then."</p>
        </div>
      </div>
    </div>
  );

  const Analytics = () => {
    const data = logs.map(l => ({ name: l.date, mood: l.mood === '😊' ? 5 : l.mood === 'Great' ? 5 : 3, stress: l.stressLevel }));
    return (
      <div className="p-6 pb-28 space-y-8 bg-white min-h-screen max-w-md mx-auto">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><XAxis dataKey="name" /><Tooltip /><Line type="monotone" dataKey="mood" stroke="#4F46E5" strokeWidth={3} /></LineChart></ResponsiveContainer></div>
        <div className="bg-indigo-50 p-6 rounded-3xl"><h3 className="font-bold mb-2">Weekly Summary</h3><p className="text-sm opacity-80 leading-relaxed">Your emotional regulation has improved by 12% this week by tracking breaks.</p></div>
      </div>
    );
  };

  const Profile = () => (
    <div className="p-6 pb-28 space-y-8 bg-white min-h-screen max-w-md mx-auto">
      <div className="flex flex-col items-center pt-8">
        <div className="w-24 h-24 rounded-full border-4 border-indigo-100 p-1 mb-4"><img src="https://picsum.photos/200/200" className="w-full h-full rounded-full object-cover" /></div>
        <h2 className="text-xl font-bold">Alex Johnson</h2>
        <p className="text-sm text-gray-400">Premium Member</p>
      </div>
      <div className="space-y-3">
        {['Personal Info', 'Data Export', 'Support'].map(i => (
          <button key={i} className="w-full text-left p-4 bg-gray-50 rounded-2xl font-medium">{i}</button>
        ))}
        <button onClick={() => setCurrentScreen('SPLASH')} className="w-full p-4 text-red-600 font-bold border-t border-gray-100 mt-6">Log Out</button>
      </div>
    </div>
  );

  const renderScreen = () => {
    switch (currentScreen) {
      case 'SPLASH': return <SplashScreen />;
      case 'CONSENT': return <ConsentScreen />;
      case 'ONBOARDING_AGE': return <AgeOnboarding />;
      case 'ONBOARDING_WORK': return <WorkOnboarding />;
      case 'ONBOARDING_WELLBEING': return <WellBeingOnboarding />;
      case 'DASHBOARD': return <Dashboard />;
      case 'CHECK_IN': return <DailyCheckIn />;
      case 'WORK_TRACKER': return <WorkTracker />;
      case 'INSIGHTS': return <AIInsights />;
      case 'CHAT': return <AIChat />;
      case 'CALL_SELECT': return <CallSelect />;
      case 'AI_CALL': return <AICallScreen />;
      case 'ANALYTICS': return <Analytics />;
      case 'PROFILE': return <Profile />;
      default: return <Dashboard />;
    }
  };

  const showNavbar = ['DASHBOARD', 'CHAT', 'ANALYTICS', 'PROFILE', 'INSIGHTS', 'WORK_TRACKER'].includes(currentScreen);

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white relative shadow-2xl overflow-hidden flex flex-col">
      <main className="flex-1 overflow-y-auto pb-safe-bottom">
        {renderScreen()}
      </main>

      {showNavbar && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 flex justify-around p-4 pb-8 z-30 rounded-t-3xl shadow-[0_-8px_30px_rgb(0,0,0,0.04)]">
          <button onClick={() => setCurrentScreen('DASHBOARD')} className={`flex flex-col items-center flex-1 ${currentScreen === 'DASHBOARD' ? 'text-indigo-600 scale-110' : 'text-gray-300'}`}>
            <Icons.Home className="w-6 h-6 mb-1" /><span className="text-[10px] font-bold">Home</span>
          </button>
          <button onClick={() => setCurrentScreen('CHAT')} className={`flex flex-col items-center flex-1 ${currentScreen === 'CHAT' ? 'text-indigo-600 scale-110' : 'text-gray-300'}`}>
            <Icons.Chat className="w-6 h-6 mb-1" /><span className="text-[10px] font-bold">Chat</span>
          </button>
          <button onClick={() => setCurrentScreen('ANALYTICS')} className={`flex flex-col items-center flex-1 ${currentScreen === 'ANALYTICS' ? 'text-indigo-600 scale-110' : 'text-gray-300'}`}>
            <Icons.Chart className="w-6 h-6 mb-1" /><span className="text-[10px] font-bold">Stats</span>
          </button>
          <button onClick={() => setCurrentScreen('PROFILE')} className={`flex flex-col items-center flex-1 ${currentScreen === 'PROFILE' ? 'text-indigo-600 scale-110' : 'text-gray-300'}`}>
            <Icons.Profile className="w-6 h-6 mb-1" /><span className="text-[10px] font-bold">Profile</span>
          </button>
        </nav>
      )}
    </div>
  );
};

export default App;
