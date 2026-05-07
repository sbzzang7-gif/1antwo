import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const fmt = (value: number) => Number(value || 0).toLocaleString("ko-KR");

export const pctCalc = (buyPrice: number, currentPrice: number) => {
  if (!buyPrice) return "0.0";
  return (((currentPrice - buyPrice) / buyPrice) * 100).toFixed(1);
};

export const newWithin36Hours = (timestamp?: number) => {
  return Boolean(timestamp && Date.now() - timestamp < 36 * 60 * 60 * 1000);
};

export const escapeStorageName = (name: string) => name.replace(/[#/[\]?*]/g, "_");
