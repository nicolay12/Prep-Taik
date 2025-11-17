
export enum MessageType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  AUDIO = 'AUDIO',
  STICKER = 'STICKER'
}

export interface User {
  id: string;
  nickname: string;
  avatarUrl?: string;
  language: string; // Preferred language for translation
  isBlocked?: boolean;
}

export interface Message {
  id: string;
  senderId: string;
  recipientId?: string; // Targeted recipient for direct messages
  content: string; // Text content or base64/url for media
  type: MessageType;
  timestamp: number;
  isEdited?: boolean;
  translatedContent?: string; // Cache for translation
}

export interface Chat {
  id: string;
  name: string; // User nickname or Group name
  type: 'direct' | 'group' | 'channel';
  participants: User[];
  messages: Message[];
  avatarUrl?: string;
  unreadCount: number;
  lastMessage?: Message;
}

export interface Story {
  id: string;
  userId: string;
  mediaUrl: string;
  timestamp: number;
  viewed: boolean;
}

export type ScreenView = 'auth' | 'chat_list' | 'chat_room' | 'call' | 'profile' | 'channels' | 'stories_feed' | 'select_contact';

export const LANGUAGES = [
  "English", "Russian", "Spanish", "French", "German", 
  "Chinese", "Japanese", "Korean", "Arabic", "Hindi", 
  "Portuguese", "Italian", "Turkish"
];
