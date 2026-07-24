import { createContext, useContext, ReactNode } from "react";
import { useNotifications } from "@/hooks/useNotifications";
import { useUnreadCounts, UnreadCounts } from "@/hooks/useUnreadCounts";
import { usePushSubscription } from "@/hooks/usePushSubscription";

type NotificationContextType = ReturnType<typeof useNotifications> & {
  unreadCounts: UnreadCounts;
  totalUnreadPersistent: number;
  refetchUnreads: () => Promise<void>;
  subscribeToPush: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType>({
  unreadMessages: 0,
  unreadFriendRequests: 0,
  totalUnread: 0,
  latestMessageSource: null,
  pendingBanner: null,
  dmUnreads: {},
  clearUnreadMessages: () => {},
  clearUnreadFriendRequests: () => {},
  clearLatestMessageSource: () => {},
  clearDmUnread: () => {},
  dismissBanner: () => {},
  setCurrentRoom: () => {},
  requestPermission: async () => false,
  permissionGranted: false,
  unreadCounts: {},
  totalUnreadPersistent: 0,
  refetchUnreads: async () => {},
  subscribeToPush: async () => {},
});

export const useNotificationContext = () => useContext(NotificationContext);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const notifications = useNotifications();
  const { unreadCounts, totalUnreadPersistent, refetchUnreads } = useUnreadCounts();
  const { subscribeToPush } = usePushSubscription();
  return (
    <NotificationContext.Provider value={{ ...notifications, unreadCounts, totalUnreadPersistent, refetchUnreads, subscribeToPush }}>
      {children}
    </NotificationContext.Provider>
  );
}