"use client";

import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  connectWebSocket,
  fetchRooms,
  fetchMessages,
  sendMessage,
  inviteUser,
  createRoom,
  selectRooms,
  selectActiveRoom,
  selectMessagesByRoom,
  setActiveRoom,
} from "@/lib/features/chat/chatSlice";
import SocketGate from "@/components/SocketGate";

export default function ChatDemoPage() {
  const dispatch = useAppDispatch();
  const rooms = useAppSelector(selectRooms);
  const activeRoom = useAppSelector(selectActiveRoom);
  const messages = useAppSelector((state) =>
    activeRoom ? selectMessagesByRoom(state, activeRoom) : []
  );

  // Local form state
  const [newRoomName, setNewRoomName] = useState("");
  const [text, setText] = useState("");
  const [inviteName, setInviteName] = useState("");

  // Initialize socket and load rooms
  useEffect(() => {
    dispatch(connectWebSocket()).then(() => {
      dispatch(fetchRooms());
    });
  }, [dispatch]);

  return (
    <SocketGate>
      <div
        style={{ display: "flex", height: "100vh", fontFamily: "sans-serif" }}
      >
        {/* -------- sidebar -------- */}
        <aside
          style={{ width: 260, borderRight: "1px solid #ccc", padding: 12 }}
        >
          {/* Create Room UI */}
          <h4>Create New Room</h4>
          <input
            value={newRoomName}
            placeholder="Room name"
            onChange={(e) => setNewRoomName(e.target.value)}
            style={{ width: "100%", marginBottom: 6 }}
          />
          <button
            style={{ width: "100%", marginBottom: 12 }}
            onClick={() => {
              if (newRoomName.trim()) {
                dispatch(createRoom({ name: newRoomName.trim() }))
                  .unwrap()
                  .then(() => setNewRoomName(""));
              }
            }}
          >
            Create Room
          </button>

          {/* Rooms list */}
          <h3>Rooms</h3>
          <ul style={{ listStyle: "none", padding: 0 }}>
            {rooms.map((r) => (
              <li
                key={r.id}
                style={{
                  padding: 6,
                  cursor: "pointer",
                  background: r.id === activeRoom ? "#eef" : undefined,
                }}
                onClick={() => {
                  dispatch(setActiveRoom(r.id));
                  dispatch(fetchMessages(r.id));
                }}
              >
                {r.name} {r.unread > 0 && <strong>({r.unread})</strong>}
              </li>
            ))}
          </ul>

          {/* Invite users */}
          {activeRoom && (
            <>
              <h4 style={{ marginTop: 24 }}>Invite User</h4>
              <input
                value={inviteName}
                placeholder="username"
                onChange={(e) => setInviteName(e.target.value)}
                style={{ width: "100%", marginBottom: 6 }}
              />
              <button
                style={{ width: "100%" }}
                onClick={() => {
                  if (inviteName.trim()) {
                    dispatch(
                      inviteUser({
                        roomId: activeRoom,
                        username: inviteName.trim(),
                      })
                    )
                      .unwrap()
                      .then(() => setInviteName(""));
                  }
                }}
              >
                Invite
              </button>
            </>
          )}
        </aside>

        {/* -------- messages panel -------- */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <div style={{ flex: 1, padding: 12, overflowY: "auto" }}>
            {messages.map((m) => (
              <div key={m.id} style={{ marginBottom: 6 }}>
                <strong>{m.sender}: </strong>
                <span>{m.content}</span>
                <small style={{ marginLeft: 6, color: "#888" }}>
                  {new Date(m.timestamp).toLocaleTimeString()}
                </small>
              </div>
            ))}
          </div>

          {activeRoom && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim()) {
                  dispatch(
                    sendMessage({ roomId: activeRoom, content: text.trim() })
                  );
                  setText("");
                }
              }}
              style={{
                display: "flex",
                borderTop: "1px solid #ccc",
                padding: 8,
              }}
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                style={{ flex: 1, marginRight: 8 }}
                placeholder="Type message…"
              />
              <button type="submit">Send</button>
            </form>
          )}
        </main>
      </div>
    </SocketGate>
  );
}
