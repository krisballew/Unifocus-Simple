// ICU Message Format Catalogs for i18n
// Supports locale-aware formatting with message parameters

export type SupportedLocale = 'en-US' | 'es-ES';

export const DEFAULT_LOCALE: SupportedLocale = 'en-US';
export const SUPPORTED_LOCALES: SupportedLocale[] = ['en-US', 'es-ES'];

// ICU message catalogs with support for pluralization, gender, and parameters
export const messageCatalogs = {
  'en-US': {
    // Common
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.success': 'Success',

    // Auth
    'auth.login': 'Log In',
    'auth.logout': 'Log Out',
    'auth.welcome': 'Welcome, {name}!',
    'auth.loginRequired': 'Please log in to continue',

    // Time Clock
    'timeclock.punchIn': 'Punch In',
    'timeclock.punchOut': 'Punch Out',
    'timeclock.breakStart': 'Start Break',
    'timeclock.breakEnd': 'End Break',
    'timeclock.lastPunch': 'Last Punch: {time}',
    'timeclock.totalHours': '{count, plural, =0 {No hours} one {1 hour} other {# hours}}',
    'timeclock.scheduleToday': "Today's Schedule",

    // Timecard
    'timecard.title': 'Timecard',
    'timecard.viewFor': 'Timecard for {employeeName}',
    'timecard.weekOf': 'Week of {date, date, long}',
    'timecard.totalHours': 'Total Hours: {hours, number, #.##}',
    'timecard.regularHours': 'Regular: {hours, number, #.##}h',
    'timecard.overtimeHours': 'Overtime: {hours, number, #.##}h',

    // Exceptions
    'exceptions.queue': 'Exceptions Queue',
    'exceptions.pending':
      '{count, plural, =0 {No pending exceptions} one {1 pending exception} other {# pending exceptions}}',
    'exceptions.approve': 'Approve',
    'exceptions.reject': 'Reject',
    'exceptions.approved': 'Exception approved',
    'exceptions.rejected': 'Exception rejected',

    // Settings
    'settings.locale': 'Language',
    'settings.timezone': 'Time Zone',
    'settings.weekStartDay': 'Week Starts On',
    'settings.dateFormat': 'Date Format',
    'settings.currency': 'Currency',
    'settings.saved': 'Settings saved',

    // Days of week
    'day.sunday': 'Sunday',
    'day.monday': 'Monday',
    'day.tuesday': 'Tuesday',
    'day.wednesday': 'Wednesday',
    'day.thursday': 'Thursday',
    'day.friday': 'Friday',
    'day.saturday': 'Saturday',

    // Months
    'month.january': 'January',
    'month.february': 'February',
    'month.march': 'March',
    'month.april': 'April',
    'month.may': 'May',
    'month.june': 'June',
    'month.july': 'July',
    'month.august': 'August',
    'month.september': 'September',
    'month.october': 'October',
    'month.november': 'November',
    'month.december': 'December',

    // Locale names
    'locale.en-US': 'English (US)',
    'locale.es-ES': 'Spanish (Spain)',

    // Week start day options
    'weekStartDay.0': 'Sunday',
    'weekStartDay.1': 'Monday',
    'weekStartDay.2': 'Tuesday',
    'weekStartDay.3': 'Wednesday',
    'weekStartDay.4': 'Thursday',
    'weekStartDay.5': 'Friday',
    'weekStartDay.6': 'Saturday',

    // User preferences
    'preferences.profile': 'Profile',
    'preferences.language': 'Language',
    'preferences.timezone': 'Time Zone',
    'preferences.updated': 'Preferences updated',
  },
  'es-ES': {
    // Common
    'common.save': 'Guardar',
    'common.cancel': 'Cancelar',
    'common.delete': 'Eliminar',
    'common.edit': 'Editar',
    'common.loading': 'Cargando...',
    'common.error': 'Error',
    'common.success': 'Éxito',

    // Auth
    'auth.login': 'Iniciar Sesión',
    'auth.logout': 'Cerrar Sesión',
    'auth.welcome': '¡Bienvenido, {name}!',
    'auth.loginRequired': 'Por favor, inicie sesión para continuar',

    // Time Clock
    'timeclock.punchIn': 'Marcar Entrada',
    'timeclock.punchOut': 'Marcar Salida',
    'timeclock.breakStart': 'Iniciar Descanso',
    'timeclock.breakEnd': 'Terminar Descanso',
    'timeclock.lastPunch': 'Último Registro: {time}',
    'timeclock.totalHours': '{count, plural, =0 {Sin horas} one {1 hora} other {# horas}}',
    'timeclock.scheduleToday': 'Horario de Hoy',

    // Timecard
    'timecard.title': 'Tarjeta de Tiempo',
    'timecard.viewFor': 'Tarjeta de tiempo para {employeeName}',
    'timecard.weekOf': 'Semana del {date, date, long}',
    'timecard.totalHours': 'Horas Totales: {hours, number, #.##}',
    'timecard.regularHours': 'Regulares: {hours, number, #.##}h',
    'timecard.overtimeHours': 'Horas Extra: {hours, number, #.##}h',

    // Exceptions
    'exceptions.queue': 'Cola de Excepciones',
    'exceptions.pending':
      '{count, plural, =0 {Sin excepciones pendientes} one {1 excepción pendiente} other {# excepciones pendientes}}',
    'exceptions.approve': 'Aprobar',
    'exceptions.reject': 'Rechazar',
    'exceptions.approved': 'Excepción aprobada',
    'exceptions.rejected': 'Excepción rechazada',

    // Settings
    'settings.locale': 'Idioma',
    'settings.timezone': 'Zona Horaria',
    'settings.weekStartDay': 'La Semana Comienza el',
    'settings.dateFormat': 'Formato de Fecha',
    'settings.currency': 'Moneda',
    'settings.saved': 'Configuración guardada',

    // Days of week
    'day.sunday': 'Domingo',
    'day.monday': 'Lunes',
    'day.tuesday': 'Martes',
    'day.wednesday': 'Miércoles',
    'day.thursday': 'Jueves',
    'day.friday': 'Viernes',
    'day.saturday': 'Sábado',

    // Months
    'month.january': 'Enero',
    'month.february': 'Febrero',
    'month.march': 'Marzo',
    'month.april': 'Abril',
    'month.may': 'Mayo',
    'month.june': 'Junio',
    'month.july': 'Julio',
    'month.august': 'Agosto',
    'month.september': 'Septiembre',
    'month.october': 'Octubre',
    'month.november': 'Noviembre',
    'month.december': 'Diciembre',

    // Locale names
    'locale.en-US': 'Inglés (EE.UU.)',
    'locale.es-ES': 'Español (España)',

    // Week start day options
    'weekStartDay.0': 'Domingo',
    'weekStartDay.1': 'Lunes',
    'weekStartDay.2': 'Martes',
    'weekStartDay.3': 'Miércoles',
    'weekStartDay.4': 'Jueves',
    'weekStartDay.5': 'Viernes',
    'weekStartDay.6': 'Sábado',

    // User preferences
    'preferences.profile': 'Perfil',
    'preferences.language': 'Idioma',
    'preferences.timezone': 'Zona Horaria',
    'preferences.updated': 'Preferencias actualizadas',
  },
} as const;

