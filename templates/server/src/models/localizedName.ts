import { Schema } from 'mongoose';

/** `{ ar, en }` text stored in both languages (CLAUDE.md §7). */
export const localizedNameSchema = new Schema(
  {
    ar: { type: String, required: true, trim: true },
    en: { type: String, required: true, trim: true },
  },
  { _id: false },
);
