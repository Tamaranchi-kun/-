import { create } from 'zustand';

type Category = 'image' | 'audio' | 'food' | 'text';

interface GameState {
  category: Category | null;
  score: number;
  total: number;
  nickname: string;
  setCategory: (c: Category) => void;
  addScore: (correct: boolean) => void;
  setNickname: (n: string) => void;
  reset: () => void;
}

export const useGameStore = create<GameState>((set) => ({
  category: null,
  score: 0,
  total: 0,
  nickname: '',
  setCategory: (category) => set({ category, score: 0, total: 0 }),
  addScore: (correct) =>
    set((s) => ({ score: s.score + (correct ? 1 : 0), total: s.total + 1 })),
  setNickname: (nickname) => set({ nickname }),
  reset: () => set({ category: null, score: 0, total: 0 }),
}));
