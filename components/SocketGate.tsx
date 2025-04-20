"use client";

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/lib/hooks";
import {
  connectWebSocket,
  selectIsConnected,
  selectIsConnecting,
  selectError,
} from "@/lib/features/chat/chatSlice";

export default function SocketGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const dispatch = useAppDispatch();
  const connected = useAppSelector(selectIsConnected);
  const connecting = useAppSelector(selectIsConnecting);
  const error = useAppSelector(selectError);

  useEffect(() => {
    dispatch(connectWebSocket());
  }, [dispatch]);

  if (connecting) return <p style={{ padding: 32 }}>🔌 Connecting…</p>;
  if (error) return <p style={{ color: "red", padding: 32 }}>Error: {error}</p>;
  if (!connected) return <p style={{ padding: 32 }}>🛑 Offline</p>;

  return <>{children}</>;
}
