import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void): () => void {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

const readOnline = () => navigator.onLine;

export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, readOnline, () => true);
}
