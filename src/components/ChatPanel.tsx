"use client";

import { useState, useRef, useEffect, FormEvent, useCallback } from "react";
import { id } from "@instantdb/react";
import db from "@/lib/instantdb";

const COLORS = [
  "#e74c3c", "#3498db", "#2ecc71", "#f1c40f",
  "#9b59b6", "#e91e63", "#00bcd4", "#ff9800",
  "#1abc9c", "#ff5722", "#8bc34a", "#03a9f4",
  "#e67e22", "#1e90ff", "#e84393", "#00cec9",
  "#6c5ce7", "#fdcb6e", "#d63031", "#74b9ff",
  "#55efc4", "#fd79a8", "#a29bfe", "#ffeaa7",
  "#c0392b", "#2980b9", "#27ae60", "#f39c12",
  "#8e44ad", "#d81b60", "#0097a7", "#ef6c00",
  "#16a085", "#e64a19", "#689f38", "#0288d1",
  "#7e57c2", "#ff6f00", "#00897b", "#c62828",
  "#5c6bc0", "#ffb300", "#ad1457", "#00838f",
  "#4527a0", "#9e9d24", "#bf360c", "#00695c",
  "#283593", "#ff8f00", "#6a1b9a", "#00796b",
];

function nameColor(name: string) {
  const n = name.toLowerCase();
  let h = 0;
  for (let i = 0; i < n.length; i++) {
    h = n.charCodeAt(i) + ((h << 5) - h) + (i * 7);
  }
  // extra mixing
  h = ((h >>> 16) ^ h) * 0x45d9f3b;
  h = ((h >>> 16) ^ h) * 0x45d9f3b;
  h = (h >>> 16) ^ h;
  return COLORS[((h >>> 0) % COLORS.length)];
}

function formatTime(ts: number) {
  const date = new Date(ts);
  const now = new Date();
  const time = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return time;
  if (isYesterday) return `Yesterday ${time}`;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} ${time}`;
}

export default function ChatPanel() {
  const [username, setUsername] = useState<string | null>(null);
  const [usernameInput, setUsernameInput] = useState("");
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { isLoading, error, data } = db.useQuery({
    messages: { $: { order: { serverCreatedAt: "asc" }, limit: 100 } },
  });

  const messages = data?.messages ?? [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  function handleJoin(e: FormEvent) {
    e.preventDefault();
    const name = usernameInput.trim();
    if (name) setUsername(name);
  }

  function handleSend(e: FormEvent) {
    e.preventDefault();
    const text = messageText.trim();
    if (!text || !username) return;

    db.transact(
      db.tx.messages[id()].update({
        text,
        username,
        createdAt: Date.now(),
      })
    );
    setMessageText("");
  }

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col md:w-80 md:flex-initial md:border-l-2 md:border-neutral-800">
      {/* Chat Messages Area */}
      <div className="chat-scroll flex flex-1 flex-col-reverse overflow-y-auto p-4">
        {isLoading && (
          <p className="text-center text-xs font-bold uppercase tracking-wider text-neutral-600">
            Loading...
          </p>
        )}
        {error && (
          <p className="text-center text-xs font-bold uppercase tracking-wider text-red-500">
            Error loading chat
          </p>
        )}
        {!isLoading && messages.length === 0 && (
          <p className="text-center text-xs font-bold uppercase tracking-wider text-neutral-600">
            No messages yet
          </p>
        )}
        {[...messages].reverse().map((msg) => (
          <div key={msg.id} className="mb-3">
            <span className="text-xs font-black uppercase tracking-wider" style={{ color: nameColor(msg.username) }}>
              {msg.username}
            </span>
            <span className="ml-2 text-xs text-neutral-600">
              {formatTime(msg.createdAt)}
            </span>
            <p className="text-sm text-white">{msg.text}</p>
          </div>
        ))}
      </div>

      {/* Chat Input Area */}
      <div className="border-t-2 border-neutral-800 p-4">
        {!username ? (
          <form onSubmit={handleJoin} className="flex gap-2">
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              placeholder="Enter your name..."
              className="flex-1 border-2 border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white placeholder-neutral-600 outline-none focus:border-neutral-500"
            />
            <button
              type="submit"
              className="border-2 border-neutral-700 bg-neutral-900 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-neutral-800"
            >
              Join
            </button>
          </form>
        ) : (
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Send a message..."
              className="flex-1 border-2 border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white placeholder-neutral-600 outline-none focus:border-neutral-500"
            />
            <button
              type="submit"
              className="border-2 border-neutral-700 bg-neutral-900 px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-neutral-800"
            >
              Send
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
