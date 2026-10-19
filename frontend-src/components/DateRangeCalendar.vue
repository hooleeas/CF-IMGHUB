const DAY_MS = 24 * 60 * 60 * 1000;
function padDatePart(value) {
  return String(value).padStart(2, '0');
}
function formatDateKey(date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}
function parseDateKey(value) {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
    return null;
  }
  date.setHours(0, 0, 0, 0);
  return date;
}
function shiftMonth(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}
export default {
  name: 'DateRangeCalendar',
  props: {
    modelValue: {
      type: Array,
      default: () => []
    }
  },
  emits: ['update:modelValue', 'change'],
  data() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return {
      displayYear: today.getFullYear(),
      displayMonth: today.getMonth(),
      draftStart: '',
      draftEnd: '',
      inputStart: '',
      inputEnd: '',
      awaitingEnd: false
    };
  },
  computed: {
    previousMonthLabel() {
      return this.$t('dateRangeCalendar.previousMonth');
    },
    nextMonthLabel() {
      return this.$t('dateRangeCalendar.nextMonth');
    },
    startDateLabel() {
      return this.$t('dateRangeCalendar.startDate');
    },
    endDateLabel() {
      return this.$t('dateRangeCalendar.endDate');
    },
    rangeSeparator() {
      return this.$t('dateRangeCalendar.rangeSeparator');
    },
    monthTitle() {
      return this.$t('dateRangeCalendar.monthTitle', {
        year: this.displayYear,
        month: padDatePart(this.displayMonth + 1)
      });
    },
    weekdayLabels() {
      return [this.$t('dateRangeCalendar.weekdaySun'), this.$t('dateRangeCalendar.weekdayMon'), this.$t('dateRangeCalendar.weekdayTue'), this.$t('dateRangeCalendar.weekdayWed'), this.$t('dateRangeCalendar.weekdayThu'), this.$t('dateRangeCalendar.weekdayFri'), this.$t('dateRangeCalendar.weekdaySat')];
    },
    calendarDays() {
      const monthStart = new Date(this.displayYear, this.displayMonth, 1);
      const start = new Date(this.displayYear, this.displayMonth, 1 - monthStart.getDay());
      const todayKey = formatDateKey(new Date());
      return Array.from({
        length: 42
      }, (_, index) => {
        const date = new Date(start.getTime() + index * DAY_MS);
        const key = formatDateKey(date);
        return {
          key,
          dayOfMonth: date.getDate(),
          isCurrentMonth: date.getMonth() === this.displayMonth,
          isToday: key === todayKey
        };
      });
    }
  },
  watch: {
    modelValue: {
      immediate: true,
      handler(value) {
        this.syncFromModel(value);
      }
    }
  },
  methods: {
    syncFromModel(value) {
      const startDate = parseDateKey(value?.[0]);
      const endDate = parseDateKey(value?.[1]);
      this.draftStart = startDate ? formatDateKey(startDate) : '';
      this.draftEnd = endDate ? formatDateKey(endDate) : '';
      this.inputStart = this.draftStart;
      this.inputEnd = this.draftEnd;
      this.awaitingEnd = false;
      const displayDate = startDate || endDate;
      if (displayDate) {
        this.displayYear = displayDate.getFullYear();
        this.displayMonth = displayDate.getMonth();
      }
    },
    goToPreviousMonth() {
      const date = shiftMonth(new Date(this.displayYear, this.displayMonth, 1), -1);
      this.displayYear = date.getFullYear();
      this.displayMonth = date.getMonth();
    },
    goToNextMonth() {
      const date = shiftMonth(new Date(this.displayYear, this.displayMonth, 1), 1);
      this.displayYear = date.getFullYear();
      this.displayMonth = date.getMonth();
    },
    selectDay(key) {
      if (!this.draftStart || this.draftEnd || !this.awaitingEnd) {
        this.draftStart = key;
        this.draftEnd = '';
        this.inputStart = key;
        this.inputEnd = '';
        this.awaitingEnd = true;
        return;
      }
      const range = key < this.draftStart ? [key, this.draftStart] : [this.draftStart, key];
      this.draftStart = range[0];
      this.draftEnd = range[1];
      this.inputStart = range[0];
      this.inputEnd = range[1];
      this.awaitingEnd = false;
      this.commitRange(range);
    },
    handleManualInput() {
      const startDate = parseDateKey(this.inputStart);
      const endDate = parseDateKey(this.inputEnd);
      if (!startDate || !endDate) return;
      const startKey = formatDateKey(startDate);
      const endKey = formatDateKey(endDate);
      const range = startKey <= endKey ? [startKey, endKey] : [endKey, startKey];
      this.draftStart = range[0];
      this.draftEnd = range[1];
      this.inputStart = range[0];
      this.inputEnd = range[1];
      this.awaitingEnd = false;
      this.displayYear = startDate.getFullYear();
      this.displayMonth = startDate.getMonth();
      this.commitRange(range);
    },
    commitRange(range) {
      this.$emit('update:modelValue', range);
      this.$emit('change', range);
    },
    isInRange(key) {
      return Boolean(this.draftStart && this.draftEnd && key > this.draftStart && key < this.draftEnd);
    }
  }
};