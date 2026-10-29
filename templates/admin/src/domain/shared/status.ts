import {
  STATUS_TONES,
  UNKNOWN_STATUS_TONE,
  type StatusKind,
  type StatusTone,
} from '@/constants/status';

const TONES: Readonly<Record<string, Readonly<Record<string, StatusTone>>>> = STATUS_TONES;

/** Tone of `value` for the enum `kind`; unknown values get the neutral tone. */
export const toneOf = (kind: StatusKind, value: string): StatusTone =>
  TONES[kind]?.[value] ?? UNKNOWN_STATUS_TONE;

export const isKnownStatus = (kind: StatusKind, value: string): boolean =>
  TONES[kind]?.[value] !== undefined;

export const statusValues = (kind: StatusKind): string[] => Object.keys(TONES[kind] ?? {});