export type MessageKey = keyof (typeof messageCatalogs)['en-US'];

export type MessageCatalog = (typeof messageCatalogs)['en-US'];

// Simple ICU message formatter - handles basic variable substitution and plurals
export function formatMessage(
  template: string,
  params?: Record<string, string | number | boolean | Date>
): string {
  if (!params) return template;

  let result = template;

  // Handle plurals: {count, plural, =0 {No items} one {1 item} other {# items}}
  result = result.replace(/\{(\w+),\s*plural,\s*([^}]+)\}/g, (match, varName, pluralRules) => {
    const count = params[varName];
    if (typeof count !== 'number') return match;

    const rules = pluralRules.split(/\s+/);
    let selectedForm = '';

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (rule.startsWith('=')) {
        const num = parseInt(rule.substring(1));
        if (num === count) {
          selectedForm = rules[i + 1]?.replace(/[{}]/g, '') || '';
          break;
        }
      } else if (rule === 'one' && count === 1) {
        selectedForm = rules[i + 1]?.replace(/[{}]/g, '') || '';
        break;
      } else if (rule === 'other') {
        selectedForm = rules[i + 1]?.replace(/[{}]/g, '') || '';
      }
    }

    return selectedForm.replace('#', String(count));
  });

  // Handle dates: {date, date, long}
  result = result.replace(/\{(\w+),\s*date,\s*(\w+)\}/g, (match, varName, style) => {
    const dateVal = params[varName];
    if (!(dateVal instanceof Date || typeof dateVal === 'string' || typeof dateVal === 'number')) {
      return match;
    }
    const date = new Date(dateVal);
    const dateFormatter = new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: style === 'long' ? 'long' : style === 'short' ? 'short' : '2-digit',
      day: '2-digit',
    });
    return dateFormatter.format(date);
  });

  // Handle numbers: {value, number, pattern}
  result = result.replace(/\{(\w+),\s*number,\s*([^}]*)\}/g, (match, varName, pattern) => {
    const numVal = params[varName];
    if (typeof numVal !== 'number') return match;

    if (pattern.includes('#.##')) {
      return numVal.toFixed(2);
    }
    return String(numVal);
  });

  // Handle simple variable substitution: {name}
  result = result.replace(/\{(\w+)\}/g, (match, varName) => {
    return String(params[varName] ?? match);
  });

  return result;
}

// Get message from catalog with variable substitution
export function getMessage(
  locale: SupportedLocale,
  key: MessageKey,
  params?: Record<string, string | number | boolean | Date>
): string {
  const catalog = messageCatalogs[locale];
  const template = catalog[key as keyof typeof catalog] as string | undefined;

  if (!template) {
    console.warn(`Missing translation for key: ${key} in locale: ${locale}`);
    return key;
  }

  return formatMessage(template, params as Record<string, string | number | boolean>);
}

// Export all catalogs for reference
export { messageCatalogs as translationCatalogs };

// Export Intl utilities and types
export * from './intl';
