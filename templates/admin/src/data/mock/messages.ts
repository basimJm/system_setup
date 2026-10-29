import type { Language } from '@/constants/i18n';

/** Server-style localized messages the mock sends (the real server localizes by Accept-Language too). */
const MESSAGES: Record<Language, Record<string, string>> = {
  ar: {
    ok: 'تمت العملية بنجاح',
    field: 'القيمة غير صالحة',
    validation: 'بيانات غير صالحة',
    unauthorized: 'انتهت الجلسة',
    forbidden: 'لا تملك الصلاحية',
    notFound: 'غير موجود',
    conflict: 'تعارض مع بيانات أخرى',
    unprocessable: 'لا يمكن تنفيذ العملية',
    serverError: 'حدث خطأ في الخادم',
  },
  en: {
    ok: 'Done',
    field: 'This value is not valid',
    validation: 'Invalid data',
    unauthorized: 'Session expired',
    forbidden: 'You do not have permission',
    notFound: 'Not found',
    conflict: 'Conflicts with other data',
    unprocessable: 'The action cannot be completed',
    serverError: 'Server error',
  },
};

export const mockMessage = (language: Language, key: string): string =>
  MESSAGES[language][key] ?? MESSAGES.en.ok ?? key;
