import { JournalEntry, User, BabyProfile } from '../types';
import { generateId, calculateAge } from '../utils';

// Keys for LocalStorage
const STORAGE_KEY_ENTRIES = 'bpj_entries';
const STORAGE_KEY_PROFILE = 'bpj_profile';
const STORAGE_KEY_TAGS = 'bpj_tags';

// Simulated latency
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock Data Service
export const MockService = {
  login: async (): Promise<User> => {
    await delay(800);
    return {
      id: 'user_123',
      name: 'Demo Parent',
      email: 'parent@example.com',
      avatarUrl: 'https://picsum.photos/100/100'
    };
  },

  getProfile: async (): Promise<BabyProfile | null> => {
    const data = localStorage.getItem(STORAGE_KEY_PROFILE);
    return data ? JSON.parse(data) : null;
  },

  saveProfile: async (profile: BabyProfile): Promise<void> => {
    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
  },

  getTags: async (): Promise<string[]> => {
    const data = localStorage.getItem(STORAGE_KEY_TAGS);
    return data ? JSON.parse(data) : ['Happy', 'Milestone', 'Funny', 'Sleeping', 'Family'];
  },

  saveTags: async (tags: string[]): Promise<void> => {
    localStorage.setItem(STORAGE_KEY_TAGS, JSON.stringify(tags));
  },

  getEntries: async (): Promise<JournalEntry[]> => {
    await delay(500);
    const data = localStorage.getItem(STORAGE_KEY_ENTRIES);
    return data ? JSON.parse(data) : [];
  },

  saveEntry: async (entryData: Omit<JournalEntry, 'id' | 'ageAtTime'> & { id?: string }, birthDate: string): Promise<JournalEntry> => {
    await delay(1000);
    const entries = await MockService.getEntries();
    
    const ageAtTime = calculateAge(birthDate, entryData.date);
    
    let newEntry: JournalEntry;

    if (entryData.id) {
      // Update existing
      const index = entries.findIndex(e => e.id === entryData.id);
      if (index === -1) throw new Error("Entry not found");
      
      newEntry = {
        ...entries[index],
        ...entryData,
        ageAtTime,
        id: entryData.id
      };
      entries[index] = newEntry;
    } else {
      // Create new
      newEntry = {
        ...entryData,
        id: generateId(),
        ageAtTime
      };
      entries.unshift(newEntry); // Add to top
    }

    localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(entries));
    return newEntry;
  },

  deleteEntry: async (id: string): Promise<void> => {
    await delay(300);
    const entries = await MockService.getEntries();
    const filtered = entries.filter(e => e.id !== id);
    localStorage.setItem(STORAGE_KEY_ENTRIES, JSON.stringify(filtered));
  }
};