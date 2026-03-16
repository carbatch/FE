import { atomWithStorage } from 'jotai/utils';

export interface AuthUser {
  id: number;
  username: string;
}

export interface AuthState {
  token: string | null;
  user: AuthUser | null;
}

export const authAtom = atomWithStorage<AuthState>('carbatch_auth', { token: null, user: null });
