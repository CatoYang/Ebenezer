// Thin typed wrapper around Telegram's Mini App script (window.Telegram.WebApp), loaded in index.html.
// https://core.telegram.org/bots/webapps

import { useEffect, useRef } from "react";

interface BottomButton {
  setText(text: string): void;
  show(): void;
  hide(): void;
  enable(): void;
  disable(): void;
  showProgress(leaveActive?: boolean): void;
  hideProgress(): void;
  onClick(cb: () => void): void;
  offClick(cb: () => void): void;
}

interface WebApp {
  initData: string;
  platform: string;
  colorScheme: "light" | "dark";
  ready(): void;
  expand(): void;
  onEvent(event: "themeChanged", cb: () => void): void;
  offEvent(event: "themeChanged", cb: () => void): void;
  showConfirm(message: string, cb: (ok: boolean) => void): void;
  showAlert(message: string, cb?: () => void): void;
  MainButton: BottomButton;
  BackButton: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
  HapticFeedback: {
    impactOccurred(style: "light" | "medium" | "heavy"): void;
    notificationOccurred(type: "success" | "error" | "warning"): void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp: WebApp };
  }
}

export const tg: WebApp | undefined = window.Telegram?.WebApp;

/** True when opened from Telegram (signed launch data present), false in a normal browser. */
export const inTelegram = Boolean(tg?.initData);

export const platform = (): "ios" | "base" => (tg && ["ios", "macos"].includes(tg.platform) ? "ios" : "base");

export const confirm = (message: string) =>
  new Promise<boolean>((resolve) => (tg ? tg.showConfirm(message, resolve) : resolve(window.confirm(message))));

export const haptic = {
  success: () => tg?.HapticFeedback.notificationOccurred("success"),
  error: () => tg?.HapticFeedback.notificationOccurred("error"),
  tap: () => tg?.HapticFeedback.impactOccurred("light"),
};

/** Shows Telegram's Back button while `onBack` is set. */
export function useBackButton(onBack: (() => void) | null) {
  const ref = useRef(onBack);
  ref.current = onBack;
  const active = onBack !== null;
  useEffect(() => {
    if (!tg || !active) return;
    const handler = () => ref.current?.();
    tg.BackButton.onClick(handler);
    tg.BackButton.show();
    return () => {
      tg.BackButton.offClick(handler);
      tg.BackButton.hide();
    };
  }, [active]);
}

/** Shows Telegram's big bottom button while `options` is set. */
export function useMainButton(options: { text: string; onClick: () => void; enabled?: boolean; loading?: boolean } | null) {
  const ref = useRef(options?.onClick);
  ref.current = options?.onClick;
  const visible = options !== null;
  useEffect(() => {
    if (!tg || !visible) return;
    const handler = () => ref.current?.();
    tg.MainButton.onClick(handler);
    tg.MainButton.show();
    return () => {
      tg.MainButton.offClick(handler);
      tg.MainButton.hide();
      tg.MainButton.hideProgress();
    };
  }, [visible]);
  useEffect(() => {
    if (!tg || !options) return;
    tg.MainButton.setText(options.text);
    if (options.enabled === false) tg.MainButton.disable();
    else tg.MainButton.enable();
    if (options.loading) tg.MainButton.showProgress(false);
    else tg.MainButton.hideProgress();
  }, [options?.text, options?.enabled, options?.loading]);
}
