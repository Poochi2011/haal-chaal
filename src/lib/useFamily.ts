"use client";

import { useEffect, useState } from "react";
import { loadCalls, loadFamily } from "./store";
import type { CallRecord, Family } from "./types";

/** Family profile + call history from browser storage, kept in sync. */
export function useFamily(): { family: Family | null; calls: CallRecord[] } {
  const [state, setState] = useState<{ family: Family | null; calls: CallRecord[] }>({ family: null, calls: [] });
  useEffect(() => {
    const sync = () => setState({ family: loadFamily(), calls: loadCalls() });
    sync();
    window.addEventListener("haalchaal:change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("haalchaal:change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return state;
}
