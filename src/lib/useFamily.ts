"use client";

import { useEffect, useState } from "react";
import { getActiveId, loadCalls, loadHousehold } from "./store";
import type { CallRecord, Household, Parent } from "./types";

interface State {
  household: Household | null;
  parent: Parent | null;        // the parent currently selected
  calls: CallRecord[];          // calls for the selected parent
  allCalls: CallRecord[];
}

/** Household + selected parent + their calls, from browser storage, kept in sync. */
export function useFamily(): State {
  const [state, setState] = useState<State>({ household: null, parent: null, calls: [], allCalls: [] });
  useEffect(() => {
    const sync = () => {
      const household = loadHousehold();
      const id = getActiveId();
      const parent = household.parents.find((p) => p.id === id) ?? household.parents[0];
      const allCalls = loadCalls();
      setState({ household, parent, allCalls, calls: allCalls.filter((c) => c.parentId === parent.id) });
    };
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
