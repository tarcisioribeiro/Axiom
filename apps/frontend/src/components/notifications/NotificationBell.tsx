import { Bell, CheckCheck } from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotificationsStore } from '@/stores/notifications-store';

import { NotificationItem } from './NotificationItem';

export function NotificationBell() {
  const { t } = useTranslation();
  const {
    notifications,
    unreadCount,
    isLoading,
    isDropdownOpen,
    setDropdownOpen,
    markAsRead,
    markAllAsRead,
    startPolling,
    stopPolling,
  } = useNotificationsStore();

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  return (
    <Popover open={isDropdownOpen} onOpenChange={setDropdownOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="hover-lift hover:bg-secondary relative transition"
          aria-label={t('layout.notifications.ariaLabel')}
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unreadCount > 0 && (
            <span className="bg-destructive px-xs text-primary-foreground text-2xs absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full font-bold">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(calc(100vw-1rem),26rem)] p-0"
        sideOffset={8}
      >
        <div className="flex items-center justify-between border-b p-3">
          <h4 className="text-sm font-semibold">{t('layout.notifications.title')}</h4>
          {unreadCount > 0 && (
            <Button variant="ghost" size="xs" onClick={markAllAsRead}>
              <CheckCheck className="mr-xs h-3 w-3" />
              {t('layout.notifications.markAllRead')}
            </Button>
          )}
        </div>

        <ScrollArea className="h-80 max-h-80">
          {isLoading ? (
            <div className="p-md text-muted-foreground text-center text-sm">
              {t('common.actions.loading')}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-md text-muted-foreground text-center text-sm">
              {t('layout.notifications.empty')}
            </div>
          ) : (
            <div className="divide-border py-xs flex flex-col divide-y">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={markAsRead}
                />
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
