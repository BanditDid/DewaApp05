export interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string;
}

export interface BabyProfile {
  name: string;
  birthDate: string; // ISO Date string
}

export interface Photo {
  id: string;
  url: string; // Object URL or Base64 for demo, Drive ID in prod
  mimeType: string;
}

export interface JournalEntry {
  id: string;
  date: string; // ISO Date string (Date taken)
  photos: Photo[];
  notes: string;
  tags: string[];
  ageAtTime: AgeDuration;
}

export interface AgeDuration {
  years: number;
  months: number;
  days: number;
}

export enum ViewMode {
  List = 'LIST',
  Grid = 'GRID',
}