import { API_URL } from "./config";
import { tg } from "./telegram";

export interface PrayerRequest {
  id: string;
  title: string;
  details: string | null;
  follow_up_days: number | null;
  since_label: string;
  prayer_count: number;
  next_check_in: string | null;
  awaiting_reply: boolean;
}

export interface Stone {
  id: string;
  title: string;
  details: string | null;
  answer_note: string | null;
  answered_label: string;
  since_label: string;
  prayer_count: number;
}

export interface Settings {
  first_name: string | null;
  timezone: string;
  reminder_time: string | null; // "HH:MM"
  nudges_enabled: boolean;
  weekly_summary_enabled: boolean;
}

export interface StudySession {
  id: string;
  minutes: number;
  note: string | null;
  label: string; // "Tue 10 Nov, 9:00 pm"
}

export interface StudySummary {
  days_this_week: number;
  minutes_this_week: number;
  current_streak: number;
  best_streak: number;
  total_minutes: number;
  total_days: number;
  this_week: { date: string; count: number }[]; // count = minutes that day
  recent: StudySession[];
}

export interface Journey {
  today: string; // the user's local date, "YYYY-MM-DD"
  days_this_week: number;
  current_streak: number;
  best_streak: number;
  total_prayers: number;
  total_days: number;
  active_requests: number;
  answered_requests: number;
  calendar: { date: string; count: number }[];
  study: StudySummary;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string) {
    super(code);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(API_URL + path, {
    method,
    headers: { authorization: `tma ${tg?.initData ?? ""}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, (data as { error?: string }).error ?? "error");
  return data as T;
}

export const api = {
  me: () => request<Settings>("GET", "/me"),
  updateSettings: (changes: Partial<Omit<Settings, "first_name">>) => request<Settings>("PATCH", "/me", changes),
  journey: () => request<Journey>("GET", "/journey"),
  requests: () => request<{ requests: PrayerRequest[]; names: string[] }>("GET", "/requests"),
  addRequest: (title: string, details: string | null, follow_up_days: number | null) =>
    request<{ id: string }>("POST", "/requests", { title, details, follow_up_days }),
  editRequest: (id: string, title: string, details: string | null) =>
    request("PATCH", `/requests/${id}`, { title, details }),
  setInterval: (id: string, follow_up_days: number | null) =>
    request<{ next_check_in: string | null }>("POST", `/requests/${id}/interval`, { follow_up_days }),
  prayed: (id: string) => request<{ prayer_count: number }>("POST", `/requests/${id}/prayed`),
  answer: (id: string, note: string | null) => request("POST", `/requests/${id}/answer`, { note }),
  close: (id: string) => request("POST", `/requests/${id}/close`),
  stones: () => request<{ stones: Stone[] }>("GET", "/stones"),
  editStoneNote: (id: string, note: string | null) => request("PATCH", `/stones/${id}`, { note }),
  logStudy: (minutes: number, note: string | null) => request<{ id: string }>("POST", "/study", { minutes, note }),
  editStudy: (id: string, minutes: number, note: string | null) =>
    request("PATCH", `/study/${id}`, { minutes, note }),
  deleteStudy: (id: string) => request("POST", `/study/${id}/delete`),
};
