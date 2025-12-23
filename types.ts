
export type Screen = 
  | 'SPLASH' 
  | 'LOGIN'
  | 'CONSENT' 
  | 'ONBOARDING_AGE' 
  | 'ONBOARDING_WORK' 
  | 'ONBOARDING_WELLBEING' 
  | 'DASHBOARD' 
  | 'CHECK_IN' 
  | 'INSIGHTS' 
  | 'CHAT' 
  | 'ANALYTICS' 
  | 'NUDGES' 
  | 'PROFILE'
  | 'WORK_TRACKER'
  | 'CALL_SELECT'
  | 'AI_CALL'
  | 'PEER_CALL';

export interface UserData {
  ageRange: string;
  workHours: number;
  workAfterHours: boolean;
  baseStress: string;
  baseLoneliness: string;
  hasOnboarded: boolean;
  isLoggedIn: boolean;
  loginMethod?: 'google' | 'mobile';
}

export interface BreakSession {
  id: number;
  label: string;
  start?: string;
  end?: string;
  status: 'idle' | 'active' | 'done';
}

export interface WorkShift {
  shiftStart?: string;
  shiftEnd?: string;
  breaks: BreakSession[];
}

export interface DailyLog {
  date: string;
  mood: string;
  stressLevel: number;
  socialized: boolean;
  sleepHours: number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}
