"use client";

import { useState } from "react";
import type { LobbyMemberView } from "@/lib/socket/events";
import { Avatar } from "./avatar";
import { ChevronDown, ChevronUp, Grip } from "./icons";

/** Déplace un élément d'un tableau (immutable). */
function move<T>(arr: T[], from: number, to: number): T[] {
  const next = [...arr];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function TableRoster({
  members,
  meId,
  isHost,
  canReorder,
  onReorder,
}: {
  members: LobbyMemberView[];
  meId: string | null;
  isHost: boolean;
  canReorder: boolean;
  onReorder: (order: string[]) => void;
}) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const reorderable = isHost && canReorder;

  function applyMove(fromId: string, toId: string) {
    if (fromId === toId) return;
    const ids = members.map((m) => m.id);
    const from = ids.indexOf(fromId);
    const to = ids.indexOf(toId);
    if (from < 0 || to < 0) return;
    onReorder(move(ids, from, to));
  }

  function nudge(id: string, dir: -1 | 1) {
    const ids = members.map((m) => m.id);
    const from = ids.indexOf(id);
    const to = from + dir;
    if (to < 0 || to >= ids.length) return;
    onReorder(move(ids, from, to));
  }

  return (
    <ul className="space-y-2">
      {members.map((m, i) => {
        const isMe = m.id === meId;
        const dragging = dragId === m.id;
        const over = overId === m.id && dragId !== null && dragId !== m.id;
        return (
          <li
            key={m.id}
            draggable={reorderable}
            onDragStart={(e) => {
              if (!reorderable) return;
              setDragId(m.id);
              e.dataTransfer.effectAllowed = "move";
            }}
            onDragOver={(e) => {
              if (!reorderable || !dragId) return;
              e.preventDefault();
              setOverId(m.id);
            }}
            onDrop={(e) => {
              if (!reorderable || !dragId) return;
              e.preventDefault();
              applyMove(dragId, m.id);
              setDragId(null);
              setOverId(null);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            className={`flex items-center gap-3 rounded-xl border bg-surface px-3 py-2.5 transition-all ${
              m.connected ? "border-border" : "border-border/50 opacity-50"
            } ${over ? "border-primary ring-1 ring-primary" : ""} ${
              dragging ? "opacity-40" : ""
            } ${reorderable ? "cursor-grab active:cursor-grabbing" : ""}`}
          >
            {reorderable && (
              <span className="text-muted/70" title="Glisser pour réordonner">
                <Grip size={16} />
              </span>
            )}

            <span className="w-5 text-center text-sm font-bold tabular-nums text-muted">
              {i + 1}
            </span>

            <Avatar name={m.name} image={m.image} size={34} />

            <span className="flex-1 truncate text-sm font-semibold">
              {m.name}
              {isMe && <span className="ml-1 text-xs text-primary">(toi)</span>}
            </span>

            {m.isHost && (
              <span title="Maître de table" className="text-xs">
                👑
              </span>
            )}

            {reorderable && (
              <span className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Monter"
                  disabled={i === 0}
                  onClick={() => nudge(m.id, -1)}
                  className="grid h-7 w-7 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-30"
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  aria-label="Descendre"
                  disabled={i === members.length - 1}
                  onClick={() => nudge(m.id, 1)}
                  className="grid h-7 w-7 place-items-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-30"
                >
                  <ChevronDown size={16} />
                </button>
              </span>
            )}

            {!reorderable &&
              (m.ready ? (
                <span className="text-xs font-bold text-emerald-500">Prêt</span>
              ) : (
                <span className="text-xs text-muted">…</span>
              ))}
          </li>
        );
      })}
    </ul>
  );
}
