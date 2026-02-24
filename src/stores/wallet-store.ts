import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

// define the shape of your state
interface WalletState {
  // data
  favorites: string[];
  searchHistory: string[];
  isDevnet: boolean;
  connectedPublicKey: string | null;

  // actions
  addFavorite: (address: string) => void;
  removeFavorite: (address: string) => void;
  isFavorite: (address: string) => boolean;
  addToHistory: (address: string) => void;
  clearHistory: () => void;
  toggleNetwork: () => void;
  setConnectedPublicKey: (publicKey: string | null) => void;
}

export const useWalletStore = create<WalletState>()(
  persist(
    (set, get) => ({
      // initial state
      favorites: [],
      searchHistory: [],
      isDevnet: false,
      connectedPublicKey: null,

      // actions
      addFavorite: (address) =>
        set((state) => ({
          favorites: state.favorites.includes(address)
            ? state.favorites
            : [address, ...state.favorites],
        })),

      removeFavorite: (address) =>
        set((state) => ({
          favorites: state.favorites.filter((a) => a !== address),
        })),

      isFavorite: (address) => get().favorites.includes(address),

      addToHistory: (address) =>
        set((state) => ({
          searchHistory: [
            address,
            ...state.searchHistory.filter((a) => a !== address),
          ].slice(0, 20),
        })),

      clearHistory: () => set({ searchHistory: [] }),

      toggleNetwork: () => set((state) => ({ isDevnet: !state.isDevnet })),

      setConnectedPublicKey: (publicKey) => set({ connectedPublicKey: publicKey }),
    }),
    {
      name: "wallet-storage",
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);